const express = require('express');
const router = express.Router();

const auth = require('../middlewares/auth.middleware');
const upload = require('../middlewares/upload.middleware');
const userController = require('../controllers/user.controller');

router.put(
  '/update-profile',
  auth,
  upload.single('profile_pic'),
  userController.updateProfile
);

module.exports = router;
