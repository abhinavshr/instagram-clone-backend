const express = require('express');
const router = express.Router();
const authMiddleware = require('../middlewares/auth.middleware');
const followController = require('../controllers/follow.controller');

router.post('/follow/:userId', authMiddleware, followController.followUser);
router.delete('/unfollow/:userId', authMiddleware, followController.unfollowUser);
router.get('/status/:userId', authMiddleware, followController.getFollowStatus);

router.put('/requests/:requestId/accept', authMiddleware, followController.acceptRequest);
router.put('/requests/:requestId/reject', authMiddleware, followController.rejectRequest);
router.get('/requests', authMiddleware, followController.getPendingRequests);


module.exports = router;
