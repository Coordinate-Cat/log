---
title: "第2章：OpenAPI設計ガイドと oapi-codegen 実装方法"
description: GoバックエンドでのOpenAPI設計とoapi-codegenを使ったコード自動生成の実装方法を解説。REST API設計のベストプラクティスとYAMLスキーマ定義パターンを網羅。
date: 2026-03-01
tags: ["Go", "Golang", "Backend", "OpenAPI", "oapi-codegen", "API"]
---

## はじめに

oapi-codegenは、YAMLでAPIの仕様書を書いたら、あとはGoのコードを自動生成してくれる仕組み。型定義とバリデーションが一発生成されるえらいやつ。 OpenAPIの設計ルールとoapi-codegenの拡張フィールドを理解していく

---

## 1. ファイル構成

### 基本構造

```
src/openapi/
├── openapi.yml              # 統括ファイル（全定義を集約するルート）
├── paths/                   # エンドポイント定義
│   ├── users/
│   │   ├── index.yml        # GET/POST /users
│   │   └── :userID.yml      # GET/PUT/DELETE /users/{userID}
│   ├── auth.yml             # 認証関連
│   └── health.yml           # ヘルスチェック
└── components/
    └── schemas/             # 再利用可能なスキーマ定義
        ├── users/
        │   ├── index.yml
        │   └── :userID.yml
        ├── common/          # 共通スキーマ（エラーレスポンス等）
        │   └── error_response.yml
        └── enum/            # enum 定義（必ずここに分離）
            └── user_status.yml
```

構造はURLパスに対応させる。`/users` は `paths/users/index.yml`、`/users/{userID}` は `paths/users/:userID.yml` に定義する。共通スキーマは `components/schemas/` 配下に置く。enumは必ず `components/schemas/enum/` に分ける。

### 統括ファイル（openapi.yml）でのパス参照

```yaml
# openapi.yml
openapi: "3.0.3"
info:
  title: My API
  version: "1.0.0"
paths:
  /users:
    $ref: "./paths/users/index.yml"
  /users/{userID}:
    $ref: "./paths/users/:userID.yml"
  /auth/login:
    $ref: "./paths/auth.yml#/login"
```

$refってなんぞや？↓

- **$ref**は、YAMLで別ファイルや別セクションを参照するための記法。`"./paths/users/index.yml"`のようにファイルパスだけ指定すると別ファイル全体を参照し、`"./paths/auth.yml#/login"`の`#/login`部分は同一ファイル内の特定コンポーネントのみを指す。

---

## 2. 命名規則

### 2.1 ファイル名

```
lower_snake_case  例: user_profile.yml, error_response.yml
```

### 2.2 コンポーネント名（スキーマ名）

```
UpperCamelCase  例: UserProfile, ErrorResponse, UserIDParameter
```

### 2.3 operationId

API 操作の識別子は「動詞 + リソース名」で命名。

| 動作         | 動詞        | 例                     |
| ------------ | ----------- | ---------------------- |
| 一覧取得     | `Fetch`     | `FetchUsers`           |
| 単件取得     | `Fetch`     | `FetchUserByID`        |
| 作成         | `Create`    | `CreateUser`           |
| 更新         | `Update`    | `UpdateUser`           |
| 削除         | `Delete`    | `DeleteUser`           |
| プルダウン用 | `Selection` | `SelectionPrefectures` |

```yaml
# ✅ 良い例
operationId: FetchUsers
operationId: CreateUser
operationId: SelectionPrefectures  # /selections/prefectures の場合

# ❌ 悪い例
operationId: getUsers    # 小文字始まり
operationId: listUsers   # "list" は使わない（"Fetch" に統一）
```

なんで動詞を統一すんの？↓

- 動詞を統一する理由はAPIの操作を一目で理解できるようにするため。`Fetch`はデータの取得、`Create`は新規作成、`Update`は更新、`Delete`は削除、`Selection`は選択肢取得といった具合に、動詞がAPIの目的を明確に伝える。これにより、コードを読んだときに何をするAPIなのかすぐにわかるようになる。

### 2.4 パラメータ名

`in: query` や `in: path` のパラメータ名は **camelCase** で記載する。

```yaml
# ✅ 良い例
parameters:
  - name: userID
    in: path
  - name: pageSize
    in: query
  - name: isComplete
    in: query
```

