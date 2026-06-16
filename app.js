const supabaseClient = window.supabase.createClient(
  window.SHEET_ICHIBA_CONFIG.url,
  window.SHEET_ICHIBA_CONFIG.publishableKey
);

let authMode = "login";
let currentSession = null;

function showMessage(message){
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
}

function updateCount(){
  const cards = [...document.querySelectorAll(".product-card")];
  const visible = cards.filter(card => card.style.display !== "none").length;
  document.getElementById("resultCount").textContent = `${visible}件の商品`;
  document.getElementById("emptyState").hidden = visible !== 0;
}

function filterProducts(category, clickedButton){
  document.querySelectorAll(".category").forEach(btn => btn.classList.remove("active"));
  clickedButton?.classList.add("active");

  document.querySelectorAll(".product-card").forEach(card => {
    const match = category === "すべて" || card.dataset.category === category;
    card.style.display = match ? "" : "none";
  });

  document.getElementById("searchInput").value = "";
  updateCount();
}

function searchProducts(){
  const term = document.getElementById("searchInput").value.trim().toLowerCase();

  document.querySelectorAll(".product-card").forEach(card => {
    const text = `${card.dataset.title} ${card.dataset.category} ${card.textContent}`.toLowerCase();
    card.style.display = !term || text.includes(term) ? "" : "none";
  });

  document.querySelectorAll(".category").forEach(btn => btn.classList.remove("active"));
  updateCount();
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

function translateAuthError(message){
  const text = String(message || "");
  if(text.includes("Invalid login credentials")) return "メールアドレスかパスワードが違います。";
  if(text.includes("User already registered")) return "このメールアドレスはすでに登録されています。";
  if(text.includes("Password should be")) return "パスワードは8文字以上で入力してください。";
  if(text.includes("Email not confirmed")) return "確認メール内のリンクを押してからログインしてください。";
  if(text.includes("Unable to validate email address")) return "メールアドレスの形式を確認してください。";
  return `処理できませんでした：${text}`;
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
      const redirectUrl = `${window.location.origin}${window.location.pathname}`;
      const { data, error } = await supabaseClient.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: redirectUrl }
      });

      if(error) throw error;

      if(data.session){
        setAuthMessage("登録してログインしました。", "success");
        setTimeout(closeAuthModal, 700);
      }else{
        setAuthMessage("確認メールを送りました。メール内のリンクを押してください。", "success");
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

function requireLogin(featureName){
  if(!currentSession){
    showMessage(`${featureName}を使うにはログインが必要です。`);
    openAuthModal("login");
    return;
  }
  showMessage(`${featureName}は次の段階で追加します。`);
}

document.getElementById("searchInput").addEventListener("keydown", event => {
  if(event.key === "Enter") searchProducts();
});

document.getElementById("authForm").addEventListener("submit", handleAuthSubmit);

document.addEventListener("keydown", event => {
  if(event.key === "Escape") closeAuthModal();
});

document.querySelectorAll(".product-card").forEach(card => {
  card.addEventListener("click", () => showMessage("商品詳細ページは次の段階で追加します。"));
});

(async function initializeAuth(){
  const { data, error } = await supabaseClient.auth.getSession();
  if(error){
    console.error("Session error:", error);
  }
  refreshAuthUI(data?.session ?? null);

  supabaseClient.auth.onAuthStateChange((_event, session) => {
    refreshAuthUI(session);
  });
})();
