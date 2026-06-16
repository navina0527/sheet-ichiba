# シート市場 ログイン機能付き更新版

Supabaseのメールアドレス認証を接続した更新版です。

## GitHubへの上書き方法

1. このZIPを解凍
2. GitHubの `sheet-ichiba` を開く
3. `Add file` → `Upload files`
4. 解凍した5ファイルを全部ドラッグ
5. `Commit changes` を押す

同名のファイルは更新され、`config.js`だけ新しく追加されます。

## Supabaseで必要なURL設定

Supabaseのプロジェクトで、Authentication → URL Configurationを開きます。

- Site URL  
  `https://navina0527.github.io/sheet-ichiba/`

- Redirect URLs  
  `https://navina0527.github.io/sheet-ichiba/`

保存後、公開サイトの「新規登録」からテストしてください。

## 接続済み機能

- メールアドレスとパスワードによる新規登録
- 確認メール
- ログイン
- ログアウト
- ログイン状態の保持
- 未ログイン時の出品ボタン制御

## 安全上の注意

`config.js`に入っているのはブラウザ用の公開可能なProject URLとPublishable keyです。
Secret keyまたはservice_role keyは絶対にGitHubへ入れないでください。
