---
title: "第5章：Gin + JWT による認証設計と実装パターン"
description: GinフレームワークとJWTを使った認証設計。HTTPOnly CookieによるセキュアなトークンストレージとXSS対策、リフレッシュトークンの実装パターンを解説。
date: 2026-03-10
tags: ["Go", "Golang", "Backend", "Gin", "JWT", "Authentication"]
---

## はじめに

JWTをlocalStorageに入れるとXSSで盗まれるので、HTTPOnly Cookieに入れる設計がスタンダードらしい(公式俺々要約)  
バックエンドだけがCookieを読めるので、JavaScriptからトークンにアクセスできない。CSRFはCSRFトークンで別途対策する。

---

## 1. 認証方式の概要

### 使用するトークン

| トークン種類            | 有効期間 | 用途                     |
| ----------------------- | -------- | ------------------------ |
| アクセストークン（JWT） | 24 時間  | API 認証                 |
| リフレッシュトークン    | 7 日間   | アクセストークンの再発行 |
| CSRF トークン           | 24 時間  | CSRF 攻撃防止            |

### Cookie 管理

全トークンは **HTTPOnly Cookie** として管理する。

| Cookie 名       | 有効期間 | パス       | HTTPOnly | Secure |
| --------------- | -------- | ---------- | -------- | ------ |
| `jwt`           | 24 時間  | `/`        | ✅       | ✅     |
| `refresh_token` | 7 日     | `/refresh` | ✅       | ✅     |
| `csrf`          | 24 時間  | `/`        | ✅       | ❌     |

> **なぜ HTTPOnly Cookie か**: JavaScript からトークンにアクセスできないため、XSS 攻撃によるトークン窃取を防止できる。

CSRFってなんぞや？↓

- **CSRF（クロスサイトリクエストフォージェリ）**は、ユーザーが意図しないリクエストを第三者のサイト経由で実行させる攻撃。別サイトから「送金してください」CSRFトークンをJavaScriptから読み取れる別Cookieに入れてヘッダーに付けさせることで、「同じサイトからのリクエストしか届かない」状態にする。

---

## 2. ログインフロー

```
クライアント
  │
  │ POST /login { email, password, shopCode }
  │
  ▼
Handler
  │
  │ 1. メールアドレス・パスワードの検証
  │ 2. 対象店舗の取得（shopCode から）
  │ 3. ユーザーの店舗アクセス権限チェック
  │ 4. JWT・リフレッシュ・CSRF トークン生成
  │ 5. HTTPOnly Cookie にセット
  │
  ▼
クライアント（Cookie を受け取る）
```

### ログインリクエスト例

```http
POST /login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "password123",
  "shopCode": "SHOP001"
}
```

---

## 3. 権限モデル

アカウントタイプによってアクセスできるデータの範囲が違う。

| アカウントタイプ               | アクセス範囲                             |
| ------------------------------ | ---------------------------------------- |
| 本部（headquarters）           | 全店舗にアクセス可能                     |
| システム管理者（system_admin） | 全店舗にアクセス可能                     |
| 販売代理店（dealer）           | 同じ代理店 ID の所属プロジェクト店舗のみ |
| オーナー（owner）              | 所属プロジェクトの店舗のみ               |
| 店長（manager）                | 所属店舗のみ                             |
| スタッフ（staff）              | 所属店舗のみ                             |

---

## 4. JWT 認証ミドルウェア

`/health` と `/login` を除く全エンドポイントで認証が動く。

```go
// internal/middleware/jwt_middleware.go
package middleware

import (
    "net/http"

    "github.com/gin-gonic/gin"
    "myapp/internal/common/ctxkeys"
)

func JWTAuthMiddleware() gin.HandlerFunc {
    // 認証をスキップするパス
    skipPaths := []string{"/health", "/login"}

    return func(c *gin.Context) {
        for _, path := range skipPaths {
            if c.Request.URL.Path == path {
                c.Next()
                return
            }
        }

        // Cookie から JWT トークンを取得
        tokenString, err := c.Cookie("jwt")
        if err != nil {
            c.JSON(http.StatusUnauthorized, gin.H{"message": "認証が必要です"})
            c.Abort()
            return
        }

        // トークン検証・クレーム取得
        claims, err := verifyToken(tokenString)
        if err != nil {
            c.JSON(http.StatusUnauthorized, gin.H{"message": "トークンが無効です"})
            c.Abort()
            return
        }

        // コンテキストに認証情報を設定
        c.Set(ctxkeys.LoginShopKey, types.LoginShop{
            ShopID:    claims.ShopID,
            ProjectID: claims.ProjectID,
        })
        c.Set(ctxkeys.LoginAdministratorKey, types.LoginAdministrator{
            ID:          claims.UserID,
            Name:        claims.Name,
            Email:       claims.Email,
            AccountType: claims.AccountType,
        })

        c.Next()
    }
}
```

