---
title: "第8章：Go × MySQL のタイムゾーン設計（JST / UTC）"
description: GoとMySQLを組み合わせたシステムでのタイムゾーン設計。JST/UTC変換の落とし穴と、入力タイムゾーンに関わらず時刻をJSTとして扱うパターンを解説。
date: 2026-03-10
tags: ["Go", "Golang", "Backend", "MySQL", "Timezone"]
---

# Go × MySQL のタイムゾーン設計（JST / UTC）

## はじめに

タイムゾーン周りはハマりやすい。DBはUTC、アプリはJSTで統一して、変換はドライバとプラグインに任せるのが楽。意識的にUTCに変換するコードを書かないのがポイント。

---

## 基本方針

| レイヤー            | タイムゾーン | 備考                                  |
| ------------------- | ------------ | ------------------------------------- |
| MySQL（DB）         | **UTC**      | MySQL はタイムゾーン設定で UTC を指定 |
| Go アプリケーション | **JST**      | コード上では常に JST で扱う           |
| フロントへの返却    | **RFC3339**  | `2024-11-19T10:30:00+09:00` 形式      |

---

## データフロー

```
[フロント]
  ↓ RFC3339 形式 (例: "2024-11-19T10:30:00+09:00")
[API - CustomTime 型でパース]
  ↓ JST として扱う (2024-11-19 10:30:00 +0900 JST)
[DB 保存]
  ↓ MySQL ドライバが自動的に UTC に変換 (2024-11-19 01:30:00 UTC)
[MySQL (UTC 格納)]
  ↓ GORM クエリ実行後 (2024-11-19 01:30:00 +0000 UTC)
[JSTPlugin - gorm:after_query]
  ↓ time.Time フィールドを自動的に JST に変換 (2024-11-19 10:30:00 +0900 JST)
[API レスポンス]
  ↓ RFC3339 形式で返却 (例: "2024-11-19T10:30:00+09:00")
[フロント]
```

---

## 実装ルール

### 1. 時刻の取得には `time.Now()` を使う

```go
// ❌ NG: MySQL の NOW() 関数は使用しない
query := "SELECT * FROM users WHERE created_at < NOW()"

// ✅ OK: Go コード側で time.Now() を使う
now := time.Now()
db.Where("created_at < ?", now).Find(&users)
```

### 2. UTC 変換しない

```go
// ❌ NG: .UTC() で変換しない
now := time.Now().UTC()

// ✅ OK: JST のまま使う（MySQL ドライバが自動変換）
now := time.Now()
```

---

## CustomTime 型

`time.Time` の代わりに `types.CustomTime` を使うと、フロントとの時刻のやり取りが安全になる。

```go
type Response struct {
    CreatedAt types.CustomTime `json:"created_at"`
    UpdatedAt types.CustomTime `json:"updated_at"`
}
```

### パース挙動（重要）

| 入力形式      | 例                          | 結果                                                  |
| ------------- | --------------------------- | ----------------------------------------------------- |
| RFC3339       | `2024-11-19T10:30:00+09:00` | タイムゾーン情報を**無視**し、値はそのまま JST に設定 |
| RFC3339 (UTC) | `2024-11-19T10:30:00Z`      | 同上 (`10:30` が JST として扱われる)                  |
| DateTime      | `2024-11-19 10:30:00`       | JST として扱う                                        |
| DateOnly      | `2024-11-19`                | `2024-11-19 00:00:00 JST`                             |

> **ポイント**: 入力タイムゾーンに関わらず、**時刻の値（10:30）をそのまま JST として扱います**。  
> 日本国内向けサービスでは、ユーザーが入力した時刻の値をそのまま使うのが自然なため。

CustomTimeってなんぞや？↓

- **CustomTime**は`time.Time`をラップした独自の型で、フロントから来るRFC3339形式の文字列を安全にパースできる。通常の`time.Time`と違い、タイムゾーン情報を無視して「時刻の値」をそのままJSTとして扱うのが最大の特徴。
- 日本向けサービスでは「10:30と書いてあれば日本時間の10:30」として扱うのが自然なので、この実装になっている。

```go
// 入力: "2024-11-19T10:30:00+05:00" (UTC+5)
// ↓
// 出力: 2024-11-19 10:30:00 +0900 JST  ← 10:30 という値はそのまま JST
```

### レスポンス時の出力

常に RFC3339 形式で出力されます：

```
2024-11-19T10:30:00+09:00
```

---

## JSTPlugin（GORM プラグイン）

MySQL から取得した `time.Time` 値は UTC だが、JSTPlugin が `gorm:after_query` コールバックで自動的に JST に変換する。

```go
// DB 初期化時に登録
db.Use(scope.NewJSTPlugin())
```

```go
// 取得例
var user User
db.WithContext(ctx).First(&user)
// user.CreatedAt → 自動で JST に変換済み (2024-11-19 10:30:00 +0900 JST)
```

---

## DB 接続文字列の設定

```go
dsn := "user:password@tcp(host:3306)/dbname?parseTime=true&loc=Asia%2FTokyo"
```

| パラメータ         | 役割                                              |
| ------------------ | ------------------------------------------------- |
| `parseTime=true`   | MySQL の DATETIME/TIMESTAMP を `time.Time` に変換 |
| `loc=Asia%2FTokyo` | Go での時刻解釈を JST に設定                      |

parseTime=trueとloc=Asia/Tokyoってなんぞや？↓

- **parseTime=true**を付けないと、MySQLのDATETIMEカラムが`[]byte`で返ってきて`time.Time`型に自動変換されない。
- **loc=Asia/Tokyo**は、GoMySQLdriversがDBから取得した時刻をどのタイムゾーンで解釈するかの設定。JSTを指定することでGo側でJST時刻として扱える。

---

## トラブルシューティング

### 時刻のズレが発生する場合

**1. DB タイムゾーン確認**

```sql
SELECT @@global.time_zone, @@session.time_zone;
-- 結果が 'UTC' であることを確認
```

**2. Go のタイムゾーン確認**

```go
loc, _ := time.LoadLocation("Asia/Tokyo")
fmt.Println(time.Now().In(loc))
```

**3. 接続文字列確認**

- `parseTime=true` が含まれているか
- `loc=Asia%2FTokyo` が含まれているか

### よくある間違い

| 間違い                 | 症状                       | 解決策                              |
| ---------------------- | -------------------------- | ----------------------------------- |
| UTC / JST 混在         | 9 時間のズレ               | この方針に統一                      |
| 文字列での時刻比較     | タイムゾーン情報が失われる | `time.Time` 型を使う                |
| JSON 変換時の TZ 喪失  | フロントで時刻がずれる     | `types.CustomTime` を使う           |
| 入力 TZ をそのまま変換 | 意図しない時刻になる       | `CustomTime` のパース挙動を理解する |

---

## まとめ

```
MySQL = UTC 格納
  ↕ MySQL ドライバが自動変換
Go アプリ = JST で処理
  ↕ CustomTime がパース / フォーマット
フロント = RFC3339 (JST) で通信
```

- `time.Now()` のみ使用、`.UTC()` は使わない
- フロントとのやり取りは `types.CustomTime` 型
- DB ↔ アプリ間の変換は MySQL ドライバ + JSTPlugin が自動処理
- 明示的なタイムゾーン変換コードは不要
