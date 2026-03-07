const express = require('express');
const { list, create, getById } = require('../controllers/symbolController');

const router = express.Router();

router.get('/', list);
router.post('/', create);
router.get('/:id', getById);

module.exports = router;
