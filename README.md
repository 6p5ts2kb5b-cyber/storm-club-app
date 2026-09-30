# STORMクラブ 運営管理アプリ

STORMクラブの活動準備（グラウンド・選手集合時間・指導者・審判・審判集合時間）を、スタッフ全員で共有するWebアプリです。
**「次の活動で何が足りていないか」をホーム画面ひとつで分かるようにする**ことを最優先にしています。

- iPhone・PCのブラウザで使えます（iPhoneでは「ホーム画面に追加」するとアプリのように使えます）
- Claudeがなくても動きます。コードはGitHub、公開はVercel、データはSupabaseにあり、すべてあなた名義です

## 開発の進み具合

| STEP | 内容 | 状態 |
| --- | --- | --- |
| 1 | アプリの土台・画面の枠・下部メニュー | ✅ 完了（サンプル表示） |
| 2 | Googleログイン | 🛠 コード完成・設定待ち |
| 3 | スタッフマスター | これから |
| 4〜16 | 活動日・区分・グラウンド・集合・指導者・試合・審判・ダッシュボード・カレンダー・スマホ調整 | これから |

## 使っている道具（かんたんな説明）

| 名前 | 役割 |
| --- | --- |
| Next.js | 画面を作る道具 |
| TypeScript | 書き間違いを見つけてくれるプログラムの書き方 |
| Supabase | データを保存するクラウドの倉庫＋ログイン係（STEP2から使用） |
| GitHub | このコードの保管場所 |
| Vercel | アプリをインターネットに公開するサービス |

## Vercelで公開する手順（最初の1回だけ）

1. https://vercel.com を開き「Sign Up」→「Continue with GitHub」で登録
2. 「Add New…」→「Project」を押す
3. 一覧から `storm-club-app` の「Import」を押す
4. 何も変更せず「Deploy」を押す
5. 1〜2分で完了。表示されたURL（例：`storm-club-app.vercel.app`）をiPhoneで開く

以後はGitHubにコードが保存されるたびに、Vercelが自動で公開し直します。

## フォルダの中身（主なもの）

```
src/
  app/                  各画面
    page.tsx            ホーム（要確認・次の活動）
    calendar/           カレンダー
    activities/         活動一覧・活動日の詳細
    staff/              スタッフマスター
    settings/           設定
    login/              ログイン画面
    globals.css         見た目（色・大きさ）
  components/           画面の部品（下部メニュー、活動カードなど）
  lib/
    divisions.ts        12月〜4月はトップ・アカデミー、などの決まり／時刻の逆算
    status.ts           🟢🟡🔴 の判定ルール
    sample.ts           STEP1の見た目確認用サンプル（STEP4で削除）
```

## パソコンで動かしたい場合（開発者向け・任意）

```
npm install
npm run dev
```

ブラウザで http://localhost:3000 を開きます。
