import type { APIRoute } from "astro";
import { fetchCollection } from "../../utils/blog";
import satori from "satori";
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

export async function getStaticPaths() {
  const posts = await fetchCollection();
  return posts.map((post) => ({
    params: { slug: post.slug },
    props: { title: post.data.title, tags: post.data.tags },
  }));
}

// Cache font buffers across requests
let jetbrainsFont: ArrayBuffer | null = null;
let notoFont: ArrayBuffer | null = null;

async function loadFonts() {
  if (!jetbrainsFont) {
    const fontPath = path.resolve("public/fonts/JetBrainsMono-Bold.ttf");
    jetbrainsFont = fs.readFileSync(fontPath).buffer as ArrayBuffer;
  }
  if (!notoFont) {
    // Fetch Noto Sans JP woff for Japanese glyph support (satori does not support woff2)
    const res = await fetch(
      "https://fonts.bunny.net/noto-sans-jp/files/noto-sans-jp-japanese-400-normal.woff"
    );
    notoFont = await res.arrayBuffer();
  }
  return { jetbrainsFont: jetbrainsFont!, notoFont: notoFont! };
}

export const GET: APIRoute = async ({ props }) => {
  const { title, tags } = props as { title: string; tags: string[] };
  const { jetbrainsFont, notoFont } = await loadFonts();

  // Build the SVG via satori using plain object (hyperscript-like) notation
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const node: any = {
    type: "div",
    props: {
      style: {
        width: "1200px",
        height: "630px",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "#000000",
        backgroundImage:
          "linear-gradient(#1d1d1d 1px, transparent 1px), linear-gradient(to right, #1d1d1d 1px, #000000 1px)",
        backgroundSize: "20px 20px",
        padding: "60px",
        fontFamily: '"NotoSansJP", "JetBrainsMono"',
      },
      children: [
        // Top accent bar
        {
          type: "div",
          props: {
            style: {
              width: "80px",
              height: "4px",
              backgroundColor: "#00ff3c",
              marginBottom: "40px",
            },
            children: null,
          },
        },
        // Title
        {
          type: "div",
          props: {
            style: {
              flex: 1,
              display: "flex",
              alignItems: "center",
            },
            children: [
              {
                type: "p",
                props: {
                  style: {
                    fontSize: title.length > 40 ? "44px" : "56px",
                    fontWeight: "bold",
                    color: "#ffffff",
                    lineHeight: "1.35",
                    margin: "0",
                    letterSpacing: "-0.01em",
                    maxWidth: "1000px",
                  },
                  children: title,
                },
              },
            ],
          },
        },
        // Footer row: tags + site name
        {
          type: "div",
          props: {
            style: {
              display: "flex",
              justifyContent: "space-between",
              alignItems: "flex-end",
              marginTop: "32px",
            },
            children: [
              // Tags
              {
                type: "div",
                props: {
                  style: {
                    display: "flex",
                    gap: "12px",
                  },
                  children: tags.slice(0, 4).map((tag) => ({
                    type: "div",
                    props: {
                      style: {
                        border: "2px solid #ffffff",
                        color: "#ffffff",
                        fontSize: "22px",
                        fontWeight: "600",
                        padding: "4px 12px",
                        fontFamily: '"JetBrainsMono"',
                      },
                      children: tag,
                    },
                  })),
                },
              },
              // Site name
              {
                type: "p",
                props: {
                  style: {
                    fontSize: "32px",
                    fontWeight: "bold",
                    color: "#00ff3c",
                    margin: "0",
                    fontFamily: '"JetBrainsMono"',
                    letterSpacing: "0.05em",
                  },
                  children: "log",
                },
              },
            ],
          },
        },
      ],
    },
  };
  const svg = await satori(node, {
    width: 1200,
    height: 630,
    fonts: [
      {
        name: "JetBrainsMono",
        data: jetbrainsFont,
        weight: 700,
        style: "normal",
      },
      {
        name: "NotoSansJP",
        data: notoFont,
        weight: 400,
        style: "normal",
      },
    ],
  });

  const png = await sharp(Buffer.from(svg)).png().toBuffer();

  return new Response(new Uint8Array(png), {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
};
