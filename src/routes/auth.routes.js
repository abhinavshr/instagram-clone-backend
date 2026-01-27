const express = require('express');
const router = express.Router();

const upload = require('../middlewares/upload.middleware');
const authController = require('../controllers/auth.controller');

router.post('/register', upload.single('profile_pic'), authController.register);
router.post('/login', authController.login);

module.exports = router;
