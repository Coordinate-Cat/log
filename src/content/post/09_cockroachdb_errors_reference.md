---
title: "第9章：cockroachdb/errors 完全リファレンス"
description: GoのcockroachDB/errorsパッケージを使ったエラーハンドリングの完全リファレンス。スタックトレース付きエラーの生成・ラップ・検査・分類方法を網羅。
date: 2026-03-13
tags: ["Go", "Golang", "Backend", "ErrorHandling", "CockroachDB"]
---

## はじめに

標準の`errors`をそのまま使うとスタックトレースが取れない。`cockroachdb/errors`に差し替えるだけでどこでエラーが起きたか追跡できるようになる。Sentryとの連携も楽。

```go
import "github.com/cockroachdb/errors"
```

---

## 基本的な使い方（最重要 3 つ）

| メソッド                   | 使う場面                                   |
| -------------------------- | ------------------------------------------ |
| `errors.New(string)`       | 新しいエラーを作る（スタックトレース付き） |
| `errors.Wrap(err, string)` | エラーをラップしてコンテキストを追加       |
| `errors.Is(err, target)`   | エラーの同一性チェック                     |

```go
// エラー作成
err := errors.New("ユーザーが見つかりません")

// エラーラップ（どこで起きたか文脈を追加）
if err != nil {
    return errors.Wrap(err, "ユーザー取得に失敗しました")
}

// エラー識別
var ErrNotFound = errors.New("not found")
if errors.Is(err, ErrNotFound) {
    // 404 レスポンスを返す
}
```

cockroachdb/errorsって普通のerrorsと何が違うの？↓

- **スタックトレース**が自動で記録される。`errors.New()`の時点でどのファイルの何行目で作られたか追跡できる。標準の`errors`にはこの機能がない。
- **errors.Wrap()**でエラーをラップするたびに文脈が積み重なる。Sentryなどのエラー追跡ツールと組み合わせると、エラーがどの関数を伝播してきたか一目でわかる。

---

## エラー作成メソッド（Error Leaves）

| メソッド                                | 概要                                                 |
| --------------------------------------- | ---------------------------------------------------- |
| `New(string)`                           | 基本エラー作成。スタックトレースを記録               |
| `Newf(format, ...args)`                 | `New` のフォーマット指定版                           |
| `Errorf(format, ...args)`               | `Newf` と同じ                                        |
| `AssertionFailedf(format, ...args)`     | 不変条件違反・到達不能コードに到達した場合           |
| `UnimplementedError(IssueLink, string)` | 未実装機能。外部リンクを付与可能                     |
| `Handled(error)`                        | エラーを「隠す」（`Is()/Unwrap()` から見えなくなる） |
| `HandledWithMessage(error, string)`     | `Handled` + メッセージ上書き                         |

```go
// フォーマット指定
err := errors.Newf("item %d が見つかりません", itemID)

// 到達不能コード
errors.AssertionFailedf("想定外のステータス: %d", status)

// 未実装
errors.UnimplementedError(errors.IssueLink{URL: "https://example.com/issue/42"}, "CSV インポートは未対応")
```

---

## エラーラッパーメソッド（Error Wrappers）

| メソッド                                 | 概要                                                         |
| ---------------------------------------- | ------------------------------------------------------------ |
| `Wrap(err, string)`                      | 最もよく使う。スタックトレース＋メッセージ＋安全な詳細を追加 |
| `Wrapf(err, format, ...args)`            | `Wrap` のフォーマット指定版                                  |
| `WithSecondaryError(primary, secondary)` | 処理中に別のエラーが発生した場合に追加                       |
| `CombineErrors(err1, err2)`              | 並行処理の 2 つのエラーを合成                                |
| `Join(errs ...error)`                    | 複数エラーを 1 つにまとめる（改行区切り）                    |
| `WithDetail(err, string)`                | 開発者向けコンテキスト情報を付加                             |
| `WithDetailf(err, format, ...args)`      | `WithDetail` のフォーマット指定版                            |
| `WithHint(err, string)`                  | エンドユーザー向けの提案メッセージを付加                     |
| `WithHintf(err, format, ...args)`        | `WithHint` のフォーマット指定版                              |

