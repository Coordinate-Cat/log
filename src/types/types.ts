
export type Post = {
  data: {
    title: string;
    date: string;
    description: string;
    devLink?: string;
  };
  slug: string;
};