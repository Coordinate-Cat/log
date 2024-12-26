---
title: "Managing Window Size and Position in a Tauri Application."
description: Using Tauri, you can control the size and position of application windows
date: 2024-12-27
tags: ["Tauri", "Rust", "React"]
---

Using Tauri, you can control the size and position of application windows. This article demonstrates how to implement features for resizing and moving windows to specific screen locations.

![Window Management Example](https://storage.googleapis.com/zenn-user-upload/9df55fc05f22-20241226.gif)

## Prerequisite Setup

### `tauri.conf.json`

Below is the configuration used for this implementation. Refer to it as needed.

[tauri.conf.json](https://github.com/Flanker-Dev/Flanker/blob/develop/src-tauri/tauri.conf.json)

:::details tauri.conf.json
```json
{
  "build": {
    "beforeDevCommand": "npm run dev",
    "beforeBuildCommand": "npm run build",
    "devPath": "http://localhost:1420",
    "distDir": "../dist"
  },
  "package": {
    "productName": "Flanker",
    "version": "0.0.0"
  },
  "tauri": {
    "macOSPrivateApi": true,
    "allowlist": {
      "all": false,
      "http": {
        "all": true
      },
      "fs": {
        "all": true,
        "scope": ["$HOME/.config/flk/**"]
      },
      "path": {
        "all": true
      },
      "os": {
        "all": true
      },
      "shell": {
        "all": false,
        "open": true
      },
      "window": {
        "all": false,
        "close": true,
        "hide": true,
        "show": true,
        "maximize": true,
        "minimize": true,
        "unmaximize": true,
        "unminimize": true,
        "startDragging": true,
        "setAlwaysOnTop": true
      },
      "clipboard": {
        "all": true,
        "writeText": true,
        "readText": true
      },
      "protocol": {
        "asset": true,
        "assetScope": ["$HOME/.config/flk/images", "$HOME/.config/flk/images/*"]
      },
      "globalShortcut": {
        "all": true
      }
    },
    "windows": [
      {
        "decorations": false,
        "transparent": true,
        "title": "Flanker",
        "width": 1500,
        "height": 1000,
        "minWidth": 768,
        "minHeight": 76,
        "hiddenTitle": true,
        "titleBarStyle": "Overlay",
        "resizable": true,
        "fullscreen": true,
        "fileDropEnabled": false
      }
    ],
    "security": {
      "csp": "default-src 'self'; img-src * asset: https://asset.localhost blob: date:; script-src 'self'; style-src 'self'; object-src 'none';"
    },
    "bundle": {
      "active": true,
      "targets": "all",
      "identifier": "com.flanker.app",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png",
        "icons/128x128@2x.png",
        "icons/icon.icns",
        "icons/icon.ico"
      ]
    }
  }
}
```
:::

## Changing Window Size

### Increase Window Height (`⌘+ArrowDown`)

```rust
// increase_height.rs
use tauri::Window;

#[tauri::command]
pub async fn increase_height(window: Window) {
    tauri::async_runtime::spawn(async move {
        let current_size = window.outer_size().unwrap();
        let scale_factor = window.scale_factor().unwrap();
        window.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: current_size.width as f64 / scale_factor,
            height: current_size.height as f64 / scale_factor + 20.0,
        })).unwrap();
    }).await.unwrap();
}
```

### Decrease Window Height (`⌘+ArrowUp`)

```rust
// decrease_height.rs
use tauri::Window;

#[tauri::command]
pub async fn decrease_height(window: Window) {
    tauri::async_runtime::spawn(async move {
        let current_size = window.outer_size().unwrap();
        let scale_factor = window.scale_factor().unwrap();
        window.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: current_size.width as f64 / scale_factor,
            height: (current_size.height as f64 / scale_factor - 20.0).max(76.0),
        })).unwrap();
    }).await.unwrap();
}
```

### Increase Window Width (`⌘+ArrowRight`)

```rust
// increase_width.rs
use tauri::Window;

#[tauri::command]
pub async fn increase_width(window: Window) {
    tauri::async_runtime::spawn(async move {
        let current_size = window.outer_size().unwrap();
        let scale_factor = window.scale_factor().unwrap();
        let monitor = window.primary_monitor().unwrap().unwrap();
        let monitor_width = monitor.size().width as f64 / scale_factor;
        let new_width = (current_size.width as f64 / scale_factor + 20.0).min(monitor_width);
        window.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: new_width,
            height: current_size.height as f64 / scale_factor,
        })).unwrap();
    }).await.unwrap();
}
```

### Decrease Window Width (`⌘+ArrowLeft`)

```rust
// decrease_width.rs
use tauri::Window;

#[tauri::command]
pub async fn decrease_width(window: Window) {
    tauri::async_runtime::spawn(async move {
        let current_size = window.outer_size().unwrap();
        let scale_factor = window.scale_factor().unwrap();
        window.set_size(tauri::Size::Logical(tauri::LogicalSize {
            width: (current_size.width as f64 / scale_factor - 20.0).max(768.0),
            height: current_size.height as f64 / scale_factor,
        })).unwrap();
    }).await.unwrap();
}
```

## Moving the Window

### Move to Top Left (`⌘+U`)

```rust
// move_window_top_left.rs
use tauri::Window;

#[tauri::command]
pub fn move_window_top_left(window: Window) {
    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: 0, y: 0 })).unwrap();
}
```

### Move to Top Right (`⌘+I`)

```rust
// move_window_top_right.rs
use tauri::Window;

#[tauri::command]
pub fn move_window_top_right(window: Window) {
    let screen = window.primary_monitor().unwrap();
    let screen_width = screen.as_ref().map_or(0, |s| s.size().width as i32);
    let window_size = window.outer_size().unwrap();
    let window_width = window_size.width as i32;
    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: screen_width - window_width, y: 0 })).unwrap();
}
```

### Move to Bottom Left (`⌘+J`)

```rust
// move_window_bottom_left.rs
use tauri::Window;

#[tauri::command]
pub fn move_window_bottom_left(window: Window) {
    let screen = window.primary_monitor().unwrap();
    let screen_height = screen.as_ref().map_or(0, |s| s.size().height as i32);
    let window_size = window.outer_size().unwrap();
    let window_height = window_size.height as i32;
    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: 0, y: screen_height - window_height })).unwrap();
}
```

### Move to Bottom Right (`⌘+K`)

```rust
// move_window_bottom_right.rs
use tauri::Window;

#[tauri::command]
pub fn move_window_bottom_right(window: Window) {
    let screen = window.primary_monitor().unwrap();
    let screen_width = screen.as_ref().map_or(0, |s| s.size().width as i32);
    let screen_height = screen.as_ref().map_or(0, |s| s.size().height as i32);
    let window_size = window.outer_size().unwrap();
    let window_width = window_size.width as i32;
    let window_height = window_size.height as i32;
    window.set_position(tauri::Position::Physical(tauri::PhysicalPosition { x: screen_width - window_width, y: screen_height - window_height })).unwrap();
}
```

## Implementing Window Operation Buttons

Button states and styles depend on the current window size.

```jsx
variant={window.innerHeight > 76 ? "fit" : "disabled"}
```

```jsx
// App.tsx

// Modify window dimensions
const decreaseHeight = () => invokeTauriCommand("decrease_height", { window: appWindow });
const increaseHeight = () => invokeTauriCommand("increase_height", { window: appWindow });
const decreaseWidth = () => invokeTauriCommand("decrease_width", { window: appWindow });
const increaseWidth = () => invokeTauriCommand("increase_width", { window: appWindow });

// Move window position
const moveWindowTopLeft = () => invokeTauriCommand("move_window_top_left");
const moveWindowTopRight = () => invokeTauriCommand("move_window_top_right");
const moveWindowBottomLeft = () => invokeTauriCommand("move_window_bottom_left");
const moveWindowBottomRight = () => invokeTauriCommand("move_window_bottom_right");

...

<Button
  variant={window.innerHeight > 76 ? "fit" : "disabled"}
  size={"fit"}
  onClick={decreaseHeight}
  className={`flex cursor-default items-center justify-center rounded p-0.5  ${window.innerHeight > 82 ? "hover:bg-white hover:text-black" : ""}`}
>
  <FoldVertical className="h-4 w-4" />
</Button>
<Button
  variant={"fit"}
  size={"fit"}
  onClick={increaseHeight}
  className="flex cursor-default items-center justify-center rounded p-0.5 hover:bg-white hover:text-black"
>
  <UnfoldVertical className="h-4 w-4 rotate-180" />
</Button>
<Button
  variant={window.innerWidth > 768 ? "fit" : "disabled"}
  size={"fit"}
  onClick={decreaseWidth}
  className={`flex cursor-default items-center justify-center rounded p-0.5  ${window.innerWidth > 768 ? "hover:bg-white hover:text-black" : ""}`}
>
  <FoldVertical className="h-4 w-4 rotate-90" />
</Button>
<Button
  variant={"fit"}
  size={"fit"}
  onClick={increaseWidth}
  className="flex cursor-default items-center justify-center rounded p-0.5 hover:bg-white hover:text-black"
>
  <UnfoldVertical className="h-4 w-4 -rotate-90" />
</Button>

<Button
  variant={"fit"}
  size={"fit"}
  onClick={moveWindowTopLeft}
  className="flex cursor-default items-center justify-center rounded p-0.5 hover:bg-white hover:text-black"
>
  <SquareArrowUpLeft
    strokeWidth={1.6}
    className="h-4 w-4"
  />
</Button>
<Button
  variant={"fit"}
  size={"fit"}
  onClick={moveWindowTopRight}
  className="flex cursor-default items-center justify-center rounded p-0.5 hover:bg-white hover:text-black"
>
  <SquareArrowUpRight
    strokeWidth={1.6}
    className="h-4 w-4"
  />
</Button>
<Button
  variant={"fit"}
  size={"fit"}
  onClick={moveWindowBottomLeft}
  className="flex cursor-default items-center justify-center rounded p-0.5 hover:bg-white hover:text-black"
>
  <SquareArrowDownLeft
    strokeWidth={1.6}
    className="h-4 w-4"
  />
</Button>
<Button
  variant={"fit"}
  size={"fit"}
  onClick={moveWindowBottomRight}
  className="flex cursor-default items-center justify-center rounded p-0.5 hover:bg-white hover:text-black"
>
  <SquareArrowDownRight
    strokeWidth={1.6}
    className="h-4 w-4"
  />
</Button>
```

### Final Result

![Final Result](https://storage.googleapis.com/zenn-user-upload/c636bd73cb62-20241226.png)

## Implementing Shortcuts

Use the `useEffect` hook to detect `keydown` events and execute window operations based on specific key inputs.

```jsx
if (event.key === "ArrowDown" && event.metaKey) increaseHeight();
```

```jsx
// App.tsx
  useEffect(() => {
    let keydownTimeout: NodeJS.Timeout | null = null;

    const handleKeydown = (event: KeyboardEvent) => {
      if (keydownTimeout) return;

      if (event.key === "ArrowDown" && event.metaKey) increaseHeight();
      if (event.key === "ArrowUp" && event.metaKey) decreaseHeight();
      if (event.key === "ArrowRight" && event.metaKey) increaseWidth();
      if (event.key === "ArrowLeft" && event.metaKey) decreaseWidth();
      if (event.key === "u" && event.metaKey) moveWindowTopLeft();
      if (event.key === "i" && event.metaKey) moveWindowTopRight();
      if (event.key === "j" && event.metaKey) moveWindowBottomLeft();
      if (event.key === "k" && event.metaKey) moveWindowBottomRight();

      keydownTimeout = setTimeout(() => {
        keydownTimeout = null;
      }, 10);
    };

    window.addEventListener("keydown", handleKeydown);

    return () => {
      window.removeEventListener("keydown", handleKeydown);
    };
  }, []);
```

## Summary

While implementing these features, challenges such as handling dual monitors and scaling differences (Retina vs non-Retina) became apparent. For an optimal user experience, consider providing customizable UI options for shortcuts and other interactions.

