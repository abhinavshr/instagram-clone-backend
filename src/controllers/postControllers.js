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
