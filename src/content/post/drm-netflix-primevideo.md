---
title: "Electronでアマプラ、ネトフリが観れない"
description: "自作 Electron ブラウザアプリで Amazon Prime Video や Netflix の DRM 動画が再生できない問題の原因と解決策。Castlabs ECS への切り替え、macOS symlink 修復、VMP 署名の手順を解説する。"
date: 2026-02-24
tags:
  ["Electron", "Widevine", "DRM", "Netflix", "PrimeVideo", "VMP", "Castlabs"]
---

## 症状

自作 Electron ブラウザアプリで Amazon Prime Video や Netflix を開こうとすると以下のエラーが出る:

- `chrome://settings/content/protectedContent`
- Netflix: `Error E100`
- Prime Video: `Error 7132` → `Google Chromeをアップデートする必要があります` → `CDM is out of date`

## 原因

### 1. 標準 Electron には Widevine CDM が含まれていない

Netflix・Prime Video などの動画サービスは **Widevine DRM** を使って暗号化されている。標準の `electron` npm パッケージにはこの CDM（Content Decryption Module）が同梱されていないため、そもそも再生できない。

### 2. VMP 署名が必要

Castlabs 製の Electron（後述）には Widevine CDM が含まれているが、**VMP（Verified Media Path）署名**がないと商用サービス（Netflix・Prime Video 等）のライセンスサーバーに拒否される（403 Forbidden）。

### 3. User-Agent 偽装は逆効果

UA を Chrome に偽装すると初期のサービス認証は通るが、**DRM ライセンス取得時に失敗する**。UA 偽装は行わないほうがよい。

## 解決策

### Step 1: Castlabs ECS（Electron for Content Security）に切り替える

標準 `electron` の代わりに Castlabs 製の Electron を使う。Widevine Component Updater が自動的に CDM をインストール・更新してくれる。

```bash
npm install "https://github.com/castlabs/electron-releases#v40.1.0+wvcus" --save-dev
```

`package.json` の `electron` 依存がこの GitHub URL に置き換わる。

### Step 2: `components.whenReady()` で CDM の準備を待つ

`electron/main.ts` の `app.whenReady()` 内で必ず待機する:

```typescript
import { app, components, BrowserWindow } from "electron";

app.whenReady().then(async () => {
  await components.whenReady();
  console.log("[Widevine] Components ready:", components.status());

  createWindow();
});
```

### Step 3: macOS の framework symlink を修復する（macOS のみ）

npm の git URL インストールは tarball 経由で展開されるため、macOS の `.framework` バンドルに必要な **シンボリックリンクが失われる**。これにより起動時に DYLD クラッシュが発生する:

```
Library not loaded: Electron Framework.framework/Electron Framework
```

`scripts/fix-electron-symlinks.sh` を作成して `postinstall` に登録する:

```bash
# scripts/fix-electron-symlinks.sh
#!/bin/bash
FW_DIR="node_modules/electron/dist/Electron.app/Contents/Frameworks"

fix_framework() {
  local fw="$1"
  local vers_dir="$fw/Versions"
  local ver
  ver=$(ls "$vers_dir" | grep -v '^Current$' | grep -v '^\.' | head -1)
  [ -z "$ver" ] && return

  ln -sf "$ver" "$vers_dir/Current"
  for item in "$vers_dir/$ver"/*; do
    ln -sf "Versions/Current/$(basename "$item")" "$fw/$(basename "$item")"
  done
}

for fw in "$FW_DIR"/*.framework; do
  [ -d "$fw" ] && fix_framework "$fw"
done
```

```json
// package.json
"scripts": {
  "postinstall": "bash scripts/fix-electron-symlinks.sh"
}
```

### Step 4: VMP 署名（最重要）

Castlabs の **EVS（ECS VMP signing Service）** を使って Electron バイナリに VMP 署名を行う。**無料**で利用できる。

#### アカウント作成（初回のみ）

```bash
pip3 install castlabs-evs --break-system-packages
python3 -m castlabs_evs.account signup
```

メールアドレス・名前・パスワードを対話式で入力し、確認メールのコードを入力すれば完了。

#### VMP 署名の実行

```bash
python3 -m castlabs_evs.vmp sign-pkg node_modules/electron/dist

# 確認
python3 -m castlabs_evs.vmp verify-pkg node_modules/electron/dist
# → Signature is valid [streaming, XXXX days of validity]
```

#### `npm install` 後に自動署名

`fix-electron-symlinks.sh` の末尾に追記して `postinstall` で自動化する:

```bash
# VMP signing
ELECTRON_DIST="$(cd "$(dirname "$0")/.." && pwd)/node_modules/electron/dist"
if command -v python3 &>/dev/null && python3 -m castlabs_evs.vmp --version &>/dev/null 2>&1; then
  python3 -m castlabs_evs.vmp sign-pkg "$ELECTRON_DIST"
fi
```

### Step 5: User-Agent 偽装を削除する

`session.defaultSession.setUserAgent()` や `webRequest.onBeforeSendHeaders` での UA 上書きは **DRM ライセンス取得を妨害する**ため削除する。

```typescript
// ❌ これらを削除
session.defaultSession.setUserAgent("Mozilla/5.0 ... Chrome/132 ...");
session.defaultSession.webRequest.onBeforeSendHeaders(...);
```

## エラーの変遷と対応

| エラー                                              | 原因                              | 対応                            |
| --------------------------------------------------- | --------------------------------- | ------------------------------- |
| `chrome://settings/content/protectedContent`        | Widevine CDM がない               | Castlabs ECS に切り替え         |
| DYLD crash: `Library not loaded`                    | macOS symlink 欠落                | `fix-electron-symlinks.sh`      |
| Prime Video Error 7132                              | UA に `Electron` が含まれる       | UA 偽装を追加（→ 後に削除）     |
| `Google Chromeをアップデートしてください`           | UA 偽装は通ったがバージョンが古い | Chrome 132 に更新（→ 後に削除） |
| `xp.system.unsupported_cdm_version` / 403 Forbidden | VMP 署名がない                    | EVS で VMP 署名                 |

## 注意点

- `npm install` のたびに VMP 署名が消えるので `postinstall` で自動化必須
- VMP 署名は macOS/Windows のみ対応（Linux は Widevine が VMP 未サポート）
- EVS アカウントは1ヶ月ごとにトークンのリフレッシュが必要（署名時に自動で促される）
- Amazon Prime Video と Netflix 両方で確認済み

## 参考

- [castlabs/electron-releases](https://github.com/castlabs/electron-releases)
- [EVS Wiki](https://github.com/castlabs/electron-releases/wiki/EVS)
- [Issue #199: netflix e100 error](https://github.com/castlabs/electron-releases/issues/199)
