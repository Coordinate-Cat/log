// tailwind.config.cjs
export default {
  content: [
    "./src/**/*.{astro,html,js,ts,jsx,tsx}", // Astroのコンポーネントやページファイルをターゲットにする
  ],
  theme: {
    extend: {
      fontFamily: {
        jetbrains: ["JetBrainsMono", "monospace"],
      },
    },
  },
  plugins: [],
};
