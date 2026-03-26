# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server (with --host)
npm run build     # Production build
npm run preview   # Preview production build
npm run lint      # ESLint all files
```

No test framework is configured.

## Architecture

Astro 5 static blog deployed at https://ocat.vercel.app. React is used only for interactive components (hydrated with `client:load`). TypeScript strict mode throughout.

### Content Pipeline

1. Blog posts live in `src/content/post/*.md` (Astro Content Collections)
2. Posts are statically rendered via `src/pages/blog/[slug].astro`
3. The homepage (`src/pages/index.astro`) uses `PostFilter.tsx` (React) for client-side tag filtering
4. OG images are auto-generated per post at `/og/{slug}.png`

### Adding a Blog Post

Create `src/content/post/NN_slug.md` with required frontmatter:

```yaml
---
title: "Title"
description: "Meta description"
date: YYYY-MM-DD
tags: ["Tag1", "Tag2"]
---
```

Also add an entry to `src/data/blog-titles.json`:

```json
{ "title": "Display Title", "url": "slug-without-extension" }
```

### Key Files

| Path | Role |
|------|------|
| `src/content/config.ts` | Content collection schema (title, date, tags, description all required) |
| `src/utils/blog.ts` | `fetchCollection()` — loads all posts |
| `src/layouts/PostLayout.astro` | Blog post page template |
| `src/layouts/DefaultLayout.astro` | Global shell (Navbar, SEO, ClientRouter) |
| `src/data/blog-titles.json` | Manually curated post index used by PostFilter |
| `src/types/types.ts` | `Post` type definition |
