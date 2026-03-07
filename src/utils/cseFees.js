/**
 * CSE (Colombo Stock Exchange) fee structure.
 *
 * Buy-side fees are expected to already be included in avg_cost/total_cost
 * as entered by the user via the transaction form.
 *
 * Sell-side fees are deducted from the gross market value to compute
 * the realistic net gain/loss on holdings.
 *
 * Standard CSE sell-side rates (as of 2025):
 *   Broker commission : 0.70% (may vary per broker; use the common default)
 *   SEC levy          : 0.05%
 *   CSE fee           : 0.023%
 *   CDS fee           : 0.01%
 *   ─────────────────────────
 *   Total             : 0.783%
 */

const SELL_FEES = {
  brokerCommission: 0.007,   // 0.70%
  secLevy:          0.0005,  // 0.05%
  cseFee:           0.00023, // 0.023%
  cdsFee:           0.0001   // 0.01%
};

const SELL_FEE_RATE = Object.values(SELL_FEES).reduce((a, b) => a + b, 0);

/**
 * Calculate the estimated sell-side fees for a given gross market value.
 * @param {number} marketValue  gross market value (current_price * quantity)
 * @returns {{ total: number, breakdown: object }}
 */
function calcSellFees(marketValue) {
  const mv = Number(marketValue) || 0;
  const breakdown = {
    broker_commission: mv * SELL_FEES.brokerCommission,
    sec_levy:          mv * SELL_FEES.secLevy,
    cse_fee:           mv * SELL_FEES.cseFee,
    cds_fee:           mv * SELL_FEES.cdsFee
  };
  const total = Object.values(breakdown).reduce((a, b) => a + b, 0);
  return { total, breakdown };
}

module.exports = { SELL_FEES, SELL_FEE_RATE, calcSellFees };
