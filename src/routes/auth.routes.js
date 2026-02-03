const express = require('express');
const router = express.Router();

const upload = require('../middlewares/upload.middleware');
const authController = require('../controllers/auth.controller');

router.post('/register', upload.single('profile_pic'), authController.register);
router.post('/login', authController.login);
router.post('/forgot-password', authController.forgotPassword);
router.post('/verify-otp', authController.verifyOtp);
router.post('/reset-password', authController.resetPassword);
router.post('/resend-otp', authController.resendOtp);

module.exports = router;
