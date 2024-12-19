---
title: "Calling Native Commands with Tauri."
description: Calling macOS AppleScript from Rust to retrieve information.
date: 2024-11-27
tags: ["Tauri", "Rust", "AppleScript"]
---

> Calling macOS AppleScript from Rust to retrieve information

---

## Table of Contents

- [Requirements and Background](#requirements-and-background)
- [Implementation Steps](#implementation-steps)
  - [Executing AppleScript from Rust](#executing-applescript-from-rust)
  - [Registering the Command in Tauri's main.rs](#registering-the-command-in-tauris-mainrs)
  - [Frontend Implementation in React](#frontend-implementation-in-react)

---

Simplified version of this article

- https://zenn.dev/ocat/articles/e7a22ac0f658f7

## Executing AppleScript from Rust

Example of executing AppleScript from Rust to retrieve information

```applescript
tell application "Spotify" -- Send command to Spotify application
    if player state is playing then -- If Spotify is playing
        set trackName to name of current track -- Get the name of the current track
        set artistName to artist of current track -- Get the artist name of the current track
        return trackName & " by " & artistName -- Return track name and artist name
    else
        return "Spotify is not playing." -- If Spotify is not playing
    end if
end tell
```

### Implementation in Rust

```rust
use std::process::Command;

#[tauri::command]
pub fn get_spotify_track_info() -> Result<String, String> {
    let script = r#"
    tell application "Spotify"
        if player state is playing then
            set trackName to name of current track
            set artistName to artist of current track
            return trackName & " by " & artistName
        else
            return "Spotify is not playing."
        end if
    end tell
    "#;

    let output = Command::new("osascript") // Execute osascript command
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let result = String::from_utf8_lossy(&output.stdout).trim().to_string(); // Convert UTF-8 encoded output to string
        Ok(result)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}
```

## Registering the Command in Tauri's main.rs

```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod spotify_info; // Add module

use spotify_info::get_spotify_track_info; // Import command
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_spotify_track_info]) // Register command
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Frontend Implementation in React

```jsx
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api";

const App = () => {
  const [trackInfo, setTrackInfo] = useState("Spotify is not playing.");

  const fetchTrackInfo = async () => {
    try {
      const result = await invoke("get_spotify_track_info"); // Call Rust command
      setTrackInfo(result as string);
    } catch (error) {
      console.error("Error fetching track info:", error);
    }
  };

  useEffect(() => {
    fetchTrackInfo();
    const intervalId = setInterval(fetchTrackInfo, 5000); // Update every 5 seconds
    return () => clearInterval(intervalId);
  }, []);

  return <div>{trackInfo}</div>;
};

export default App;
```
