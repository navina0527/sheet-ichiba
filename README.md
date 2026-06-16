# シート市場 メール確認対応版 v3

確認メールのリンクからサイトへ戻った際に、認証情報を受け取り、自動ログインする処理を追加した版です。

## GitHubへの上書き方法

1. ZIPを解凍
2. GitHubの `sheet-ichiba` を開く
3. `Add file` → `Upload files`
4. 解凍した5ファイルを全部ドラッグ
5. `Commit changes` を押す

同名ファイルは上書きされます。ブラウザキャッシュ対策として `?v=3` を付けています。

## Supabase側の設定

Authentication → URL Configuration

- Site URL: `https://navina0527.github.io/sheet-ichiba/`
- Redirect URLs: `https://navina0527.github.io/sheet-ichiba/`

その後、Emailプロバイダーの `Confirm email` をONに戻します。

## テスト

既存の確認済みアカウントには影響しません。確認メールを試すには、別のメールアドレスで新規登録するか、テストユーザーを削除して同じアドレスで登録し直します。

## 追加した処理

- 確認メールから戻ったURLの認証情報を処理
- 通常のトークン形式とPKCEコード形式の両方に対応
- 確認成功後に自動ログイン
- 認証用の長いURLパラメータを自動削除
- 成功・失敗メッセージを日本語表示
