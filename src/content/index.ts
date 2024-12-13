import blogTitles from "../data/blog-titles.json";

export const posts = await Promise.all(
  blogTitles.map((title) => import(`./post/${title.url}`))
);

export { blogTitles };
