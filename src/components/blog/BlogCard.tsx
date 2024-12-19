import React from "react";
import { getFormattedDate } from "../../utils/utils";

interface Props {
  title: string;
  date: Date;
  tags: string[];
  description: string;
  slug?: string;
}

export const BlogCard: React.FC<Props> = ({
  title,
  date,
  tags,
  description,
  slug,
}) => {
  return (
    <a href={slug} className="w-full text-white no-underline">
      <h2 className="m-0 truncate font-black leading-tight sm:text-lg md:text-xl lg:text-2xl">
        {title}
      </h2>
      <p className="bold m-0 mr-2 truncate italic">{getFormattedDate(date)}</p>
      <p className="mb-0 truncate">{description}</p>
    </a>
  );
};
