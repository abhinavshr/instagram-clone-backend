const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const followController = require('../controllers/follow.controller');

router.post('/follow/:userId', authMiddleware, followController.followUser);
router.delete('/unfollow/:userId', authMiddleware, followController.unfollowUser);
router.get('/status/:userId', authMiddleware, followController.getFollowStatus);

module.exports = router;