in ってなんぞや？↓

- inは、OpenAPIのパラメータ定義で、そのパラメータがどこから来るかを指定するフィールド。`in: query`はクエリパラメータ、`in: path`はURLパスの一部、`in: header`はHTTPヘッダー、`in: cookie`はクッキーから値を取得することを意味する。

### 2.5 プロパティ名

JSON プロパティ名は **lowerCamelCase** を使う。

```yaml
# ✅ 良い例
properties:
  userName:
    type: string
  projectStatus:
    type: string
  isArchived:
    type: boolean
```

### 2.6 スキーマ参照の形式

```yaml
# paths ファイル内でスキーマを参照する形式
# $ref: {スキーマファイルパス}#{operationId}{Request|Response}

# 例: FetchUserByID の場合
requestBody:
  content:
    application/json:
      schema:
        $ref: "../../components/schemas/users/:userID.yml#/FetchUserByIDRequest"
responses:
  "200":
    content:
      application/json:
        schema:
          $ref: "../../components/schemas/users/:userID.yml#/FetchUserByIDResponse"
```

---

## 3. ディレクトリ構成ルール

URL パス構造をそのままディレクトリ構造に反映する。

```
/users              → paths/users/index.yml
/users/{userID}     → paths/users/:userID.yml
/projects/{projectID}/tasks  → paths/projects/:projectID/tasks.yml

# 例外（直接 yml ファイルとして配置）
/auth 関連    → paths/auth.yml
/health       → paths/health.yml
```

### enum は必ず専用ディレクトリへ

```yaml
# ✅ components/schemas/enum/user_status.yml
UserStatus:
  type: string
  enum:
    - active
    - suspended
    - deleted
```

> **重要**: `enum` を使用する場合は **必ず** `components/schemas/enum/` 配下に定義してください。

なんでenumを専用ディレクトリに分けんの？↓

- enumを専用ディレクトリに分ける理由は、APIの仕様が大規模になるにつれてenum定義が増えるため、管理しやすくするため。`components/schemas/enum/`にまとめることで、enum定義を一箇所で見つけやすくなり、コードの可読性と保守性が向上するらしい。

---

## 4. データ型の定義規則

### 4.1 日時フィールド（レスポンス）

レスポンスの日時は `string` 型で定義（`date-time` 形式は使わん）。

```yaml
# ✅ 正しい定義
createdAt:
  type: string
  description: "作成日時"
  example: "2024-01-15 10:30:00"

updatedAt:
  type: string
  description: "更新日時"
  example: "2024-01-15 14:45:00"
```

date-time 形式は使わない理由は、Goのtime.Time型にマッピングされると、RFC3339形式（例: "2024-01-15T10:30:00Z"）ってやつでシリアライズされるため。  
これを避けるために、日時フィールドは単純なstring型で定義し、フォーマットはAPIドキュメントの説明やexampleで明示する。

### 4.2 日時フィールド（リクエスト）

リクエストの日時には Go のカスタム型を指定する。

```yaml
# ✅ types.CustomTime を使用
startDate:
  type: string
  x-go-type: types.CustomTime
  description: "開始日時"
  example: "2024-01-15 10:30:00"
```

### 4.3 Int 型

- 基本は `uint`（負の値にならないケース）
- 負の値が必要な場合は `int64`

uint知らん↓

- uintは、符号なし整数を表すGoの基本型。0以上の整数のみを扱う場合に使用される。例えば、ページ番号やアイテム数など、負の値が意味をなさない場合に適している。一方、負の値が必要な場合は`int64`を使用することが推奨。

- int64は、符号付き整数を表すGoの基本型。負の値を含む整数を扱う場合に使用される。例えば、残高や温度など、負の値が意味を持つ場合に適している。

### 4.4 Boolean 型

```yaml
# ❌ required に boolean を含めない（false が通らなくなる）
required:
  - name
  - isActive  # boolean は required に含めない

# ✅ 正しい定義
required:
  - name
properties:
  isActive:
    type: boolean
```

### 4.5 レスポンスは data キーで包む

```yaml
# ✅ data キーに包む（メッセージレスポンスを除く）
FetchUsersResponse:
  type: object
  required: [data]
  properties:
    data:
      type: array
      items:
        $ref: "#/UserItem"
```

---

