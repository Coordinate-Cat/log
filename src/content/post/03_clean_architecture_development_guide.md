---
title: "第3章：クリーンアーキテクチャ × DDD による Go バックエンド開発手順書"
description: DDD・クリーンアーキテクチャを採用したGoバックエンドの開発手順。DIパターン、Wireによる依存注入、GORMを使ったリポジトリ実装を具体的に解説。
date: 2026-03-01
tags: ["Go", "Golang", "Backend", "CleanArchitecture", "DDD", "GORM"]
---

## はじめに

筆者はDDDちょっとわかる程度
DDDとクリーンアーキテクチャはセットで語られてることが多くないというくらいの感覚はある。要はコードを4層に分けて依存の方向を守るだけくらいの認識。

## 概要

DDD（ドメイン駆動設計）とクリーンアーキテクチャを採用したGoバックエンドで、新規APIエンドポイントを開発する標準的な手順。

### アーキテクチャ構成（4 層構造）

```
┌─────────────────────────────────────────────┐
│  Handler 層
│  HTTPリクエスト/レスポンスの処理
├─────────────────────────────────────────────┤
│  UseCase 層
│  ビジネスロジックのオーケストレーション
├─────────────────────────────────────────────┤
│  Domain 層
│  ビジネスルールとエンティティ（純粋なGoコード）│
├─────────────────────────────────────────────┤
│  Infrastructure 層
│  DB アクセス・外部サービス連携
└─────────────────────────────────────────────┘
```

クリーンアーキテクチャってなんぞや？↓

- クリーンアーキテクチャは、システムをHandler/UseCase/Domain/Infrastructureなど複数の層に分け、依存の方向を「外から内へのみ」に制限する設計パターン。ドメインのビジネスロジックがフレームワークやDBの実装に依存しないのが最大のメリット。
- DDD（ドメイン駆動設計）はビジネスの概念をコードで表現する考え方で、エンティティや値オブジェクトとして業務ロジックを閉じ込める。クリーンアーキテクチャのDomain層がそれに対応する。

依存の方向: Infrastructure → Handler → UseCase → Domain（内向きのみ）

### データアクセス層の使い分け

| 用途             | Repository           | QueryService         |
| ---------------- | -------------------- | -------------------- |
| 対象操作         | 作成・更新・削除     | 読み取り専用         |
| 戻り値           | ドメインエンティティ | DTO または Paginator |
| トランザクション | 必要                 | 不要                 |
| 主な目的         | ビジネスルール保護   | パフォーマンス重視   |

RepositoryとQueryServiceってどう違うんだっけ？↓

- Repositoryは、ドメインエンティティの保存・取得・削除を担う。ビジネスルールを守るためにドメイン層のインターフェースを実装する。
- QueryServiceは、画面表示用のデータ取得に特化した読み取り専用サービス。DTOを返すのでエンティティのルールに縛られず、複雑なJOINやページングも自由にできる。

DTO復習↓

- DTO（Data Transfer Object）は、データの転送に特化したオブジェクト。ドメインエンティティとは異なり、ビジネスロジックを持たない。APIのリクエストやレスポンスで使用されることが多い。

---

## 開発の全体フロー（10 ステップ）

```
Step 1: 要件定義とドメインモデリング
Step 2: OpenAPI 定義の作成
Step 3: コード生成（make codegen）
Step 4: Domain 層の実装
Step 5: Infrastructure 層の実装
Step 6: UseCase 層の実装
Step 7: Handler 層の実装
Step 8: 依存性注入（DI）の設定
Step 9: ServerHandler への統合
Step 10: テスト実装
```

---

## Step 1: 要件定義とドメインモデリング

### 1.1 ビジネス要件の確認

- エンドポイントの目的と機能を明確化
- 必要なデータ項目の洗い出し
- ビジネスルールの確認

### 1.2 ドメインモデルの設計

