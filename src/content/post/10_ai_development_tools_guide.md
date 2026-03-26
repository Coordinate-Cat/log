---
title: "第10章：AI 開発支援ツール活用ガイド"
description: GitHub CopilotやAIエージェントを活用したバックエンド開発効率化ガイド。Memory Bankの管理からコードレビュー支援まで、開発チーム全員が活用できる実践的なAIツール活用方法を解説。
date: 2026-03-13
tags: ["Go", "Golang", "Backend", "AI", "GitHubCopilot", "DevelopmentTools"]
---

## はじめに

AIを使い倒す方法をまとめた。コードに組み込むFactory、Copilotのプロンプト術、エージェントにプロジェクトを記憶させるMemory Bank、3つのパートに分けて書いた。

---

## Part 1: アプリケーションへの AI 統合

### 1.1 概要

バックエンドアプリケーションに AI チャット機能を組み込む際、**複数の AI プロバイダーを統一インターフェースで切り替えられる Factory パターン**を採用している。

対応プロバイダー：

- **OpenAI**（GPT-4o 等）
- **Gemini**（Gemini 2.5 Pro 等）
- **Perplexity**（Sonar 等）

---

### 1.2 基本的な使い方

#### Factory パターン（推奨）

```go
import "myapp/internal/pkg/ai"

// 環境変数に基づいて AI クライアントを自動生成
client, err := ai.NewAIClientFromEnv()
if err != nil {
    return fmt.Errorf("AI クライアントの生成に失敗: %w", err)
}

response, err := client.Chat(ctx,
    "You are a helpful assistant.",
    "Clean Architecture を日本語で説明してください",
)
```

Factoryパターンってなんぞや？↓

- **Factoryパターン**は、オブジェクトを生成するロジックを一つの関数やクラスにまとめる設計パターン。呼び出し側は「どのAIプロバイダーか」を意識しなくていい。環境変数を変えるだけでOpenAI→Geminiと切り替えられる。

#### プロバイダーを直接指定

```go
// OpenAI
openaiClient, err := ai.NewAIClient(ai.ProviderOpenAI)

// Gemini
geminiClient, err := ai.NewAIClient(ai.ProviderGemini)

// Perplexity
perplexityClient, err := ai.NewAIClient(ai.ProviderPerplexity)
```

---

### 1.3 環境変数

```bash
# プロバイダー選択（デフォルト: openai）
export AI_PROVIDER="openai"  # または "gemini", "perplexity"

# OpenAI
export OPENAI_API_KEY="sk-proj-..."
export OPENAI_MODEL="gpt-4o"           # オプション

# Gemini
export GEMINI_API_KEY="AIza..."
export GEMINI_MODEL="gemini-2.5-pro"   # オプション

# Perplexity
export PERPLEXITY_API_KEY="pplx-..."
export PERPLEXITY_MODEL="sonar"        # オプション
```

---

### 1.4 UseCase での使い方

```go
type AnalysisUseCase struct {
    aiClient ai.AIClient
}

func NewAnalysisUseCase(aiClient ai.AIClient) *AnalysisUseCase {
    return &AnalysisUseCase{aiClient: aiClient}
}

func (uc *AnalysisUseCase) Execute(ctx context.Context, data string) (string, error) {
    systemPrompt := "你は熟練のデータアナリストです。"
    userPrompt := fmt.Sprintf("以下のデータを分析してください: %s", data)
    return uc.aiClient.Chat(ctx, systemPrompt, userPrompt)
}
```

#### Wire による依存性注入

```go
// wire.go
func NewAIClient() (ai.AIClient, error) {
    return ai.NewAIClientFromEnv()
}

var AISet = wire.NewSet(
    NewAIClient,
    NewAnalysisUseCase,
)
```

---

### 1.5 プロバイダーの選択指針

| プロバイダー   | 向いているユースケース                                       |
| -------------- | ------------------------------------------------------------ |
| **OpenAI**     | 高精度な推論、Function Calling、構造化出力が必要な場合       |
| **Gemini**     | 大量テキスト処理（長いコンテキスト）、多言語対応が重要な場合 |
| **Perplexity** | リアルタイムの情報検索、引用付き回答、調査・研究用途         |

