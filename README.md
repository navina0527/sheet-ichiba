# シート市場 管理者二段階認証対応版

管理者画面を開く前に、Supabase TOTPによる二段階認証を必須にします。
初回はGoogle Authenticator等でQRコードを登録し、以後はログインごとに6桁コードを確認します。

導入後はadmin-apiもv3へ更新してください。
