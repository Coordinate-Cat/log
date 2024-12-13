import { create, insert } from "@orama/orama";
import { posts } from "../content";

export default async function fill() {
  const blogDB = await create({
    id: "blog",
    schema: {
      title: "string",
      date: "string",
      tags: "string[]",
      description: "string",
      url: "string",
    } as const,
  });

  for (const post of posts) {
    await insert(blogDB, {
      title: post.frontmatter.title,
      date: post.frontmatter.date,
      tags: post.frontmatter.tags,
      description: post.frontmatter.description,
      url: "/blog/" + post.file!.split("blog/").pop()!.split(".md")[0],
    });
  }
  return {
    instance: blogDB,
    params: {
      tolerance: 1,
      limit: 5,
      boost: {
        title: 5,
        content: 0.1,
      },
      match: "partial", // 部分一致を有効にする
    },
  };
}
