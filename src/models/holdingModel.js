const db = require('../config/database');

const HOLDINGS_TABLE = 'revo_equity_holdings';
const SYMBOLS_TABLE = 'revo_equity_symbols';

function runner(conn) {
  return conn || db;
}

class HoldingModel {
  static async upsert(tenantId, symbolId, data, conn = null) {
    const { quantity, avg_cost, total_cost, first_purchase_date } = data;
    await runner(conn).query(
      `INSERT INTO ${HOLDINGS_TABLE} (tenant_id, symbol_id, quantity, avg_cost, total_cost, first_purchase_date)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         quantity = VALUES(quantity),
         avg_cost = VALUES(avg_cost),
         total_cost = VALUES(total_cost),
         first_purchase_date = VALUES(first_purchase_date)`,
      [tenantId, symbolId, quantity, avg_cost, total_cost, first_purchase_date]
    );
  }

  static async deleteIfZero(tenantId, symbolId, conn = null) {
    await runner(conn).query(`DELETE FROM ${HOLDINGS_TABLE} WHERE tenant_id = ? AND symbol_id = ? AND quantity <= 0`, [tenantId, symbolId]);
  }

  static async deleteAllForTenant(tenantId, conn = null) {
    await runner(conn).query(`DELETE FROM ${HOLDINGS_TABLE} WHERE tenant_id = ?`, [tenantId]);
  }

  static async findAll(tenantId) {
    const [rows] = await db.query(
      `SELECT h.*, s.ticker, s.display_name, s.full_name FROM ${HOLDINGS_TABLE} h
       JOIN ${SYMBOLS_TABLE} s ON h.symbol_id = s.id
       WHERE h.tenant_id = ? AND h.quantity > 0
       ORDER BY h.total_cost DESC`,
      [tenantId]
    );
    return rows;
  }

  static async getDistinctTickersWithHoldings() {
    const [rows] = await db.query(
      `SELECT DISTINCT s.ticker FROM ${HOLDINGS_TABLE} h
       JOIN ${SYMBOLS_TABLE} s ON h.symbol_id = s.id
       WHERE h.quantity > 0`
    );
    return rows.map((r) => r.ticker);
  }
}

module.exports = HoldingModel;
