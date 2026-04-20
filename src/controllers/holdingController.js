const HoldingModel = require('../models/holdingModel');
const HoldingSnapshotModel = require('../models/holdingSnapshotModel');
const { getPrice, getHistory } = require('../services/marketDataClient');
const { calcSellFees } = require('../utils/cseFees');
const { resolveTradePrice } = require('../utils/resolveTradePrice');

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;
const MAX_HISTORY_RANGE_DAYS = 730;

function parseYmd(s) {
  if (!s || typeof s !== 'string' || !YMD_RE.test(s)) return null;
  return s;
}

function todayYmd() {
  return new Date().toISOString().slice(0, 10);
}

function ymdDaysBetween(start, end) {
  const a = new Date(`${start}T00:00:00Z`).getTime();
  const b = new Date(`${end}T00:00:00Z`).getTime();
  return Math.floor((b - a) / (86400 * 1000));
}

function ymdAddDays(ymd, deltaDays) {
  const d = new Date(`${ymd}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}

async function getHoldings(req, res, next) {
  try {
    const rows = await HoldingModel.findAll(req.tenantId);
    const withPrices = await Promise.all(
      rows.map(async (h) => {
        const price = await getPrice(h.ticker);
        const currentPrice = resolveTradePrice(price);
        const qty = parseFloat(h.quantity);
        const totalCost = parseFloat(h.total_cost) || 0;
        const marketValue = currentPrice != null ? currentPrice * qty : null;

        const sellFees = marketValue != null ? calcSellFees(marketValue) : null;
        const netMarketValue = marketValue != null ? marketValue - sellFees.total : null;

        const gainLoss = netMarketValue != null && totalCost > 0 ? netMarketValue - totalCost : null;
        const gainLossPct = gainLoss != null && totalCost > 0 ? (gainLoss / totalCost) * 100 : null;

        return {
          ...h,
          current_price: currentPrice,
          market_value: marketValue,
          selling_fees: sellFees ? sellFees.total : null,
          selling_fees_breakdown: sellFees ? sellFees.breakdown : null,
          net_market_value: netMarketValue,
          cost_basis: totalCost,
          gain_loss: gainLoss,
          gain_loss_pct: gainLossPct,
          last_updated: price?.date || null
        };
      })
    );
    res.json({ success: true, data: withPrices });
  } catch (err) {
    next(err);
  }
}

async function getSummary(req, res, next) {
  try {
    const rows = await HoldingModel.findAll(req.tenantId);
    let portfolioValue = 0;
    let totalCost = 0;

    let totalSellingFees = 0;
    for (const h of rows) {
      const price = await getPrice(h.ticker);
      const currentPrice = resolveTradePrice(price);
      const qty = parseFloat(h.quantity);
      const cost = parseFloat(h.total_cost) || 0;
      totalCost += cost;
      if (currentPrice != null) {
        const mv = currentPrice * qty;
        portfolioValue += mv;
        totalSellingFees += calcSellFees(mv).total;
      }
    }

    const netPortfolioValue = portfolioValue - totalSellingFees;
    const gainLoss = portfolioValue > 0 ? netPortfolioValue - totalCost : 0;
    const gainLossPct = totalCost > 0 ? (gainLoss / totalCost) * 100 : 0;

    res.json({
      success: true,
      data: {
        portfolio_value: portfolioValue,
        total_selling_fees: totalSellingFees,
        net_portfolio_value: netPortfolioValue,
        total_cost: totalCost,
        gain_loss: gainLoss,
        gain_loss_pct: gainLossPct,
        holdings_count: rows.length,
        currency: 'LKR'
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getPortfolioHistory(req, res, next) {
  try {
    const { days = 90 } = req.query;
    const rows = await HoldingModel.findAll(req.tenantId);
    if (rows.length === 0) {
      return res.json({ success: true, data: { dates: [], values: [] } });
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - parseInt(days, 10));

    const histories = await Promise.all(
      rows.map(async (h) => {
        const hist = await getHistory(h.ticker, startDate.toISOString().slice(0, 10), endDate.toISOString().slice(0, 10), 365);
        const qty = parseFloat(h.quantity);
        return hist.map((p) => ({ date: p.date, value: parseFloat(p.close) * qty }));
      })
    );

    const byDate = {};
    for (const arr of histories) {
      for (const { date, value } of arr) {
        byDate[date] = (byDate[date] || 0) + value;
      }
    }
    const sorted = Object.entries(byDate).sort((a, b) => a[0].localeCompare(b[0]));
    res.json({
      success: true,
      data: {
        dates: sorted.map(([d]) => d),
        values: sorted.map(([, v]) => v)
      }
    });
  } catch (err) {
    next(err);
  }
}

async function getHoldingHistory(req, res, next) {
  try {
    const symbolId = parseInt(req.params.symbolId, 10);
    if (!Number.isFinite(symbolId) || symbolId <= 0) {
      return res.status(400).json({ success: false, error: 'Invalid symbol id' });
    }

    const holding = await HoldingModel.findByTenantAndSymbolId(req.tenantId, symbolId);
    if (!holding) {
      return res.status(404).json({ success: false, error: 'Holding not found' });
    }

    let end = parseYmd(req.query.end) || todayYmd();
    let start = parseYmd(req.query.start);
    if (!start) {
      start = ymdAddDays(end, -30);
    }
    if (start > end) {
      return res.status(400).json({ success: false, error: 'start must be on or before end' });
    }
    if (ymdDaysBetween(start, end) > MAX_HISTORY_RANGE_DAYS) {
      start = ymdAddDays(end, -MAX_HISTORY_RANGE_DAYS);
    }

    const rows = await HoldingSnapshotModel.findRange(req.tenantId, symbolId, start, end);
    const points = rows.map((r) => ({
      date:
        r.snapshot_date instanceof Date
          ? r.snapshot_date.toISOString().slice(0, 10)
          : String(r.snapshot_date).slice(0, 10),
      quantity: r.quantity != null ? parseFloat(r.quantity) : null,
      avg_cost: r.avg_cost != null ? parseFloat(r.avg_cost) : null,
      total_cost: r.total_cost != null ? parseFloat(r.total_cost) : null,
      close_price: r.close_price != null ? parseFloat(r.close_price) : null,
      market_value: r.market_value != null ? parseFloat(r.market_value) : null,
      gain_loss: r.gain_loss != null ? parseFloat(r.gain_loss) : null,
      gain_loss_pct: r.gain_loss_pct != null ? parseFloat(r.gain_loss_pct) : null
    }));

    res.json({
      success: true,
      data: {
        symbol: {
          symbol_id: holding.symbol_id,
          ticker: holding.ticker,
          display_name: holding.display_name,
          full_name: holding.full_name
        },
        range: { start, end },
        points
      }
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getHoldings, getSummary, getPortfolioHistory, getHoldingHistory };
