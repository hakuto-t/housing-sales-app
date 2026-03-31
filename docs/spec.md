# 住宅営業育成アプリ 仕様書

## 概要
住宅営業担当者向けの知識習得・スキル育成を目的としたPC用Webアプリケーション。
学習モード・テストモード・卒業検定の3段階で、180の専門用語と多様な問題形式を通じて実務知識を体系的に習得する。

## 技術スタック
- **Frontend**: Next.js 16 (App Router, TypeScript)
- **UI**: shadcn/ui + Tailwind CSS
- **Backend**: Next.js Route Handlers
- **DB**: PostgreSQL (Prisma ORM)
- **認証**: JWT (jose) + Cookie-based Session
- **AI採点**: OpenAI互換API (プロバイダ抽象化)
- **テスト**: Vitest (unit) + Playwright (E2E)

## 画面一覧

| パス | 画面名 | 説明 |
|------|--------|------|
| `/login` | ログイン | メール/パスワード認証 |
| `/dashboard` | ダッシュボード | 進捗・弱点・バッジ・ランク表示 |
| `/learn` | 学習モード | 苦手優先の出題、即時フィードバック |
| `/test` | テストモード | 時間制限付き、コンボ・XP獲得 |
| `/exam` | 卒業検定 | 120問、90点足切り |
| `/results/[id]` | 結果詳細 | セッション結果・統計 |
| `/glossary` | 用語集 | 180語の検索・閲覧 |
| `/ranking` | ランキング | 累計/月間、社内限定 |
| `/badges` | バッジ | 獲得・未獲得バッジ一覧 |
| `/admin/questions` | 問題管理 | CRUD操作 |
| `/admin/glossary` | 用語管理 | CRUD操作 |

## API一覧

| メソッド | パス | 説明 |
|----------|------|------|
| POST | `/api/auth/login` | ログイン |
| POST | `/api/auth/logout` | ログアウト |
| GET | `/api/auth/me` | 現在のユーザー情報 |
| GET | `/api/dashboard` | ダッシュボードデータ |
| POST | `/api/learn` | 学習セッション開始 |
| POST | `/api/test` | テストセッション開始 |
| POST | `/api/submit` | 回答提出・採点 |
| GET | `/api/exam` | 検定受験可否チェック |
| POST | `/api/exam` | 検定操作 (start/answer/complete) |
| GET | `/api/glossary` | 用語検索・一覧 |
| GET | `/api/ranking` | ランキング取得 |
| GET | `/api/badges` | バッジ一覧 |
| GET | `/api/admin/questions` | 問題一覧 (管理者) |
| POST | `/api/admin/questions` | 問題作成 (管理者) |
| GET | `/api/admin/glossary` | 用語一覧 (管理者) |
| POST | `/api/admin/glossary` | 用語作成 (管理者) |
| PUT | `/api/admin/glossary` | 用語更新 (管理者) |

## 問題形式

| タイプ | 説明 | 採点方法 |
|--------|------|----------|
| MCQ | 4択問題 | 正解位置均等化、自動採点 |
| FREE_TEXT | 自由記述 | AI採点 (100点満点) |
| CASE_MULTI | ケース記述 | AI採点 (100点満点) |
| DEFINITION_FIX | 定義修正 | AI採点 |
| ORDERING | 並べ替え | 完全一致判定 |

## AI採点ルーブリック (100点満点)
- 定義正確性: 40点
- 必須要素網羅: 25点
- 近接概念との区別: 20点
- 実務説明可能性: 15点

## 卒業判定
- 120問出題 (カテゴリ均等配分)
- **合格条件**: 総合90点以上 AND 全カテゴリ90点以上
- 不合格時: 弱点カテゴリ補講を自動提案
- 再受験: 24時間クールダウン

## ゲーミフィケーション
- **XP**: 正答+難易度+コンボ+速度で加算、不正解でも継続XP付与
- **レベル**: 1-20 (XP閾値テーブル)
- **ストリーク**: 日次学習継続カウント
- **バッジ**: 12種類、条件自動付与
- **ランキング**: 累計/月間、社内限定、氏名表示
