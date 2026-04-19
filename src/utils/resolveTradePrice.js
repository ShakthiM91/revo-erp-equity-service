/**
 * Pick a usable spot price from market-data payload.
 * CSE sometimes sends 0 for last trade / close in pre-open; treat as missing.
 */
function resolveTradePrice(price) {
  if (!price || typeof price !== 'object') return null;
  const pick = (v) => {
    if (v == null || v === '') return null;
    const n = typeof v === 'number' ? v : parseFloat(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  return pick(price.nowprice) ?? pick(price.close) ?? null;
}

module.exports = { resolveTradePrice };
