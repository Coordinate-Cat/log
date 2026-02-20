---
title: "第1章:Golangコーディング規約と命名パターン"
description: Golangの基本ルール・命名規則・エラーハンドリング・並行処理など、現場で使われるコーディング規約を具体例とともに解説。
date: 2026-02-20
tags: ["Go", "Golang", "CodingGuidelines"]
---

# 目次
- [はじめに](#はじめに)
- [1. 基本ルール](#1-基本ルール)
- [2. 命名規則](#2-命名規則)
- [3. コメント規則](#3-コメント規則)
- [4. 構造体のフィールド順序](#4-構造体のフィールド順序)
- [5. インポートのグループ化](#5-インポートのグループ化)
- [6. エラーハンドリング](#6-エラーハンドリング)
- [7. 並行処理](#7-並行処理)
- [8. テスト](#8-テスト)
- [9. Boolean 変数の命名パターン](#9-boolean-変数の命名パターン)
- [10. データアクセス層の設計原則](#10-データアクセス層の設計原則)
- [11. ValueObject の作成基準](#11-valueobject-の作成基準)
- [まとめ](#まとめ)

## はじめに

Golangはシンプルさと効率性を重視した言語らしい(公式俺々要約)  
他言語の経験があって、Golangを初めて書く方、フロント人間(筆者)、プログラミングの基礎を理解してるとまあ分かるんじゃないか

---

## 1. 基本ルール

| カテゴリ | ルール | 例 |
|----------|--------|----|
| インデント | **タブ**を使用（スペース不可） | `func sample() {`<br>`	statements` |
| 行の長さ | 制限なし（長い場合は適切な位置で改行） | — |
| ファイル名 | **スネークケース**（すべて小文字） | `user_handler.go`, `db_connection.go` |
| ファイル構成 | 1ファイル = 1パッケージ | `package handlers` |
| コーディング順序 | ①型定義（struct, interface） → ②メソッド → ③関連関数 | — |

---

## 2. 命名規則

### 2.1 パッケージ名

```go
// ✅ おっけー
package http        // 小文字で短く、単一語
package bytes       // 小文字で短く、単一語
package strings     // 小文字で短く、単一語

// ❌ だめ
package HTTP         // 大文字は使わん
package string_util  // アンダースコア不要
```

- 小文字のみ
- 短く簡潔な単一語
- アンダースコア・混合大文字は避ける

### 2.2 変数名

```go
// ✅ キャメルケース
userID    := 1 // 公開変数は PascalCase でなく camelCase
firstName := "John" // スネークケースは不可

// ❌ だめ
UserID     := 1   // PascalCase は非公開変数には使わん
first_name := ""  // スネークケース不可
```

| スコープ | 方針 |
|---------|------|
| ローカル変数 | 短く簡潔（`i`, `sum`, `done`） |
| グローバル変数 | より説明的（`MaxRetryCount`, `DefaultTimeout`） |

### 2.3 定数名

```go
const (
    // 公開定数 → PascalCase
    MaxRetries     = 3
    DefaultTimeout = 30 * time.Second

    // 非公開定数 → camelCase
    maxRetries     = 3
    defaultTimeout = 30 * time.Second
)
```

### 2.4 インターフェース名

```go
// ✅ 動作 + "er" 接尾辞（1メソッドの場合）
type Reader interface {
    Read(p []byte) (n int, err error) // 1メソッドなら "er" 接尾辞で動作を表す 例: io.Reader
}

type Writer interface {
    Write(p []byte) (n int, err error) // 1メソッドなら "er" 接尾辞で動作を表す 例: io.Writer
}

// ✅ 複数メソッドの場合は機能を表す名前
type UserRepository interface {
    FindByID(ctx context.Context, id uint) (*User, error) // 取得系
    Save(ctx context.Context, user *User) error          // 操作系
}

// ❌ だめ
type ReadInterface interface { ... }  // "Interface" は冗長
```

### 2.5 構造体名

```go
// ✅ PascalCase
type UserProfile struct { ... }    // 公開構造体
type DatabaseConfig struct { ... } // 公開構造体

// ❌ だめ
type userProfile struct { ... }      // 非公開になってまう
type database_config struct { ... }  // スネークケース
```

### 2.6 略語の扱い

Golangでは略語を**全部大文字か全部小文字**で統一する。中途半端なキャピタライズはNG。

```go
// ✅ おっけー
ServeHTTP()   // HTTP は全部大文字
XMLParser     // XML は全部大文字
userID        // ID は全部大文字

// ❌ だめ
ServeHttp()   // Http は NG
XmlParser     // Xml は NG
userId        // Id は NG（ID が正しい）
```

### 2.7 ゲッター / セッター

Golangでは**get プレフィックスを使用しない**。

```go
// ✅ おっけー
owner := obj.Owner()       // "Get" プレフィックス不要
obj.SetOwner(user)         // "Set" は使用する

// ❌ だめ
owner := obj.GetOwner()    // "Get" は冗長
```

### 2.8 メソッドレシーバー

```go
// ✅ 一貫した短い名前（1〜2文字推奨）
func (s *Server) Start() error  { ... } // "s" は Server のレシーバー
func (c *Client) Connect() error { ... } // "c" は Client のレシーバー

// ❌ 不統一は NG
func (s *Server) Start() error { ... } // "s" は Server のレシーバー
func (server *Server) Stop() error { ... }  // 同じ型で名前が違う
```

フロントの自分からしたらレシーバーって何ってなった↓
- **レシーバー**は、構造体のメソッドを定義する際に、そのメソッドがどの構造体に属するかを示すもの。例えば、`func (s *Server) Start()` の `s *Server` がレシーバーで、このメソッドは `Server` 構造体の一部であることを示している。


### 2.9 コンストラクタ

```go
// ✅ New[Type] の形式で統一
func NewUser(name string) *User { ... } // User のコンストラクタ
func NewProductRepository(db *gorm.DB) ProductRepository { ... } // ProductRepository のコンストラクタ
```

コンストラクタってなんぞや？↓
- **コンストラクタ**は、構造体のインスタンスを生成するための関数。Golangでは、`New[Type]` という形式で命名されることが一般的で、必要な初期化処理を行ってから構造体のインスタンスを返す役割を持つ。

---

## 3. コメント規則

| 種類 | フォーマット | 例 |
|------|------------|----|
| パッケージコメント | `// Package [name] ...` | `// Package handlers provides HTTP handlers.` |
| 公開関数コメント | `// [FuncName] ...` | `// CreateUser creates a new user.` |
| インラインコメント | `// [説明]` | `// retry count` |
| TODO コメント | `// TODO:` | `// TODO: implement validation` |

---

## 4. 構造体のフィールド順序

公開フィールドを先に、非公開フィールドを後に並べる。

```go
type User struct {
    // 公開フィールド（先）
    ID        uint
    Name      string
    Email     string
    CreatedAt time.Time

    // 非公開フィールド（後）
    hashedPassword string
}
```

公開、非公開ってなんぞや？↓
- **公開フィールド**は、構造体の外部からアクセスできるフィールドで、先頭が大文字で始まるもの（例: `ID`, `Name`）。
- **非公開フィールド**は、構造体の外部からアクセスできないフィールドで、先頭が小文字で始まるもの（例: `hashedPassword`）。この順序でフィールドを定義することで、コードの可読性が向上する。


---

## 5. インポートのグループ化

```go
import (
    // 1. 標準パッケージ
    "context"
    "fmt"
    "time"

    // 2. サードパーティパッケージ
    "github.com/gin-gonic/gin"
    "gorm.io/gorm"

    // 3. 自作パッケージ
    "myapp/internal/domain/user"
    "myapp/internal/common/ctxkeys"
)
```

自作パッケージってなんぞや？↓
- **自作パッケージ**は、プロジェクト内で開発された独自のパッケージで、通常はプロジェクトのモジュール名から始まるインポートパスを持つもの（例: `myapp/internal/domain/user`）。これらはプロジェクト固有のコードを含んでおり、他のプロジェクトでは使用されないことが多い。

---

## 6. エラーハンドリング

### 基本方針

- エラーは**即座にチェック**する（後回しにしない）
- エラーパッケージは `cockroachdb/errors` を使用する
- `panic` は**初期化時のみ**許可（ビジネスロジックでの使用は禁止）

```go
// ✅ おっけー: 即時チェック
if err != nil {
    return err
}

// ❌ だめ: 後回しにしてる
if err == nil {
    // 処理
}
```

### cockroachdb/errors の基本的な使い方

```go
import "github.com/cockroachdb/errors"

// 新しいエラーを作成
err := errors.New("ユーザーが見つかりません")

// フォーマット付きエラーを作成
err := errors.Newf("ユーザーID %d が見つかりません", userID)

// エラーをラップして文脈を追加
if err != nil {
    return errors.Wrap(err, "ユーザー取得に失敗しました")
}
```

### コントローラーでのエラーハンドリング例

```go
func (con *UserController) GetUser(c *gin.Context) {
    result, err := con.getUserUseCase.Execute(c.Request.Context(), userID) // 例: use case の実行
    if err != nil { // エラーが発生した場合は即座にチェック
        var appErr *apperrors.AppError // AppError 型でエラーをキャスト
        if errors.As(err, &appErr) { // AppError ならコードとメッセージを返す
            c.JSON(appErr.Code, gin.H{ // appErr.Code は HTTP ステータスコード
                "message": appErr.Message, // appErr.Message はエラーメッセージ
            })
            return
        }
        // AppError でない場合は 500
        c.JSON(http.StatusInternalServerError, gin.H{  // HTTP 500 エラー
            "message": err.Error(),
        })
        return
    }
    c.JSON(http.StatusOK, result) // HTTP 200 OK
}
```

---

## 7. 並行処理

| ルール | ✅ | ❌ |
|--------|--------|--------|
| チャネルの方向 | `chan<- int`（送信専用）<br>`<-chan int`（受信専用）と明示 | 方向を指定しない |
| goroutine管理 | `context.Context` でキャンセル制御 | 制御なしの goroutine 起動 |

例:

```go
// ✅ チャネルの方向を明示
func producer(ch chan<- int) {
    for i := 0; i < 5; i++ {
        ch <- i
    }
    close(ch)
}
func consumer(ch <-chan int) {
    for num := range ch {
        fmt.Println(num)
    }
}
// ✅ context で goroutine を管理
func main() {
    ctx, cancel := context.WithCancel(context.Background())
    defer cancel()
    ch := make(chan int)
    go producer(ch)
    go consumer(ch)
    // 何らかの条件でキャンセル
    // cancel()
}
```

チャネルってそもそもなんだっけ↓
- **チャネル**は goroutine 間でデータをやり取りするためのパイプのようなもの。
- **チャネルの方向**を指定することで、送信専用や受信専用のチャネルを作ることができる。
- **context.Context** を使うことで、goroutine のライフサイクルを管理し、必要に応じてキャンセルすることができる。

---

## 8. テスト

| ルール | 例 |
|--------|-----|
| ファイル名 | `xxx_test.go`（テスト対象と同じパッケージに配置） |
| テスト関数名 | `Test[関数名]`（例: `TestCreateUser`） |
| マジックナンバー禁止 | `const maxRetries = 3` として定数化 |

マジックナンバーってなんだっけ↓
- **マジックナンバー**はコード中に直接書かれた数値のこと。意味がわからないため、定数として名前をつけて管理することが推奨される。

例:
```go
// ✅ 定数化して意味を明確に
const maxRetries = 3
for i := 0; i < maxRetries; i++ {
    // 処理
}
// ❌ マジックナンバーは避ける
for i := 0; i < 3; i++ {
    // 処理
}
```

---

## 9. Boolean 変数の命名パターン

プレフィックスに意味を持たせることで、変数の役割が一目でわかるようになる。

| プレフィックス | 使用シーン | 例 |
|--------------|-----------|-----|
| `is` | 現在の状態 | `isActive`, `isValid`, `isOpen` |
| `has` | 所有・含有 | `hasPermission`, `hasChildren` |
| `can` | 能力・許可 | `canEdit`, `canProceed` |
| `should` | 推奨・期待 | `shouldUpdate`, `shouldProcess` |
| `will` | 未来の動作 | `willExpire`, `willRefresh` |
| `was` / `did` | 過去の状態 | `wasSuccessful`, `didProcess` |
| `enable` | 機能の有効化 | `enableLogging`, `enableNotifications` |
| `allow` | 許可の設定 | `allowGuests`, `allowMultiple` |

### 重要なガイドライン

```go
// ✅ 否定形を避ける
isValid := true
if !isValid { ... }      // 否定が必要な場合は ! を使う

// ❌ 否定形の変数名は避ける
isNotValid := false      // 読みにくい

// ✅ デフォルトが false になるように命名
isEnabled := false       // デフォルトで無効
allowGuests := false     // デフォルトで不許可

// ✅ 単一責任
isActiveAndValid := true  // ❌ 2つの概念を持たせない
// → isActive と isValid に分ける
```

### 分野別パターン

| 分野 | 一般的なパターン | 例 |
|-----|---------------|-----|
| UI状態 | `is`, `has` | `isVisible`, `isExpanded`, `hasError` |
| アクセス制御 | `can`, `has` | `canAccess`, `hasPermission` |
| 設定オプション | `enable`, `allow`, `should` | `enableNotifications`, `allowComments` |
| 処理状態 | `is`, `was`, `did` | `isProcessing`, `wasSuccessful`, `didComplete` |
| 機能フラグ | `is`, `has` | `isEnabled`, `hasFeature` |

---

## 10. データアクセス層の設計原則

Golangの DDD + クリーンアーキテクチャは、データアクセスを目的別に分ける。
データアクセスってのは、データベースや外部APIからデータを取得したり、保存したりすることね。

### Repository（操作系）

```go
type UserRepository interface { // 操作系（作成・更新・削除）
    FindByID(ctx context.Context, id uint) (*UserEntity, error) // 取得系は QueryService に分ける
    Save(ctx context.Context, user *UserEntity) error // 作成と更新は同じメソッドで対応することが多い
    Update(ctx context.Context, user *UserEntity) error // 更新専用メソッドも必要に応じて追加
    Delete(ctx context.Context, id uint) error // 削除は ID だけで十分なことが多い
}
```

- **目的**: 作成・更新・削除
- **戻り値**: ドメインエンティティ
- **トランザクション**: 必要

### QueryService（取得系）

```go
type UserQueryService interface { // 取得系（読み取り専用）
    FetchUser(ctx context.Context, id uint) (*qsdto.UserDto, error) // 単一のユーザーを取得するメソッド
    FetchAllUsers(ctx context.Context) ([]qsdto.UserDto, error) // すべてのユーザーを取得するメソッド
    FetchUsers(ctx context.Context, conditions FetchUsersConditions) (*dbutil.Paginator, error) // 条件に基づいてユーザーを取得するメソッド（ページネーション対応）
}
```

- **目的**: 読み取り専用
- **戻り値**: DTO（`qsdto.Dto`）または `dbutil.Paginator`
- **トランザクション**: 不要
- テーブルを横断する複雑なクエリも QueryService で実装

---

## 11. ValueObject の作成基準

値オブジェクト（ValueObject）はビジネスルールを持つ値を表現するが、**すべての型に作成するわけではない**。

### 作成しない基準

以下は ValueObject を作らなくてよいケース：

- **ID関連**（`UserID`, `ProductID` など）
- **bool 型**
- **`*At` 系の時間型**（ただし、時間に関するビジネスロジックが絡む場合は例外）

### 作成する基準

```go
// ✅ バリデーションロジックを持つ → ValueObject にする
type Name string

func NewName(value string) (Name, error) {
    trimmed := strings.TrimSpace(value)
    if trimmed == "" {
        return "", errors.New("名前は必須です")
    }
    if utf8.RuneCountInString(trimmed) > 100 {
        return "", errors.New("名前は100文字以内で入力してください")
    }
    return Name(trimmed), nil
}
// ✅ ビジネスルールを持つ → ValueObject にする
type Email string
func NewEmail(value string) (Email, error) {
    trimmed := strings.TrimSpace(value)
    if trimmed == "" {
        return "", errors.New("メールアドレスは必須です")
    }
    if !isValidEmail(trimmed) {
        return "", errors.New("有効なメールアドレスを入力してください")
    }
    return Email(trimmed), nil
}
// ❌ バリデーションやビジネスルールがない → ValueObject にしない
type Age int // 単純な数値でビジネスルールがない
func NewAge(value int) Age {
    return Age(value) // バリデーションやビジネスルールがないので ValueObject にしない
}
```

**ポイント**: ValueObject は**必ず正常な値が入るように**設計する。コンストラクタでバリデーションを行って、不正な値で生成できないようにする。

---

## まとめ

| カテゴリ | キーポイント |
|---------|------------|
| 命名 | キャメルケース（変数）/ PascalCase（型・定数）/ スネークケース（ファイル）|
| 略語 | 全部大文字か全部小文字（`HTTP`, `id` → `ID`） |
| エラー | `cockroachdb/errors` を使用、即時チェック |
| Boolean | `is` / `has` / `can` / `should` などプレフィックスで役割を明確化 |
| インポート | 標準 → サードパーティ → 自作の3グループ |
| データアクセス | 操作系は Repository、取得系は QueryService |
