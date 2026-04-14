const TransactionModel = require('../models/transactionModel');
const HoldingModel = require('../models/holdingModel');

/**
 * Recompute holdings row from transactions for one symbol.
 * @param {number} tenantId
 * @param {number} symbolId
 * @param {import('mysql2/promise').PoolConnection | null} [conn]
 */
async function syncHolding(tenantId, symbolId, conn = null) {
  const recalc = await TransactionModel.recalculateHoldings(tenantId, symbolId, conn);
  if (recalc.quantity > 0) {
    await HoldingModel.upsert(
      tenantId,
      symbolId,
      {
        quantity: recalc.quantity,
        avg_cost: recalc.avg_cost,
        total_cost: recalc.total_cost,
        first_purchase_date: recalc.first_purchase_date
      },
      conn
    );
  } else {
    await HoldingModel.deleteIfZero(tenantId, symbolId, conn);
  }
}

module.exports = { syncHolding };
