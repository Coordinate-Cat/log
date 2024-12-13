// tailwind.config.cjs
export default {
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
