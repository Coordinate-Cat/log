import React from "react";
import "../../global.css";

export const Navbar = () => {
  return (
    <div className="mt-4" role="navigation" aria-label="main navigation">
      <a href={"/"} className="text-white no-underline">
        <h1 className="m-0">log</h1>
      </a>
    </div>
  );
};