| 環境 | 推奨プロバイダー        | 理由             |
| ---- | ----------------------- | ---------------- |
| 本番 | OpenAI (gpt-4o)         | 高品質           |
| 開発 | Gemini (gemini-2.5-pro) | コスト効率       |
| 調査 | Perplexity (sonar)      | リアルタイム情報 |

---

### 1.6 エラーハンドリング

```go
client, err := ai.NewAIClient(ai.ProviderGemini)
if err != nil {
    // APIキー未設定 / クライアント初期化失敗
    return fmt.Errorf("AI クライアントの生成に失敗: %w", err)
}

response, err := client.Chat(ctx, systemPrompt, userPrompt)
if err != nil {
    // API 呼び出し失敗
    return fmt.Errorf("AI チャットが失敗しました: %w", err)
}
```

---

## Part 2: GitHub Copilot の効果的な使い方

Copilot はタコ打ちしてもそれなりの精度を返すが、プロンプトの書き方を少し意識するだけでアウトプットの質が全然違う。「ちょっと輪郭をかけて」くらいの意識で丁寧に書くと、コード生成からレビューからドキュメント生成まで次元が違う成果を返す。

### 2.1 目的

- 高精度なコード・ドキュメント・レビュー成果物を生成
- 不要なトークン消費を抑える
- 既存の開発フローと品質基準を維持

---

### 2.2 高精度プロンプトの書き方

冒頭で**目的を明確に**書く：

「そっちのコードをいい感じにして」だと曖昧すぎてAIの精度が落ちる。`Generate:` / `Refactor:` / `Review:` のように動詞で始めて「何をしてほしいか」を先に明示するのがコツ。

```
Generate: / Refactor: / Review: / Explain:
```

#### プロンプト例

```
Generate: src/internal/domain/user/entity/user.go の NewUser をリファクタリングしてください。
入力バリデーションをドメインの value object に委譲し、既存テストを壊さない構造にしてください。
現状のバリデーションはこのスニペットを参照 → <抜粋コード>
```

```
/tests 次の条件でユニットテストを追加してください。
対象: src/internal/domain/shop/entity/shop.go の NewShop
正常系とエラー（名称未入力）を網羅してください。
```

```
Review: PR の差分を確認し、非同期処理のエラーハンドリング漏れがないか重点的に指摘してください。
コード修正は不要で、懸念点のみ箇条書きで返答してください。
```

---

### 2.3 スラッシュコマンド一覧

| コマンド   | 用途             |
| ---------- | ---------------- |
| `/tests`   | テストコード生成 |
| `/explain` | コードの説明     |
| `/fix`     | バグ修正案の提示 |
| `/docs`    | ドキュメント生成 |

---

### 2.4 ショートカット（VS Code）

| 操作                | キー            |
| ------------------- | --------------- |
| 提案を受け入れる    | `Tab`           |
| 提案を拒否          | `Esc`           |
| 複数の提案を表示    | `Ctrl + Return` |
| Copilot Chat        | `⌘ + i`         |
| Copilot Chat Editor | `⌘ + Shift + i` |

---

### 2.5 トークン効率化のコツ

トークンを無駄に使うメリットはないし、コンテキストは自分で管理するのが基本。太いファイルを丸ごと放り込んでも精度は上がらない。関連する部分だけに絞ってコンテキストに渡すと精度が上がる。

```
✅ プロンプトは 30 行以内に収める
✅ 箇条書き・番号付きリストを優先（長文は避ける）
✅ ファイル全体ではなく代表的な抜粋を提示
✅ 再実行時は前回のレスポンスを参照（全文の再掲を避ける）
✅ 大きく方向転換する際はチャットをリセット
```

---

### 2.6 プロンプトの記法テクニック

