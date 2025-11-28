import { NextResponse } from 'next/server';
import GraphRunner from '@/lib/graphRunner';

// キャッシュされないように動的レンダリングを強制
export const dynamic = 'force-dynamic';

export async function GET() {
  const runner = GraphRunner.getInstance();

  await runner.waitForReady();
  
  return NextResponse.json({ ready: true });
}