const express = require('express');
const router = express.Router();
const postsController = require('../controllers/postControllers');
const upload = require('../middlewares/post.upload.middleware');
const authenticateUser = require('../middlewares/auth.middleware'); 

router.post('/posts', authenticateUser, upload, postsController.createPost);

router.put(
  '/posts/:postId',
  authenticateUser,
  upload,
  postsController.editPost
);

router.delete(
  "/posts/:postId",
  authenticateUser,
  postsController.deletePost
);

router.post(
  "/posts/:postId/like",
  authenticateUser,
  postsController.toggleLike
);

router.get(
  "/posts/:postId/likes",
  authenticateUser,
  postsController.getPostLikes
);


module.exports = router;
