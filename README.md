# シート市場 管理者追加アクセスパスワード対応版

## 導入順
1. Supabase Secretsへ`ADMIN_ACCESS_PASSWORD`を保存
2. `01_admin-api-index-v5-access-password.ts`を既存`admin-api`へ上書き
3. admin-apiのVerify JWTはOFFのまま
4. `02_sheet-ichiba-admin-access-password-site-update.zip`をGitHubへ上書き

## 動作
管理者画面は次の3段階で保護されます。

1. 管理者アカウントでログイン
2. 認証アプリによる二段階認証
3. 管理者専用アクセスパスワード

管理者アクセスパスワードはlocalStorageやsessionStorageへ保存せず、
ページを再読み込みすると再入力が必要です。
