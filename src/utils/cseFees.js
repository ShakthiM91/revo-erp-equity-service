/**
 * CSE (Colombo Stock Exchange) equity sell-side fee estimates.
 *
 * Source: https://www.cse.lk/investors/transaction-costs
 * Structure (equity, step-up above LKR 100M): tier-1 total ~1.12% on value up to 100M;
 * tier-2 uses lower CSE/CDS/SEC rates; brokerage on the excess uses 0.640% (same cap as tier 1).
 *
 * Buy-side / cost basis: not adjusted here (import and transactions keep user/broker figures).
 * Sell-side: deducted from gross market value for net gain/loss estimates.
 */

const TIER1_MAX = 100_000_000;

const TIER1 = {
  broker_commission: 0.0064, // 0.640%
  cse_fee: 0.00084, // 0.084%
  cds_fee: 0.00024, // 0.024%
  sec_cess: 0.00072, // 0.072% SEC Cess
  stl: 0.003 // 0.300% Share Transaction Levy
};

const TIER2 = {
  broker_commission: 0.0064,
  cse_fee: 0.000525, // 0.0525%
  cds_fee: 0.00015, // 0.0150%
  sec_cess: 0.00045, // 0.0450%
  stl: 0.003
};

const TIER1_TOTAL = Object.values(TIER1).reduce((a, b) => a + b, 0); // 0.0112
const TIER2_TOTAL = Object.values(TIER2).reduce((a, b) => a + b, 0); // 0.010525

/**
 * @param {number} marketValue gross market value (e.g. current_price * quantity)
 */
function calcSellFees(marketValue) {
  const mv = Number(marketValue) || 0;
  const v1 = Math.min(mv, TIER1_MAX);
  const v2 = Math.max(0, mv - TIER1_MAX);

  const breakdown = {
    broker_commission: v1 * TIER1.broker_commission + v2 * TIER2.broker_commission,
    sec_levy: v1 * TIER1.sec_cess + v2 * TIER2.sec_cess,
    cse_fee: v1 * TIER1.cse_fee + v2 * TIER2.cse_fee,
    cds_fee: v1 * TIER1.cds_fee + v2 * TIER2.cds_fee,
    share_transaction_levy: v1 * TIER1.stl + v2 * TIER2.stl
  };
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { total, breakdown };
}

function netAfterSellFees(grossMarketValue) {
  const g = Number(grossMarketValue) || 0;
  return g - calcSellFees(g).total;
}

/**
 * Gross market value V such that net after sell fees equals targetNet (V - fees(V) = targetNet).
 */
function grossMarketValueForNetProceeds(targetNet) {
  const t = Number(targetNet) || 0;
  if (t <= 0) return 0;
  const Vflat = t / (1 - TIER1_TOTAL);
  if (Vflat <= TIER1_MAX) return Vflat;
  const k = TIER1_MAX * (TIER1_TOTAL - TIER2_TOTAL);
  return (t + k) / (1 - TIER2_TOTAL);
}

function effectiveSellFeeRate(grossMarketValue) {
  const g = Number(grossMarketValue) || 0;
  if (g <= 0) return TIER1_TOTAL;
  return calcSellFees(g).total / g;
}

/** @deprecated Use effectiveSellFeeRate(marketValue); tier-1 total only. */
const SELL_FEE_RATE = TIER1_TOTAL;

/** @deprecated Internal structure changed; kept for legacy requires. */
const SELL_FEES = { TIER1, TIER2, TIER1_MAX, TIER1_TOTAL, TIER2_TOTAL };

module.exports = {
  TIER1_MAX,
  TIER1_TOTAL,
  TIER2_TOTAL,
  calcSellFees,
  netAfterSellFees,
  grossMarketValueForNetProceeds,
  effectiveSellFeeRate,
  SELL_FEE_RATE,
  SELL_FEES
};
