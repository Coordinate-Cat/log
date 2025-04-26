---
title: "React Colocation Pattern Design and Operation Guide"
description: This article completely explains the colocation pattern design and operation guide for React components in Next.js App Router.
date: 2025-04-26
tags: ["React", "ColocationPattern", "Nextjs"]
---

# React Colocation Pattern Design and Operation Guide

In the Next.js App Router (`src/app/`) structure,  
we have introduced a **colocation design** to safely manage components on a per-page basis.  
Additionally, we use **eslint-plugin-import-access** to achieve **safe import management**.

This article completely explains **directory structure**, **rule list**, **code examples**, and **lazy/Suspense operations**.

# Project Directory Structure

## Overall Structure

```plaintext
src/
  ├── app/
  │   ├── (colocation)/         // Logical group, does not affect URL path
  │   │   ├── colocation-a/      // Page directory
  │   │   │   ├── _components/   // Page-specific components
  │   │   │   │   ├── index.ts   // Re-export (loophole)
  │   │   │   │   ├── parts-a-1/ // Component unit directory
  │   │   │   │   │   ├── parts-a-1.tsx
  │   │   │   │   │   ├── parts-a-1.stories.tsx
  │   │   │   ├── page.tsx       // Page component
  │   │   │   └── sub/
  │   │   │       └── page.tsx   // Subpage
  │   │   └── colocation-b/
  │   │       └── page.tsx
  │   ├── api/
  │   ├── layout.tsx
  │   └── page.tsx
  ├── _components/
  │   ├── common/                // Common components
  │   ├── features/              // Feature-specific components
  │   └── ui/                    // UI components (shadcn)
  ├── config/
  ├── constants/
  ├── hooks/
  ├── lib/
  ├── store/
  ├── types/
  └── utils/
```

# Colocation Operation Rules

## Basic Rules

- Use `(colocation)` folders for logical grouping (does not affect URL path)
- Create a directory per page (e.g., `colocation-a/`)
- Place page-specific components under `_components/`

## import-access Rules for Encapsulation

- Always annotate `_components/parts-*/*.tsx` files with `@package`
- Create `_components/index.ts` to re-export components
- Also annotate `index.ts` with `@package`
- Always import via `index.ts` from `page.tsx` or `sub/page.tsx`
- Direct import of individual parts (like `parts-a-1.tsx`) is prohibited
- Import across different colocation areas (e.g., colocation-b) is prohibited

## Common / Utility Rules

- Place Storybook files (`*.stories.tsx`) within each parts directory
- Group common components under `/_components/common/`
- Group feature-specific components under `/_components/features/`
- Place utility libraries (fetch, localStorage, cookie operations) under `/lib/`
- Place state management logic under `/store/`
- Centralize type definitions under `/types/`
- Centralize pure functions and helper utilities under `/utils/`

# Re-export (Loophole) Implementation Example

## parts-a-1.tsx
```tsx
// src/app/(colocation)/colocation-a/_components/parts-a-1/parts-a-1.tsx
/**
 * @package
 */
export const PartsA1 = () => {
  return <div>PartsA1</div>;
};
```

## index.ts
```tsx
// src/app/(colocation)/colocation-a/_components/index.ts
/**
 * @package
 * Re-export for components
 */
export { PartsA1 } from "./parts-a-1/parts-a-1";
export { PartsA2 } from "./parts-a-2/parts-a-2";
export { PartsA3 } from "./parts-a-3/parts-a-3";
```

# lazy (Suspense) Operation Rules

## Policy

- Use `Suspense` in the page component (`page.tsx`)
- Wrap only components that require loading delays with `fallback`
- Group multiple parts under one `Suspense` if UX allows
- Use `React.lazy` to dynamically import heavy components
- Since `page.tsx` is a Server Component by default, attach `"use client"` if needed

## Example: Wrapping with Suspense

```tsx
// src/app/(colocation)/colocation-a/page.tsx
import { Suspense } from "react";
import { PartsA1, PartsA2, PartsA3 } from "@/app/(colocation)/colocation-a/_components";

export default function Page() {
  return (
    <div>
      <h1>Co-location A</h1>
      <Suspense fallback={<div>Loading...</div>}>
        <div>
          <PartsA1 />
          <PartsA2 />
          <PartsA3 />
        </div>
      </Suspense>
    </div>
  );
}
```

# Conclusion

By introducing this colocation + import-access pattern:

- Clear responsibility separation improves maintainability
- Prevents wrong imports safely through `import-access`
- Optimizes UX through appropriate lazy loading
- Supports future scaling and refactoring safely

This structure is one of the most practical setups for the Next.js App Router era.
