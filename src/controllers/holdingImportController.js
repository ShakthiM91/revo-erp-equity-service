const pool = require('../config/database');
const TransactionModel = require('../models/transactionModel');
const HoldingModel = require('../models/holdingModel');
const SymbolModel = require('../models/symbolModel');
const { parseCsePortfolioXlsx } = require('../services/csePortfolioXlsxParser');
const { syncHolding } = require('../services/holdingSync');

function resolveTransactionDate(body) {
  const raw = body && body.snapshot_date;
  if (raw != null && String(raw).trim() !== '') {
    const d = new Date(String(raw).trim());
    if (!Number.isNaN(d.getTime())) return d.toISOString().slice(0, 10);
  }
  return new Date().toISOString().slice(0, 10);
}

async function importPortfolio(req, res, next) {
  try {
    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    let parsed;
    try {
      parsed = await parseCsePortfolioXlsx(req.file.buffer);
    } catch (e) {
      return res.status(400).json({
        success: false,
        error: e.message || 'Invalid spreadsheet',
        code: e.code,
        row: e.row,
        ticker: e.ticker
      });
    }

    const tenantId = req.tenantId;
    const transactionDate = resolveTransactionDate(req.body);
    const createdSymbols = [];

    const conn = await pool.getConnection();
    try {
      await conn.beginTransaction();
      await TransactionModel.deleteAllForTenant(tenantId, conn);
      await HoldingModel.deleteAllForTenant(tenantId, conn);

      for (const row of parsed.rows) {
        let symbol = await SymbolModel.findByTicker(row.ticker, conn);
        if (!symbol) {
          symbol = await SymbolModel.create({ ticker: row.ticker, display_name: row.ticker }, conn);
          createdSymbols.push(symbol.ticker);
        }

        const price = Math.round(row.avgPrice * 100) / 100;
        let fees = row.totalCost - row.quantity * price;
        fees = Math.round(fees * 100) / 100;

        const uid = req.userId != null && req.userId !== '' ? parseInt(req.userId, 10) : null;

        await TransactionModel.create(
          tenantId,
          {
            symbol_id: symbol.id,
            transaction_type: 'buy',
            quantity: row.quantity,
            price_per_share: price,
            fees,
            transaction_date: transactionDate,
            notes: 'CSE portfolio import',
            reference: 'cse-xlsx',
            created_by: Number.isFinite(uid) ? uid : null
          },
          conn
        );
        await syncHolding(tenantId, symbol.id, conn);
      }

      await conn.commit();
      res.json({
        success: true,
        data: { imported: parsed.rows.length, created_symbols: createdSymbols }
      });
    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  } catch (err) {
    next(err);
  }
}

module.exports = { importPortfolio };