## 5. oapi-codegen 拡張フィールド

`oapi-codegen` には OpenAPI 標準の仕様を拡張するフィールドがある。よく使うものをまとめる。

### 5.1 `x-go-type` / `x-go-type-import` — 外部パッケージ型の使用

```yaml
components:
  schemas:
    UserProfile:
      type: object
      properties:
        id:
          type: string
          x-go-type: uuid.UUID
          x-go-type-import:
            path: github.com/google/uuid
            name: uuid
        createdAt:
          type: string
          format: date-time
          x-go-type: time.Time
          x-go-type-import:
            path: time
        metadata:
          type: object
          x-go-type: datatypes.JSON
          x-go-type-import:
            path: gorm.io/datatypes
```

生成される Go コード：

```go
type UserProfile struct {
    ID        uuid.UUID      `json:"id"`
    CreatedAt time.Time      `json:"created_at"`
    Metadata  datatypes.JSON `json:"metadata,omitempty"`
}
```

全然わからん↓

- **x-go-type**は、OpenAPIの型をGoの特定の型に変換するための指示。例えば、APIドキュメントでは`id`フィールドを`string`型で定義していても、実際のGoコードでは`uuid.UUID`型として扱いたい場合に使う。これにより、API仕様と実装コードの両方で適切な型を使用できるようになる。

- **x-go-type-import**は、`x-go-type`で指定した型が属する外部パッケージをインポートするための情報。`path`でパッケージのインポートパスを指定し、`name`でコード内で使用するパッケージ名を指定する。これにより、生成されるGoコードに必要なインポート文が自動的に追加される。

### 5.2 `x-oapi-codegen-extra-tags` — バリデーション用タグ

```yaml
components:
  schemas:
    LoginRequest:
      type: object
      required:
        - email
        - password
      properties:
        email:
          type: string
          x-oapi-codegen-extra-tags:
            binding: "required,email"
        password:
          type: string
          x-oapi-codegen-extra-tags:
            binding: "required,min=8,max=100"
        rememberMe:
          type: boolean
          x-oapi-codegen-extra-tags:
            binding: "omitempty"
```

生成される Go コード：

```go
type LoginRequest struct {
    Email      string `json:"email" binding:"required,email"`
    Password   string `json:"password" binding:"required,min=8,max=100"`
    RememberMe *bool  `json:"rememberMe,omitempty" binding:"omitempty"`
}
```

x-oapi-codegen-extra-tagsってなんぞや？↓

- **x-oapi-codegen-extra-tags**は、生成されるGoの構造体フィールドに追加のタグを付与するための拡張フィールド。`binding`タグを設定することで、Ginのバリデーションが自動で効くようになる。`required,email`や`min=8,max=100`はGoのバリデーションパッケージのルール書式。

### 5.3 `x-go-name` / `x-go-json-ignore` — カスタムフィールド名と JSON 制御

```yaml
User:
  type: object
  properties:
    user_id:
      type: string
      x-go-name: "ID" # Go フィールド名を "ID" にカスタマイズ
    internalData:
      type: object
      x-go-json-ignore: true # JSON シリアライズから除外
      properties:
        tempToken:
          type: string
```

### 5.4 `enum` / `x-enum-varnames` — 列挙型とカスタム変数名

```yaml
components:
  schemas:
    ErrorCode:
      type: string
      enum:
        - auth_failed
        - invalid_input
        - not_found
        - internal_error
      x-enum-varnames:
        - ErrAuthenticationFailed
        - ErrInvalidInput
        - ErrResourceNotFound
        - ErrInternal

    UserStatus:
      type: string
      enum:
        - active
        - suspended
        - deleted
      x-enum-varnames:
        - StatusActive
        - StatusSuspended
        - StatusDeleted
      x-oapi-codegen-extra-tags:
        binding: "required,oneof=active suspended deleted"
```

生成される Go コード：

```go
type ErrorCode string

const (
    ErrAuthenticationFailed ErrorCode = "auth_failed"
    ErrInvalidInput         ErrorCode = "invalid_input"
    ErrResourceNotFound     ErrorCode = "not_found"
    ErrInternal             ErrorCode = "internal_error"
)
```

x-enum-varnamesってなんぞや？↓

