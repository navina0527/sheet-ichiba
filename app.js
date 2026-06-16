function showMessage(message){
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => toast.classList.remove('show'), 2600);
}

function updateCount(){
  const cards = [...document.querySelectorAll('.product-card')];
  const visible = cards.filter(card => card.style.display !== 'none').length;
  document.getElementById('resultCount').textContent = `${visible}件の商品`;
  document.getElementById('emptyState').hidden = visible !== 0;
}

function filterProducts(category){
  document.querySelectorAll('.category').forEach(btn => btn.classList.remove('active'));
  event.currentTarget.classList.add('active');

  document.querySelectorAll('.product-card').forEach(card => {
    const match = category === 'すべて' || card.dataset.category === category;
    card.style.display = match ? '' : 'none';
  });

  document.getElementById('searchInput').value = '';
  updateCount();
}

function searchProducts(){
  const term = document.getElementById('searchInput').value.trim().toLowerCase();

  document.querySelectorAll('.product-card').forEach(card => {
    const text = `${card.dataset.title} ${card.dataset.category} ${card.textContent}`.toLowerCase();
    card.style.display = !term || text.includes(term) ? '' : 'none';
  });

  document.querySelectorAll('.category').forEach(btn => btn.classList.remove('active'));
  updateCount();
}

document.getElementById('searchInput').addEventListener('keydown', e => {
  if(e.key === 'Enter') searchProducts();
});

document.querySelectorAll('.product-card').forEach(card => {
  card.addEventListener('click', () => showMessage('商品詳細ページは次の段階で追加します。'));
});
