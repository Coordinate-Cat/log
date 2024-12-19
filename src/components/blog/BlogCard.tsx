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
    <a href={slug} className="w-full text-white no-underline hover:text-white">
      <div className="m-0 flex">
        <div className="m-0 w-fit truncate border-b-2 border-white bg-none p-1 leading-tight">
          {title}
        </div>
        <div className="m-0 flex-1 bg-white"></div>
      </div>
      <div className="m-0 flex">
        <p className="bold m-0 w-fit text-nowrap border-r-2 border-white p-1 pr-2 italic">
          {getFormattedDate(date)}
        </p>
        <div className="m-0 w-full bg-white"></div>
      </div>
      <div className="m-0 flex">
        <p className="mb-0 w-fit truncate border-t-2 border-white p-1">
          {description}
        </p>
        <div className="m-0 flex-1 bg-white"></div>
      </div>
    </a>
  );
};
