---
title: "Tauriでネイティブコマンドを呼び出す"
description: macOSのAppleScriptをRustから呼び出して情報を取得する
date: 2024-11-27 
---

この記事を簡潔化したもの

- https://zenn.dev/ocat/articles/e7a22ac0f658f7

## AppleScriptをRustから実行する
RustコードからAppleScriptを実行して情報を取得する例
```applescript
tell application "Spotify" --Spotifyアプリケーションにコマンドを送信します。
    if player state is playing then --Spotifyが再生中の場合
        set trackName to name of current track --現在のトラックの名前を取得
        set artistName to artist of current track --現在のトラックのアーティスト名を取得
        return trackName & " by " & artistName --トラック名とアーティスト名を返す
    else
        return "Spotify is not playing." --Spotifyが再生中でない場合
    end if
end tell
```

### Rustでの実装
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

    let output = Command::new("osascript") //osascriptコマンドを実行
        .arg("-e")
        .arg(script)
        .output()
        .map_err(|e| e.to_string())?;

    if output.status.success() {
        let result = String::from_utf8_lossy(&output.stdout).trim().to_string(); //UTF-8エンコードされた出力を文字列に変換
        Ok(result)
    } else {
        Err(String::from_utf8_lossy(&output.stderr).trim().to_string())
    }
}
```

## Tauriのmain.rsにコマンドを登録
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod spotify_info; // モジュールを追加

use spotify_info::get_spotify_track_info; // コマンドをインポート
use tauri::Manager;

fn main() {
    tauri::Builder::default()
        .invoke_handler(tauri::generate_handler![get_spotify_track_info]) // コマンドを登録
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

## Reactでのフロントエンド実装
```jsx
import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api";

const App = () => {
  const [trackInfo, setTrackInfo] = useState("Spotify is not playing.");

  const fetchTrackInfo = async () => {
    try {
      const result = await invoke("get_spotify_track_info"); // Rustのコマンドを呼び出す
      setTrackInfo(result as string);
    } catch (error) {
      console.error("Error fetching track info:", error);
    }
  };

  useEffect(() => {
    fetchTrackInfo();
    const intervalId = setInterval(fetchTrackInfo, 5000); // 5秒ごとに更新
    return () => clearInterval(intervalId);
  }, []);

  return <div>{trackInfo}</div>;
};

export default App;
```