- エンティティ: 識別子（ID）を持つオブジェクト（例: `ProductEntity`）
- 値オブジェクト: 同値性で比較されるオブジェクト（例: `valueobjects.Name`）
- ドメインサービス: エンティティに収まらないビジネスロジック

---

## Step 2: OpenAPI 定義の作成

### 2.1 ファイル作成

```bash
# 例: 新規リソース "products" のエンドポイント定義
touch src/openapi/paths/products/index.yml
touch src/openapi/paths/products/:id.yml
touch src/openapi/components/schemas/products/index.yml
```

### 2.2 パス定義の記述例

```yaml
# src/openapi/paths/products/index.yml
get:
  tags:
    - product
  summary: 商品一覧取得
  operationId: FetchProducts
  parameters:
    - name: page
      in: query
      schema:
        type: integer
        minimum: 1
        default: 1
    - name: limit
      in: query
      schema:
        type: integer
        minimum: 1
        maximum: 100
        default: 20
  responses:
    "200":
      description: 成功
      content:
        application/json:
          schema:
            $ref: "../../components/schemas/products/index.yml#/FetchProductsResponse"
    "400":
      description: バリデーションエラー

post:
  tags:
    - product
  summary: 商品作成
  operationId: CreateProduct
  requestBody:
    required: true
    content:
      application/json:
        schema:
          $ref: "../../components/schemas/products/index.yml#/CreateProductRequest"
  responses:
    "201":
      description: 作成成功
      content:
        application/json:
          schema:
            $ref: "../../components/schemas/products/index.yml#/CreateProductResponse"
```

### 2.3 スキーマ定義の記述例

```yaml
# src/openapi/components/schemas/products/index.yml
CreateProductRequest:
  type: object
  required:
    - name
    - price
  properties:
    name:
      type: string
      x-oapi-codegen-extra-tags:
        binding: "required,min=1,max=100"
    price:
      type: integer
      x-oapi-codegen-extra-tags:
        binding: "required,min=0"
    description:
      type: string

FetchProductsResponse:
  type: object
  required: [data]
  properties:
    data:
      type: array
      items:
        $ref: "#/ProductItem"

ProductItem:
  type: object
  properties:
    id:
      type: integer
    name:
      type: string
    price:
      type: integer
    createdAt:
      type: string
      example: "2024-01-15 10:30:00"

CreateProductResponse:
  type: object
  required: [data]
  properties:
    data:
      $ref: "#/ProductItem"
```

### 2.4 openapi.yml へのパス追加

```yaml
# openapi.yml のpathsセクションに追加
paths:
  /products:
    $ref: "./paths/products/index.yml"
  /products/{id}:
    $ref: "./paths/products/:id.yml"
```

---

## Step 3: コード生成

```bash
make codegen
```

生成されるファイル（手動編集禁止）：

- ~~`generated/openapi/models.gen.go` — リクエスト/レスポンスモデル~~
- ~~`generated/openapi/server.gen.go` — サーバーインターフェース~~

2章でも解説してるので割愛

---

## Step 4: Domain 層の実装

### 4.1 エンティティの作成

```go
// src/internal/domain/product/product_entity.go
package product

import (
    "time"
    "myapp/internal/domain/common/types"
    "myapp/internal/domain/product/valueobjects"
)

type ProductEntity struct {
    id          types.ID
    name        valueobjects.Name
    price       valueobjects.Price
    description valueobjects.Description
    createdAt   time.Time
    updatedAt   time.Time
}

// NewProductEntity: 新規作成用コンストラクタ（バリデーション付き）
func NewProductEntity(name string, price int, description string) (*ProductEntity, error) {
    nameVO, err := valueobjects.NewName(name)
    if err != nil {
        return nil, err
    }

    priceVO, err := valueobjects.NewPrice(price)
    if err != nil {
        return nil, err
    }

    return &ProductEntity{
        id:          types.NewID(),
        name:        nameVO,
        price:       priceVO,
        description: valueobjects.Description(description),
        createdAt:   time.Now(),
        updatedAt:   time.Now(),
    }, nil
}

// RestoreProductEntity: DB から復元するコンストラクタ（バリデーションなし）
func RestoreProductEntity(
    id uint, name string, price int, description string,
    createdAt, updatedAt time.Time,
) *ProductEntity {
    return &ProductEntity{
        id:          types.RestoreID(id),
        name:        valueobjects.Name(name),
        price:       valueobjects.Price(price),
        description: valueobjects.Description(description),
        createdAt:   createdAt,
        updatedAt:   updatedAt,
    }
}

// ゲッター（Get プレフィックスは使わない）
func (p *ProductEntity) ID() types.ID              { return p.id }
func (p *ProductEntity) Name() valueobjects.Name   { return p.name }
func (p *ProductEntity) Price() valueobjects.Price { return p.price }
func (p *ProductEntity) CreatedAt() time.Time       { return p.createdAt }
func (p *ProductEntity) UpdatedAt() time.Time       { return p.updatedAt }
```

