title: "自作ブラウザにリアルタイムページ翻訳を実装、最適化しアルゴリズムを理解する"
description: "Electron で自作ブラウザにリアルタイムページ翻訳を実装した際のアルゴリズム的な工夫と最適化のポイントを解説。URL を変えずに DOM を直接書き換える方式で、CSP を回避しながら高速な翻訳を実現する方法を紹介する。"
date: 2026-02-24
tags: ["Electron", "JavaScript", "translation", "optimization", "CSP"]

## もくじ

- [はじめに](#はじめに)
- [失敗した方法](#失敗した方法)
  - [1. Google Translate URL にリダイレクト](#1-google-translate-url-にリダイレクト)
  - [2. Google Translate ウィジェットを inject](#2-google-translate-ウィジェットを-inject)
- [採用した方法：Main プロセスから API を叩いて DOM を直接書き換える](#採用した方法main-プロセスから-api-を叩いて-dom-を直接書き換える)
  - [全体フロー](#全体フロー)
  - [Step 1: DOM Walking](#step-1-dom-walking)
  - [Step 2: 並列バッチ翻訳](#step-2-並列バッチ翻訳)
  - [Step 3: テキストノードへの書き戻し](#step-3-テキストノードへの書き戻し)
  - [元に戻す](#元に戻す)
- [ナビゲーション時の状態リセット](#ナビゲーション時の状態リセット)
- [右クリックメニューの出し分け](#右クリックメニューの出し分け)
- [まとめ](#まとめ)

## はじめに

Electron でデスクトップブラウザアプリを自作している。
「Chromeみたいにページ全体を翻訳したい」という要件が出てきた。

Chrome の翻訳機能は Google が Chromium エンジンに直接組み込んでるものであり、サードパーティの Electron アプリからは利用できない。代替手段を探しながら実装・最適化を重ねた結果、**URL を一切変えずに DOM のテキストノードを直接書き換える**方式で実現した。

試行錯誤の過程でいくつかのアルゴリズム的な判断があったので、理由も含めて整理しておく。

## 失敗した方法

### 1. Google Translate URL にリダイレクト

```
https://translate.google.com/translate?sl=auto&tl=ja&u=<元のURL>
```

動くには動くが、URL が `translate.goog` ドメインに変わってしまう。「今いるページで翻訳したい」という要件を満たせない。

### 2. Google Translate ウィジェットを inject

```javascript
const s = document.createElement("script");
s.src =
  "https://translate.googleapis.com/translate_a/element.js?cb=googleTranslateElementInit";
document.head.appendChild(s);
```

GitHub のような CSP（Content Security Policy）が厳しいサイトでは `script-src` に `translate.googleapis.com` が含まれておらず、スクリプトがブロックされる。

## 採用した方法：Main プロセスから API を叩いて DOM を直接書き換える

Electron の `WebContentsView` には `executeJavaScript()` があり、ページの DOM を自由に操作できる。また Electron の **main プロセス**から `fetch()` を呼べば、CSP の制約を完全に回避できる。

この 2 つを組み合わせた。

### 全体フロー

```
[右クリック → Translate Page]
        │
        ▼
Step 1: executeJavaScript でページの TextNode を収集
        │ (最大 800 ノード、script/style/code 等は除外)
        ▼
Step 2: main プロセスで translate.googleapis.com に並列 fetch
        │ (100 件ずつバッチ、全バッチを Promise.all で同時送信)
        ▼
Step 3: executeJavaScript で翻訳結果を TextNode に書き戻す
```

### Step 1: DOM Walking

TreeWalkerはブラウザ組み込みのAPIで、DOMツリーを効率的に巡回できる。テキストノードだけを対象にするため、`NodeFilter.SHOW_TEXT` を指定する。さらに、空白だけのノードや、`<script>`, `<style>`, `<code>`, `<pre>` 内のノードは翻訳不要なのでフィルタリングする。

```javascript
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, {
  acceptNode(node) {
    if (!node.textContent.trim()) return NodeFilter.FILTER_REJECT;
    // script / style / code / pre などは翻訳しない
    let el = node.parentElement;
    while (el) {
      if (skip.has(el.tagName.toUpperCase())) return NodeFilter.FILTER_REJECT;
      el = el.parentElement;
    }
    return NodeFilter.FILTER_ACCEPT;
  },
});
```

収集したノードへの参照と元テキストを `window.__bwNodes`（`Map<string, {node, orig}>`）に保存しておく。これが「元に戻す」ための原本になる。

### Step 2: 並列バッチ翻訳

最も重要な最適化ポイント。

#### 工夫 1：重複テキストの排除

ナビゲーションバーや繰り返し出現する UI 文言は同じ文字列が何度も現れる。翻訳が必要なのは**ユニークな文字列だけ**。

```typescript
const uniqueMap = new Map<string, string[]>(); // text → [nodeId, ...]
for (const t of texts) {
  const key = t.text.trim();
  const arr = uniqueMap.get(key);
  if (arr) arr.push(t.id);
  else uniqueMap.set(key, [t.id]);
}
```

#### 工夫 2：Promise.all で全バッチを並列送信

従来の逐次処理（`for await`）だと`8 バッチ` × `200ms` = `1,600ms`。並列化すると理論上`200ms`まで短縮できる。

```typescript
const SEP = "\n\u2060\n"; // Word Joiner を区切り文字に使用

const chunkResults = await Promise.all(
  chunks.map(async (chunk) => {
    const q = chunk.join(SEP);
    const res = await fetch(
      `https://translate.googleapis.com/translate_a/single` +
        `?client=gtx&sl=auto&tl=${tl}&dt=t&q=${encodeURIComponent(q)}`
    );
    const json = await res.json();
    const joined = json[0].map((item) => item[0]).join("");
    return joined.split(/\n\u2060\n|\u2060/);
  })
);
```

区切り文字に **Word Joiner（U+2060）** を使う理由：通常の `\n` だと翻訳 API がテキスト内の改行と混同するが、Word Joiner は非表示文字のため誤認識されにくい。

### Step 3: テキストノードへの書き戻し

```javascript
const map = /* JSON */;
const store = window.__bwNodes;
for (const [id, translated] of Object.entries(map)) {
  const entry = store.get(id);
  if (entry && translated) entry.node.textContent = translated;
}
```

### 元に戻す

`window.__bwNodes` に元テキストを保存してあるので、完全な復元が可能。

```javascript
for (const [, entry] of window.__bwNodes) {
  entry.node.textContent = entry.orig;
}
window.__bwNodes.clear();
```

## ナビゲーション時の状態リセット

翻訳済みフラグをタブごとに `Map<tabId, boolean>` で管理し、`did-navigate` イベント（リロード・URL 遷移の両方で発火）でリセットする。

```typescript
view.webContents.on("did-navigate", () => {
  tabTranslationState.delete(tabId);
});
```

これにより「翻訳後にリロードしたのに右クリックが "Show Original" のまま」というバグを防ぐ。

## 右クリックメニューの出し分け

- テキスト**未選択**時 → `Translate Page to 日本語` / `Show Original Page`
- テキスト**選択**時 → `Translate "選択テキスト…" to 日本語`（インラインオーバーレイ表示）

翻訳先言語は `app.getLocale()` から自動決定し、`Intl.DisplayNames` で言語名を表示する。日本語環境なら `日本語`、英語環境なら `Japanese` と表示される。

```typescript
const systemLocale = app.getLocale(); // e.g. "ja-JP"
const translateTargetLang = systemLocale.split("-")[0]; // "ja"
const translateTargetLangName = new Intl.DisplayNames([systemLocale], {
  type: "language",
}).of(translateTargetLang);
// → "日本語"
```

## まとめ

| 項目 | 内容 |
| - | |
| URL 変化 | なし（ページに留まったまま翻訳） |
| CSP の影響 | なし（main プロセスから fetch） |
| 翻訳 API コスト | 無料（`translate.googleapis.com` 非公式 API） |
| 翻訳速度の最適化 | 重複排除 ＋ Promise.all 並列 ＋ バッチサイズ 100 |
| 元に戻す | ワンクリックで完全復元 |
| 翻訳先言語 | システムロケールから自動決定 |

Electron で本格的なブラウザ機能を自作するのは制約が多いが、`executeJavaScript` と main プロセスの `fetch` の組み合わせは強力なパターンかなと思った。特に CSP 回避の仕方は、翻訳以外の機能（例：ページ内の特定要素をスクレイピングしてサイドバーに表示する等）でも応用できそう。
