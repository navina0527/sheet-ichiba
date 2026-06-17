const supabaseClient = window.supabase.createClient(
  window.SHEET_ICHIBA_CONFIG.url,
  window.SHEET_ICHIBA_CONFIG.publishableKey,
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  }
);

let authMode = "login";
let currentSession = null;
let allProducts = [];
let activeCategory = "すべて";
let currentSearchTerm = "";
let stripeStatusChecking = false;
let selectedProduct = null;
let checkoutStarting = false;
let downloadStarting = false;
let paidProductIds = new Set();
const CART_STORAGE_KEY = "sheetIchibaCartV1";
const PENDING_CART_KEY = "sheetIchibaPendingCartV1";
let cartProductIds = [];
let cartCheckoutStarting = false;

function showMessage(message, duration = 3200){
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.classList.remove("show"), duration);
}

function escapeHtml(value){
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function formatPrice(price){
  const amount = Number(price || 0);
  return amount === 0 ? "無料" : `¥${amount.toLocaleString("ja-JP")}`;
}

function getPreviewUrl(path){
  if(!path) return "";
  const { data } = supabaseClient.storage
    .from("product-previews")
    .getPublicUrl(path);
  return data?.publicUrl || "";
}

function renderProducts(){
  const grid = document.getElementById("productGrid");
  const emptyState = document.getElementById("emptyState");

  const filtered = allProducts.filter(product => {
    const categoryMatches = activeCategory === "すべて" || product.category === activeCategory;
    const searchable = `${product.title} ${product.description} ${product.category}`.toLowerCase();
    const searchMatches = !currentSearchTerm || searchable.includes(currentSearchTerm);
    return categoryMatches && searchMatches;
  });

  document.getElementById("resultCount").textContent = `${filtered.length}件の商品`;

  if(filtered.length === 0){
    grid.innerHTML = "";
    emptyState.hidden = false;
    return;
  }

  emptyState.hidden = true;
  grid.innerHTML = filtered.map(product => {
    const imageUrl = getPreviewUrl(product.preview_image_path);
    const sellerName = product.profiles?.display_name || "出品者";
    const description = product.description.length > 82
      ? `${product.description.slice(0, 82)}…`
      : product.description;

    const preview = imageUrl
      ? `<img class="product-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.title)}のプレビュー画像" loading="lazy">`
      : `<div class="product-thumb-placeholder">${escapeHtml(product.title)}</div>`;

    return `
      <article class="product-card" data-product-id="${escapeHtml(product.id)}">
        ${preview}
        <div class="product-body">
          <span class="tag">${escapeHtml(product.category)}</span>
          <h3>${escapeHtml(product.title)}</h3>
          <p>${escapeHtml(description)}</p>
          <div class="product-meta">
            <strong class="${Number(product.price_jpy) === 0 ? "price-free" : ""}">${formatPrice(product.price_jpy)}</strong>
            <span class="${
              paidProductIds.has(product.id)
                ? "purchased-label"
                : cartProductIds.includes(product.id)
                  ? "cart-product-label"
                  : ""
            }">
              ${
                paidProductIds.has(product.id)
                  ? "購入済み"
                  : cartProductIds.includes(product.id)
                    ? "カート内"
                    : "新着"
              }
            </span>
          </div>
          <span class="seller-name">出品者：${escapeHtml(sellerName)}</span>
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll(".product-card").forEach(card => {
    card.addEventListener("click", () => {
      openProductDetail(card.dataset.productId);
    });
  });
}

async function loadProducts(){
  const grid = document.getElementById("productGrid");
  grid.innerHTML = '<div class="loading-products">商品を読み込んでいます…</div>';

  const { data, error } = await supabaseClient
    .from("products")
    .select(`
      id,
      seller_id,
      title,
      description,
      category,
      price_jpy,
      preview_image_path,
      created_at,
      profiles (
        display_name
      )
    `)
    .eq("status", "published")
    .order("created_at", { ascending: false });

  if(error){
    console.error("Products load error:", error);
    allProducts = [];
    grid.innerHTML = "";
    document.getElementById("emptyState").hidden = false;
    document.getElementById("emptyState").querySelector("strong").textContent = "商品を読み込めませんでした。";
    document.getElementById("emptyState").querySelector("span").textContent = "Supabaseの設定を確認してください。";
    document.getElementById("resultCount").textContent = "0件の商品";
    return;
  }

  allProducts = data || [];
  renderProducts();
}

function filterProducts(category, clickedButton){
  activeCategory = category;
  document.querySelectorAll(".category").forEach(btn => btn.classList.remove("active"));
  clickedButton?.classList.add("active");
  renderProducts();
}

function searchProducts(){
  currentSearchTerm = document.getElementById("searchInput").value.trim().toLowerCase();
  renderProducts();
}

function openAuthModal(mode = "login"){
  setAuthMode(mode);
  const modal = document.getElementById("authModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setTimeout(() => document.getElementById("authEmail").focus(), 50);
}

function closeAuthModal(){
  const modal = document.getElementById("authModal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  setAuthMessage("");
}

function setAuthMode(mode){
  authMode = mode;
  const isLogin = mode === "login";

  document.getElementById("loginTab").classList.toggle("active", isLogin);
  document.getElementById("signupTab").classList.toggle("active", !isLogin);
  document.getElementById("authTitle").textContent = isLogin ? "ログイン" : "新規登録";
  document.getElementById("authDescription").textContent = isLogin
    ? "登録したメールアドレスとパスワードを入力してください。"
    : "メールアドレスと8文字以上のパスワードで登録できます。";
  document.getElementById("authSubmitButton").textContent = isLogin ? "ログイン" : "アカウントを作る";
  document.getElementById("authPassword").setAttribute(
    "autocomplete",
    isLogin ? "current-password" : "new-password"
  );
  setAuthMessage("");
}

function setAuthMessage(message, type = ""){
  const target = document.getElementById("authMessage");
  target.textContent = message;
  target.className = `auth-message ${type}`.trim();
}

function setProductMessage(message, type = ""){
  const target = document.getElementById("productMessage");
  target.textContent = message;
  target.className = `auth-message ${type}`.trim();
}

function translateAuthError(message){
  const text = String(message || "");
  if(text.includes("Invalid login credentials")) return "メールアドレスかパスワードが違います。";
  if(text.includes("User already registered")) return "このメールアドレスはすでに登録されています。";
  if(text.includes("Password should be")) return "パスワードは8文字以上で入力してください。";
  if(text.includes("Email not confirmed")) return "確認メール内のリンクを押して、メール確認を完了してください。";
  if(text.includes("Unable to validate email address")) return "メールアドレスの形式を確認してください。";
  if(text.includes("expired")) return "確認リンクの期限が切れています。もう一度新規登録してください。";
  return `処理できませんでした：${text}`;
}

function getSiteRootUrl(){
  return `${window.location.origin}${window.location.pathname}`;
}

function hasAuthCallbackParams(){
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  return Boolean(
    query.get("code") ||
    query.get("error") ||
    query.get("error_description") ||
    hash.get("access_token") ||
    hash.get("refresh_token") ||
    hash.get("error") ||
    hash.get("error_description")
  );
}

function cleanAuthParamsFromUrl(){
  window.history.replaceState({}, document.title, getSiteRootUrl());
}

async function completeEmailConfirmation(){
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const callbackDetected = hasAuthCallbackParams();

  const errorDescription =
    query.get("error_description") ||
    hash.get("error_description") ||
    query.get("error") ||
    hash.get("error");

  if(errorDescription){
    cleanAuthParamsFromUrl();
    showMessage(`メール確認に失敗しました：${decodeURIComponent(errorDescription.replace(/\+/g, " "))}`, 6000);
    return null;
  }

  const code = query.get("code");
  if(code){
    const { data, error } = await supabaseClient.auth.exchangeCodeForSession(code);
    cleanAuthParamsFromUrl();
    if(error){
      console.error("Code exchange error:", error);
      showMessage("確認リンクを処理できませんでした。もう一度確認メールを開いてください。", 6000);
      return null;
    }
    showMessage("メール確認が完了しました。ログイン済みです！", 5000);
    return data.session ?? null;
  }

  const accessToken = hash.get("access_token");
  const refreshToken = hash.get("refresh_token");
  if(accessToken && refreshToken){
    const { data, error } = await supabaseClient.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken
    });
    cleanAuthParamsFromUrl();
    if(error){
      console.error("Set session error:", error);
      showMessage("メール確認は行われましたが、自動ログインに失敗しました。ログイン画面から入ってください。", 6000);
      return null;
    }
    showMessage("メール確認が完了しました。ログイン済みです！", 5000);
    return data.session ?? null;
  }

  const { data, error } = await supabaseClient.auth.getSession();
  if(error){
    console.error("Session error:", error);
  }

  if(callbackDetected){
    cleanAuthParamsFromUrl();
    if(data?.session){
      showMessage("メール確認が完了しました。ログイン済みです！", 5000);
    }
  }

  return data?.session ?? null;
}

async function handleAuthSubmit(event){
  event.preventDefault();

  const email = document.getElementById("authEmail").value.trim();
  const password = document.getElementById("authPassword").value;
  const submitButton = document.getElementById("authSubmitButton");

  submitButton.disabled = true;
  submitButton.textContent = "処理中…";
  setAuthMessage("");

  try{
    if(authMode === "signup"){
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: getSiteRootUrl()
        }
      });

      if(error) throw error;

      if(data.session){
        setAuthMessage("登録してログインしました。", "success");
        setTimeout(closeAuthModal, 700);
      }else{
        setAuthMessage("確認メールを送りました。メール内のリンクを押すと、自動でログインします。", "success");
      }
    }else{
      const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
      if(error) throw error;
      setAuthMessage("ログインしました。", "success");
      setTimeout(closeAuthModal, 600);
    }
  }catch(error){
    setAuthMessage(translateAuthError(error.message), "error");
  }finally{
    submitButton.disabled = false;
    submitButton.textContent = authMode === "login" ? "ログイン" : "アカウントを作る";
  }
}

async function handleAuthButton(){
  if(!currentSession){
    openAuthModal("login");
    return;
  }

  const shouldLogout = window.confirm("ログアウトしますか？");
  if(!shouldLogout) return;

  const { error } = await supabaseClient.auth.signOut();
  if(error){
    showMessage("ログアウトできませんでした。");
    return;
  }
  showMessage("ログアウトしました。");
}

function refreshAuthUI(session){
  currentSession = session;
  const button = document.getElementById("authButton");
  const label = document.getElementById("authUserLabel");

  if(session?.user){
    label.textContent = session.user.email || "ログイン中";
    label.hidden = false;
    button.textContent = "ログアウト";
  }else{
    label.textContent = "";
    label.hidden = true;
    button.textContent = "ログイン";
    paidProductIds = new Set();
  }

  setStripeUI();
}





function loadCartFromStorage(){
  try{
    const saved = JSON.parse(localStorage.getItem(CART_STORAGE_KEY) || "[]");
    cartProductIds = Array.isArray(saved)
      ? [...new Set(saved.map(value => String(value)).filter(Boolean))].slice(0, 8)
      : [];
  }catch(_error){
    cartProductIds = [];
  }

  updateCartUI();
}

function saveCart(){
  localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartProductIds));
  updateCartUI();

  if(allProducts.length > 0){
    renderProducts();
  }
}

function getCartProducts(){
  const productsById = new Map(allProducts.map(product => [product.id, product]));
  return cartProductIds
    .map(productId => productsById.get(productId))
    .filter(Boolean);
}

function updateCartUI(){
  const badge = document.getElementById("cartCountBadge");
  if(badge){
    badge.textContent = String(cartProductIds.length);
  }

  renderCart();
}

function renderCart(){
  const container = document.getElementById("cartItems");
  const totalElement = document.getElementById("cartTotal");
  const checkoutButton = document.getElementById("cartCheckoutButton");
  const clearButton = document.getElementById("cartClearButton");

  if(!container || !totalElement || !checkoutButton || !clearButton) return;

  const products = getCartProducts();

  if(products.length !== cartProductIds.length && allProducts.length > 0){
    cartProductIds = products.map(product => product.id);
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartProductIds));
  }

  if(products.length === 0){
    container.innerHTML = '<div class="cart-empty">カートは空です。</div>';
    totalElement.textContent = "¥0";
    checkoutButton.disabled = true;
    clearButton.hidden = true;
    return;
  }

  const total = products.reduce(
    (sum, product) => sum + Number(product.price_jpy || 0),
    0
  );

  container.innerHTML = products.map(product => {
    const imageUrl = getPreviewUrl(product.preview_image_path);
    const preview = imageUrl
      ? `<img class="cart-item-image" src="${escapeHtml(imageUrl)}" alt="">`
      : `<div class="cart-item-placeholder">Excel</div>`;

    return `
      <div class="cart-item">
        ${preview}
        <div class="cart-item-copy">
          <strong>${escapeHtml(product.title)}</strong>
          <span>${escapeHtml(product.profiles?.display_name || "出品者")}</span>
        </div>
        <div class="cart-item-side">
          <span class="cart-item-price">${formatPrice(product.price_jpy)}</span>
          <button class="cart-remove-button" type="button" onclick="removeFromCart('${escapeHtml(product.id)}')">削除</button>
        </div>
      </div>
    `;
  }).join("");

  totalElement.textContent = formatPrice(total);
  checkoutButton.disabled = false;
  clearButton.hidden = false;
}

function openCartModal(){
  renderCart();
  const modal = document.getElementById("cartModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeCartModal(){
  const modal = document.getElementById("cartModal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
}

function clearCart(){
  cartProductIds = [];
  saveCart();
  showMessage("カートを空にしました。");
}

function removeFromCart(productId){
  cartProductIds = cartProductIds.filter(id => id !== productId);
  saveCart();

  if(selectedProduct?.id === productId){
    openProductDetail(productId);
  }
}

function canAddProductToCart(product){
  if(!product){
    return "商品情報を取得できませんでした。";
  }

  if(paidProductIds.has(product.id)){
    return "この商品は購入済みです。";
  }

  if(currentSession?.user?.id === product.seller_id){
    return "自分の商品はカートに入れられません。";
  }

  if(Number(product.price_jpy) <= 0){
    return "無料商品は現在カートに対応していません。";
  }

  if(cartProductIds.length >= 8 && !cartProductIds.includes(product.id)){
    return "カートに入れられる商品は8点までです。";
  }

  const cartProducts = getCartProducts();

  if(
    cartProducts.length > 0 &&
    cartProducts[0].seller_id !== product.seller_id
  ){
    return "別の出品者の商品は同じカートに入れられません。先に購入するか、カートを空にしてください。";
  }

  return "";
}

function toggleSelectedProductInCart(){
  if(!selectedProduct) return;

  if(cartProductIds.includes(selectedProduct.id)){
    removeFromCart(selectedProduct.id);
    showMessage("カートから削除しました。");
    return;
  }

  const errorMessage = canAddProductToCart(selectedProduct);

  if(errorMessage){
    showMessage(errorMessage, 6000);
    return;
  }

  cartProductIds.push(selectedProduct.id);
  saveCart();
  openProductDetail(selectedProduct.id);
  showMessage("カートに追加しました！");
}

async function invokeCreateCartCheckout(productIds){
  const { data, error } = await supabaseClient.functions.invoke(
    "create-cart-checkout",
    {
      body: { productIds }
    }
  );

  if(error){
    let message = error.message || "カート決済を呼び出せませんでした。";

    try{
      const contextBody = await error.context?.json();
      if(contextBody?.error) message = contextBody.error;
    }catch(_ignored){}

    throw new Error(message);
  }

  if(data?.error){
    throw new Error(data.error);
  }

  return data;
}

async function startCartCheckout(){
  if(cartCheckoutStarting || cartProductIds.length === 0) return;

  if(!currentSession?.user){
    closeCartModal();
    showMessage("まとめて購入するにはログインが必要です。");
    openAuthModal("login");
    return;
  }

  const products = getCartProducts();

  if(products.length !== cartProductIds.length){
    showMessage("カートの商品情報を更新しました。もう一度確認してください。");
    cartProductIds = products.map(product => product.id);
    saveCart();
    return;
  }

  const purchasedInCart = cartProductIds.filter(id => paidProductIds.has(id));

  if(purchasedInCart.length > 0){
    cartProductIds = cartProductIds.filter(id => !paidProductIds.has(id));
    saveCart();
    showMessage("購入済みの商品をカートから除外しました。");
    return;
  }

  cartCheckoutStarting = true;
  const button = document.getElementById("cartCheckoutButton");
  button.disabled = true;
  button.textContent = "決済画面を準備中…";

  try{
    sessionStorage.setItem(
      PENDING_CART_KEY,
      JSON.stringify(cartProductIds)
    );

    const data = await invokeCreateCartCheckout(cartProductIds);

    if(!data?.url){
      throw new Error("Stripeの決済URLを取得できませんでした。");
    }

    window.location.assign(data.url);
  }catch(error){
    console.error("Cart checkout error:", error);
    showMessage(`カート決済を開始できませんでした：${error.message}`, 7000);
    button.disabled = false;
    button.textContent = "まとめて購入する";
    cartCheckoutStarting = false;
  }
}

async function waitForPaidProducts(expectedProductIds){
  const expected = [...new Set(expectedProductIds || [])];

  for(let attempt = 0; attempt < 10; attempt += 1){
    await loadPaidPurchases();

    if(
      expected.length === 0 ||
      expected.every(productId => paidProductIds.has(productId))
    ){
      return true;
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  return false;
}

async function loadPaidPurchases(){
  if(!currentSession?.user){
    paidProductIds = new Set();

    if(allProducts.length > 0){
      renderProducts();
    }

    return [];
  }

  try{
    const data = await invokeDownloadPurchase("", "list");
    const productIds = Array.isArray(data?.productIds) ? data.productIds : [];

    paidProductIds = new Set(productIds);

    if(allProducts.length > 0){
      renderProducts();
    }

    return productIds;
  }catch(error){
    console.error("Paid purchases load error:", error);
    return [];
  }
}

async function invokeDownloadPurchase(productId = "", action = "download"){
  const { data, error } = await supabaseClient.functions.invoke("download-purchase", {
    body: { productId, action }
  });

  if(error){
    let message = error.message || "ダウンロード処理を呼び出せませんでした。";
    try{
      const contextBody = await error.context?.json();
      if(contextBody?.error) message = contextBody.error;
    }catch(_ignored){}
    throw new Error(message);
  }

  if(data?.error){
    throw new Error(data.error);
  }

  return data;
}

async function startDownload(){
  if(!selectedProduct || downloadStarting) return;

  if(!currentSession?.user){
    closeProductDetail();
    showMessage("ダウンロードするにはログインが必要です。");
    openAuthModal("login");
    return;
  }

  downloadStarting = true;

  const button = document.getElementById("detailBuyButton");
  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "ダウンロード準備中…";

  try{
    const data = await invokeDownloadPurchase(selectedProduct.id, "download");

    if(!data?.url){
      throw new Error("ダウンロードURLを取得できませんでした。");
    }

    const link = document.createElement("a");
    link.href = data.url;
    link.download = data.fileName || "";
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();

    showMessage("Excelのダウンロードを開始しました！");
    button.textContent = "もう一度ダウンロード";
  }catch(error){
    console.error("Download error:", error);
    showMessage(`ダウンロードできませんでした：${error.message}`, 7000);
    button.textContent = originalText;
  }finally{
    button.disabled = false;
    downloadStarting = false;
  }
}

function findProductById(productId){
  return allProducts.find(product => product.id === productId) || null;
}

function openProductDetail(productId){
  const product = findProductById(productId);

  if(!product){
    showMessage("商品情報を取得できませんでした。");
    return;
  }

  selectedProduct = product;

  const previewWrap = document.getElementById("detailPreviewWrap");
  const imageUrl = getPreviewUrl(product.preview_image_path);

  previewWrap.innerHTML = imageUrl
    ? `<img class="detail-preview-image" src="${escapeHtml(imageUrl)}" alt="${escapeHtml(product.title)}のプレビュー画像">`
    : `<div class="detail-preview-placeholder">${escapeHtml(product.title)}</div>`;

  document.getElementById("detailCategory").textContent = product.category;
  document.getElementById("detailTitle").textContent = product.title;
  document.getElementById("detailDescription").textContent = product.description;
  document.getElementById("detailSeller").textContent =
    product.profiles?.display_name || "出品者";
  document.getElementById("detailPrice").textContent = formatPrice(product.price_jpy);

  const buyButton = document.getElementById("detailBuyButton");
  const cartButton = document.getElementById("detailCartButton");
  const note = document.getElementById("detailPurchaseNote");
  const isOwnProduct = currentSession?.user?.id === product.seller_id;
  const isFree = Number(product.price_jpy) === 0;
  const isPurchased = paidProductIds.has(product.id);
  const isInCart = cartProductIds.includes(product.id);

  buyButton.classList.toggle("own-product", Boolean(isOwnProduct));
  buyButton.classList.toggle("download-product", Boolean(isPurchased));
  buyButton.disabled = false;
  buyButton.hidden = false;
  buyButton.setAttribute("onclick", isPurchased ? "startDownload()" : "startCheckout()");

  cartButton.hidden = false;
  cartButton.disabled = false;
  cartButton.classList.toggle("in-cart", isInCart);
  cartButton.textContent = isInCart ? "カートから削除" : "カートに入れる";

  if(isPurchased){
    buyButton.textContent = "Excelをダウンロード";
    cartButton.hidden = true;
    note.textContent = "購入済みの商品です。何度でもダウンロードできます。";
  }else if(isOwnProduct){
    buyButton.textContent = "自分の商品です";
    buyButton.disabled = true;
    cartButton.hidden = true;
    note.textContent = "自分で出品した商品は購入できません。";
  }else if(isFree){
    buyButton.textContent = "無料で取得";
    buyButton.disabled = true;
    cartButton.hidden = true;
    note.textContent = "無料商品の取得機能は次の段階で追加します。";
  }else if(!currentSession?.user){
    buyButton.textContent = "ログインして購入";
    note.textContent = "カートへの追加はできます。購入時にログインが必要です。";
  }else{
    buyButton.textContent = "今すぐ購入";
    note.textContent = "今すぐ購入、またはカートでまとめ買いできます。";
  }

  const modal = document.getElementById("productDetailModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
}

function closeProductDetail(){
  const modal = document.getElementById("productDetailModal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  selectedProduct = null;
}

async function invokeCreateCheckout(productId){
  const { data, error } = await supabaseClient.functions.invoke("create-checkout", {
    body: { productId }
  });

  if(error){
    let message = error.message || "購入処理を呼び出せませんでした。";
    try{
      const contextBody = await error.context?.json();
      if(contextBody?.error) message = contextBody.error;
    }catch(_ignored){}
    throw new Error(message);
  }

  if(data?.error){
    throw new Error(data.error);
  }

  return data;
}

async function startCheckout(){
  if(!selectedProduct || checkoutStarting) return;

  if(!currentSession?.user){
    closeProductDetail();
    showMessage("購入するにはログインが必要です。");
    openAuthModal("login");
    return;
  }

  if(currentSession.user.id === selectedProduct.seller_id){
    showMessage("自分の商品は購入できません。");
    return;
  }

  checkoutStarting = true;
  const button = document.getElementById("detailBuyButton");
  button.disabled = true;
  button.textContent = "決済画面を準備中…";

  try{
    const data = await invokeCreateCheckout(selectedProduct.id);

    if(!data?.url){
      throw new Error("Stripeの決済URLを取得できませんでした。");
    }

    window.location.assign(data.url);
  }catch(error){
    console.error("Checkout start error:", error);

    if(String(error.message || "").includes("すでに購入済み")){
      await loadPaidPurchases();

      if(selectedProduct && paidProductIds.has(selectedProduct.id)){
        openProductDetail(selectedProduct.id);
        showMessage("この商品は購入済みです。ダウンロードできます！");
        checkoutStarting = false;
        return;
      }
    }

    showMessage(`購入画面を開けませんでした：${error.message}`, 7000);
    button.disabled = false;
    button.textContent = "購入する";
    checkoutStarting = false;
  }
}

async function handleCheckoutReturn(){
  const params = new URLSearchParams(window.location.search);
  const checkoutResult = params.get("checkout");

  if(!checkoutResult) return;

  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);

  if(checkoutResult === "cancel"){
    sessionStorage.removeItem(PENDING_CART_KEY);
    showMessage("購入をキャンセルしました。", 5000);
    return;
  }

  if(checkoutResult === "success"){
    showMessage("支払い完了を確認しています…", 5000);

    let expectedProductIds = [];

    try{
      const saved = JSON.parse(
        sessionStorage.getItem(PENDING_CART_KEY) || "[]"
      );
      expectedProductIds = Array.isArray(saved) ? saved : [];
    }catch(_error){
      expectedProductIds = [];
    }

    const confirmed = await waitForPaidProducts(expectedProductIds);

    if(confirmed){
      if(expectedProductIds.length > 0){
        cartProductIds = cartProductIds.filter(
          id => !expectedProductIds.includes(id)
        );
        saveCart();
      }

      sessionStorage.removeItem(PENDING_CART_KEY);

      showMessage(
        "購入が完了しました！購入済み商品からダウンロードできます。",
        7000
      );
    }else{
      showMessage(
        "決済は完了しています。反映に少し時間がかかっているため、数秒後に再読み込みしてください。",
        8000
      );
    }
  }
}

function setStripeUI(state = {}){
  const headerButton = document.getElementById("stripeConnectButton");
  const sellerButton = document.getElementById("sellerConnectButton");
  const badge = document.getElementById("payoutStatusBadge");
  const text = document.getElementById("payoutStatusText");

  if(!headerButton || !sellerButton || !badge || !text) return;

  const loggedIn = Boolean(currentSession?.user);
  headerButton.hidden = !loggedIn;

  if(!loggedIn){
    badge.textContent = "ログインが必要";
    badge.className = "payout-status pending";
    text.textContent = "売上受取設定を行うには、先にログインしてください。";
    sellerButton.textContent = "ログインして設定";
    sellerButton.disabled = false;
    headerButton.classList.remove("complete");
    headerButton.textContent = "売上受取設定";
    return;
  }

  if(state.checking){
    badge.textContent = "確認中";
    badge.className = "payout-status checking";
    text.textContent = "Stripeの登録状況を確認しています…";
    sellerButton.textContent = "確認中…";
    sellerButton.disabled = true;
    return;
  }

  sellerButton.disabled = false;

  if(state.onboardingComplete){
    badge.textContent = "設定完了";
    badge.className = "payout-status complete";
    text.textContent = "本人確認と売上受取設定が完了しています。";
    sellerButton.textContent = "登録内容を確認・更新";
    headerButton.textContent = "受取設定済み";
    headerButton.classList.add("complete");
    return;
  }

  if(state.connected){
    badge.textContent = "設定途中";
    badge.className = "payout-status pending";
    text.textContent = "Stripeの登録がまだ完了していません。続きを入力してください。";
    sellerButton.textContent = "受取設定を続ける";
    headerButton.textContent = "受取設定を続ける";
    headerButton.classList.remove("complete");
    return;
  }

  if(state.error){
    badge.textContent = "確認エラー";
    badge.className = "payout-status error";
    text.textContent = "登録状況を確認できませんでした。もう一度お試しください。";
    sellerButton.textContent = "受取設定を開く";
    headerButton.textContent = "売上受取設定";
    headerButton.classList.remove("complete");
    return;
  }

  badge.textContent = "未設定";
  badge.className = "payout-status pending";
  text.textContent = "出品した商品の売上を受け取るには、Stripeで本人確認と振込口座の登録が必要です。";
  sellerButton.textContent = "受取設定を始める";
  headerButton.textContent = "売上受取設定";
  headerButton.classList.remove("complete");
}

async function invokeConnectAccount(action){
  const { data, error } = await supabaseClient.functions.invoke("connect-account", {
    body: { action }
  });

  if(error){
    let message = error.message || "Edge Functionを呼び出せませんでした。";
    try{
      const contextBody = await error.context?.json();
      if(contextBody?.error) message = contextBody.error;
    }catch(_ignored){}
    throw new Error(message);
  }

  if(data?.error){
    throw new Error(data.error);
  }

  return data;
}

async function checkStripeStatus(showResultMessage = false){
  if(!currentSession?.user || stripeStatusChecking) return null;

  stripeStatusChecking = true;
  setStripeUI({ checking: true });

  try{
    const status = await invokeConnectAccount("status");
    setStripeUI(status || {});

    if(showResultMessage){
      if(status?.onboardingComplete){
        showMessage("売上の受取設定が完了しました！");
      }else if(status?.connected){
        showMessage("受取設定はまだ途中です。続きを入力してください。", 5000);
      }else{
        showMessage("売上受取設定はまだ開始されていません。", 5000);
      }
    }

    return status;
  }catch(error){
    console.error("Stripe status error:", error);
    setStripeUI({ error: true });
    if(showResultMessage){
      showMessage(`受取設定を確認できませんでした：${error.message}`, 6000);
    }
    return null;
  }finally{
    stripeStatusChecking = false;
  }
}

async function startStripeOnboarding(){
  if(!currentSession?.user){
    showMessage("売上受取設定にはログインが必要です。");
    openAuthModal("login");
    return;
  }

  const buttons = [
    document.getElementById("stripeConnectButton"),
    document.getElementById("sellerConnectButton")
  ].filter(Boolean);

  buttons.forEach(button => button.disabled = true);
  showMessage("Stripeの登録画面を準備しています…", 5000);

  try{
    const data = await invokeConnectAccount("onboard");

    if(!data?.url){
      throw new Error("Stripeの登録URLを取得できませんでした。");
    }

    window.location.assign(data.url);
  }catch(error){
    console.error("Stripe onboarding error:", error);
    showMessage(`売上受取設定を開けませんでした：${error.message}`, 7000);
    buttons.forEach(button => button.disabled = false);
  }
}

async function handleStripeRedirect(){
  const params = new URLSearchParams(window.location.search);
  const stripeResult = params.get("stripe");

  if(!stripeResult || !currentSession?.user) return;

  const cleanUrl = `${window.location.origin}${window.location.pathname}`;
  window.history.replaceState({}, document.title, cleanUrl);

  if(stripeResult === "refresh"){
    showMessage("Stripeの登録リンクを作り直しています…", 5000);
    await startStripeOnboarding();
    return;
  }

  if(stripeResult === "return"){
    await checkStripeStatus(true);
  }
}

function openProductModal(){
  if(!currentSession?.user){
    showMessage("出品するにはログインが必要です。");
    openAuthModal("login");
    return;
  }

  const modal = document.getElementById("productModal");
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
  document.body.classList.add("modal-open");
  setProductMessage("");
  setTimeout(() => document.getElementById("productTitle").focus(), 50);
}

function closeProductModal(){
  const modal = document.getElementById("productModal");
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
  document.body.classList.remove("modal-open");
  setProductMessage("");
}

function updateSelectedFiles(){
  const preview = document.getElementById("productPreview").files[0];
  const excel = document.getElementById("productFile").files[0];
  const box = document.getElementById("selectedFiles");

  if(!preview && !excel){
    box.hidden = true;
    box.textContent = "";
    return;
  }

  const lines = [];
  if(preview) lines.push(`画像：${preview.name}`);
  if(excel) lines.push(`Excel：${excel.name}`);
  box.textContent = lines.join(" ／ ");
  box.hidden = false;
}

function validateProductFiles(previewFile, excelFile){
  const allowedImages = ["image/jpeg", "image/png", "image/webp"];

  if(!previewFile) throw new Error("商品画像を選択してください。");
  if(!allowedImages.includes(previewFile.type)) throw new Error("商品画像はJPEG・PNG・WebPのみ使えます。");
  if(previewFile.size > 5 * 1024 * 1024) throw new Error("商品画像は5MB以下にしてください。");

  if(!excelFile) throw new Error("Excelファイルを選択してください。");
  if(!excelFile.name.toLowerCase().endsWith(".xlsx")) throw new Error("販売できるExcel形式は.xlsxのみです。");
  if(excelFile.size > 10 * 1024 * 1024) throw new Error("Excelファイルは10MB以下にしてください。");
}

function setUploadState(isUploading, text = "アップロードしています…"){
  const button = document.getElementById("productSubmitButton");
  const progress = document.getElementById("uploadProgress");
  const progressText = document.getElementById("uploadProgressText");

  button.disabled = isUploading;
  button.textContent = isUploading ? "公開処理中…" : "この内容で公開する";
  progress.hidden = !isUploading;
  progressText.textContent = text;
}

async function cleanupUploadedFiles(previewPath, excelPath){
  const tasks = [];
  if(previewPath){
    tasks.push(supabaseClient.storage.from("product-previews").remove([previewPath]));
  }
  if(excelPath){
    tasks.push(supabaseClient.storage.from("product-files").remove([excelPath]));
  }
  await Promise.allSettled(tasks);
}

async function handleProductSubmit(event){
  event.preventDefault();
  setProductMessage("");

  if(!currentSession?.user){
    closeProductModal();
    openAuthModal("login");
    return;
  }

  const title = document.getElementById("productTitle").value.trim();
  const category = document.getElementById("productCategory").value;
  const price = Number(document.getElementById("productPrice").value);
  const description = document.getElementById("productDescription").value.trim();
  const previewFile = document.getElementById("productPreview").files[0];
  const excelFile = document.getElementById("productFile").files[0];

  let previewPath = "";
  let excelPath = "";

  try{
    validateProductFiles(previewFile, excelFile);

    if(!title || title.length > 100) throw new Error("商品名は1〜100文字で入力してください。");
    if(!category) throw new Error("カテゴリを選択してください。");
    if(!Number.isInteger(price) || price < 0 || price > 1000000){
      throw new Error("価格は0〜1,000,000円の整数で入力してください。");
    }
    if(!description) throw new Error("商品説明を入力してください。");

    const userId = currentSession.user.id;
    const productId = crypto.randomUUID();
    const imageExtension = previewFile.name.split(".").pop().toLowerCase().replace("jpeg", "jpg");

    previewPath = `${userId}/${productId}/preview.${imageExtension}`;
    excelPath = `${userId}/${productId}/product.xlsx`;

    setUploadState(true, "商品画像をアップロードしています…");

    const { error: previewError } = await supabaseClient.storage
      .from("product-previews")
      .upload(previewPath, previewFile, {
        cacheControl: "3600",
        contentType: previewFile.type,
        upsert: false
      });

    if(previewError) throw new Error(`商品画像を保存できませんでした：${previewError.message}`);

    setUploadState(true, "Excelファイルを安全な保存場所へアップロードしています…");

    const { error: fileError } = await supabaseClient.storage
      .from("product-files")
      .upload(excelPath, excelFile, {
        cacheControl: "3600",
        contentType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        upsert: false
      });

    if(fileError) throw new Error(`Excelファイルを保存できませんでした：${fileError.message}`);

    setUploadState(true, "商品情報を公開しています…");

    const { error: insertError } = await supabaseClient
      .from("products")
      .insert({
        id: productId,
        seller_id: userId,
        title,
        description,
        category,
        price_jpy: price,
        excel_type: "xlsx",
        preview_image_path: previewPath,
        file_path: excelPath,
        status: "published"
      });

    if(insertError) throw new Error(`商品情報を保存できませんでした：${insertError.message}`);

    document.getElementById("productForm").reset();
    updateSelectedFiles();
    setProductMessage("出品できました！商品一覧へ公開されています。", "success");

    await loadProducts();

    setTimeout(() => {
      closeProductModal();
      document.getElementById("products").scrollIntoView({ behavior: "smooth" });
      showMessage("Excelを出品しました！");
    }, 900);

  }catch(error){
    console.error("Product upload error:", error);
    await cleanupUploadedFiles(previewPath, excelPath);
    setProductMessage(error.message || "出品できませんでした。", "error");
  }finally{
    setUploadState(false);
  }
}

document.getElementById("searchInput").addEventListener("keydown", event => {
  if(event.key === "Enter") searchProducts();
});

document.getElementById("authForm").addEventListener("submit", handleAuthSubmit);
document.getElementById("productForm").addEventListener("submit", handleProductSubmit);
document.getElementById("productPreview").addEventListener("change", updateSelectedFiles);
document.getElementById("productFile").addEventListener("change", updateSelectedFiles);

document.addEventListener("keydown", event => {
  if(event.key === "Escape"){
    closeAuthModal();
    closeProductModal();
    closeProductDetail();
    closeCartModal();
  }
});

(async function initializeApp(){
  loadCartFromStorage();

  const callbackSession = await completeEmailConfirmation();
  if(callbackSession){
    refreshAuthUI(callbackSession);
  }else{
    const { data, error } = await supabaseClient.auth.getSession();
    if(error){
      console.error("Session error:", error);
    }
    refreshAuthUI(data?.session ?? null);
  }

  supabaseClient.auth.onAuthStateChange((event, session) => {
    refreshAuthUI(session);

    if(event === "SIGNED_IN" && session?.user){
      setTimeout(() => {
        checkStripeStatus(false);
        loadPaidPurchases();
      }, 0);
    }
  });

  if(currentSession?.user){
    await handleStripeRedirect();

    if(!new URLSearchParams(window.location.search).get("stripe")){
      await checkStripeStatus(false);
    }

    await loadPaidPurchases();
  }

  await loadProducts();
  updateCartUI();
  await handleCheckoutReturn();
})();
