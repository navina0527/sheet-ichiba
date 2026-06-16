# シート市場 Stripe受取設定対応版 v5

デプロイ済みのSupabase Edge Function `connect-account` をサイトから呼び出し、
出品者をStripeの本人確認・振込口座登録画面へ案内する版です。

## GitHubへの上書き

1. ZIPを解凍
2. GitHubの `sheet-ichiba` を開く
3. `Add file` → `Upload files`
4. 解凍した5ファイルを全部ドラッグ
5. `Commit changes`

## 追加した機能

- ログイン中だけ「売上受取設定」を表示
- `connect-account` Edge Functionを呼び出す
- Stripe-hosted onboardingへ移動
- Stripeから戻った後に登録状況を自動確認
- 登録リンクの期限切れ時に新しいリンクを再発行
- 未設定・設定途中・設定完了を画面に表示

## テスト手順

1. サイトを再読み込みしてログイン
2. 出品案内欄の「受取設定を始める」を押す
3. Stripeのサンドボックス画面で必要事項を入力
4. サイトへ戻った後、設定状況が表示されることを確認

StripeのAccount Linkは一度だけ利用できるため、リンク切れ時はサイトが新しいリンクを発行します。
