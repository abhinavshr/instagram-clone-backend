const express = require('express');
const router = express.Router();
const postsController = require('../controllers/postControllers');
const commentsController = require('../controllers/commentControllers');
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

router.post(
  "/posts/:postId/comments",
  authenticateUser,
  commentsController.createComment
)

router.get(
  "/posts/:postId/comments",
  authenticateUser,
  commentsController.getPostComments
);

router.delete(
  "/comments/:commentId",
  authenticateUser,
  commentsController.deleteComment
);

router.post(
  "/comments/:commentId/like",
  authenticateUser,
  commentsController.toggleCommentLike
);

router.get(
  "/comments/:commentId/likes",
  authenticateUser,
  commentsController.getCommentLikes
);


module.exports = router;
