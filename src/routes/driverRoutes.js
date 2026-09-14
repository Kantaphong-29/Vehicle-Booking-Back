const express = require('express');
const router = express.Router();
const { getDrivers, createDriver, updateDriver, deleteDriver } = require('../controllers/driverController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getDrivers);
router.post('/', authorize('STAFF', 'ADMIN'), createDriver);
router.put('/:id', authorize('STAFF', 'ADMIN'), updateDriver);
router.delete('/:id', authorize('STAFF', 'ADMIN'), deleteDriver);

module.exports = router;
