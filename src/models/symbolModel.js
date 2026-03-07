const db = require('../config/database');

const TABLE = 'revo_equity_symbols';

class SymbolModel {
  static async findAll(filters = {}) {
    const { search, is_active, limit = 100, offset = 0 } = filters;
    let query = `SELECT * FROM ${TABLE} WHERE 1=1`;
    const params = [];

    if (is_active !== undefined) {
      query += ' AND is_active = ?';
      params.push(is_active);
    }
    if (search) {
      query += ' AND ticker LIKE ?';
      params.push(`%${search}%`);
    }

    query += ' ORDER BY display_name ASC LIMIT ? OFFSET ?';
    params.push(limit, offset);

    const [rows] = await db.query(query, params);
    return rows;
  }

  static async findById(id) {
    const [rows] = await db.query(`SELECT * FROM ${TABLE} WHERE id = ?`, [id]);
    return rows[0] || null;
  }

  static async findByTicker(ticker) {
    const [rows] = await db.query(`SELECT * FROM ${TABLE} WHERE ticker = ?`, [String(ticker).trim().toUpperCase()]);
    return rows[0] || null;
  }

  static async create(data) {
    const { ticker, display_name, full_name, isin, sector } = data;
    const normalized = String(ticker).trim().toUpperCase();
    const [result] = await db.query(
      `INSERT INTO ${TABLE} (ticker, display_name, full_name, isin, sector, is_active) VALUES (?, ?, ?, ?, ?, TRUE)`,
      [normalized, display_name || normalized, full_name || null, isin || null, sector || null]
    );
    return this.findById(result.insertId);
  }

  static async update(id, data) {
    const fields = [];
    const values = [];
    const allowed = ['display_name', 'full_name', 'isin', 'sector', 'is_active'];
    for (const k of allowed) {
      if (data[k] !== undefined) {
        fields.push(`${k} = ?`);
        values.push(data[k]);
      }
    }
    if (fields.length === 0) return this.findById(id);
    values.push(id);
    await db.query(`UPDATE ${TABLE} SET ${fields.join(', ')} WHERE id = ?`, values);
    return this.findById(id);
  }
}

module.exports = SymbolModel;
