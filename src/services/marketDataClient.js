const axios = require('axios');

const MARKET_DATA_URL = process.env.MARKET_DATA_SERVICE_URL || 'http://localhost:3011';
const INTERNAL_TOKEN = process.env.INTERNAL_CRON_TOKEN || 'revo-cron-internal-secret';

async function getPrice(ticker) {
  try {
    const res = await axios.get(`${MARKET_DATA_URL}/api/market-data/price/${encodeURIComponent(ticker)}`, {
      timeout: 5000,
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      validateStatus: () => true
    });
    if (res.status === 200 && res.data?.success && res.data?.data) {
      return res.data.data;
    }
    return null;
  } catch (err) {
    console.warn('[Equity] marketData getPrice failed:', ticker, err.message);
    return null;
  }
}

async function getHistory(ticker, startDate, endDate, limit) {
  try {
    const params = new URLSearchParams();
    if (startDate) params.set('start_date', startDate);
    if (endDate) params.set('end_date', endDate);
    if (limit) params.set('limit', limit);
    const qs = params.toString();
    const url = `${MARKET_DATA_URL}/api/market-data/history/${encodeURIComponent(ticker)}${qs ? '?' + qs : ''}`;
    const res = await axios.get(url, {
      timeout: 10000,
      headers: { 'X-Internal-Token': INTERNAL_TOKEN },
      validateStatus: () => true
    });
    if (res.status === 200 && res.data?.success && Array.isArray(res.data?.data)) {
      return res.data.data;
    }
    return [];
  } catch (err) {
    console.warn('[Equity] marketData getHistory failed:', ticker, err.message);
    return [];
  }
}

module.exports = { getPrice, getHistory };
