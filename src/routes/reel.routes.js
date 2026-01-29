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

router.get(
  "/reels",
  authenticateUser,
  reelController.getReelsFeed
);

router.post(
  "/reels/:reelId/like",
  authenticateUser,
  reelController.toggleReelLike
);

module.exports = router;