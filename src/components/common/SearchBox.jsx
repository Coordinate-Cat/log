import React, { useState, useEffect } from "react";
import blogTitles from "../../data/blog-titles.json"; // ブログのタイトルデータをインポート

const SearchBox = () => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);

  useEffect(() => {
    if (query) {
      const filteredResults = blogTitles.filter((title) =>
        title.title.toLowerCase().includes(query.toLowerCase())
      );
      setResults(filteredResults);
    } else {
      setResults([]);
    }
  }, [query]);

  const handleSearch = (event) => {
    setQuery(event.target.value);
  };

  return (
    <div className="relative">
      <input
        type="text"
        placeholder="Search..."
        value={query}
        onChange={handleSearch}
        className="border-2 border-black px-4 py-1 w-full focus:outline-none"
      />
      {query && (
        <ul className="absolute left-0 right-0 mt-2 bg-white border-black border-2 shadow-lg z-10">
          {results.length > 0 ? (
            results.map((result, index) => (
              <li key={index} className="list-none m-0">
                <a
                  class="font-semibold text-black p-1 hover:text-red-500"
                  href={`/blog/${result.url}`}
                >
                  {result.title}
                </a>
              </li>
            ))
          ) : (
            <li className="py-1 px-4 text-gray-500">No results found</li>
          )}
        </ul>
      )}
    </div>
  );
};

export default SearchBox;
