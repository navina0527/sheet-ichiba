# シート市場 カート機能 v9

## 内容
- カートへ追加・削除
- ヘッダーに商品点数表示
- カート内容と合計金額
- 最大8商品までまとめてStripe Checkout
- 同じ出品者の商品だけまとめ買い
- 決済後に各商品を購入済みへ変更
- 購入者だけ各Excelをダウンロード

## 導入順
1. `01_cart_migration.sql`をSupabase SQL Editorで実行
2. `02_create-cart-checkout-index.ts`を`create-cart-checkout`としてデプロイ（Verify JWT ON）
3. `03_stripe-webhook-index-v2.ts`を既存`stripe-webhook`へ上書き（Verify JWT OFF）
4. `04_sheet-ichiba-cart-update.zip`をGitHubへ上書き
