const db = require('../config/database');

const TABLE = 'revo_equity_holding_snapshots';

class HoldingSnapshotModel {
  static async findRange(tenantId, symbolId, startDate, endDate) {
    const [rows] = await db.query(
      `SELECT snapshot_date, quantity, avg_cost, total_cost,
              close_price, market_value, gain_loss, gain_loss_pct
       FROM ${TABLE}
       WHERE tenant_id = ? AND symbol_id = ?
         AND snapshot_date BETWEEN ? AND ?
       ORDER BY snapshot_date ASC`,
      [tenantId, symbolId, startDate, endDate]
    );
    return rows;
  }
}

module.exports = HoldingSnapshotModel;
