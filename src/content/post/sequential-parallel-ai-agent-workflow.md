---
title: "planner / tdd-guide / security-reviewer を協調させる AI 開発フロー"
description: "計画フェーズを直列で完走させてからレビューを並列に走らせる。壁時計時間を半減しつつ品質を担保するエージェントオーケストレーションパターンを解説する。"
date: 2026-04-25
tags: ["AI", "GitHubCopilot", "DevelopmentTools", "TDD", "Workflow"]
---

## もくじ

- [背景](#背景)
- [構造：3フェーズの全体像](#構造3フェーズの全体像)
- [ファイル構成とセットアップ](#ファイル構成とセットアップ)
  - [エージェントファイルの書き方](#エージェントファイルの書き方)
  - [スキルファイルの書き方](#スキルファイルの書き方)
  - [起動方法](#起動方法)
- [Phase 1 — planner](#phase-1--planner)
- [Phase 2 — 並列実行](#phase-2--並列実行)
  - [orchestrator（統括エージェント）](#orchestrator統括エージェント)
  - [tdd-guide](#tdd-guide)
  - [code-reviewer](#code-reviewer)
  - [security-reviewer](#security-reviewer)
- [Phase 3 — 集計レポート](#phase-3--集計レポート)
- [なぜ「1メッセージに全部」が重要か](#なぜ1メッセージに全部が重要か)
- [Definition of Done](#definition-of-done)
- [まとめ](#まとめ)

## 背景

AIエージェントに「機能を実装して」と頼むと、ノープランで書き始めて後から修正が大量に出ることがある。計画なしに実装を始めないという原則を強制する仕組みが欲しかった。

一方、計画が固まった後のレビュー（テスト・コードレビュー・セキュリティ）は互いに依存しない。つまり**計画は直列、レビューは並列**が最適解になる。

## 構造：3フェーズの全体像

```
Phase 1 ──► planner（ブロッキング）
                │
                ▼（承認）
Phase 2 ──► tdd-guide.        ──┐
            code-reviewer     ──┼── 3つを同時起動
            security-reviewer ──┘
                │
                ▼
Phase 3 ──► 集計レポート + DoD チェックリスト
```

計画フェーズは次フェーズへの入力になるので並列化できない。3種類のレビューは独立しているので同時に走らせられる。これだけ。

## ファイル構成とセットアップ

このワークフローは GitHub Copilot のカスタムエージェント機能を使う。リポジトリのルートに `.claude/` ディレクトリを作り、以下の構成でファイルを置く。

```
.claude/
  agents/
    orchestrator.md   ← 統括エージェント（Phase 1→2 の遷移を管理）
    planner.md        ← 計画専用（コード書き禁止）
    tdd-guide.md      ← TDD サイクル担当
    code-reviewer.md  ← コードレビュー担当
    security-reviewer.md ← セキュリティレビュー担当
  skills/
    orchestrate/
      SKILL.md        ← ワークフロー全体の入口
```

### エージェントファイルの書き方

`.claude/agents/*.md` の各ファイルは YAML frontmatter + システムプロンプトで構成する。

```yaml
---
name: planner
description: >
  実装計画を立てる専用エージェント。
  コードは書かず、計画のみを返す。
tools: Read, Grep, Glob
model: sonnet
---
（ここにシステムプロンプトを書く）
```

frontmatter のフィールド：

| フィールド    | 役割                                                                                                         |
| ------------- | ------------------------------------------------------------------------------------------------------------ |
| `name`        | エージェントの識別子。`Agent(name)` で呼び出すときに使う                                                     |
| `description` | Copilot がいつこのエージェントを選ぶかの説明。意図的な呼び出しにも使われる                                   |
| `tools`       | このエージェントが使えるツールの制限。`planner` に Write/Edit を与えないことでコード生成を強制的に禁止できる |
| `model`       | 使用するモデル（`sonnet` / `opus` など）                                                                     |

`tools` に何を書けるかはプラットフォームによる。GitHub Copilot では `Read`, `Grep`, `Glob`, `Bash`, `Write`, `Edit`, `Agent` などが指定できる。

### スキルファイルの書き方

`.claude/skills/orchestrate/SKILL.md` はワークフローの入口になるスキルファイル。エージェントと違い、スキルは Copilot が `description` を読んで**自動的にロードして適用**する。

```yaml
---
name: orchestrate
description: >
  Sequential → parallel development workflow.
  Use when: implementing a feature, fixing a bug, any non-trivial code change.
  Triggers on: /orchestrate, "implement X", "add feature X", "fix Y"
---
（ここにワークフロー全体の指示を書く）
```

`description` に「どんなユーザー発言でこのスキルが発動するか」を具体的に書いておくと、ユーザーが `/orchestrate` と打たなくても「機能を追加して」と言うだけで自動的にこのフローが動く。

### 起動方法

```
/orchestrate タブ切り替えアニメーションを追加する
```

または `description` に書いたトリガーワードを含む発言をするだけで自動発動する。

---

## Phase 1 — planner

`planner` は**コードを書かない**専用エージェントとして定義している。使えるツールを Read / Grep / Glob だけに制限することで「書けない」を強制している。

```yaml
tools: Read, Grep, Glob # Write / Edit / Bash はなし
model: sonnet
```

タスクを受け取ると、まずコードベースを探索して既存のパターンを把握する。そのうえで以下のフォーマットでプランを返す。

```
## Requirements
[何を実装するか]

## Codebase Findings
[関連する既存ファイル・関数・パターン]

## Implementation Plan
[ファイルパス付きの番号付きステップ]

## Risks & Constraints
[ネイティブ層の制約、リファクタリングルールなど]

## Open Questions
[実装前にユーザーに確認が必要な事項]
```

ユーザーが承認するまで Phase 2 には進まない。これが一番大事なガードレール。

リファクタリング系のタスクの場合は「UIの見た目を1ピクセルも変えない」制約をプランに明示することも指示している。プランナー自身がこのルールを把握したうえでステップを組む。

## Phase 2 — 並列実行

プランが承認されたら、**1つのメッセージで**3エージェントを同時起動する。

| エージェント        | 担当                                                              |
| ------------------- | ----------------------------------------------------------------- |
| `tdd-guide`         | Kent Beck の canonical TDD 5ステップサイクル                      |
| `code-reviewer`     | Clippy / Biome チェック、IPC パターン、リファクタリングルール検証 |
| `security-reviewer` | Tauri capability 検査、IPC 入力検証、SQLite インジェクション検査  |

### orchestrator（統括エージェント）

Phase 1→2 の遷移自体を管理する `orchestrator` エージェントが存在する。このエージェントが planner を呼び、ユーザーの承認を受けたあと、3エージェントを一括で起動する司令塔になる。

```yaml
---
name: orchestrator
description: 複数エージェントを sequential → parallel で協調させる統括エージェント
tools: Read, Grep, Glob, Bash, Write, Edit, Agent
model: sonnet
---
```

`Agent` ツールを持っていることが重要で、これがないと他エージェントを呼び出せない。

Phase 2 の起動コードはこういう形になる。

```
# Phase 1（直列）
Agent(planner): "<タスクの全文>"

# ↓ユーザー承認後

# Phase 2（並列 — この3行を1メッセージに書く）
Agent(tdd-guide):        "Plan: <plan>. TDD for: <task>"
Agent(code-reviewer):    "Review changes for: <task>"
Agent(security-reviewer): "Security review for: <task>"
```

### tdd-guide

Kent Beck が2023年に再定義した canonical TDD の5ステップに従う。よくある「テストを先に書く」だけではなく、**テストリストの作成**から始めるのが特徴。

```
Step 1 — テストリストを作る（分析フェーズ）
Step 2 — テストを1つ書く → Red を確認
Step 3 — 最小限の実装でグリーンにする
Step 4 — リファクタリング（ここだけでやる）
Step 5 — リストが空になるまで繰り返す
```

Step 3 での実装戦略は3つ定義している。

| 戦略                   | 使いどころ                                                                    |
| ---------------------- | ----------------------------------------------------------------------------- |
| Obvious Implementation | 実装が明確なとき — そのまま書く                                               |
| Fake It                | まず戻り値をハードコードしてグリーンにする。その後 triangulate で本実装に誘導 |
| Triangulation          | テストケースを追加して、自然と汎用的な実装が生まれるよう誘導する              |

Rust のテストは `cargo test`（`src-tauri/` 内）、TypeScript は `vitest`（`npm run test`）を使う。

Step 3 と Step 4 を**絶対に混ぜない**ことを明文化している。グリーンになっていない状態でリファクタリングするのは禁止。

### code-reviewer

4つの軸でレビューする。

**1. リファクタリングルール準拠（最重要）**

コンポーネントの構造変更や移行を含む場合は必ず確認する。

■ CSSクラス名が変わっていないか（順序・スペース含め）
■ プレースホルダーやラベルのテキストが変わっていないか
■ `data-tauri-drag-region` や `aria-*` などの HTML 属性が消えていないか

1つでも違反があればブロッカーとして報告する。

**2. IPC パターン正確性**

■ コマンドハンドラは薄いラッパーであること（ビジネスロジックは別関数）
■ フロントエンドからの入力は必ず検証してから使う
■ エラーは `Result<_, String>` または `tauri::Error` で返す

**3. Rust コード品質**

■ プロダクションパスに `unwrap()` / `expect()` を使わない — `?` か明示的エラーハンドリング
■ 参照で足りる場面で `clone()` を使わない

**4. TypeScript コード品質**

■ `any` 型を使わない
■ `console.log` をプロダクションコードに残さない
■ `invoke()` の引数型が Rust のコマンドシグネチャと一致しているか

自動チェックとして以下を実行する。

```bash
cd src-tauri && cargo fmt --check
cd src-tauri && cargo clippy --all-features -- -D warnings
npx biome check src/
```

出力フォーマットはブロッカー / サジェスト / ポジティブの3段。

### security-reviewer

Tauri アプリ固有のセキュリティに特化している。脅威エリアは6つ。

**1. Tauri Capabilities（最優先）**

`src-tauri/capabilities/` を読み、付与されている capability が必要最小限かを確認する。`fs:read-all` のような広すぎる権限はフラグを立てる。

**2. IPC 入力検証**

■ ファイルパスに使われる入力はパストラバーサルを検証
■ シェルコマンドに展開される入力はインジェクション検証
■ SQLite クエリはパラメータライズドクエリを使っているか

**3. WebView / XSS**

■ `webview.eval()` でインジェクトするコンテンツにエスケープされていないユーザーデータが含まれていないか
■ 外部URLを読み込むタブから Tauri IPC にアクセスできないか

**4. Secrets & Credentials**

■ ハードコードされた API キーやトークンがないか
■ `.env` ファイルがコミットされていないか

**5. SQLite（history.rs）**

■ 全クエリが `?` プレースホルダーを使っているか
■ 文字列連結でSQLを組み立てていないか

**6. Filesystem（files.rs）**

■ ユーザー入力のパスを canonicalize して許可ディレクトリ内に収まっているか
■ シンボリックリンク経由での逸脱がないか

自動チェックコマンド：

```bash
grep -rn "unwrap()" src-tauri/src/ipc/      # IPC 層の未処理エラー
grep -rn "format!.*sql" src-tauri/src/      # 文字列結合SQL
grep -rn "eval(" src-tauri/src/             # webview.eval 呼び出し
grep -rn "shell::Command" src-tauri/src/    # シェル実行
```

> **別スタックへの移植ポイント**: code-reviewer と security-reviewer のチェック内容はプロジェクト固有になる。Tauri 固有の capability 検査や Clippy の部分は、自分のスタック（Next.js なら ESLint + npm audit、Go なら go vet + gosec など）に置き換える。構造（3エージェント並列 + 集計）はそのまま使える。

## Phase 3 — 集計レポート

3エージェントの結果をまとめてレポートを出力する。

```
## Orchestration Report: <task>

### Plan Executed
<要約>

### TDD Status
- Cycle completed: Red → Green → Refactor
- Tests added: N
- All tests passing: yes / no

### Code Review
**Blockers:** <list or "none">
**Suggestions:** <list or "none">

### Security Review
**Critical:** <list or "none">
**Warnings:** <list or "none">
```

ブロッカーや重大なセキュリティ問題があれば、その時点で停止。完了を宣言しない。

## なぜ「1メッセージに全部」が重要か

AIエージェントのマルチエージェント実行は、1つのターンに複数のエージェント呼び出しを並べることで並列化される。別々のメッセージで送ると**順番に実行されてしまう**。

```
# ❌ 順番になる
Agent(tdd-guide): "..."
// 待機
Agent(code-reviewer): "..."
// 待機
Agent(security-reviewer): "..."

# ✅ 並列になる（1メッセージ内）
Agent(tdd-guide): "..."
Agent(code-reviewer): "..."      ← 同時
Agent(security-reviewer): "..."  ← 同時
```

3つのレビューを直列で待つと、単純計算でレビュー時間が3倍かかる。

## Definition of Done

全項目をパスしてはじめて完了とする。

```
cargo test — 全テスト通過
npm run test — 全テスト通過
ビルド成功
Clippy 警告なし（pedantic）
コードレビューのブロッカーなし
セキュリティの重大問題なし
```

1つでも落ちたらリリースしない。DoD はエージェントが都合よく解釈できないよう、チェックリスト形式で機械的に判定する。

## まとめ

- 計画は直列（次フェーズへの入力になるため並列化できない）
- レビューは並列（独立しているため同時に走らせられる）
- planner はツール制限でコードを「書けない」ようにする
- tdd-guide は Kent Beck canonical TDD 5ステップ — テストリスト作成が起点
- code-reviewer はリファクタリングルール違反を最重要チェック項目に置く
- security-reviewer は Tauri 固有の capability 検査から始める
- 1メッセージに全エージェント呼び出しをまとめることが並列化の鍵
- ブロッカーが1つでも残ったら完了宣言しない

trivial な変更（変数名の修正など）にはこのフローは使わない。計画が必要なタスクにだけ適用する。
