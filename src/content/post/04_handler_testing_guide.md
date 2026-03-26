---
title: "第4章：ハンドラーテストの書き方"
description: GoバックエンドのハンドラーテストをGinとmockeryを使って記述する方法。モックの生成から境界値テスト、HTTPレスポンス検証まで実践的に解説。
date: 2026-03-10
tags: ["Go", "Golang", "Backend", "Testing", "Gin"]
---

# ハンドラーテストの書き方

## はじめに

ハンドラーテストはHTTPのリクエスト＆レスポンスをそのままテストできるのが強み。モックを差し込んでインフラなしで動かせるので、CIも速い。DBを立ち上げなくていいのが地味にありがたい。

この章では「どうテストファイルを整理して」「どう認証情報を渡して」「どうアサーションを書くか」の3点を実際のコードベースのパターンからまとめた。

### テストする範囲

| 対象                            | 必須    |
| ------------------------------- | ------- |
| **Handler（各エンドポイント）** | ✅ 必須 |
| Domain: ValueObject             | ✅ 必須 |
| Domain: Entity                  | ✅ 必須 |
| Domain: Service                 | ✅ 必須 |
| UseCase                         | —       |
| Repository                      | —       |

**最低限**: 各エンドポイントにつき**正常系を 1 件**以上テストすること。

---

## 1. ディレクトリ構造

ハンドラーと並行した `handler_test` ディレクトリを作って、**メソッド別にファイルを分割**する。

```
src/internal/
├── handler/                         # 実装ファイル
│   └── auth_handler.go
│   └── health_handler.go
│   └── product_handler.go
└── handler_test/                    # テストファイル
    ├── shared/                      # 共通テストユーティリティ
    │   └── setup.go
    ├── auth_handler/
    │   ├── login_test.go            # Login メソッドのテスト
    │   ├── logout_test.go
    │   ├── refresh_test.go
    │   └── me_test.go
    ├── health_handler/
    │   └── health_check_test.go
    └── product_handler/
        ├── fetch_products_test.go   # FetchProducts メソッドのテスト
        └── create_product_test.go   # CreateProduct メソッドのテスト
```

なんでhandler_test/ディレクトリを実装と並行して別に作るの？↓

- テストファイルを専用ディレクトリに分けることで、実装コードとテストコードが混在しない。どのハンドラーのどのメソッド用かがディレクトリ名とファイル名で一目でわかる設計になる。

---

## 2. 命名規則

| 対象           | 規則                           | 例                      |
| -------------- | ------------------------------ | ----------------------- |
| ディレクトリ   | ハンドラーファイル名と同じ     | `auth_handler/`         |
| テストファイル | `{メソッド名}_test.go`         | `login_test.go`         |
| テスト関数     | `Test{Handler名}_{メソッド名}` | `TestAuthHandler_Login` |
| パッケージ名   | `handler_test` で統一          | `package handler_test`  |

---

## 3. テスト環境の初期化

各テスト関数の冒頭で必ず `shared.SetupTestEnvironment(t)` を呼び出す。

```go
package handler_test

import (
    "net/http"
    "net/http/httptest"
    "testing"

    "myapp/internal/handler_test/shared"
    "github.com/stretchr/testify/assert"
)

func TestHealthHandler_HealthCheck(t *testing.T) {
    // ✅ 必須: テスト環境の初期化（毎回リセット）
    shared.SetupTestEnvironment(t)

    req, _ := http.NewRequest("GET", "/health", nil)
    w := httptest.NewRecorder()
    shared.TestRouter.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
}
```

shared.SetupTestEnvironment(t)ってなんぞや？↓

- テストの実行前にDB・ルーター・モックを初期化してリセットするヘルパー関数。各テストで毎回呼ぶことで、テストが前のテストの状態に影響されなくなる（テストの独立性を保つ）。

サブテストを使用する場合：

