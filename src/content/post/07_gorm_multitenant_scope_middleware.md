---
title: "第7章：GORM プラグインによるマルチテナント実装とリクエストミドルウェア"
description: GORMのScope機能とGinミドルウェアを組み合わせたマルチテナント実装。プロジェクトスコープ・ショップスコープの自動適用パターンを詳しく解説。
date: 2026-03-10
tags: ["Go", "Golang", "Backend", "GORM", "MultiTenant", "Middleware"]
---

# GORM プラグインによるマルチテナント実装とリクエストミドルウェア

## はじめに

マルチテナントのSELECT/INSERT/UPDATE/DELETEに毎回`shop_id`を手書きするのはミスのもと。GORMのスコープとして登録しておけば、`WithContext(ctx)`を呼ぶだけで自動でフィルタがかかる。

---

## Part 1: マルチテナントスコープ

### 1.1 概要

marketplaceやSaaSでよくある構成。複数のテナント（店舗・プロジェクト）のデータを 1 つのデータベースで管理するシステムで、「どのテナントのデータか」を SELECT / INSERT / UPDATE / DELETE すべてで意識する必要がある。辺山刈で各層に `shop_id` 条件を手書きすると書き忘れが生まれるので、スコープとして自動化している。

### 2 種類のスコープ

| スコープ            | フィルタリングキー | 有効化方法                                    |
| ------------------- | ------------------ | --------------------------------------------- |
| **GlobalShopScope** | `shop_id`          | デフォルトで自動有効（推奨）                  |
| **ProjectScope**    | `project_id`       | `scope.ProjectScopeAble(db)` で明示的に有効化 |

GORMのスコープってなんぞや？↓

- **GORMスコープ**は、全クエリに自動でWHERE条件を追加する仕組み。マルチテナントでは`shop_id`や`project_id`の絞り込みを毎回手書きしなくていい。
- **マルチテナント**は、1つのDBを複数の店舗・組織が「自分のデータしか見えない」状態で共有するシステム設計。この仕組みのおかげでテナントをまたいだデータ漏洩を防げる。

---

### 1.2 GlobalShopScope（推奨）

GORM プラグインとして全 CRUD に自動適用される。コンテキストに `shop_id` が設定されていれば、WHERE 句に自動で追加される。

```go
import "myapp/internal/common/ctxkeys"

// コンテキストに shop_id をセット（JWT ミドルウェアが自動設定）
ctx := context.WithValue(c.Request.Context(), ctxkeys.ShopIDkey, uint(1))
```

#### SELECT（自動フィルタリング）

```go
// ✅ WHERE shop_id = 1 が自動で付与される
var products []dbmodel.Product
err := db.WithContext(ctx).Find(&products).Error
// → SELECT * FROM products WHERE shop_id = 1 AND deleted_at IS NULL
```

#### CREATE（shop_id 自動設定）

```go
product := dbmodel.Product{
    Name:  "テスト商品",
    Price: 1500,
    // ShopID は自動設定される
}
err := db.WithContext(ctx).Create(&product).Error
// → INSERT INTO products (name, price, shop_id, ...) VALUES ('テスト商品', 1500, 1, ...)
```

#### UPDATE / DELETE（shop_id フィルタ付き）

```go
// UPDATE: shop_id = 1 のレコードのみ更新
err := db.WithContext(ctx).
    Model(&dbmodel.Product{}).
    Where("id = ?", productID).
    Update("name", "更新後").Error

// DELETE: shop_id = 1 のレコードのみ削除
err := db.WithContext(ctx).Delete(&dbmodel.Product{}, productID).Error
```

#### GlobalShopScope をスキップ（管理者機能等）

```go
import "myapp/internal/infrastructure/scope"

// 全店舗のデータを取得（管理者向け）
var allProducts []dbmodel.Product
err := scope.GlobalShopScopeSkip(db).WithContext(ctx).Find(&allProducts).Error
```

---

### 1.3 ProjectScope

明示的な有効化が必要。プロジェクト単位でデータを分離したい場合に使う。

> **重要**: ProjectScope を使うと GlobalShopScope は**自動的に無効化**される。

```go
import "myapp/internal/infrastructure/scope"

// SELECT: project_id = 1 のレコードのみ取得
var users []dbmodel.User
err := scope.ProjectScopeAble(db).WithContext(ctx).Find(&users).Error

// CREATE: project_id が自動設定される
user := dbmodel.User{Name: "テストユーザー"}
err := scope.ProjectScopeAble(db).WithContext(ctx).Create(&user).Error

// UPDATE
err := scope.ProjectScopeAble(db).WithContext(ctx).
    Model(&dbmodel.User{}).
    Where("id = ?", userID).
    Update("name", "更新").Error
```

---

### 1.4 JOIN 設定（shop_id を持たないテーブルのフィルタリング）

`shop_id` や `project_id` カラムを直接持たないテーブルでも、JOIN を経由してフィルタリングを適用できる。

```go
// JOIN 設定の構造体
type ShopJoinConfig struct {
    JoinTable     string // JOIN するテーブル名
    JoinCondition string // JOIN 条件
    ShopIDColumn  string // shop_id カラム名（デフォルト: "shop_id"）
    JoinType      string // JOIN 種別（デフォルト: "INNER"）
}

// 登録例（dbmodel パッケージで事前定義されたものを使用）
globalShopScope := scope.NewGlobalShopScope()
globalShopScope.RegisterJoinConfig(dbmodel.UserProfileShopJoinConfig())
```

