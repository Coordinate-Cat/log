---
title: "第6章：AWS S3 署名付き URL を使ったファイルアップロード設計"
description: AWS S3の署名付きURLを活用したGoバックエンドでのファイルアップロード設計。プリサインドURL生成からCloudFrontとの組み合わせまで実践的に解説。
date: 2026-03-10
tags: ["Go", "Golang", "Backend", "AWS", "S3", "FileUpload"]
---

# AWS S3 署名付き URL を使ったファイルアップロード設計

## はじめに

ファイルアップロードをバックエンド経由でやるとメモリを食う。S3の署名付きURLを使えばクライアントが直接S3に投げられる。AWS認証情報もフロントに渡さなくていい、いいとこ取りの設計。

---

## 1. 基本方針

### なぜ署名付き URL を使うのか

```
❌ 直接バックエンド経由でアップロード（非推奨）
  クライアント → バックエンド → S3
  └ 問題: 大容量ファイルがバックエンドのメモリを圧迫する

✅ 署名付き URL を使った直接アップロード（推奨）
  クライアント ──[1. URL要求]──▶ バックエンド
  クライアント ◀──[2. 署名付きURL]── バックエンド
  クライアント ──[3. ファイルを直接PUT]──▶ S3
```

**メリット**:

- バックエンドのメモリ負荷を削減
- AWS 認証情報をフロントに公開しない
- ファイル転送の高速化

署名付きURL（Presigned URL）ってなんぞや？↓

- **署名付きURL**は、一定時間だけ有効なAWS S3へのアクセスURLで、URLを持っていれば認証なしでPUTやGETができる。有効期限が過ぎると無効になるので、短い期間（このシステムは10分）で発行するのが安全。

---

## 2. S3 バケット構成

環境変数でバケット名を管理する。

| バケット | 用途                            | 環境変数                |
| -------- | ------------------------------- | ----------------------- |
| temp     | 署名付き URL 経由の一時ファイル | `AWS_S3_TEMP_BUCKET`    |
| private  | 非公開ファイル                  | `AWS_S3_PRIVATE_BUCKET` |
| public   | 公開アクセス可能なファイル      | `AWS_S3_PUBLIC_BUCKET`  |

```bash
# 環境変数設定例
AWS_S3_TEMP_BUCKET=your-app-temp
AWS_S3_PRIVATE_BUCKET=your-app-private
AWS_S3_PUBLIC_BUCKET=your-app-public
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=ap-northeast-1
```

---

## 3. API 設計

### エンドポイント

```
POST /upload/presigned_url
```

### サポートファイル形式

```go
var supportedMimeTypes = map[string]bool{
    "image/jpeg":      true,
    "image/png":       true,
    "image/gif":       true,
    "image/webp":      true,
    "application/pdf": true,
}
```

### ファイルサイズ制限

| 制限                       | 値                         |
| -------------------------- | -------------------------- |
| 最小                       | 1 KB (1,024 bytes)         |
| 最大                       | 100 MB (104,857,600 bytes) |
| 1 リクエスト最大ファイル数 | 60 ファイル                |

### リクエスト例

```json
POST /upload/presigned_url

[
  {
    "fileName": "product_image.jpg",
    "mimeType": "image/jpeg",
    "fileSize": 2097152
  },
  {
    "fileName": "manual.pdf",
    "mimeType": "application/pdf",
    "fileSize": 5242880
  }
]
```

### レスポンス例

```json
{
  "data": [
    {
      "fileName": "product_image.jpg",
      "url": "https://your-bucket.s3.ap-northeast-1.amazonaws.com/uploads/shop-uuid/product_image.jpg?X-Amz-Signature=..."
    },
    {
      "fileName": "manual.pdf",
      "url": "https://your-bucket.s3.ap-northeast-1.amazonaws.com/uploads/shop-uuid/manual.pdf?X-Amz-Signature=..."
    }
  ]
}
```

### 署名付き URL の仕様

| 項目                 | 値                               |
| -------------------- | -------------------------------- |
| 有効期限             | 10 分間                          |
| アップロード先       | temp バケット                    |
| HTTP メソッド        | PUT                              |
| オブジェクトキー形式 | `uploads/{shop-uuid}/{filename}` |

---

## 4. アーキテクチャ

