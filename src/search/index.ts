import { search } from "@orama/orama";
import getBlogDB from "./blog";

export const blogDB = await getBlogDB();

export default async function (term: string) {
  const result = [];

  for (let db of [blogDB]) {
    const searchResults = await search(db.instance, {
      term: term.toLowerCase(), // 検索クエリを小文字に変換
      ...db.params,
    });

    // 部分一致を手動でフィルタリング
    const filteredResults = searchResults.hits.filter((hit) =>
      hit.document.title.toLowerCase().includes(term.toLowerCase())
    );

    result.push({
      id: db.instance.id,
      output: filteredResults,
    });
  }

  // 結果をソートして返す
  return result
    .map((r) => r.output)
    .flat()
    .sort((a, b) => b.score - a.score);
}
