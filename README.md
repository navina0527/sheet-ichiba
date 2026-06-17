# シート市場 購入済みページ v10

## 追加機能
- ヘッダーに「購入済み」ボタン
- 購入済み件数の表示
- 購入商品一覧、購入日、金額の表示
- 一覧から直接Excelを再ダウンロード
- 非公開になった商品も購入履歴に残る

## 導入順
1. `01_download-purchase-index-v3.ts`を既存の`download-purchase`へ上書きしてDeploy（Verify JWT ON）
2. `02_sheet-ichiba-purchased-page-update.zip`を解凍し、GitHubへ5ファイルを上書き
