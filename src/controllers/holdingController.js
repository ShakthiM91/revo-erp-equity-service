const HoldingModel = require('../models/holdingModel');
const { getPrice, getHistory } = require('../services/marketDataClient');
const { calcSellFees } = require('../utils/cseFees');
const { resolveTradePrice } = require('../utils/resolveTradePrice');

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

module.exports = { getHoldings, getSummary, getPortfolioHistory };
