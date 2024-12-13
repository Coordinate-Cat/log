// tailwind.config.cjs
module.exports = {
  content: [
    "./src/**/*.{astro,html,js,ts,jsx,tsx}", // Astroのコンポーネントやページファイルをターゲットにする
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
      },
    },
  },
  plugins: [],
};