2種類のコンストラクタってなんぞや？↓

- NewProductEntityは新規作成時に使うコンストラクタで、値オブジェクトを通じたバリデーションを実行してからエンティティを生成する。
- RestoreProductEntityはDBから復元する時のコンストラクタで、すでにバリデーション済みのデータなので再検証をスキップする。用途によって使い分けるのがポイント。

### 4.2 値オブジェクトの作成

```go
// internal/domain/product/valueobjects/name.go
package valueobjects

import (
    "strings"
    "unicode/utf8"

    "github.com/cockroachdb/errors"
)

type Name string

func NewName(value string) (Name, error) {
    trimmed := strings.TrimSpace(value)
    if trimmed == "" {
        return "", errors.New("商品名は必須です")
    }
    if utf8.RuneCountInString(trimmed) > 100 {
        return "", errors.New("商品名は100文字以内で入力してください")
    }
    return Name(trimmed), nil
}

func (n Name) String() string {
    return string(n)
}
```

値オブジェクトってなんぞや？↓

- 値オブジェクトは、ビジネス的に意味のある制約（文字数・フォーマット等）をGoの型として閉じ込めたもの。`string`のまま引き回すと「空文字チェック忘れ」などのバグが起きやすいが、値オブジェクトを通じてしか生成できなくすれば不正な値が入り込まない。

### 4.3 リポジトリインターフェースの定義

```go
// src/internal/domain/product/product_repository.go
package product

import (
    "context"
    "myapp/internal/domain/common/types"
)

type ProductRepository interface {
    FindByID(ctx context.Context, id types.ID) (*ProductEntity, error)
    FindAll(ctx context.Context, offset, limit int) ([]*ProductEntity, error)
    Count(ctx context.Context) (int64, error)
    Save(ctx context.Context, product *ProductEntity) error
    Update(ctx context.Context, product *ProductEntity) error
    Delete(ctx context.Context, id types.ID) error
}
```

---

## Step 5: Infrastructure 層の実装

### 5.1 DB モデルの作成

```go
// internal/infrastructure/dbmodel/product.go
package dbmodel

import (
    "time"
    "gorm.io/gorm"
)

type Product struct {
    ID          uint           `gorm:"primaryKey;autoIncrement"`
    ShopID      uint           `gorm:"not null;index"`
    Name        string         `gorm:"type:varchar(100);not null"`
    Price       int            `gorm:"not null"`
    Description string         `gorm:"type:text"`
    CreatedAt   time.Time
    UpdatedAt   time.Time
    DeletedAt   gorm.DeletedAt `gorm:"index"`
}
```

### 5.2 マイグレーションファイルの作成

```bash
make migration name=create_products_table
```

ファイル命名規則:

| 変更内容     | 命名パターン                     |
| ------------ | -------------------------------- |
| テーブル作成 | `create_{table}_table`           |
| カラム追加   | `add_column_{column}_{table}`    |
| カラム修正   | `modify_column_{column}_{table}` |
| カラム削除   | `delete_column_{column}_{table}` |

