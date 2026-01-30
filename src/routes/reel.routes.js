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

router.post(
  "/reels/:reelId/comments",
  authenticateUser,
  reelController.addReelComment
);

router.post(
  "/reels/:reelId/comments/:commentId/reply",
  authenticateUser,
  reelController.replyReelComment
);

router.get(
  "/:reelId/comments",
  authenticateUser,
  reelController.getReelComments
);

router.delete(
  "/reels/:reelId/comments/:commentId",
  authenticateUser,
  reelController.deleteReelComment
);

router.post(
  "/reels/comments/:commentId/like",
  authenticateUser,
  reelController.toggleReelCommentLike
);

router.post(
  "/reels/:reelId/view",
  authenticateUser,
  reelController.addReelView
);

router.get(
  "/reels/:reelId/views",
  authenticateUser,
  reelController.getReelViewCount
);

module.exports = router;