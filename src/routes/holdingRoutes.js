const express = require('express');
const { getHoldings, getSummary, getPortfolioHistory } = require('../controllers/holdingController');

const router = express.Router();

router.get('/summary', getSummary);
router.get('/portfolio-history', getPortfolioHistory);
router.get('/', getHoldings);

module.exports = router;
