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
            <span>新着</span>
          </div>
          <span class="seller-name">出品者：${escapeHtml(sellerName)}</span>
        </div>
      </article>
    `;
  }).join("");

  grid.querySelectorAll(".product-card").forEach(card => {
    card.addEventListener("click", () => {
      showMessage("商品詳細・購入機能は次の段階で追加します。");
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
  }
});

(async function initializeApp(){
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

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    refreshAuthUI(session);
  });

  await loadProducts();
})();
