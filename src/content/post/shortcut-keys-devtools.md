---
title: "How to Implement Shortcut Keys to Open DevTools"
description: This article explains how to use the `CmdOrCtrl+I` shortcut key to open DevTools in a Tauri application. It also covers implementation steps considering behavior in both debug and production environments.
date: 2024-12-13
tags: ["Tauri", "Rust", "DevTools"]
---

> This article explains how to use the `CmdOrCtrl+I` shortcut key to open DevTools in a Tauri application. It also covers implementation steps considering behavior in both debug and production environments.

---

## Table of Contents

- [Requirements and Background](#requirements-and-background)
- [Implementation Steps](#implementation-steps)
  - [Implementing the Shortcut Functionality](#implementing-the-shortcut-functionality)
  - [Opening DevTools in Debug Environment](#opening-devtools-in-debug-environment)
- [Resolving Chunk Size Warnings](#resolving-chunk-size-warnings)
- [Signing MacOS Applications](#signing-macos-applications)
- [Final Confirmation](#final-confirmation)

---

## Requirements and Background

When developing a Tauri application, you may want to open DevTools using a shortcut key. Adding the functionality to open DevTools with `CmdOrCtrl+I` allows for efficient debugging.

However, it is recommended to disable DevTools in production environments. Therefore, we will ensure that this functionality only works in the debug environment.

---

## Implementation Steps

### Implementing the Shortcut Functionality

Add the following code to `src/open_devtools.rs`. This file will implement the shortcut functionality.

```rust
use tauri::{App, GlobalShortcutManager, Manager};

/// open DevTools shortcut
pub fn register_open_devtools_shortcut(app: &mut App) {
    let app_handle = app.handle();
    let mut shortcut_manager = app_handle.global_shortcut_manager();

    shortcut_manager
        .register("CmdOrCtrl+I", move || {
            if let Some(_main_window) = app_handle.get_window("main") {
                // Only works in debug build
                #[cfg(debug_assertions)]
                {
                    _main_window.open_devtools();
                }
            }
        })
        .expect("Failed to register global shortcut");
}
```

- **`#[cfg(debug_assertions)]`**:

  - Ensures DevTools can only be opened in debug builds.
  - This part is disabled in production builds.

- **`_main_window`**:
  - The variable name starts with an underscore to suppress Rust's unused variable warning.

---

### Opening DevTools in Debug Environment

Register the shortcut functionality in `main.rs`.

```rust
mod open_devtools;

fn main() {
    tauri::Builder::default()
        .setup(|app| {
            open_devtools::register_open_devtools_shortcut(app);
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

With this setup, pressing `CmdOrCtrl+I` will open DevTools in the debug environment.

---

## Resolving Chunk Size Warnings

You may encounter the following warning during the build process:

```
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking
```

This warning indicates that the generated JavaScript bundle size is too large. Add the following settings to `vite.config.ts` to enable code splitting.

```ts
export default defineConfig({
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            return "vendor";
          }
        },
      },
    },
    chunkSizeWarningLimit: 1000, // Relax chunk size warning
  },
});
```

---

## Signing MacOS Applications

You may see the following warning when building on MacOS:

```
Warn Signing, by default, is only supported on Windows hosts, but you can specify a custom signing command in `bundler > windows > sign_command`, for now, skipping signing the installer...
```

This warning appears if the MacOS application is not signed. If you need to sign the application for distribution, add the following to `tauri.conf.json`:

```json
{
  "tauri": {
    "bundle": {
      "macOS": {
        "signing_identity": "Developer ID Application: Your Name (TEAM_ID)"
      }
    }
  }
}
```

Specify the name of your Apple developer certificate in `signing_identity`.

---

## Final Confirmation

Follow these steps to build and verify the application:

```bash
cargo clean
cargo build
npm run tauri dev
npm run tauri build
```

Ensure that `CmdOrCtrl+I` opens DevTools in the debug environment and that the shortcut is disabled in the production environment.

---

With this, you can implement the functionality to open DevTools using a shortcut key in a Tauri application. Use this for efficient debugging.
