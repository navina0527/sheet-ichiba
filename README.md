# シート市場 ログインロック対応版

- 30分以内にログインを10回失敗すると30分間ロック
- 成功時は失敗回数をリセット
- メールアドレスはSHA-256ハッシュで保存
- login_securityテーブルはブラウザから直接アクセス不可

## 導入順
1. 01_login_lock.sqlをSupabase SQL Editorで実行
2. 02_secure-login-index.tsをsecure-loginとして新規デプロイ
3. Verify JWTはOFF
4. 03_sheet-ichiba-login-lock-site-update.zipをGitHubへ上書き