```go
// 基本ラップ
if err := repo.Find(&user, id); err != nil {
    return errors.Wrapf(err, "ID=%d のユーザー取得中にエラーが発生しました", id)
}

// 並行処理のエラー合成
result, err1 := operationA()
if err2 := operationB(); err2 != nil {
    return errors.CombineErrors(err1, err2)
}

// 開発者向け詳細 + ユーザー向けヒント
return errors.WithHint(
    errors.WithDetail(err, "DB 接続タイムアウト。リトライ回数: 3"),
    "しばらく待ってから再試行してください",
)
```

---

## エラー識別メソッド

| メソッド                    | 概要                                                     |
| --------------------------- | -------------------------------------------------------- |
| `Is(err, target)`           | エラーが target と同じか確認（ネットワーク越しでも機能） |
| `IsAny(err, ...targets)`    | いずれかの target と一致するか確認                       |
| `As(err, target)`           | 特定の型にキャスト                                       |
| `HasAssertionFailure(err)`  | アサーション失敗を含むか                                 |
| `IsUnimplementedError(err)` | 未実装エラーか                                           |
| `HasType(err, ref)`         | 特定の具体型と一致するか                                 |

```go
var (
    ErrNotFound   = errors.New("not found")
    ErrPermission = errors.New("permission denied")
)

// 単一チェック
if errors.Is(err, ErrNotFound) {
    return c.JSON(404, gin.H{"error": "リソースが見つかりません"})
}

// 複数チェック
if errors.IsAny(err, ErrNotFound, ErrPermission) {
    return c.JSON(400, gin.H{"error": "リクエストエラー"})
}

// 型チェック
var appErr *AppError
if errors.As(err, &appErr) {
    return c.JSON(appErr.StatusCode, gin.H{"error": appErr.Message})
}
```

---

## PII セーフな詳細情報

ユーザー個人情報（Personal Identifiable Information）を Sentry 等の外部サービスに送る際は、機密情報を安全にマークできる。

| メソッド                                | 概要                       |
| --------------------------------------- | -------------------------- |
| `WithSafeDetails(err, format, ...args)` | 安全に報告できる詳細を追加 |
| `Safe(v)`                               | 値を PII-free としてマーク |
| `GetAllSafeDetails(err)`                | 安全な詳細をすべて取得     |

```go
// ユーザー ID は安全（PII-free）、メールアドレスは含めない
err = errors.WithSafeDetails(err,
    "ユーザー処理エラー: userID=%v",
    errors.Safe(userID),  // ID は安全
    // email は Safe でマークしないため Sentry に送られない
)
```

PIIってなんぞや？↓

- **PII（Personal Identifiable Information）**は個人を特定できる情報のこと。メールアドレス・電話番号・住所など。Sentryに送るエラーログにこれらが含まれていると個人情報漏洩になる。`errors.Safe()`でマークした値だけが外部サービスに送られる。

---

## ドメインエラー

エラーの発生元パッケージや領域を明示できる。

```go
var myDomain = errors.NamedDomain("myapp/user")

// エラーにドメインを付与
err = errors.WithDomain(err, myDomain)

// ドメイン外のエラーか確認
if errors.NotInDomain(err, myDomain) {
    // このエラーは user ドメイン外から来た
}
```

---

## Sentry 統合

| メソッド                 | 概要                  |
| ------------------------ | --------------------- |
| `BuildSentryReport(err)` | Sentry レポートを構築 |
| `ReportError(err)`       | Sentry にエラーを報告 |

```go
if err != nil {
    errors.ReportError(err)
    return wrapInternalError(err)
}
```

Sentryってなんぞや？↓

