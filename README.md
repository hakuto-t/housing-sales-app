# 住宅営業育成アプリ

住宅営業担当者向けの知識習得・スキル育成PC用Webアプリケーション。

## 技術スタック

- **Frontend**: Next.js 16 (App Router, TypeScript)
- **UI**: shadcn/ui + Tailwind CSS
- **Backend**: Next.js Route Handlers
- **DB**: PostgreSQL (Prisma ORM)
- **認証**: JWT + Cookie Session
- **AI採点**: OpenAI互換API
- **テスト**: Vitest / Playwright

## セットアップ

### 前提条件
- Node.js 18+
- PostgreSQL 14+
- npm

### 手順

1. 依存パッケージのインストール
```bash
npm install
```

2. 環境変数の設定
```bash
cp .env.example .env
# .env を編集してDB接続情報・APIキーを設定
```

3. データベースのセットアップ
```bash
npx prisma generate
npx prisma migrate dev --name init
```

4. 初期データの投入
```bash
npx tsx prisma/seed.ts
```

5. 開発サーバーの起動
```bash
npm run dev
```

6. ブラウザで http://localhost:3000 を開く

### デモアカウント
| ロール | メール | パスワード |
|--------|--------|------------|
| 管理者 | admin@demo.com | password123 |
| 受講者 | learner1@demo.com | password123 |
| 受講者 | learner2@demo.com | password123 |

## テスト

```bash
# ユニットテスト
npm test

# E2Eテスト
npm run test:e2e
```

## 環境変数

| 変数名 | 説明 | 例 |
|--------|------|-----|
| `DATABASE_URL` | PostgreSQL接続文字列 | `postgresql://user:pass@localhost:5432/jutaku` |
| `JWT_SECRET` | JWTトークン署名用シークレット | ランダム文字列 |
| `LLM_API_URL` | AI採点用LLM APIエンドポイント | `https://api.openai.com/v1` |
| `LLM_API_KEY` | LLM APIキー | `sk-...` |
| `LLM_MODEL` | 使用モデル名 | `gpt-4o-mini` |
| `NEXT_PUBLIC_APP_URL` | アプリURL | `http://localhost:3000` |

## 主な機能

- **学習モード**: 苦手カテゴリ優先出題、即時フィードバック
- **テストモード**: 時間制限付き、コンボボーナス
- **卒業検定**: 120問、総合90点以上 AND 全カテゴリ90点以上で合格
- **用語集**: 180語の住宅営業専門用語
- **ゲーミフィケーション**: XP/レベル/ストリーク/バッジ
- **ランキング**: 累計/月間、社内限定

## ドキュメント

- [仕様書](docs/spec.md)
- [運用手順](docs/operations.md)
- [実装上の仮定](docs/assumptions.md)
