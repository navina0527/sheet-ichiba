# シート市場 購入ボタン対応版 v6

商品カードを開くと詳細画面が表示され、購入者がStripe Checkoutへ進める版です。

## GitHubへの上書き

1. ZIPを解凍
2. GitHubの `sheet-ichiba` を開く
3. `Add file` → `Upload files`
4. 解凍した5ファイルを全部ドラッグ
5. `Commit changes`

## 追加した機能

- 商品詳細画面
- 商品価格・説明・出品者の表示
- 「購入する」ボタン
- `create-checkout` Edge Functionの呼び出し
- Stripe Checkout URLへの移動
- キャンセル時の案内
- 自分の商品を購入できない制御

## まだ未実装

- Stripe Webhookによる決済完了確定
- 購入済み商品のダウンロード
- 購入履歴

購入完了後のファイル提供は、ブラウザの戻り先だけで判断せず、次にStripe Webhookを接続して確定します。
