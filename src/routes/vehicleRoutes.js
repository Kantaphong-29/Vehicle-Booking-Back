const express = require('express');
const router = express.Router();
const { getVehicles, createVehicle, updateVehicle, deleteVehicle } = require('../controllers/vehicleController');
const { authenticate, authorize } = require('../middleware/auth');

router.use(authenticate);

router.get('/', getVehicles); // ทุก role ดูรายการรถได้
router.post('/', authorize('STAFF', 'ADMIN'), createVehicle);
router.put('/:id', authorize('STAFF', 'ADMIN'), updateVehicle);
router.delete('/:id', authorize('STAFF', 'ADMIN'), deleteVehicle);

module.exports = router;
