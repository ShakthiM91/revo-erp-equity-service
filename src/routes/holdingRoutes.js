const express = require('express');
const multer = require('multer');
const { getHoldings, getSummary, getPortfolioHistory } = require('../controllers/holdingController');
const { importPortfolio } = require('../controllers/holdingImportController');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

function uploadImportFile(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (err) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ success: false, error: 'File too large (max 5 MB)' });
      }
      return res.status(400).json({ success: false, error: err.message || 'Upload failed' });
    }
    next();
  });
}

router.post('/import', uploadImportFile, importPortfolio);
router.get('/summary', getSummary);
router.get('/portfolio-history', getPortfolioHistory);
router.get('/', getHoldings);

module.exports = router;
