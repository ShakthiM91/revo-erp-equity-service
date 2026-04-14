const db = require('../config/database');

const TABLE = 'revo_equity_transactions';

function runner(conn) {
  return conn || db;
}

class TransactionModel {
  static async create(tenantId, data, conn = null) {
    const { symbol_id, transaction_type, quantity, price_per_share, fees, transaction_date, notes, reference, created_by } = data;
    const total_amount = quantity * price_per_share + (fees || 0);
    const [result] = await runner(conn).query(
      `INSERT INTO ${TABLE} (tenant_id, symbol_id, transaction_type, quantity, price_per_share, fees, total_amount, transaction_date, notes, reference, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [tenantId, symbol_id, transaction_type, quantity, price_per_share, fees || 0, total_amount, transaction_date, notes || null, reference || null, created_by || null]
    );
    return result.insertId;
  }

  static async findById(id, tenantId) {
    const [rows] = await db.query(
      `SELECT t.*, s.ticker, s.display_name, s.full_name FROM ${TABLE} t
       JOIN revo_equity_symbols s ON t.symbol_id = s.id
       WHERE t.id = ? AND t.tenant_id = ?`,
      [id, tenantId]
    );
    return rows[0] || null;
  }

  static async findAll(tenantId, filters = {}) {
    const { symbol_id, transaction_type, start_date, end_date, limit = 50, offset = 0 } = filters;
    let query = `SELECT t.*, s.ticker, s.display_name, s.full_name FROM ${TABLE} t
                 JOIN revo_equity_symbols s ON t.symbol_id = s.id
                 WHERE t.tenant_id = ?`;
    const params = [tenantId];

    if (symbol_id) {
      query += ' AND t.symbol_id = ?';
      params.push(symbol_id);
    }
    if (transaction_type) {
      query += ' AND t.transaction_type = ?';
      params.push(transaction_type);
    }
    if (start_date) {
      query += ' AND t.transaction_date >= ?';
      params.push(start_date);
    }
    if (end_date) {
      query += ' AND t.transaction_date <= ?';
      params.push(end_date);
    }

    query += ' ORDER BY t.transaction_date DESC, t.id DESC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  static async update(id, tenantId, data) {
    const existing = await this.findById(id, tenantId);
    if (!existing) return null;

    const { quantity, price_per_share, fees, transaction_date, notes, reference } = data;
    const total_amount = quantity * price_per_share + (fees || 0);
    await db.query(
      `UPDATE ${TABLE} SET quantity = ?, price_per_share = ?, fees = ?, total_amount = ?, transaction_date = ?, notes = ?, reference = ? WHERE id = ? AND tenant_id = ?`,
      [quantity, price_per_share, fees || 0, total_amount, transaction_date, notes || null, reference || null, id, tenantId]
    );
    return this.findById(id, tenantId);
  }

  static async delete(id, tenantId) {
    const [result] = await db.query(`DELETE FROM ${TABLE} WHERE id = ? AND tenant_id = ?`, [id, tenantId]);
    return result.affectedRows > 0;
  }

  static async deleteAllForTenant(tenantId, conn = null) {
    await runner(conn).query(`DELETE FROM ${TABLE} WHERE tenant_id = ?`, [tenantId]);
  }

  static async recalculateHoldings(tenantId, symbolId, conn = null) {
    const [txns] = await runner(conn).query(
      `SELECT transaction_type, quantity, price_per_share, total_amount, transaction_date
       FROM ${TABLE} WHERE tenant_id = ? AND symbol_id = ? ORDER BY transaction_date ASC, id ASC`,
      [tenantId, symbolId]
    );

    let qty = 0;
    let totalCost = 0;
    let firstDate = null;

    for (const t of txns) {
      const q = parseFloat(t.quantity);
      const amt = parseFloat(t.total_amount);
      if (t.transaction_type === 'buy') {
        totalCost += amt;
        qty += q;
        if (!firstDate) firstDate = t.transaction_date;
      } else {
        const avgCost = qty > 0 ? totalCost / qty : 0;
        totalCost -= avgCost * q;
        qty -= q;
      }
    }

    const avgCost = qty > 0 ? totalCost / qty : null;
    return { quantity: qty, total_cost: totalCost, avg_cost: avgCost, first_purchase_date: firstDate };
  }
}

module.exports = TransactionModel;
