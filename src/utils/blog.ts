import { getCollection } from "astro:content";
import type { Post } from "../types/types"; // Post型をインポート

export const fetchCollection = async (): Promise<Post[]> =>
  (await getCollection("post")) as unknown as Post[];

async function getStaticPaths() {
  const posts: Post[] = await fetchCollection();

  return posts.map((post: Post) => {
    return {
      params: {
        slug: post.slug,
      },
      props: {
        post,
      },
    };
  });
}

export function getPaths() {
  return getStaticPaths();
}
