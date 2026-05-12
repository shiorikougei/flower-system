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

// item: { id, name, price, imageUrl, stock }
export function addToCart(tenantId, item, qty = 1) {
  const cart = getCart(tenantId);
  const existing = cart.find(x => x.id === item.id);
  if (existing) {
    const newQty = Math.min(item.stock, existing.qty + qty);
    existing.qty = newQty;
  } else {
    cart.push({
      id: item.id,
      name: item.name,
      price: item.price,
      imageUrl: item.imageUrl,
      qty: Math.min(item.stock, qty),
    });
  }
  saveCart(tenantId, cart);
  return cart;
}

export function updateQty(tenantId, itemId, qty) {
  const cart = getCart(tenantId);
  const item = cart.find(x => x.id === itemId);
  if (!item) return cart;
  if (qty <= 0) {
    return removeFromCart(tenantId, itemId);
  }
  item.qty = qty;
  saveCart(tenantId, cart);
  return cart;
}

export function removeFromCart(tenantId, itemId) {
  const cart = getCart(tenantId).filter(x => x.id !== itemId);
  saveCart(tenantId, cart);
  return cart;
}

export function clearCart(tenantId) {
  saveCart(tenantId, []);
}
