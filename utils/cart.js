// シンプルな localStorage ベースのカート
// テナント別にキーを分けて保存（同一ブラウザで複数店舗を使うケースに対応）

const KEY = (tenantId) => `florix_cart_${tenantId}`;

export function getCart(tenantId) {
  if (typeof window === 'undefined') return [];
  try {
    const s = localStorage.getItem(KEY(tenantId));
    return s ? JSON.parse(s) : [];
  } catch (e) {
    return [];
  }
}

export function saveCart(tenantId, items) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(KEY(tenantId), JSON.stringify(items));
}

export function getCartCount(tenantId) {
  return getCart(tenantId).reduce((sum, item) => sum + Number(item.qty || 0), 0);
}

export function getCartTotal(tenantId) {
  return getCart(tenantId).reduce((sum, item) => sum + Number(item.qty || 0) * Number(item.price || 0), 0);
}

// ★ オプション加算額の計算
export function calcOptionsTotal(selectedOptions) {
  if (!selectedOptions) return 0;
  let sum = 0;
  if (selectedOptions.wrapping?.price)      sum += Number(selectedOptions.wrapping.price) || 0;
  if (selectedOptions.messageCard?.price)   sum += Number(selectedOptions.messageCard.price) || 0;
  if (selectedOptions.textInsertion?.price) sum += Number(selectedOptions.textInsertion.price) || 0;
  return sum;
}

// ★ 同じ商品+同じオプション内容はマージ
function isSameOptions(a, b) {
  return JSON.stringify(a || null) === JSON.stringify(b || null);
}

// item: { id, name, price, imageUrl, stock, selectedOptions }
export function addToCart(tenantId, item, qty = 1) {
  const cart = getCart(tenantId);
  const existing = cart.find(x => x.id === item.id && isSameOptions(x.selectedOptions, item.selectedOptions));
  if (existing) {
    const newQty = Math.min(item.stock, existing.qty + qty);
    existing.qty = newQty;
  } else {
    cart.push({
      // ★ オプション違いを区別する一意キー
      cartItemId: `${item.id}_${Date.now()}_${Math.random().toString(36).slice(2,7)}`,
      id: item.id,
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl,
      selectedOptions: item.selectedOptions || null,
      qty: Math.min(item.stock, qty),
    });
  }
  saveCart(tenantId, cart);
  return cart;
}

export function updateQty(tenantId, itemId, qty) {
  const cart = getCart(tenantId);
  // cartItemId 優先（後方互換: id でも検索）
  const item = cart.find(x => x.cartItemId === itemId || x.id === itemId);
  if (!item) return cart;
  if (qty <= 0) {
    return removeFromCart(tenantId, itemId);
  }
  item.qty = qty;
  saveCart(tenantId, cart);
  return cart;
}

export function removeFromCart(tenantId, itemId) {
  const cart = getCart(tenantId).filter(x => (x.cartItemId || x.id) !== itemId);
  saveCart(tenantId, cart);
  return cart;
}

export function clearCart(tenantId) {
  saveCart(tenantId, []);
}
