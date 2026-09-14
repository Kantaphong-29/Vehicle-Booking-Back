const express = require('express');
const router = express.Router();
const { register, login, me, updateProfile, changePassword } = require('../controllers/authController');
const { authenticate } = require('../middleware/auth');

router.post('/register', register);
router.post('/login', login);
router.get('/me', authenticate, me);
router.patch('/me', authenticate, updateProfile);
router.patch('/me/password', authenticate, changePassword);

module.exports = router;