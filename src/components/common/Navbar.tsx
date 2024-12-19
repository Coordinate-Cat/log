import React, { useState, useEffect } from "react";
import blogTitles from "../../data/blog-titles.json";
import "../../global.css";

const Navbar = () => {
  const [searchTerm, setSearchTerm] = useState("");
  const [filteredTitles, setFilteredTitles] = useState(blogTitles);

  useEffect(() => {
    console.log(blogTitles); // blogTitles の内容を確認
    const results = blogTitles.filter((blog) =>
      blog.title.toLowerCase().includes(searchTerm.toLowerCase())
    );
    console.log(results); // フィルタリング結果を確認
    setFilteredTitles(results);
  }, [searchTerm]);

  const handleSearchChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(event.target.value);
  };

  return (
    <nav className="" role="navigation" aria-label="main navigation">
      <a href="/" className="text-white no-underline h">
        <h1 className="m-0">log</h1>
      </a>
    </nav>
  );
};

export default Navbar;