```go
// dbmodel パッケージでの JOIN 設定定義例
func UserProfileShopJoinConfig() (string, scope.ShopJoinConfig) {
    return "user_profiles", scope.ShopJoinConfig{
        JoinTable:     "users",
        JoinCondition: "user_profiles.user_id = users.id",
        ShopIDColumn:  "shop_id",
        JoinType:      "INNER",
    }
}
```

> **注意**: UPDATE / DELETE では安全性のため JOIN 機能は使えない。

---

### 1.5 スコープ間の関係

```
通常の GORM 操作
  → GlobalShopScope が自動適用（shop_id でフィルタ）

scope.ProjectScopeAble(db) を使用
  → ProjectScope が有効化
  → GlobalShopScope は自動で無効化（ProjectScope が優先）

scope.GlobalShopScopeSkip(db) を使用
  → GlobalShopScope をバイパス（管理者機能向け）
```

---

### 1.6 実装の注意事項

```
✅ WithContext(ctx) は必須
✅ ProjectScope は明示的に scope.ProjectScopeAble(db) で有効化
✅ UPDATE/DELETE では JOIN 機能は使用不可
✅ スコープ適用済みのエントリポイントを使っているか必ず確認
```

---

## Part 2: TrimWhiteSpaceMiddleware

### 2.1 概要

PUT / POST / PATCH リクエストの文字列フィールドの前後スペースを自動除去するミドルウェア。ユーザーの入力ミス（前後のスペース）によるバグを防げる。

```
入力:  { "name": "  テスト商品  " }
出力:  { "name": "テスト商品" }
```

### 2.2 使用方法

```go
import "myapp/internal/middleware"

func main() {
    r := gin.Default()

    // 全エンドポイントに適用
    r.Use(middleware.TrimWhiteSpaceMiddleware())

    r.POST("/products", createProduct)
    r.PUT("/products/:id", updateProduct)

    r.Run(":8080")
}
```

TrimWhiteSpaceMiddlewareって何してるの？↓

- リクエストのJSONやフォームの文字列フィールドから、前後の不要なスペースを自動で除去するミドルウェア。ユーザーが「　テスト商品　」とスペース付きで送ってきても、サーバー側ではきれいな「テスト商品」として受け取れる。

グループ単位での適用：

```go
api := r.Group("/api")
api.Use(middleware.TrimWhiteSpaceMiddleware())
{
    api.POST("/products", createProduct)
    api.PUT("/products/:id", updateProduct)
}
```

### 2.3 処理対象

| Content-Type          | 処理内容                            |
| --------------------- | ----------------------------------- |
| `application/json`    | JSON 内の全文字列値を再帰的にトリム |
| `multipart/form-data` | テキストフォームフィールドをトリム  |

### 2.4 JSON の処理例

```json
// 入力
{
  "name": "  テスト商品  ",
  "email": " test@example.com ",
  "profile": {
    "bio": "  Software Developer  ",
    "skills": [" Go ", "  JavaScript  "]
  }
}

// 処理後（ネスト・配列も再帰処理される）
{
  "name": "テスト商品",
  "email": "test@example.com",
  "profile": {
    "bio": "Software Developer",
    "skills": ["Go", "JavaScript"]
  }
}
```

### 2.5 multipart/form-data の処理例

```
// 入力フィールド
name: "  テスト商品  "
description: " 商品説明 "

// 処理後
name: "テスト商品"
description: "商品説明"
```

### 2.6 処理されない条件

```
❌ GET、DELETE などのメソッド
❌ リクエストボディが空の場合
❌ JSON が無効な形式の場合
❌ ファイルアップロードフィールド（バイナリデータ）
```

### 2.7 注意事項

| 項目                 | 詳細                                                                 |
| -------------------- | -------------------------------------------------------------------- |
| パフォーマンス       | リクエストボディ全体をメモリに読み込むため、大きなペイロードには注意 |
| エラー時の挙動       | パースエラー発生時は元のリクエストをそのまま次のハンドラに渡す       |
| 文字エンコーディング | UTF-8 を前提                                                         |
| 数値・真偽値         | 変更されない（文字列のみ対象）                                       |

---

## Part 3: JST プラグイン（JSTPlugin）

### 3.1 概要

GORM の `gorm:after_query` コールバックを使って、クエリ結果の全 `time.Time` フィールドを自動的に JST（Asia/Tokyo）に変換するプラグイン。

```go
// DB 初期化時にプラグインを登録
db.Use(scope.NewJSTPlugin())
```

JSTPluginってなんぞや？↓

- **GORMプラグイン**はGORMの処理フックに独自処理を差し込む仕組み。JSTPluginはクエリ実行後（`gorm:after_query`）に自動でtime.TimeフィールドをJSTに変換する。詳細は「Go × MySQL のタイムゾーン設計」の章を参照。

詳細は「Go × MySQL のタイムゾーン設計」ガイドを参照してください。

---

## まとめ

| 機能                 | 要点                                                            |
| -------------------- | --------------------------------------------------------------- |
| GlobalShopScope      | デフォルト有効、`WithContext(ctx)` で自動フィルタ               |
| ProjectScope         | 明示的に `scope.ProjectScopeAble(db)` で有効化                  |
| JOIN 設定            | `shop_id`/`project_id` のないテーブルも JOIN でフィルタ適用可能 |
| スコープの優先順位   | ProjectScope > GlobalShopScope                                  |
| UPDATE/DELETE の制約 | JOIN 機能は使用不可                                             |
| TrimWhiteSpace       | POST/PUT/PATCH の文字列フィールドの前後スペースを自動除去       |
| JST プラグイン       | クエリ後に `time.Time` を自動で JST 変換                        |