```sql
-- migrations/20240115_create_products_table.up.sql
CREATE TABLE products (
    id          BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    shop_id     BIGINT UNSIGNED NOT NULL,
    name        VARCHAR(100)    NOT NULL,
    price       INT             NOT NULL,
    description TEXT,
    created_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP       NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at  TIMESTAMP       NULL,
    INDEX idx_shop_id (shop_id),
    INDEX idx_deleted_at (deleted_at)
);

-- migrations/20240115_create_products_table.down.sql
DROP TABLE IF EXISTS products;
```

### 5.3 Repository の実装（操作系専用）

```go
// internal/infrastructure/repository/product_repository.go
package repository

import (
    "context"

    "github.com/cockroachdb/errors"
    "gorm.io/gorm"

    "myapp/internal/domain/common/types"
    "myapp/internal/domain/product"
    "myapp/internal/infrastructure/dbmodel"
)

type productRepository struct {
    db *gorm.DB
}

func NewProductRepository(db *gorm.DB) product.ProductRepository {
    return &productRepository{db: db}
}

func (r *productRepository) FindByID(ctx context.Context, id types.ID) (*product.ProductEntity, error) {
    var model dbmodel.Product
    if err := r.db.WithContext(ctx).First(&model, "id = ?", id.Value()).Error; err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, errors.New("商品が見つかりません")
        }
        return nil, errors.Wrap(err, "商品取得に失敗しました")
    }
    return r.toEntity(&model), nil
}

func (r *productRepository) Save(ctx context.Context, p *product.ProductEntity) error {
    model := r.toModel(p)
    if err := r.db.WithContext(ctx).Create(model).Error; err != nil {
        return errors.Wrap(err, "商品保存に失敗しました")
    }
    return nil
}

// DB モデル ↔ エンティティ変換
func (r *productRepository) toEntity(model *dbmodel.Product) *product.ProductEntity {
    return product.RestoreProductEntity(
        model.ID,
        model.Name,
        model.Price,
        model.Description,
        model.CreatedAt,
        model.UpdatedAt,
    )
}

func (r *productRepository) toModel(p *product.ProductEntity) *dbmodel.Product {
    return &dbmodel.Product{
        ID:          p.ID().Value(),
        Name:        p.Name().String(),
        Price:       int(p.Price()),
        Description: string(p.Description()),
        CreatedAt:   p.CreatedAt(),
        UpdatedAt:   p.UpdatedAt(),
    }
}
```

### 5.4 QueryService の実装（取得系専用）

```go
// internal/infrastructure/queryservice/product_query_service.go
package queryservice

import (
    "context"

    "gorm.io/gorm"

    "myapp/internal/infrastructure/dbmodel"
    qsdto "myapp/internal/infrastructure/qsdto"
)

type ProductQueryService struct {
    db *gorm.DB
}

func NewProductQueryService(db *gorm.DB) *ProductQueryService {
    return &ProductQueryService{db: db}
}

func (s *ProductQueryService) FetchProducts(
    ctx context.Context,
    page, limit int,
) (*qsdto.ProductListDTO, error) {
    var products []qsdto.ProductDTO
    var total int64

    offset := (page - 1) * limit

    // SELECT * は使わず必要なカラムのみ指定
    if err := s.db.WithContext(ctx).
        Model(&dbmodel.Product{}).
        Select("id, name, price, description, created_at").
        Where("deleted_at IS NULL").
        Count(&total).Error; err != nil {
        return nil, err
    }

    if err := s.db.WithContext(ctx).
        Model(&dbmodel.Product{}).
        Select("id, name, price, description, created_at").
        Where("deleted_at IS NULL").
        Order("created_at DESC").
        Offset(offset).
        Limit(limit).
        Scan(&products).Error; err != nil {
        return nil, err
    }

    return &qsdto.ProductListDTO{
        Products:   products,
        Total:      total,
        Page:       page,
        Limit:      limit,
        TotalPages: int((total + int64(limit) - 1) / int64(limit)),
    }, nil
}
```

