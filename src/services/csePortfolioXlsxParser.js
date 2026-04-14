const ExcelJS = require('exceljs');

const TICKER_MAX_LEN = 20;

function normalizeCell(value) {
  if (value == null || value === '') return '';
  if (typeof value === 'object') {
    if (value.richText && Array.isArray(value.richText)) {
      return value.richText.map((t) => t.text || '').join('').trim();
    }
    if (value.text != null) return String(value.text).trim();
    if (value.result != null) return normalizeCell(value.result);
    if (value.hyperlink) return String(value.hyperlink).trim();
  }
  return String(value).trim();
}

function normHeader(value) {
  return normalizeCell(value).toLowerCase().replace(/\s+/g, ' ').trim();
}

function toNumber(value) {
  if (value == null || value === '') return NaN;
  if (typeof value === 'number' && !Number.isNaN(value)) return value;
  if (typeof value === 'object' && value.result != null) return toNumber(value.result);
  const s = String(value).replace(/,/g, '').trim();
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : NaN;
}

/**
 * @param {Buffer} buffer
 * @returns {Promise<{ rows: Array<{ ticker: string, quantity: number, avgPrice: number, totalCost: number, excelRow: number }> }>}
 */
async function parseCsePortfolioXlsx(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  const sheet = workbook.getWorksheet('Portfolio') || workbook.worksheets[0];
  if (!sheet) {
    const err = new Error('No worksheet found in workbook');
    err.code = 'NO_SHEET';
    throw err;
  }

  let headerRowIndex = null;
  /** @type {Record<string, number>} */
  const colMap = {};

  for (let r = 1; r <= Math.min(sheet.rowCount || 0, 100); r++) {
    const row = sheet.getRow(r);
    const first = normHeader(row.getCell(1).value);
    if (first === 'security') {
      headerRowIndex = r;
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const h = normHeader(cell.value);
        if (h) colMap[h] = colNumber;
      });
      break;
    }
  }

  if (headerRowIndex == null) {
    const err = new Error('Could not find header row with "Security" in column A');
    err.code = 'NO_HEADER';
    throw err;
  }

  const need = ['security', 'quantity', 'avg price', 'total cost'];
  for (const key of need) {
    if (colMap[key] == null) {
      const err = new Error(`Missing required column: ${key}`);
      err.code = 'MISSING_COLUMN';
      throw err;
    }
  }

  const rows = [];
  const seenTickers = new Set();

  for (let r = headerRowIndex + 1; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const securityRaw = normalizeCell(row.getCell(colMap['security']).value);
    if (!securityRaw) continue;

    if (securityRaw.toLowerCase() === 'total') continue;

    const ticker = securityRaw.trim().toUpperCase();
    if (ticker.length === 0 || ticker.length > TICKER_MAX_LEN) {
      const err = new Error(`Invalid Security value at row ${r} (must be 1–${TICKER_MAX_LEN} characters)`);
      err.code = 'INVALID_ROW';
      err.row = r;
      throw err;
    }

    if (seenTickers.has(ticker)) {
      const err = new Error(`Duplicate ticker in file: ${ticker}`);
      err.code = 'DUPLICATE_TICKER';
      err.ticker = ticker;
      err.row = r;
      throw err;
    }
    seenTickers.add(ticker);

    const quantity = toNumber(row.getCell(colMap['quantity']).value);
    const avgPrice = toNumber(row.getCell(colMap['avg price']).value);
    const totalCost = toNumber(row.getCell(colMap['total cost']).value);

    if (!Number.isFinite(quantity) || quantity <= 0) {
      const err = new Error(`Invalid Quantity at row ${r}`);
      err.code = 'INVALID_ROW';
      err.row = r;
      throw err;
    }
    if (!Number.isFinite(avgPrice) || avgPrice < 0) {
      const err = new Error(`Invalid Avg Price at row ${r}`);
      err.code = 'INVALID_ROW';
      err.row = r;
      throw err;
    }
    if (!Number.isFinite(totalCost) || totalCost < 0) {
      const err = new Error(`Invalid Total Cost at row ${r}`);
      err.code = 'INVALID_ROW';
      err.row = r;
      throw err;
    }

    rows.push({ ticker, quantity, avgPrice, totalCost, excelRow: r });
  }

  return { rows };
}

module.exports = { parseCsePortfolioXlsx, TICKER_MAX_LEN };
