const express = require('express');
const { list, create, update, remove } = require('../controllers/transactionController');

const router = express.Router();

router.get('/', list);
router.post('/', create);
router.put('/:id', update);
router.delete('/:id', remove);

module.exports = router;