### 5.5 N+1 問題の回避（Preload の活用）

リレーション先のデータが必要な場合は `Preload` を使って一括取得する。

```go
// ✅ Preload で N+1 回避
if err := s.db.WithContext(ctx).
    Preload("Category").                       // 1:1 リレーション
    Preload("Tags").                           // many2many リレーション
    Preload("Category.ParentCategory").        // ネストした Preload
    Preload("Tags", "active = ?", true).       // 条件付き Preload
    Where("deleted_at IS NULL").
    Order("created_at DESC").
    Offset(offset).Limit(limit).
    Find(&products).Error; err != nil {
    return nil, err
}

// ❌ N+1 問題が発生するパターン
for _, p := range products {
    db.Where("product_id = ?", p.ID).Find(&tags)  // ループ内クエリは絶対NG
}
```

N+1問題ってなんぞや？↓

- N+1問題は、1件のリストを取得したあとに関連データをループでN回SQLするパターンの総称。商品が10件あればカテゴリ取得のSQLも追加10回走ってしまう。`Preload`を使えと1回のJOINで取りきれる。

---

## Step 6: UseCase 層の実装

```go
// internal/usecases/product/create_product_usecase.go
package usecase

import (
    "context"

    "myapp/internal/domain/product"
)

type CreateProductInput struct {
    Name        string
    Price       int
    Description string
}

type CreateProductOutput struct {
    Product *product.ProductEntity
}

type CreateProductUseCase struct {
    productRepo product.ProductRepository
}

func NewCreateProductUseCase(productRepo product.ProductRepository) *CreateProductUseCase {
    return &CreateProductUseCase{productRepo: productRepo}
}

func (u *CreateProductUseCase) Execute(
    ctx context.Context,
    input CreateProductInput,
) (*CreateProductOutput, error) {
    // ドメイン層でエンティティ作成（バリデーション含む）
    entity, err := product.NewProductEntity(input.Name, input.Price, input.Description)
    if err != nil {
        return nil, err
    }

    // Repository でデータ保存
    if err := u.productRepo.Save(ctx, entity); err != nil {
        return nil, err
    }

    return &CreateProductOutput{Product: entity}, nil
}
```

---

## Step 7: Handler 層の実装

Handler は HTTP リクエスト/レスポンスの処理のみに専念する。

```go
// src/internal/handler/product/product_handler.go
package handler

import (
    "net/http"

    api "myapp/generated/openapi"
    "myapp/internal/common/ctxkeys"
    "myapp/internal/usecases/product/usecase"

    "github.com/cockroachdb/errors"
    "github.com/gin-gonic/gin"
)

type ProductHandler struct {
    fetchProductsUseCase *usecase.FetchProductsUseCase
    createProductUseCase *usecase.CreateProductUseCase
}

func NewProductHandler(
    fetchProductsUseCase *usecase.FetchProductsUseCase,
    createProductUseCase *usecase.CreateProductUseCase,
) *ProductHandler {
    return &ProductHandler{
        fetchProductsUseCase: fetchProductsUseCase,
        createProductUseCase: createProductUseCase,
    }
}

// GET /products
func (h *ProductHandler) FetchProducts(c *gin.Context, params api.FetchProductsParams) {
    // クエリパラメータのバリデーション（必須）
    if err := BindQuery(c, &params); err != nil {
        return
    }

    res, err := h.fetchProductsUseCase.Execute(c.Request.Context(), params)
    if IsError(c, err) {
        return
    }

    c.JSON(http.StatusOK, res)
}

// POST /products
func (h *ProductHandler) CreateProduct(c *gin.Context) {
    var req api.CreateProductRequest
    if err := BindJSON(c, &req); err != nil {
        return
    }

    // コンテキストから店舗情報を取得（認証ミドルウェアが設定済み）
    shopInfo, ok := c.Get(ctxkeys.LoginShopKey)
    if !ok {
        IsErrorWithMessage(c, errors.New("認証情報の取得に失敗しました"), "認証情報の取得に失敗しました")
        return
    }
    shopID := shopInfo.(types.LoginShop).ShopID

    res, err := h.createProductUseCase.Execute(c.Request.Context(), shopID, req)
    if IsErrorWithMessage(c, err, "商品作成に失敗しました") {
        return
    }

    c.JSON(http.StatusCreated, res)
}
```

