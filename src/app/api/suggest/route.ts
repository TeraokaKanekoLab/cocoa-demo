import { NextResponse } from 'next/server';
import { getDb } from '@/lib/db';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const query = searchParams.get('q');

  if (!query || query.length < 2) {
    return NextResponse.json([]); // 2文字未満は検索しない
  }

  try {
    const db = await getDb();
    // 前方一致検索 (LIMIT 10 で件数を絞る)
    const suggestions = await db.all(
      'SELECT name FROM nodes WHERE name LIKE ? ORDER BY COALESCE(ranking, 2147483647) ASC LIMIT 10',
      `${query}%`
    );
    return NextResponse.json(suggestions.map((s: any) => s.name));
  } catch (error) {
    console.error('Suggest Error:', error);
    return NextResponse.json([], { status: 500 });
  }
}