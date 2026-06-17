# シート市場 管理者判定修正版

管理者画面を開く前の権限確認を、admin-api経由ではなく
admin_usersテーブルの本人向けRLSで直接確認するよう修正しました。

## 更新方法
1. ZIPを解凍
2. GitHubのsheet-ichibaを開く
3. Add file → Upload files
4. 中のファイルをすべて上書き
5. Commit changes
6. サイトでCtrl＋Shift＋R
7. 一度ログアウトして管理者アカウントで再ログイン