```go
func TestProductHandler_CreateProduct(t *testing.T) {
    t.Run("正常系_作成成功", func(t *testing.T) {
        shared.SetupTestEnvironment(t)
        // テストロジック...
    })

    t.Run("異常系_名前が空", func(t *testing.T) {
        shared.SetupTestEnvironment(t)
        // テストロジック...
    })
}
```

---

## 4. HTTP リクエストの作成パターン

### 認証が必要なテスト

認証が必要なエンドポイントでは `shared.NewRequest` を使う。この関数が自動でログイン処理を行い、JWT・CSRF トークンをセットする。

```go
func TestProductHandler_FetchProducts(t *testing.T) {
    shared.SetupTestEnvironment(t)

    // テスト用ユーザーを作成（認証情報が自動設定される）
    user := shared.CreateLoginUser()

    req := shared.NewRequest(t, user, "GET", "/products", nil)

    w := httptest.NewRecorder()
    shared.TestRouter.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
}
```

### 認証が不要なテスト

認証不要なエンドポイント（ログイン・ヘルスチェック等）や 401 を確認するテストでは `http.NewRequest` を使う。

```go
func TestAuthHandler_Login(t *testing.T) {
    shared.SetupTestEnvironment(t)

    // 認証不要なのでそのままリクエスト
    req, _ := http.NewRequest("POST", "/login", strings.NewReader(`{
        "email": "test@example.com",
        "password": "password123",
        "shopCode": "SHOP001"
    }`))
    req.Header.Set("Content-Type", "application/json")

    w := httptest.NewRecorder()
    shared.TestRouter.ServeHTTP(w, req)

    assert.Equal(t, http.StatusOK, w.Code)
}
```

shared.NewRequestとhttp.NewRequestの使い分けってなんぞや？↓

- **shared.NewRequest**は認証が必要なエンドポイント用で、自動でログイン処理・JWT・CSRFトークンをセットしてくれる。
- **http.NewRequest**は認証不要なエンドポイント（ログイン・ヘルスチェック）や4、0、1を確認するテストで使う生のHTTPリクエスト。

### リクエストボディが必要なテスト

```go
func TestProductHandler_CreateProduct(t *testing.T) {
    shared.SetupTestEnvironment(t)

    user := shared.CreateLoginUser()

    // リクエストボディを準備
    requestData := map[string]interface{}{
        "name":  "テスト商品",
        "price": 1500,
    }
    requestBody, err := json.Marshal(requestData)
    require.NoError(t, err)

    req := shared.NewRequest(
        t,
        user,
        "POST",
        "/products",
        strings.NewReader(string(requestBody)),
    )

    w := httptest.NewRecorder()
    shared.TestRouter.ServeHTTP(w, req)

    assert.Equal(t, http.StatusCreated, w.Code)
}
```

---

## 5. アサーション

### `require` vs `assert` の使い分け

| 関数        | 用途                               | 失敗時の動作       |
| ----------- | ---------------------------------- | ------------------ |
| `require.*` | 重要な検証（後続テストに影響する） | **テストを即停止** |
| `assert.*`  | 継続可能な検証                     | テストを継続       |

requireとassertの使い分けってなんぞや？↓

- **require**は「これが失敗したら後続テストの意味がない」ケースに使う。例えばステータスコードが200じゃないのにレスポンスボディをパースしようとしても意味がないので、 `require.Equal(t, http.StatusOK, w.Code)` で即停止させる。
- **assert**はそのテスト内で複数の項目をまとめて検証したいときに使う。一箇所失敗しても残りの検証も続けてくれるので、何が壊れているか一度に把握できる。
- 「ステータスコードはrequire、レスポンスボディはassert」と覚えておくと迷わない。

```go
func TestProductHandler_FetchProducts(t *testing.T) {
    shared.SetupTestEnvironment(t)
    user := shared.CreateLoginUser()

    req := shared.NewRequest(t, user, "GET", "/products", nil)
    w := httptest.NewRecorder()
    shared.TestRouter.ServeHTTP(w, req)

    // ✅ require: ステータスコードは重要なのでここで停止
    require.Equal(t, http.StatusOK, w.Code)

    // ✅ assert: レスポンスボディの検証は継続
    var response map[string]interface{}
    err := json.Unmarshal(w.Body.Bytes(), &response)
    assert.NoError(t, err)
    assert.NotNil(t, response["data"])
}
```

