export type Post = {
  data: {
    title: string;
    date: string;
    description: string;
    devLink?: string;
    tags?: string[];
  };
  slug: string;
};
