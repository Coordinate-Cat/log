---
title: "ブラウザをソースからビルドして起動する"
description: "FirefoxフォークのZen BrowserをmacOS (Sonoma) でソースビルドする手順と、ハマりポイントをまとめた。SDKバージョン問題やWASI SDK未インストール問題の回避策も解説する。"
date: 2026-03-27
tags: ["ZenBrowser", "Firefox", "macOS", "Build", "OSS"]
---

## 環境

| 項目    | バージョン                  |
| ------- | --------------------------- |
| macOS   | 14.5 Sonoma (Darwin 23.5.0) |
| Xcode   | 16.2 (macOS SDK 15.2)       |
| Node.js | 22.x                        |
| Python  | 3.14 (Homebrew)             |
| Rust    | 1.92.0                      |

リポジトリ: [zen-browser/desktop](https://github.com/zen-browser/desktop)
参考ドキュメント: [Building Guide](https://docs.zen-browser.app/contribute/desktop/building)

---

## なんでブラウザをビルドするの？

個人でブラウザを作っており、ブラウザを分解して理解したいと思ったから。  
Zen BrowserはFirefoxをベースにしているため、Firefoxのコードベースを理解したいというのもある。  
実際にはchromiumベースのブラウザを開発しているが、知見の幅を広げるためにFirefoxも触ってみることにした。

## Zen Browserとは

Zen BrowserはFirefoxをベースにしたOSSブラウザで、ワークスペース（Spaces）・Glance（タブプレビュー）・コンパクトモードなど独自のUI機能を持つ。コアはFirefox 149.0で、`src/zen/` 配下にZen固有のJavaScriptモジュールとスタイルを追加し、186個のパッチでFirefox本体のコードを改変している。

## セットアップ手順

### 1. リポジトリのクローンと依存インストール

```bash
git clone https://github.com/zen-browser/desktop.git
cd desktop
npm i

# 上記はmacosだとホームディレクトリにdesktopディレクトリがすでにある場合があるので、必要に応じてパスを調整する。
```

`npm i`はSurfer(Zen 専用Firefoxカスタマイズビルドツール)やHuskyなどをインストールする。4秒くらい。

### 2. Firefoxエンジンのダウンロード

```bash
npm run download
```

Firefox 149.0のソースコード（`firefox-149.0.source.tar.xz`）を取得し、`engine/`に展開する。展開後gitリポジトリとして初期化され、`zen_browser`ブランチに切り替わる。けっこう時間がかかる（15分くらい）。

```
00:00:00 Downloading Firefox release 149.0...
00:01:00 Unpacking Firefox...
00:01:31 Unpacked Firefox source to .../engine
00:05:23 Switched to a new branch 'zen_browser'
SUCCESS You should be ready to make changes to Zen Browser.
```

### 3. パッチと設定のインポート

```bash
npm run import
```

内部で3つのステップが走る:

1. **`npm run ffprefs`** — `tools/ffprefs/`（Rust 製ツール）が`prefs/`配下のYAMLを読み込み、Firefox形式の`.inc`/`.js`に変換して`engine/modules/libpref/init/zen-static-prefs.inc`等に書き出す
2. **`npm run import:dumps`** — 検索エンジン設定JSONを更新
3. **`surfer import`** — ブランディング画像・186個のgitパッチ・Zenソースファイルをすべて`engine/`に適用

```
[FINISH] Apply 186 git patches
```

### 4. Bootstrap（ビルド環境の準備）

```bash
npm run bootstrap
```

内部で`engine/mach bootstrap`を呼び出す。macOS SDK のダウンロードで403エラーが出るが、ビルドには影響しない（後述）。

```
urllib.error.HTTPError: HTTP Error 403: Forbidden
...
Your version of Rust (1.92.0) is new enough.
```

---

## ハマりポイントと解決策

### 問題1: macOS SDKバージョン不足

#### エラー

```
ERROR: SDK version "15.2" is too old. Please upgrade to at least 26.2.
Try updating your system Xcode.
```

Firefox 149.0のビルドシステムがmacOS SDK**26.2 以上**を要求する（Xcode 17+に同梱されるmacOS 26 SDKに相当）。macOS 14 Sonoma + Xcode 16.2ではSDK 15.2しか持っていないため弾かれる。

#### 解決策

`engine/build/moz.configure/toolchain.configure`の`mac_sdk_min_version()`を書き換えて要件を下げる。このファイルはsurferが再生成しないため、変更が保持される。

```python
# engine/build/moz.configure/toolchain.configure
def mac_sdk_min_version():
    return "15.2"   # 元は "26.2"
```

> **注意**:本来はXcodeを最新版（17+）に上げるのが正道。SDKバージョンの要件はmacOS 26の新APIに依存していなければ動作するが、保証はない。

### 問題2: WASI SDK未インストール

#### エラー

```
ERROR: Cannot find wasi headers or problem with the wasm compiler.
Please fix the problem. Or build with --without-wasm-sandboxed-libraries.
```

Firefoxはデフォルトで一部ライブラリをWebAssemblyのサンドボックス内でビルドするため、WASI（WebAssembly System Interface）のSDKが必要。ただし開発ビルドではこの機能は必須ではない。

#### 解決策

`configs/macos/mozconfig`に以下を追記する。`engine/mozconfig`はsurferがビルドのたびに`configs/`の内容から**自動生成**するため、直接`engine/mozconfig`を編集しても次回上書きされてしまう点に注意。

```bash
# configs/macos/mozconfig に追記
ac_add_options --without-wasm-sandboxed-libraries
```

### 問題3: bootstrap時の403エラー

macOS SDKの自動ダウンロードがTaskClusterのエンドポイントで拒否される。ただしこれはCI環境向けのものであり、**ローカルビルドには影響しない**。エラーのあともbootstrapは続行し、virtualenvのセットアップやRustバージョン確認が完了する。無視してよい。

---

## ビルド

2 つの回避策を適用した後:

```bash
cd /path/to/zen-browser/desktop
npm run build
```

Surferが`engine/mozconfig`を生成し、`engine/mach build`を呼び出す。M1 Macで30〜90分程度かかる。

```
Building for "macos"...
W AI agent detected. Terminal output limited to warnings and errors.
W Adding make options from .../engine/mozconfig
```

ビルド成果物は`engine/obj-aarch64-apple-darwin/`に生成される。

---

## 起動

```bash
npm start
```

`engine/mach run --noprofile`が呼ばれ、ブラウザが起動する。ビルド後の初回起動は数秒かかる場合がある。

---

## 変更を加える場合

- **Zen 固有の JS/CSS**: `src/zen/`配下を直接編集→`npm run build:ui`（C++を再コンパイルしないため高速）
- **Firefox エンジン本体のコード**: `engine/`配下を編集→`npm run export <パス>`でパッチとして`src/`に書き出す
- **設定（prefs）**: `prefs/`配下のYAMLを編集→`npm run ffprefs`で`.inc`/`.js`に変換される

---

## まとめ

ハマりやすいのはmacOS SDKバージョンとWASI SDKの2点で、いずれもビルドオプションの変更で回避できる。  
頻繁に開発する場合はXcodeを最新版に更新してSDKを揃えておく方が長期的には楽。
