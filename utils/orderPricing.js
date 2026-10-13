// [2026-10] 注文金額のサーバー側の確認（見積以外のお客様の注文）
//
// お客様の注文画面（custom / cart）の計算と同じ計算をサーバーでもう一度行い、
// ブラウザから送られた金額と比べる。
//   - いまは「記録だけ」: 差があっても注文は受け付け、注文に priceCheck の印を残す
//   - 様子を見て問題がなければ、差がある注文を止める形に切り替える
//
// 計算の元: app/order/[tenantId]/[shopId]/custom/page.js（送料・箱代・クール便・引き取り料）
//           app/order/[tenantId]/[shopId]/cart/page.jsx（ネットショップの送料）
// 画面側の計算を変えたときは、ここも合わせて直すこと。

export function normalizeAddressText(text) {
  if (!text) return '';
  let res = String(text).replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
  const kMap = { '一': '1', '二': '2', '三': '3', '四': '4', '五': '5', '六': '6', '七': '7', '八': '8', '九': '9' };
  res = res.replace(/三十([一二三四五六七八九])/g, (m, p1) => '3' + kMap[p1]);
  res = res.replace(/二十([一二三四五六七八九])/g, (m, p1) => '2' + kMap[p1]);
  res = res.replace(/十([一二三四五六七八九])/g, (m, p1) => '1' + kMap[p1]);
  res = res.replace(/三十/g, '30'); res = res.replace(/二十/g, '20'); res = res.replace(/十/g, '10');
  res = res.replace(/[一二三四五六七八九〇]/g, m => ({ ...kMap, '〇': '0' })[m] || m);
  return res;
}

function prefOf(rawAddress) {
  const m = String(rawAddress || '').match(/^(北海道|東京都|(?:京都|大阪)府|.{2,3}県)/);
  if (!m) return null;
  const p = m[1].replace(/(都|府|県)$/, '');
  return p === '北海' ? '北海道' : p;
}

function priceTierBoxFee(bfc, itemPrice) {
  const tiers = Array.isArray(bfc?.priceTiers) ? bfc.priceTiers : [];
  const sorted = [...tiers].sort((a, b) => Number(b.minPrice) - Number(a.minPrice));
  return sorted.find(t => Number(itemPrice) >= Number(t.minPrice)) || null;
}

/**
 * お花の注文（custom）の送料・箱代・クール便・引き取り料
 * @returns {{ ok: boolean, calculatedFee: number, pickupFee: number, feeBreakdown: object, reason?: string }}
 */