---

## 6. 新しいハンドラーテストの追加手順

### Step 1: ディレクトリ作成

```bash
mkdir -p src/internal/handler_test/product_handler
```

### Step 2: テストファイルの作成

```go
// handler_test/product_handler/fetch_products_test.go
package handler_test

import (
    "encoding/json"
    "net/http"
    "net/http/httptest"
    "testing"

    "myapp/internal/handler_test/shared"

    "github.com/stretchr/testify/assert"
    "github.com/stretchr/testify/require"
)

func TestProductHandler_FetchProducts(t *testing.T) {
    t.Run("正常系_一覧取得成功", func(t *testing.T) {
        shared.SetupTestEnvironment(t)

        user := shared.CreateLoginUser()
        req := shared.NewRequest(t, user, "GET", "/products", nil)

        w := httptest.NewRecorder()
        shared.TestRouter.ServeHTTP(w, req)

        require.Equal(t, http.StatusOK, w.Code)

        var response map[string]interface{}
        err := json.Unmarshal(w.Body.Bytes(), &response)
        assert.NoError(t, err)
        assert.NotNil(t, response["data"])
    })

    t.Run("異常系_未認証は401", func(t *testing.T) {
        shared.SetupTestEnvironment(t)

        // 認証なし
        req, _ := http.NewRequest("GET", "/products", nil)
        w := httptest.NewRecorder()
        shared.TestRouter.ServeHTTP(w, req)

        assert.Equal(t, http.StatusUnauthorized, w.Code)
    })
}
```

---

## 7. テスト実行コマンド

```bash
# 全ハンドラーテストを実行
make test-c

# 特定ハンドラーのテストを実行
make test-store-handler handler=product_handler

# 特定のテスト関数を実行
make test-store-handler-func handler=product_handler func=TestProductHandler_FetchProducts

# カバレッジ確認
make coverage-d grep=handler
make coverage-d grep=store/product
```

---

## 8. ベストプラクティス

### テストの独立性を保つ

```go
// ✅ 各テストは独立している
func TestProductHandler_FetchProducts(t *testing.T) {
    t.Run("正常系", func(t *testing.T) {
        shared.SetupTestEnvironment(t)  // 毎回リセット
        // ...
    })
}

func TestProductHandler_CreateProduct(t *testing.T) {
    t.Run("正常系", func(t *testing.T) {
        shared.SetupTestEnvironment(t)  // 毎回リセット
        // ...
    })
}
```

### 認証テストの標準化

```go
// ✅ 認証あり: shared.NewRequest を使う
req := shared.NewRequest(t, user, "GET", "/products", nil)

// ✅ 認証なし: http.NewRequest を使う
req, _ := http.NewRequest("POST", "/login", body)
```

### リーダブルなテスト名

```go
// ✅ 日本語で意図が明確なサブテスト名
t.Run("正常系_ログイン成功", ...)
t.Run("異常系_パスワード不正", ...)
t.Run("異常系_メールアドレス不存在", ...)
```

---

## まとめ

| ポイント     | 内容                                         |
| ------------ | -------------------------------------------- |
| ディレクトリ | ハンドラーと並行した `handler_test/` 配下    |
| ファイル分割 | メソッド単位でファイルを分割                 |
| 命名         | `Test{Handler名}_{メソッド名}`               |
| 初期化       | 必ず `shared.SetupTestEnvironment(t)` を呼ぶ |
| 認証あり     | `shared.NewRequest()` を使用                 |
| 認証なし     | `http.NewRequest()` を使用                   |
| アサーション | 重要な検証に `require`、それ以外に `assert`  |
| 最低基準     | 各エンドポイントの正常系を 1 件以上          |

---

> 共著: [@citcho](https://github.com/citcho)
