import { NextResponse } from 'next/server';
import GraphRunner from '@/lib/graphRunner';
import { getDb } from '@/lib/db';

const TOP_RESULT_LIMIT = 100;

const resolveUserKey = (req: Request) => {
  const forwarded = req.headers.get('x-forwarded-host');
  if (forwarded && forwarded.trim().length > 0) {
    return forwarded.toLowerCase();
  }
  const host = req.headers.get('host');
  return (host && host.trim().length > 0) ? host.toLowerCase() : 'default';
};

async function respondWithTopNodes(rawResult: unknown) {
  if (!Array.isArray(rawResult)) {
    return null;
  }

  const limitedResult = rawResult.slice(0, TOP_RESULT_LIMIT);
  if (limitedResult.length === 0) {
    return NextResponse.json({ status: 'ok', top_nodes: [] });
  }

  const db = await getDb();
  const ids = limitedResult.map((r: any) => r.id);
  const placeholders = ids.map(() => '?').join(',');
  const rows = await db.all(
    `SELECT id, name, title_ja, ranking FROM nodes WHERE id IN (${placeholders})`,
    ids
  );
  const idToMeta = new Map<number, { name: string; title_ja: string | null; ranking: number | null }>();
  rows.forEach((r: any) =>
    idToMeta.set(r.id, {
      name: r.name,
      title_ja: typeof r.title_ja === 'string' ? r.title_ja : null,
      ranking: typeof r.ranking === 'number' ? r.ranking : null,
    })
  );

  const top_nodes = limitedResult.map((r: any) => ({
    id: r.id,
    name: idToMeta.get(r.id)?.name ?? String(r.id),
    title_ja: idToMeta.get(r.id)?.title_ja ?? null,
    score: r.score,
    ranking: idToMeta.get(r.id)?.ranking ?? null,
  }));

  return NextResponse.json({ status: 'ok', top_nodes });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const runner = GraphRunner.getInstance();
    const userKey = resolveUserKey(req);

    // ------------------------------------------
    // パターンA: パラメータ調整 (Stage 2)
    // ------------------------------------------
    if (typeof body.c === 'number') {
      // Clamp incoming C to avoid exact -1/+1 values which may cause
      // edge behavior in the C++ adjustment logic.
      const CLAMP_MAX = 0.9999;
      const clampC = (v: number) => Math.max(-CLAMP_MAX, Math.min(CLAMP_MAX, v));
      const cValue = Number.isFinite(body.c) ? clampC(body.c) : 0;

      const result = await runner.execute({
        type: "adjust",
        c: cValue,
        userKey
      });
      const normalizedResponse = await respondWithTopNodes(result);
      if (normalizedResponse) {
        return normalizedResponse;
      }

      return NextResponse.json(result);
    }

    // ------------------------------------------
    // パターンB: 新規解析 (Stage 1)
    // ------------------------------------------
    else if (Array.isArray(body.items) && body.items.length > 0) {
      const { items } = body; // [{name: "A", weight: 1.0}, ...]
      const locale = body.locale === 'ja' ? 'ja' : 'en';
      const blacklistIds: number[] = Array.isArray(body.blacklistIds)
        ? Array.from(
            new Set(
              body.blacklistIds
                .map((value: unknown) => (typeof value === 'number' ? value : Number(value)))
                .filter((value: number) => Number.isInteger(value))
            )
          )
        : [];
      
      const db = await getDb();
      const nodeNames = items.map((i: any) => i.name);
      const lookupColumn = locale === 'ja' ? 'COALESCE(title_ja, name)' : 'name';
      
      // 名前 -> ID 一括変換
      const placeholders = nodeNames.map(() => '?').join(',');
      const rows = await db.all(
        `SELECT id, name, title_ja FROM nodes WHERE ${lookupColumn} IN (${placeholders})`,
        nodeNames
      );

      // マップ作成 (Name -> ID)
      const nameToId = new Map<string, number>();
      rows.forEach((r: any) => {
        const key = locale === 'ja' ? (r.title_ja ?? r.name) : r.name;
        nameToId.set(key, r.id);
      });

      // C++送信用リスト作成
      const queryList = [];
      for (const item of items) {
        if (nameToId.has(item.name)) {
          queryList.push({
            id: nameToId.get(item.name),
            w: Number(item.weight)
          });
        }
      }

      for (const id of blacklistIds) {
        queryList.push({ id, w: 0 });
      }

      if (queryList.length === 0) {
        return NextResponse.json({ error: 'Valid nodes not found' }, { status: 404 });
      }

      const result = await runner.execute({
        type: "analyze",
        queries: queryList,
        userKey
      });
      const normalizedResponse = await respondWithTopNodes(result);
      if (normalizedResponse) {
        return normalizedResponse;
      }

      return NextResponse.json(result);
    }

    return NextResponse.json({ error: 'Invalid Parameters' }, { status: 400 });

  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}