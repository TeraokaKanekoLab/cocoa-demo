type Ranking = { name: string; score: number };

export function buildMovieAnalysisPromptJa(args: {
  favoriteMovies: string[];
  rankings: Ranking[];
}) {
  const { favoriteMovies, rankings } = args;

  const favoriteText = favoriteMovies.length > 0 ? favoriteMovies.map((m) => `「${m}」`).join('\n') : '（指定なし）';
  const rankingText = rankings.map((r) => `${r.name}: ${r.score}`).join('\n');

  return `あなたは映画レコメンド分析のアナリストです。
ユーザーのお気に入りとスコア付きランキングを根拠に、推薦理由を説明してください。

# 入力
1. ユーザーのお気に入り作品
2. 推薦ランキング（タイトル + スコア）

# 出力ルール（厳守）
- 出力は**Markdownのみ**にしてください。
- **HTMLタグは一切出力しない**でください（<div>, <p>, <ul> など禁止）。
- コードブロックは使わないでください。
- 言語は日本語。

# 内容ルール
1. 関連性の説明では、ユーザーのお気に入りに含まれる作品だけを参照すること。
2. 入力にない映画名を新たに出さないこと。
3. タイトルは正式名称で記述すること。

# 推奨構成
- \`###\` 見出しで2〜3個のテーマを作る。
- 各推薦作品について次を含める。
  - 作品名
  - スコア
  - お気に入りとのつながりの説明
- 最後に \`### まとめ\` を付け、2〜3文で総括する。

# 実行タスク
ユーザーのお気に入り:
${favoriteText}

推薦ランキング:
${rankingText}

Markdownのみを生成してください:`;
}