| テクニック                   | 例                                                                             |
| ---------------------------- | ------------------------------------------------------------------------------ |
| コロンを使って入力を明示     | `テキストを日本語にしてください。`<br>`テキスト: "Hello World."`               |
| ナンバリングでステップを指定 | `ステップバイステップで実装してください`<br>`1. 値を受け取る`<br>`2. 計算する` |

---

### 2.7 推奨ワークフロー

| フェーズ      | 活用方法                                                    |
| ------------- | ----------------------------------------------------------- |
| **Plan**      | Copilot Chat に計画案を下書きさせ、手順を整理               |
| **Implement** | インライン提案を確認しながら 1 関数ずつ集中                 |
| **Validate**  | テスト方針を説明させたうえでローカル検証 (`make lint test`) |
| **Review**    | リスクのある差分を抽出させ、最終判断は人間が行う            |
| **Document**  | ドキュメント草案を生成させ、要点を手作業で精査              |

---

### 2.8 品質チェックリスト

Copilotの出力はあくまで「案」で、最終的な責任は実装者にある。特に未導入の importやエラーハンドリングの漏れはよくあるので、受け取ったら必ず目を通す。

**出力受領後に確認すること：**

```
□ 未導入の import がないか
□ エラーハンドリングが適切か
□ 並行処理のリスクはないか
□ プロジェクトのコーディング規約に準拠しているか
□ テストは成功/失敗双方をカバーしているか
```

---

## Part 3: AI エージェント（Cline 等）の活用

### 3.1 Memory Bank パターン

AI エージェントはセッションをまたいで記憶を保持できないため、**Memory Bank** というドキュメント群でプロジェクトの状態を管理する。

```
memory-bank/
  projectbrief.md     # プロジェクトの概要・ゴール（最重要）
  productContext.md   # なぜこのプロダクトが存在するか
  systemPatterns.md   # アーキテクチャ・設計パターン
  techContext.md      # 技術スタック・依存関係
  activeContext.md    # 現在の作業フォーカス・次のステップ
  progress.md         # 完了したこと・残りのタスク・既知の問題
```

Memory Bankってなんで必要なの？↓

- **AIエージェントはセッションをまたいで記憶を保持できない**。次のセッションを始めた時にはプロジェクトのことを何も覚えていない状態になる。
- **Memory Bankのファイルを最初に読ませる**ことで、エージェントが「このプロジェクトの設計パターン」「今作業中の内容」「残りのタスク」を把握した状態から仕事を始められる。精度が直結するのでちゃんと更新しておくのが大事。

### 依存関係（更新順序）

```
projectbrief.md
  ├── productContext.md
  ├── systemPatterns.md
  └── techContext.md
           └── activeContext.md
                    └── progress.md
```

---

### 3.2 Memory Bank の活用方法

- **タスク開始時**: Memory Bank の全ファイルを読み込む
- **実装後**: `activeContext.md` と `progress.md` を更新
- **大きな変更後**: 関連する全ファイルを見直して更新

> Memory Bank の精度がエージェントの作業品質に直結する。
> 「update memory bank」と伝えると全ファイルを見直してくれる。

---

### 3.3 `.clinerules` ファイル

プロジェクト固有のパターンや学習事項を蓄積するファイル。

**記録すべき内容：**

- 重要な実装パスとパターン
- ユーザーの好みやワークフロー
- プロジェクト固有の設計ルール
- 既知の落とし穴と解決策

```markdown
# .clinerules 例

- テストは make test-c を使用（go test コマンドは直接使わない）
- エラー処理は cockroachdb/errors パッケージを使う
- DB スコープは scope.GlobalShopScopeSkip で管理画面と通常画面を分ける
```

---

## まとめ

| ツール                          | 主な用途                                                                       |
| ------------------------------- | ------------------------------------------------------------------------------ |
| **AI Client（アプリ組み込み）** | チャット・分析・自動化機能の実装。Factory パターンでプロバイダーを切り替え可能 |
| **GitHub Copilot**              | コード生成・リファクタリング・テスト生成・レビュー支援                         |
| **AI エージェント（Cline 等）** | 複数ファイルにまたがる大規模な作業。Memory Bank で文脈を継続                   |
