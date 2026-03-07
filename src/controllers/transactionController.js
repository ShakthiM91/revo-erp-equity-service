const TransactionModel = require('../models/transactionModel');
const SymbolModel = require('../models/symbolModel');
const HoldingModel = require('../models/holdingModel');

async function list(req, res, next) {
  try {
    const { symbol_id, transaction_type, start_date, end_date, limit, offset } = req.query;
    const rows = await TransactionModel.findAll(req.tenantId, {
      symbol_id,
      transaction_type,
      start_date,
      end_date,
      limit: parseInt(limit, 10) || 50,
      offset: parseInt(offset, 10) || 0
    });
    res.json({ success: true, data: rows });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { symbol_id, transaction_type, quantity, price_per_share, fees, transaction_date, notes, reference } = req.body;
    if (!symbol_id || !transaction_type || quantity == null || !price_per_share || !transaction_date) {
      return res.status(400).json({ error: 'symbol_id, transaction_type, quantity, price_per_share, transaction_date are required' });
    }
    if (!['buy', 'sell'].includes(transaction_type)) {
      return res.status(400).json({ error: 'transaction_type must be buy or sell' });
    }
    const qty = parseFloat(quantity);
    const price = parseFloat(price_per_share);
    if (qty <= 0 || price < 0) return res.status(400).json({ error: 'quantity must be positive, price_per_share must be non-negative' });

    const symbol = await SymbolModel.findById(symbol_id);
    if (!symbol) return res.status(404).json({ error: 'Symbol not found' });

    const id = await TransactionModel.create(req.tenantId, {
      symbol_id,
      transaction_type,
      quantity: qty,
      price_per_share: price,
      fees: parseFloat(fees) || 0,
      transaction_date,
      notes,
      reference,
      created_by: req.userId
    });

    await syncHolding(req.tenantId, symbol_id);

    const txn = await TransactionModel.findById(id, req.tenantId);
    res.status(201).json({ success: true, data: txn });
  } catch (err) {
    next(err);
  }
}

async function update(req, res, next) {
  try {
    const { quantity, price_per_share, fees, transaction_date, notes, reference } = req.body;
    const txn = await TransactionModel.findById(req.params.id, req.tenantId);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });

    const qty = quantity != null ? parseFloat(quantity) : parseFloat(txn.quantity);
    const price = price_per_share != null ? parseFloat(price_per_share) : parseFloat(txn.price_per_share);
    if (qty <= 0 || price < 0) return res.status(400).json({ error: 'quantity must be positive, price_per_share must be non-negative' });

    const updated = await TransactionModel.update(req.params.id, req.tenantId, {
      quantity: qty,
      price_per_share: price,
      fees: fees != null ? parseFloat(fees) : txn.fees,
      transaction_date: transaction_date || txn.transaction_date,
      notes: notes !== undefined ? notes : txn.notes,
      reference: reference !== undefined ? reference : txn.reference
    });

    await syncHolding(req.tenantId, txn.symbol_id);
    res.json({ success: true, data: updated });
  } catch (err) {
    next(err);
  }
}

async function remove(req, res, next) {
  try {
    const txn = await TransactionModel.findById(req.params.id, req.tenantId);
    if (!txn) return res.status(404).json({ error: 'Transaction not found' });
    const symbolId = txn.symbol_id;
    const ok = await TransactionModel.delete(req.params.id, req.tenantId);
    if (!ok) return res.status(404).json({ error: 'Transaction not found' });
    await syncHolding(req.tenantId, symbolId);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
}

async function syncHolding(tenantId, symbolId) {
  const recalc = await TransactionModel.recalculateHoldings(tenantId, symbolId);
  if (recalc.quantity > 0) {
    await HoldingModel.upsert(tenantId, symbolId, {
      quantity: recalc.quantity,
      avg_cost: recalc.avg_cost,
      total_cost: recalc.total_cost,
      first_purchase_date: recalc.first_purchase_date
    });
  } else {
    await HoldingModel.deleteIfZero(tenantId, symbolId);
  }
}

module.exports = { list, create, update, remove };
