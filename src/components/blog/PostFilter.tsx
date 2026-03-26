import React, { useState, useEffect } from "react";
import { BlogCard } from "./BlogCard";

type PostData = {
  title: string;
  date: string;
  description: string;
  tags: string[];
  slug: string;
};

interface Props {
  posts: PostData[];
}

export const PostFilter: React.FC<Props> = ({ posts }) => {
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    const tag = new URLSearchParams(window.location.search).get("tag");
    if (tag) setActiveTag(tag);

    const handler = () => {
      const t = new URLSearchParams(window.location.search).get("tag");
      setActiveTag(t);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  const allTags = Array.from(new Set(posts.flatMap((p) => p.tags))).sort();

  const handleTagClick = (tag: string) => {
    const next = activeTag === tag ? null : tag;
    setActiveTag(next);
    const url = new URL(window.location.href);
    if (next) {
      url.searchParams.set("tag", next);
    } else {
      url.searchParams.delete("tag");
    }
    window.history.pushState({}, "", url.toString());
  };

  const filtered = activeTag
    ? posts.filter((p) => p.tags.includes(activeTag))
    : posts;

  return (
    <>
      <div className="mb-2 flex flex-wrap gap-1">
        {allTags.map((tag) => (
          <button
            key={tag}
            onClick={() => handleTagClick(tag)}
            className={`h-auto cursor-pointer border-2 border-white px-2 py-0.5 font-jetbrains text-sm ${
              activeTag === tag
                ? "bg-white text-black hover:bg-white hover:text-black"
                : "bg-transparent text-white hover:text-white"
            }`}
          >
            {tag}
          </button>
        ))}
      </div>
      {filtered.map((post) => (
        <div
          key={post.slug}
          className="m-0 mt-2 flex h-fit border-2 border-white"
        >
          <BlogCard
            title={post.title}
            date={new Date(post.date)}
            tags={post.tags}
            description={post.description}
            slug={"/blog/" + post.slug}
          />
        </div>
      ))}
    </>
  );
};
