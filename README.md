# シート市場 セキュリティ強化版 v20

追加内容:
- ユーザー入力のUnicode正規化・制御文字除去・最大長制限
- メールアドレス形式チェック
- Stripe Checkout / Connectの移動先URLを許可リストで検証
- SupabaseのダウンロードURLを許可リストで検証
- Content Security PolicyとReferrer Policyを追加
- 動的表示は既存のescapeHtmlを継続使用

更新方法:
1. ZIPを解凍
2. GitHubのsheet-ichibaを開く
3. Add file → Upload files
4. 中のファイルを全部上書き
5. Commit changes
6. Ctrl＋Shift＋Rで強制更新