---

## Step 8: 依存性注入（DI）の設定

Google Wire を使ったコンパイル時 DI を設定する。

```go
// src/internal/di/wire.go に追加

var productSet = wire.NewSet(
    repository.NewProductRepository,
    queryservice.NewProductQueryService,
    usecase.NewCreateProductUseCase,
    usecase.NewFetchProductsUseCase,
    handler.NewProductHandler,
)

// 既存の各セットにも追加
var repositorySet = wire.NewSet(
    // ... 既存
    repository.NewProductRepository,
)

var handlerSet = wire.NewSet(
    // ... 既存
    handler.NewProductHandler,
)
```

Wireってなんぞや？↓

- Wireは、Googleが作ったGoのコンパイル時依存性注入ツール。`NewXxx`関数を登録しておくと、依存関係を自動で解決してインスタンスを生成するコードを生成してくれる。手書きのファクトリ関数を書かなくていいのでミスが減る。

```bash
# DI コードの再生成
make wire
```

> 注意: DI ファイルも手動編集は禁止。`make wire` で生成されたコードを使う。

---

## Step 9: ServerHandler への統合

生成されたサーバーインターフェースを実装する `ServerHandler` にメソッドを追加する。

```go
// src/internal/handler/base_handler.go

type ServerHandler struct {
    // ... 既存フィールド
    productHandler *ProductHandler
}

// インターフェース実装メソッドを追加
func (sc *ServerHandler) FetchProducts(c *gin.Context, params api.FetchProductsParams) {
    sc.productHandler.FetchProducts(c, params)
}

func (sc *ServerHandler) CreateProduct(c *gin.Context) {
    sc.productHandler.CreateProduct(c)
}
```

---

## Step 10: テスト実装

ハンドラーテストの詳細は「ハンドラーテストの書き方」ガイドを参照してください。

---

## 実装チェックリスト

実装完了の確認に使用してください。

```
□ OpenAPI 定義の作成
□ コード生成（make codegen）
□ Domain 層: Entity, ValueObject, Repository Interface
□ DB マイグレーションファイル作成（up/down 両方）
□ Infrastructure 層: Repository, QueryService
□ UseCase 層の実装
□ Handler 層の実装
□ DI 設定（wire.go への追加）
□ make wire の実行
□ ServerHandler へのメソッド追加
□ テストの実装
□ 動作確認（実際のエンドポイントを叩く）
□ マルチテナント: shop_id フィルタがスコープ経由で適用されていること
```

---

## よくある問題と解決方法

### コード生成でエラーが発生する場合

- YAML の文法エラーを確認（インデントミスが多い）
- `$ref` 参照先ファイルパスの確認
- 必須フィールドの定義漏れを確認

### ビルドエラーが発生する場合

```bash
go mod tidy        # モジュールの整理
make import        # import の自動追加
```

### テストが失敗する場合

- モックの設定を確認
- テストDBへの接続確認
- テストデータの初期化確認

---

## パフォーマンス考慮事項

### QueryService 実装時

- N+1 回避: 関連データは `Preload` または JOIN で一括取得
- SELECT の限定: `SELECT *` は使わず必要カラムのみ指定
- ページネーション必須: 大量データは必ず `LIMIT`/`OFFSET` を使用
- インデックスの活用: `WHERE`/`ORDER BY` で使うカラムにインデックスを設定

### Repository 実装時

- トランザクション管理: データ整合性のためトランザクション境界を明確に
- エラーメッセージ: ドメイン固有の意味あるエラーメッセージを設定
