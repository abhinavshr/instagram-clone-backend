const express = require('express');
const router = express.Router();
const postsController = require('../controllers/postControllers');
const upload = require('../middlewares/post.upload.middleware');
const authenticateUser = require('../middlewares/auth.middleware'); 

router.post('/posts', authenticateUser, upload, postsController.createPost);

module.exports = router;
