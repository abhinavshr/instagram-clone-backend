const db = require('../config/db');
const cloudinary = require('../config/cloudinary');

// CREATE POST (single or multiple media)
exports.createPost = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { caption } = req.body;

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: "Please upload at least one image or video" });
    }

    const insertPostQuery = `INSERT INTO posts (user_id, caption) VALUES (?, ?)`;
    db.query(insertPostQuery, [userId, caption], async (err, postResult) => {
      if (err) return res.status(500).json({ error: err });

      const postId = postResult.insertId;

      const mediaPromises = req.files.map(async (file) => {
        const uploadResult = await cloudinary.uploader.upload(file.path, {
          folder: `instagram_posts/${userId}`,
          resource_type: 'auto', 
        });

        const mediaUrl = uploadResult.secure_url;
        const mediaType = file.mimetype.startsWith('video') ? 'video' : 'image';

        return new Promise((resolve, reject) => {
          const insertMediaQuery = `
            INSERT INTO post_media (post_id, media_url, media_type)
            VALUES (?, ?, ?)
          `;
          db.query(insertMediaQuery, [postId, mediaUrl, mediaType], (err) => {
            if (err) reject(err);
            else resolve();
          });
        });
      });

      await Promise.all(mediaPromises);

      res.status(201).json({
        message: "Post created successfully",
        postId,
      });
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.editPost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;

    const caption = req.body?.caption ?? null;
    let deleteMediaIds = req.body?.deleteMediaIds ?? [];

    if (deleteMediaIds) {
      if (typeof deleteMediaIds === "string") {
        deleteMediaIds = deleteMediaIds.startsWith("[")
          ? JSON.parse(deleteMediaIds)
          : [deleteMediaIds];
      }
      deleteMediaIds = deleteMediaIds.map(id => Number(id));
    }

    const postQuery = `SELECT id FROM posts WHERE id = ? AND user_id = ?`;
    db.query(postQuery, [postId, userId], async (err, postResult) => {
      if (err) return res.status(500).json({ error: err });
      if (postResult.length === 0) {
        return res.status(403).json({ message: "You cannot edit this post" });
      }

      if (caption !== null) {
        await db.promise().query(
          `UPDATE posts SET caption = ? WHERE id = ?`,
          [caption, postId]
        );
      }

      if (deleteMediaIds.length > 0) {
        const [media] = await db.promise().query(
          `SELECT id, public_id FROM post_media WHERE id IN (?) AND post_id = ?`,
          [deleteMediaIds, postId]
        );

        for (const m of media) {
          if (m.public_id) {
            await cloudinary.uploader.destroy(m.public_id, {
              resource_type: "auto",
            });
          }
        }

        await db.promise().query(
          `DELETE FROM post_media WHERE id IN (?) AND post_id = ?`,
          [deleteMediaIds, postId]
        );
      }

      if (req.files && req.files.length > 0) {
        for (const file of req.files) {
          const upload = await cloudinary.uploader.upload(file.path, {
            folder: `instagram_posts/${userId}`,
            resource_type: "auto",
          });

          const mediaType = file.mimetype.startsWith("video")
            ? "video"
            : "image";

          await db.promise().query(
            `INSERT INTO post_media (post_id, media_url, media_type, public_id)
             VALUES (?, ?, ?, ?)`,
            [postId, upload.secure_url, mediaType, upload.public_id]
          );
        }
      }

      res.status(200).json({ message: "Post updated successfully" });
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deletePost = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;

    const [post] = await db.promise().query(
      `SELECT id FROM posts WHERE id = ? AND user_id = ?`,
      [postId, userId]
    );

    if (post.length === 0) {
      return res.status(403).json({ message: "You cannot delete this post" });
    }

    const [media] = await db.promise().query(
      `SELECT public_id FROM post_media WHERE post_id = ?`,
      [postId]
    );

    for (const m of media) {
      if (m.public_id) {
        await cloudinary.uploader.destroy(m.public_id, {
          resource_type: "auto",
        });
      }
    }

    await db.promise().query(`DELETE FROM posts WHERE id = ?`, [postId]);

    return res.status(200).json({ message: "Post deleted successfully" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};


exports.toggleLike = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;

    // 1️⃣ Check post exists
    const [post] = await db.promise().query(
      `SELECT id FROM posts WHERE id = ?`,
      [postId]
    );

    if (post.length === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    // 2️⃣ Check if already liked
    const [like] = await db.promise().query(
      `SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?`,
      [userId, postId]
    );

    // 3️⃣ Unlike
    if (like.length > 0) {
      await db.promise().query(
        `DELETE FROM post_likes WHERE user_id = ? AND post_id = ?`,
        [userId, postId]
      );

      return res.status(200).json({ message: "Post unliked" });
    }

    // 4️⃣ Like
    await db.promise().query(
      `INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)`,
      [userId, postId]
    );

    return res.status(201).json({ message: "Post liked" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPostLikes = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;

    const [[count]] = await db.promise().query(
      `SELECT COUNT(*) AS totalLikes FROM post_likes WHERE post_id = ?`,
      [postId]
    );

    const [liked] = await db.promise().query(
      `SELECT id FROM post_likes WHERE post_id = ? AND user_id = ?`,
      [postId, userId]
    );

    res.status(200).json({
      totalLikes: count.totalLikes,
      isLiked: liked.length > 0,
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