- **Sentry**はエラーをリアルタイムで収集・通知するエラー追跡サービス。アプリでエラーが起きると自動でSlackやメールで通知してくれる。`cockroachdb/errors`のスタックトレースと組み合わせると、どのコードパスで発生したか詳しく確認できる。

---

## AppError パターン（実践例）

アプリケーション固有のエラー型を作成し、HTTP ステータスコードと連携する定番パターン。

```go
// domain 層でエラーを定義
var (
    ErrUserNotFound    = errors.New("user not found")
    ErrUserUnauthorized = errors.New("user unauthorized")
)

// usecase 層でラップ
func (uc *UserUseCase) GetUser(ctx context.Context, id uint) (*User, error) {
    user, err := uc.repo.FindByID(ctx, id)
    if err != nil {
        if errors.Is(err, gorm.ErrRecordNotFound) {
            return nil, errors.Mark(err, ErrUserNotFound)
        }
        return nil, errors.Wrap(err, "ユーザー取得エラー")
    }
    return user, nil
}

// handler 層でエラーを識別してレスポンス
func (h *UserHandler) GetUser(ctx *gin.Context) {
    user, err := h.usecase.GetUser(ctx, userID)
    if err != nil {
        switch {
        case errors.Is(err, ErrUserNotFound):
            ctx.JSON(http.StatusNotFound, gin.H{"error": "ユーザーが見つかりません"})
        case errors.Is(err, ErrUserUnauthorized):
            ctx.JSON(http.StatusForbidden, gin.H{"error": "権限がありません"})
        default:
            ctx.JSON(http.StatusInternalServerError, gin.H{"error": "内部エラーが発生しました"})
        }
        return
    }
    ctx.JSON(http.StatusOK, user)
}
```

errors.Mark()ってなんぞや？↓

- **`errors.Mark(err, target)`**は、「このエラーは `target` エラーと同じ種類だ」とマークするメソッド。マーク後に `errors.Is(err, ErrUserNotFound)` で械をかけるとヒットする。
- `errors.Wrap()` との違いは、**エラーの「種類」だけを付記したいときに使う**こと。上の例では `gorm.ErrRecordNotFound` を自分のアプリの `ErrUserNotFound` として Handler 層に渡すことで、handlerが gormの具体実装に依存しなくて済む。

| デバッグやログ出力で「どこで起きたエラーか」を追いたいときに使う。クリーンアーキの層を贝通って伝携してきたエラーの本当の原因と発生箇所が一発でまるわかるのは助かる。 | 概要                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------- |
| `UnwrapAll(err)`                                                                                                                                                     | エラーチェーンの根本原因を取得               |
| `UnwrapOnce(err)`                                                                                                                                                    | 1 レベルだけアンラップ                       |
| `GetOneLineSource(err)`                                                                                                                                              | エラー発生箇所（ファイル、行、関数名）を取得 |
| `GetReportableStackTrace(err)`                                                                                                                                       | スタックトレースを取得                       |

```go
// 根本原因の確認
rootCause := errors.UnwrapAll(err)
fmt.Println("根本原因:", rootCause)

// 発生箇所の確認
file, line, fn, ok := errors.GetOneLineSource(err)
if ok {
    fmt.Printf("エラー発生箇所: %s:%d (%s)\n", file, line, fn)
}
```

---

## まとめ

| ユースケース               | 使うメソッド                                 |
| -------------------------- | -------------------------------------------- |
| 新しいエラーを作る         | `errors.New()` / `errors.Newf()`             |
| エラーにコンテキストを追加 | `errors.Wrap()` / `errors.Wrapf()`           |
| エラー識別                 | `errors.Is()` / `errors.IsAny()`             |
| 型チェック                 | `errors.As()`                                |
| 複数エラーを合成           | `errors.CombineErrors()` / `errors.Join()`   |
| 不変条件違反               | `errors.AssertionFailedf()`                  |
| PII 保護                   | `errors.WithSafeDetails()` + `errors.Safe()` |
| ユーザー向けメッセージ     | `errors.WithHint()`                          |