```
Handler（Upload）
  │ リクエストのバリデーション、エラーハンドリング
  ▼
UseCase（CreatePresignedURL）
  │ ファイルバリデーション、並行処理で複数URL生成
  ▼
Infrastructure（S3Client）
  │ AWS SDK v2 を使って署名付き URL を生成
  ▼
AWS S3（temp バケット）
```

---

## 5. S3 クライアントインターフェース

インターフェースを定義することでテスト時にモックに差し替えできる。

```go
// internal/infrastructure/aws/s3.go
package aws

import "context"

type S3Client interface {
    // 基本操作
    PutObject(ctx context.Context, input PutObjectInput) error
    GetObject(ctx context.Context, input GetObjectInput) ([]byte, error)
    DeleteObject(ctx context.Context, key string) error
    GetObjectMetadata(ctx context.Context, key string) (*ObjectMetadata, error)

    // 署名付き URL 操作
    GeneratePresignedURL(ctx context.Context, input PresignedURLInput) (string, error)
    GeneratePresignedURLs(ctx context.Context, inputs []PresignedURLInput) ([]string, error)

    // バッチ操作
    PutObjects(ctx context.Context, inputs []PutObjectInput) error
    CopyToBucket(ctx context.Context, srcKey, dstKey, dstBucket string) error
}

type PresignedURLInput struct {
    Key           string // オブジェクトキー（例: "uploads/shop-uuid/file.jpg"）
    ContentType   string // MIME タイプ
    ContentLength int64  // ファイルサイズ
    ExpiresIn     int    // 有効期限（秒）
}
```

---

## 6. UseCase の実装例

```go
// internal/usecases/upload/create_presigned_url_usecase.go
package usecase

import (
    "context"
    "fmt"
    "sync"

    "github.com/cockroachdb/errors"
    "myapp/internal/infrastructure/aws"
)

type CreatePresignedURLInput struct {
    Files []FileInput
}

type FileInput struct {
    FileName  string
    MimeType  string
    FileSize  int64
    ShopUUID  string
}

type CreatePresignedURLOutput struct {
    Results []PresignedURLResult
}

type PresignedURLResult struct {
    FileName string
    URL      string
}

type CreatePresignedURLUseCase struct {
    s3Client aws.S3Client
}

func NewCreatePresignedURLUseCase(s3Client aws.S3Client) *CreatePresignedURLUseCase {
    return &CreatePresignedURLUseCase{s3Client: s3Client}
}

var supportedMimeTypes = map[string]bool{
    "image/jpeg":      true,
    "image/png":       true,
    "image/gif":       true,
    "image/webp":      true,
    "application/pdf": true,
}

const (
    minFileSize = 1024             // 1 KB
    maxFileSize = 104_857_600      // 100 MB
    maxFiles    = 60
)

func (u *CreatePresignedURLUseCase) Execute(
    ctx context.Context,
    input CreatePresignedURLInput,
) (*CreatePresignedURLOutput, error) {
    // ファイル数チェック
    if len(input.Files) > maxFiles {
        return nil, errors.Newf("一度にアップロードできるファイルは %d 件までです", maxFiles)
    }

    // 各ファイルのバリデーション
    for _, f := range input.Files {
        if !supportedMimeTypes[f.MimeType] {
            return nil, errors.Newf("サポートされていないファイル形式です: %s", f.MimeType)
        }
        if f.FileSize < minFileSize || f.FileSize > maxFileSize {
            return nil, errors.Newf("ファイルサイズが制限範囲外です: %d bytes", f.FileSize)
        }
    }

    // 並行処理で署名付き URL を生成
    results := make([]PresignedURLResult, len(input.Files))
    errs := make([]error, len(input.Files))
    var wg sync.WaitGroup

    for i, f := range input.Files {
        wg.Add(1)
        go func(idx int, file FileInput) {
            defer wg.Done()

            objectKey := fmt.Sprintf("uploads/%s/%s", file.ShopUUID, file.FileName)
            url, err := u.s3Client.GeneratePresignedURL(ctx, aws.PresignedURLInput{
                Key:           objectKey,
                ContentType:   file.MimeType,
                ContentLength: file.FileSize,
                ExpiresIn:     600, // 10 分
            })
            if err != nil {
                errs[idx] = errors.Wrap(err, "署名付き URL の生成に失敗しました")
                return
            }

            results[idx] = PresignedURLResult{
                FileName: file.FileName,
                URL:      url,
            }
        }(i, f)
    }

    wg.Wait()

    // エラーチェック
    for _, err := range errs {
        if err != nil {
            return nil, err
        }
    }

    return &CreatePresignedURLOutput{Results: results}, nil
}
```