- **x-enum-varnames**は、YAMLのenum値に対応するGoの定数名をカスタムで指定できる拡張フィールド。指定しないとYAMLの値（`auth_failed`など）がそのまま定数名になってGoらしくないっぽい。`ErrAuthenticationFailed`のようなGo慣習に沿った名前を付ける。

### 5.5 `deprecated` / `x-deprecated-reason` — 非推奨フィールドの文書化

```yaml
LegacyUserProfile:
  type: object
  deprecated: true
  x-deprecated-reason: "UserProfile スキーマを使用してください。v3.0 で削除予定です。"
  properties:
    username:
      type: string
      deprecated: true
      x-deprecated-reason: "email フィールドを使用してください"
```

### 5.6 `x-order` — フィールド順序の制御

```yaml
Address:
  type: object
  properties:
    country:
      type: string
      x-order: 1
    prefecture:
      type: string
      x-order: 2
    city:
      type: string
      x-order: 3
    street:
      type: string
      x-order: 4
    zipCode:
      type: string
      x-order: 5
```

---

## 6. コード生成の設定ファイル

`oapi-codegen.yaml` の記述例：

```yaml
package: api
generate:
  models: true
  gin-server: true
  strict-server: true
output-options:
  skip-prune: true
output: generated/openapi/api.gen.go
```

これは、`api`パッケージにモデルとGinサーバーコードを生成し、生成ファイルは`generated/openapi/api.gen.go`に出力する設定。`skip-prune: true`は、生成後に未使用のコードを削除しないオプション。

コード生成コマンド：

```bash
make codegen
```

生成されるファイル：

- ~~`generated/openapi/models.gen.go` — リクエスト/レスポンスモデル~~
- ~~`generated/openapi/server.gen.go` — サーバーインターフェース（ハンドラーが実装する）~~

ここはVERSIONというファイルが生成されるように変更されたため、生成されるファイルの説明は削除する。
生成ファイルは**手動で編集しない**こと。

---

## 7. ハンドラー実装時の注意点

### クエリパラメータのバリデーション

`x-oapi-codegen-extra-tags` で `binding` タグを設定しても、**クエリパラメータのバリデーションは自動では実行されない**。ハンドラー内で明示的に `BindQuery` を呼び出す必要がある。

```go
func (h *productHandler) FetchProducts(c *gin.Context, params api.FetchProductsParams) {
    // ⚠️ バリデーションを必ず呼び出す
    if err := BindQuery(c, &params); err != nil {
        return // BindQuery 内で 400 エラーレスポンスが自動設定される
    }

    // 以降の処理...
    result, err := h.fetchProductsUseCase.Execute(c.Request.Context(), params)
    // ...
}
```

---

## 8. API 設計の原則

### エンドポイントのパターン

```
GET    /resources          一覧取得
GET    /resources/{id}     単件取得
POST   /resources          作成
PUT    /resources/{id}     全体更新
PATCH  /resources/{id}     部分更新
DELETE /resources/{id}     削除
GET    /selections/{name}  プルダウン用一覧
```

### ステータスコード

| 操作                       | コード                    |
| -------------------------- | ------------------------- |
| 取得成功                   | 200 OK                    |
| 作成成功                   | 201 Created               |
| 削除成功（レスポンスあり） | 200 OK                    |
| バリデーションエラー       | 400 Bad Request           |
| 未認証                     | 401 Unauthorized          |
| 権限なし                   | 403 Forbidden             |
| 見つからない               | 404 Not Found             |
| サーバーエラー             | 500 Internal Server Error |

> **注意**: `422 Unprocessable Entity` は使わず、バリデーションエラーは **400** に統一する。

---

## まとめ

| ポイント           | 内容                                                       |
| ------------------ | ---------------------------------------------------------- |
| ファイル命名       | `lower_snake_case`                                         |
| スキーマ名         | `UpperCamelCase`                                           |
| operationId        | `Fetch` / `Create` / `Update` / `Delete` + リソース名      |
| enum               | 必ず `components/schemas/enum/` に分離                     |
| 日時（レスポンス） | `string` 型、`"2024-01-15 10:30:00"` 形式                  |
| 日時（リクエスト） | `x-go-type: types.CustomTime`                              |
| バリデーション     | `x-oapi-codegen-extra-tags` + `BindQuery()` の明示呼び出し |
| 生成ファイル       | 手動編集禁止                                               |
