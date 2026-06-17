# シート市場 販売者情報登録機能

## 追加内容
- ログイン後の「販売者情報」ボタン
- 氏名・法人名、屋号、問い合わせメール、対応時間の登録
- 住所・電話番号を「請求時に開示」または「サイト掲載」から選択
- 商品ページで購入者が販売者情報を確認
- 販売者情報が未登録のユーザーは新規出品・再公開不可
- 単品決済とカート決済で販売者情報の登録をサーバー側でも確認
- Stripe決済画面へ販売者名と問い合わせ先を表示

## 導入順
1. 01_seller_legal_profiles.sql をSupabase SQL Editorで実行
2. 04_sheet-ichiba-seller-legal-update.zip をGitHubへ上書き
3. サイトで「販売者情報」を開いて登録
4. 02_create-checkout-index-seller-legal.ts を既存 create-checkout へ上書き
5. 03_create-cart-checkout-index-seller-legal.ts を既存 create-cart-checkout へ上書き