export function computeCustomFees(settings, { receiveMethod, rawAddress, itemPrice, flowerType, selectedDate }) {
  const s = settings || {};
  const itemSettings = (s.flowerItems || []).find(i => i.name === flowerType) || {};
  const zero = { ok: true, calculatedFee: 0, pickupFee: 0, feeBreakdown: { baseFee: 0, boxFee: 0, coolFee: 0 } };
  if (!receiveMethod || receiveMethod === 'pickup') return zero;
  const address = String(rawAddress || '').replace(/[\s　]+/g, '');
  if (!address) return { ...zero, ok: false, reason: 'no_address' };
  const bfc = s.boxFeeConfig || {};

  if (receiveMethod === 'delivery') {
    const normalized = normalizeAddressText(address);
    let isFreeArea = false;
    for (const n of ['23', '24', '25', '26', '27']) {
      for (const w of ['3', '4', '5']) {
        if (normalized.includes(`北${n}条西${w}`)) { isFreeArea = true; break; }
      }
      if (isFreeArea) break;
    }
    let matchedFee = null;
    if (isFreeArea) matchedFee = 0;
    else if (Array.isArray(s.deliveryAreas) && s.deliveryAreas.length > 0) {
      for (const area of s.deliveryAreas) {
        const keywords = String(area.name || '').split(',').map(k => k.trim()).filter(Boolean);
        if (keywords.some(k => address.includes(k) || normalized.includes(k))) { matchedFee = Number(area.fee); break; }
      }
    }
    if (matchedFee === null) {
      if (normalized.includes('厚別区') || normalized.includes('清田区') || normalized.includes('南区')) matchedFee = 1000;
      else if (normalized.includes('白石区') || normalized.includes('豊平区') || normalized.includes('手稲区') || normalized.includes('石狩市')) matchedFee = 800;
      else if (normalized.includes('北区') || normalized.includes('中央区') || normalized.includes('東区') || normalized.includes('西区')) matchedFee = 500;
    }
    if (matchedFee === null) return { ...zero, ok: false, reason: 'out_of_area' };
    const baseFee = matchedFee;
    let pickupFee = 0;
    if (itemSettings.hasReturn) {
      const returnType = bfc.returnFeeType || 'flat';
      const returnVal = Number(bfc.returnFeeValue) || 0;
      if (returnType === 'flat') pickupFee = returnVal;
      else if (returnType === 'percent') pickupFee = Math.floor(baseFee * (returnVal / 100));
    }
    let boxFee = 0;
    if (bfc.applyToDelivery) {
      if (bfc.type === 'flat') boxFee = Number(bfc.flatFee) || 0;
      else if (bfc.type === 'price_based') { const t = priceTierBoxFee(bfc, itemPrice); boxFee = t ? Number(t.fee) : 0; }
    }
    return { ok: true, calculatedFee: baseFee + boxFee, pickupFee, feeBreakdown: { baseFee, boxFee, coolFee: 0 } };
  }

  if (receiveMethod === 'sagawa') {
    const pref = prefOf(address);
    if (!pref) return { ...zero, ok: false, reason: 'no_pref' };
    const rates = Array.isArray(s.shippingRates) ? s.shippingRates : [];
    const rateData = rates.find(r => r.prefs && r.prefs.includes(pref)) || rates.find(r => r.region && r.region.includes(pref));
    if (!rateData) return { ...zero, ok: false, reason: 'no_rate' };
    let size;
    let boxFee = 0;
    const defaultSize = itemSettings.defaultBoxSize || s.shippingSizes?.[0] || '80';
    if (bfc.type === 'flat') {
      boxFee = Number(bfc.flatFee) || 0;
      size = bfc.flatSize || defaultSize;
    } else if (bfc.type === 'price_based') {
      const t = priceTierBoxFee(bfc, itemPrice);
      boxFee = t ? Number(t.fee) : 0;
      size = t?.size || defaultSize;
    } else {
      size = defaultSize;
    }
    let baseFee = Number(rateData['fee' + size]) || 0;
    if (bfc.freeShippingThresholdEnabled && Number(itemPrice) >= (bfc.freeShippingThreshold || 15000)) baseFee = 0;
    let coolFee = 0;
    if (!itemSettings.excludeCoolBin && bfc.coolBinEnabled && selectedDate) {
      const m = String(selectedDate).match(/^\d{4}-(\d{2})-(\d{2})/);
      if (m) {
        const mmdd = `${m[1]}-${m[2]}`;
        const periods = Array.isArray(bfc.coolBinPeriods) ? bfc.coolBinPeriods : [];
        if (periods.some(p => mmdd >= p.start && mmdd <= p.end)) coolFee = Number(rateData['cool' + size]) || 0;
      }
    }
    return { ok: true, calculatedFee: baseFee + boxFee + coolFee, pickupFee: 0, feeBreakdown: { baseFee, boxFee, coolFee } };
  }

  return { ...zero, ok: false, reason: 'unknown_method' };
}

/**
 * お花の注文（custom）の商品代が、選べる金額かどうか
 *   - お花の種類の設定（最低・最高・刻み）から作る選択肢
 *   - または、作品例（ギャラリー）の写真に付いている金額
 */
export function isAllowedCustomItemPrice(settings, galleryImages, { flowerType, receiveMethod, itemPrice }) {
  const price = Number(itemPrice);
  if (!Number.isFinite(price) || price <= 0) return false;
  const itemSettings = ((settings || {}).flowerItems || []).find(i => i.name === flowerType) || {};
  let min = 2000, max = 50000, step = 1000;
  if (itemSettings.minPrice) {
    min = Number(itemSettings.minPrice);
    max = Number(itemSettings.maxPrice);
    step = Number(itemSettings.stepPrice);
  }
  if ((receiveMethod === 'delivery' || receiveMethod === 'sagawa') && min < 3000) min = 3000;
  if (step > 0 && price >= min && price <= max) {
    // 画面の選択肢は min から step ずつ（浮動小数のずれを避けて整数で比べる）
    for (let v = min; v <= max; v += step) { if (v === price) return true; }
  }
  const imgs = Array.isArray(galleryImages) ? galleryImages : [];
  return imgs.some(img => Number(img?.price) > 0 && Number(img.price) === price);
}

/** ネットショップ（cart）の送料: お届け先の都道府県 + カートの一番大きい箱のサイズ */
export function computeEcShippingFee(settings, { address1, maxSize }) {
  if (!address1 || !maxSize) return 0;
  const pref = prefOf(address1);
  if (!pref) return 0;
  const rates = Array.isArray(settings?.shippingRates) ? settings.shippingRates : [];
  const row = rates.find(r => r.region === pref || r.region?.includes(pref));
  if (!row) return 0;
  return Number(row[`fee${maxSize}`]) || 0;
}