sync.WaitGroupってなんぞや？↓

- **sync.WaitGroup**は複数のgoroutineが全部終わるのを待つための仕組み。`wg.Add(1)`で待つgoroutineの数を増やして、goroutine内の処理が終わったら`defer wg.Done()`で減らす。全部終わったら`wg.Wait()`がブロックを解除する。
- **goroutine**はGoが持つ軽量なスレッドのようなもの。`go func()`で非同期に実行できる。複数ファイルのURLを並行で生成することで、逐次処理より速く結果が返せる。

---

## 7. Handler の実装例

```go
// internal/handler/upload_handler.go
package handler

import (
    "net/http"

    api "myapp/generated/openapi"
    "myapp/internal/usecases/upload/usecase"

    "github.com/gin-gonic/gin"
)

type UploadHandler struct {
    createPresignedURLUseCase *usecase.CreatePresignedURLUseCase
}

func (h *UploadHandler) CreatePresignedURL(c *gin.Context) {
    var request api.PresignedURLRequest
    if err := c.ShouldBindJSON(&request); err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"message": "リクエストの形式が正しくありません"})
        return
    }

    // コンテキストから店舗 UUID を取得
    shopInfo, ok := c.Get(ctxkeys.LoginShopKey)
    if !ok {
        c.JSON(http.StatusInternalServerError, gin.H{"message": "Internal server error"})
        return
    }
    shop := shopInfo.(types.LoginShop)

    response, err := h.createPresignedURLUseCase.Execute(c.Request.Context(), request, shop.ShopUUID)
    if err != nil {
        c.JSON(http.StatusBadRequest, gin.H{"message": err.Error()})
        return
    }

    c.JSON(http.StatusOK, api.PresignedURLResponse{Data: response})
}
```

---

## 8. クライアント側のアップロード手順

```javascript
// 1. 署名付き URL を取得
const { data } = await fetch('/upload/presigned_url', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify([
    { fileName: 'image.png', mimeType: 'image/png', fileSize: file.size }
  ]),
}).then(r => r.json());

// 2. 取得した URL に直接 PUT する（認証不要）
await fetch(data[0].url, {
  method: 'PUT',
  headers: { 'Content-Type': 'image/png' },
  body: file,
});

// 3. アップロード完了後、オブジェクトキーをバックエンドに送信して保存
await fetch('/products', {
  method: 'POST',
  body: JSON.stringify({ imageKey: 'uploads/shop-uuid/image.png', ... }),
});
```

---

## 9. multipart/form-data の場合

画像をフォームデータとして送信するエンドポイントでは、`TrimWhiteSpaceMiddleware` が文字列フィールドの前後の空白を自動除去する。

```go
// ミドルウェアの登録
r.Use(middleware.TrimWhiteSpaceMiddleware())
```

**処理される条件**:

- HTTP メソッド: PUT, POST, PATCH
- Content-Type: `application/json` または `multipart/form-data`

**処理されない条件**:

- GET, DELETE などその他のメソッド
- ファイルフィールド（テキストフィールドのみ対象）

---

## 10. テストでの S3 モック

テスト時は `S3Client` インターフェースをモックに差し替える。

```go
// テストでのモック使用例
shared.TestS3Client.On(
    "GeneratePresignedURL",
    mock.Anything,
    mock.MatchedBy(func(input aws.PresignedURLInput) bool {
        return input.ContentType == "image/png" && input.ContentLength == 1024000
    }),
).Return("https://example.com/presigned-url", nil).Once()
```

---

## まとめ

| ポイント         | 内容                                                           |
| ---------------- | -------------------------------------------------------------- |
| アップロード方式 | 署名付き URL 経由でクライアントが直接 S3 へ PUT                |
| 有効期限         | 署名付き URL は 10 分間有効                                    |
| バケット設計     | temp（一時） / private（非公開） / public（公開）の 3 バケット |
| セキュリティ     | AWS 認証情報はバックエンドのみで管理                           |
| バリデーション   | 形式・サイズ・ファイル数を UseCase でチェック                  |
| パフォーマンス   | 複数ファイルは goroutine で並行処理                            |
