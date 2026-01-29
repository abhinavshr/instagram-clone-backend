const express = require('express');
const router = express.Router();
const upload = require('../middlewares/reel.upload.middleware');
const authenticateUser = require('../middlewares/auth.middleware'); 
const reelController = require('../controllers/reelController');

router.post(
  "/reels",
  authenticateUser,
  upload.single("video"),
  reelController.createReel
);

module.exports = router;