ミドルウェアってなんぞや？↓

- **ミドルウェア**は、ルートのハンドラーが実行される前後に挑まる処理のこと。認証・ログ・CORS設定など「全エンドポイントに共通する処理」をここに書くことで、各ハンドラーで同じコードを繰り返さなくて済む。

---

## 5. セッション管理（コンテキストキー）

認証後の情報は Gin のコンテキストに保持される。

### コンテキストキー定数

```go
// internal/common/ctxkeys/context_key.go
package ctxkeys

const (
    LoginAdministratorKey = "login_administrator"  // ログインユーザー情報
    LoginShopKey          = "login_shop"            // ログイン店舗情報
)
```

### データ構造

```go
// internal/pkg/types/login_user.go
package types

// LoginAdministrator: ログインユーザー情報
type LoginAdministrator struct {
    ID          uint    // ユーザー ID
    ShopID      *uint   // 所属店舗 ID（nullable: 本部・システム管理者はnull）
    ProjectID   *uint   // 所属プロジェクト ID（nullable）
    DealerID    *uint   // 所属代理店 ID（nullable）
    Name        string  // ユーザー名
    Email       string  // メールアドレス
    AccountType string  // アカウントタイプ
}

// LoginShop: ログイン店舗情報
type LoginShop struct {
    ShopID    uint  // 店舗 ID
    ProjectID uint  // プロジェクト ID
}
```

---

## 6. ハンドラーでの認証情報取得

### 店舗情報の取得

```go
func (h *ProductHandler) CreateProduct(c *gin.Context) {
    // 店舗情報を取得
    shopInfo, ok := c.Get(ctxkeys.LoginShopKey)
    if !ok {
        c.JSON(http.StatusInternalServerError, gin.H{"message": "Internal server error"})
        return
    }

    // 型アサーション
    shop := shopInfo.(types.LoginShop)
    shopID    := shop.ShopID
    projectID := shop.ProjectID

    // 以降の処理で使用
    result, err := h.createProductUseCase.Execute(c.Request.Context(), shopID, req)
    // ...
}
```

### ユーザー情報の取得

```go
func (h *ReportHandler) FetchReport(c *gin.Context) {
    loginUser, ok := c.Get(ctxkeys.LoginAdministratorKey)
    if !ok {
        c.JSON(http.StatusInternalServerError, gin.H{"message": "Internal server error"})
        return
    }

    user := loginUser.(types.LoginAdministrator)
    userID      := user.ID
    accountType := user.AccountType

    // 権限チェックの例
    if accountType == "staff" && user.ShopID == nil {
        c.JSON(http.StatusForbidden, gin.H{"message": "権限がありません"})
        return
    }

    // ...
}
```

### 店舗情報 + ユーザー情報を両方取得

```go
func (h *AnalysisHandler) FetchAnalysis(c *gin.Context) {
    shopInfo, ok := c.Get(ctxkeys.LoginShopKey)
    if !ok {
        c.JSON(http.StatusInternalServerError, gin.H{"message": "Internal server error"})
        return
    }
    shop := shopInfo.(types.LoginShop)

    loginUser, ok := c.Get(ctxkeys.LoginAdministratorKey)
    if !ok {
        c.JSON(http.StatusInternalServerError, gin.H{"message": "Internal server error"})
        return
    }
    user := loginUser.(types.LoginAdministrator)

    result, err := h.fetchAnalysisUseCase.Execute(c.Request.Context(), shop.ShopID, user.ID)
    // ...
}
```

---

## 7. ログアウト

Cookie の有効期限を過去に設定することで削除できる。

```go
func (h *AuthHandler) Logout(c *gin.Context) {
    // Cookie を削除（有効期限を -1 に設定）
    c.SetCookie("jwt", "", -1, "/", "", false, true)
    c.SetCookie("csrf", "", -1, "/", "", false, false)
    c.SetCookie("refresh_token", "", -1, "/refresh", "", false, true)

    c.JSON(http.StatusOK, gin.H{"message": "ログアウトしました"})
}
```

