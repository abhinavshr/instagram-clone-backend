const express = require('express');
const router = express.Router();

const auth = require('../middlewares/auth.middleware');
const feedController = require('../controllers/homeFeedControllers');

router.get(
  "/feed",
  auth,
  feedController.getHomeFeed
);

module.exports = router;
