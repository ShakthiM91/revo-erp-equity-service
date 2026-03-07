const SymbolModel = require('../models/symbolModel');

async function list(req, res, next) {
  try {
    const { search, is_active, limit, offset } = req.query;
    const symbols = await SymbolModel.findAll({ search, is_active: is_active === 'true' ? true : is_active === 'false' ? false : undefined, limit: parseInt(limit, 10) || 100, offset: parseInt(offset, 10) || 0 });
    res.json({ success: true, data: symbols });
  } catch (err) {
    next(err);
  }
}

async function create(req, res, next) {
  try {
    const { ticker, display_name, full_name, isin, sector } = req.body;
    if (!ticker) return res.status(400).json({ error: 'Ticker is required' });
    const existing = await SymbolModel.findByTicker(ticker);
    if (existing) return res.status(400).json({ error: 'Symbol already exists', ticker: existing.ticker });
    const symbol = await SymbolModel.create({ ticker, display_name, full_name, isin, sector });
    res.status(201).json({ success: true, data: symbol });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Symbol already exists' });
    next(err);
  }
}

async function getById(req, res, next) {
  try {
    const symbol = await SymbolModel.findById(req.params.id);
    if (!symbol) return res.status(404).json({ error: 'Symbol not found' });
    res.json({ success: true, data: symbol });
  } catch (err) {
    next(err);
  }
}

module.exports = { list, create, getById };