---

## 8. トークンリフレッシュ

```http
POST /refresh
```

処理フロー：

1. Cookie からリフレッシュトークンを取得
2. リフレッシュトークンの署名・有効期限を検証
3. 新しいアクセストークン・リフレッシュトークンを生成
4. 新しいトークンを Cookie にセット

リフレッシュトークンってなんのためにあるの？↓

- アクセストークン（24h）は短员命にしるほどセキュリティが上がるが、それだと毎回ログインし直す缷笾な例えばが起きる。
- リフレッシュトークン（7日）を別途持たせることで、アクセストークンが切れたら自動で再発行できる。ユーザーにはログインし直している感覚がないのに、セキュリティを保てる。
- リフレッシュトークンは `/refresh` パスしか使えない Cookie に入れているので、それ以外のエンドポイントからはアクセスできない。

---

## 9. セキュリティ考慮事項

### トークン保護

```go
// ✅ HTTPOnly Cookie でトークンを管理（JavaScript からアクセス不可）
c.SetCookie("jwt", tokenString, expireSeconds, "/", domain, isSecure, true)

// ✅ CSRF トークンでクロスサイトリクエストの防止
c.SetCookie("csrf", csrfToken, expireSeconds, "/", domain, isSecure, false)
// JavaScript から読める必要があるため HTTPOnly = false
```

### パスワード管理

```go
// ✅ パスワードはハッシュ化して保存
import "golang.org/x/crypto/bcrypt"

hashedPassword, err := bcrypt.GenerateFromPassword([]byte(password), bcrypt.DefaultCost)

// ✅ 検証時はハッシュで比較
err := bcrypt.CompareHashAndPassword(hashedPassword, []byte(inputPassword))
```

bcryptってなんぞや？↓

- **bcrypt**はパスワードを安全にハッシュ化するアルゴリズム。毎回ループを回して計算する「ストレッチング」機能でブルートフォース攻撃を遅らせる設計になっている。
- 「`bcrypt.DefaultCost`」は安全性とパフォーマンスのバランスが平均的な設定値（10）。「10」は2^10=1024回ハッシュ計算を回すことを意味する。
- DBには「ハッシュ化した文字列」だけ保存するので、DBが流出しても元のパスワードはじかにならない。

```go
// ❌ 詳細情報を漏洩させない
c.JSON(http.StatusUnauthorized, gin.H{
    "message": "メールアドレス user@example.com は存在しません",  // 存在確認できてしまう
})

// ✅ 汎用的なメッセージにする
c.JSON(http.StatusUnauthorized, gin.H{
    "message": "メールアドレスまたはパスワードが正しくありません",
})
```

なんで汎用メッセージにするの？↓

- 「そのメールアドレスは存在しません」と返すと、攻撃者に「そのメールアドレスは登録済み」と教えてしまう。登録済みメアドのリスト収集に悪用される。
- 汎用メッセージにすることで「メールアドレスが間違っているのかパスワードが間違っているのか」を攻撃者に漏らさない。地味だけど認証まわりはこういう細かい配慮が積み重なる。

## 10. 関連実装ファイル

| 役割                 | ファイル                                              |
| -------------------- | ----------------------------------------------------- |
| 認証ハンドラー       | `src/internal/handler/auth_handler.go`                |
| ログインユースケース | `src/internal/usecases/auth/usecase/login_usecase.go` |
| JWT ミドルウェア     | `src/internal/middleware/jwt_middleware.go`           |
| JWT 実装             | `src/internal/infrastructure/security/jwt.go`         |
| 型定義               | `src/internal/pkg/types/login_user.go`                |
| コンテキストキー     | `src/internal/common/ctxkeys/context_key.go`          |

---

## まとめ

| ポイント         | 内容                                           |
| ---------------- | ---------------------------------------------- |
| トークン管理     | HTTPOnly Cookie（XSS 対策）                    |
| CSRF 対策        | CSRF トークンを別 Cookie で管理                |
| セッション       | Gin の Context で店舗・ユーザー情報を保持      |
| 取得方法         | `c.Get(ctxkeys.LoginShopKey)` + 型アサーション |
| エラーメッセージ | 認証失敗時は詳細情報を返さない                 |
| スキップパス     | `/health`, `/login` は認証スキップ             |
