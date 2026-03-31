# 運用手順書

## 問題追加手順

### 管理画面から追加
1. 管理者アカウントでログイン
2. サイドバー「問題管理」を選択
3. 「問題を追加」ボタンをクリック
4. 問題タイプ・カテゴリ・難易度・問題文を入力
5. MCQの場合: 4つの選択肢を入力し、正解を指定
6. 保存

### APIから一括追加
```bash
curl -X POST http://localhost:3000/api/admin/questions \
  -H "Content-Type: application/json" \
  -H "Cookie: jutaku-session=<token>" \
  -d '{
    "type": "MCQ",
    "category": "建築基礎",
    "difficulty": 3,
    "text": "問題文",
    "explanation": "解説文",
    "options": [
      {"text": "選択肢1", "isCorrect": true},
      {"text": "選択肢2", "isCorrect": false},
      {"text": "選択肢3", "isCorrect": false},
      {"text": "選択肢4", "isCorrect": false}
    ]
  }'
```

## 用語更新手順

### 管理画面から更新
1. 管理者アカウントでログイン
2. サイドバー「用語管理」を選択
3. 更新対象の用語を選択
4. 各フィールドを編集して保存

### CSVでの一括差し替え
1. 現在のデータをエクスポート: `npx tsx scripts/export-glossary.ts`
2. CSVを編集
3. インポート: `npx tsx scripts/import-glossary.ts path/to/file.csv`

## ランキング運用

### 月間ランキング
- 毎月1日に自動で新期間が開始される
- 過去月のデータは履歴として保持
- ランキングはXP獲得時にリアルタイム更新

### 手動ランク再計算
```bash
npx tsx scripts/recalculate-rankings.ts
```

## 障害時対応

### DBの接続エラー
1. PostgreSQLサービスの稼働確認
2. `DATABASE_URL`環境変数の確認
3. ネットワーク接続の確認

### AI採点失敗
- 自動的に1回リトライ
- 2回失敗時は暫定スコア(50点/partial)を付与
- `AIScore`テーブルの`retryCount`が2のレコードを確認
- LLM APIキーの有効性を確認

### セッション切れ
- JWTトークンは7日間有効
- 再ログインで復旧

### データの整合性確認
```bash
# Prismaスタジオでデータ確認
npx prisma studio

# マイグレーション状態確認
npx prisma migrate status
```
