const db = require("../config/db");
const cloudinary = require("../config/cloudinary"); 

exports.createReel = async (req, res) => {
  try {
    const userId = req.user.id;
    const caption = req.body?.caption || null;

    if (!req.file) {
      return res.status(400).json({ message: "Video is required" });
    }

    // Upload to Cloudinary
    const uploadResult = await cloudinary.uploader.upload(req.file.path, {
      folder: `instagram_reels/${userId}`,
      resource_type: "video",
      chunk_size: 6000000,
    });

    await db.promise().query(
      `INSERT INTO reels (user_id, caption, video_url, public_id)
       VALUES (?, ?, ?, ?)`,
      [
        userId,
        caption,
        uploadResult.secure_url,
        uploadResult.public_id,
      ]
    );

    res.status(201).json({
      message: "Reel uploaded successfully",
      video_url: uploadResult.secure_url,
    });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: error.message });
  }
};

exports.getReelsFeed = async (req, res) => {
  try {
    const userId = req.user.id;

    const [reels] = await db.promise().query(
      `
      SELECT 
        r.id,
        r.caption,
        r.video_url,
        r.created_at,

        u.id AS user_id,
        u.username,
        u.profile_pic,

        COUNT(DISTINCT rl.id) AS like_count,
        COUNT(DISTINCT rc.id) AS comment_count,
        MAX(CASE WHEN rl.user_id = ? THEN 1 ELSE 0 END) AS is_liked

      FROM reels r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN reel_likes rl ON rl.reel_id = r.id
      LEFT JOIN reel_comments rc ON rc.reel_id = r.id

      GROUP BY r.id
      ORDER BY r.created_at DESC
      `,
      [userId]
    );

    const formatted = reels.map(r => ({
      ...r,
      is_liked: !!r.is_liked
    }));

    res.status(200).json({ reels: formatted });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.toggleReelLike = async (req, res) => {
  try {
    const userId = req.user.id;
    const reelId = req.params.reelId;

    const [liked] = await db.promise().query(
      `SELECT id FROM reel_likes WHERE reel_id = ? AND user_id = ?`,
      [reelId, userId]
    );

    if (liked.length > 0) {
      await db.promise().query(
        `DELETE FROM reel_likes WHERE reel_id = ? AND user_id = ?`,
        [reelId, userId]
      );
      return res.json({ message: "Reel unliked" });
    }

    await db.promise().query(
      `INSERT INTO reel_likes (reel_id, user_id) VALUES (?, ?)`,
      [reelId, userId]
    );

    res.status(201).json({ message: "Reel liked" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addReelComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const reelId = req.params.reelId;
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({ message: "Comment required" });
    }

    await db.promise().query(
      `INSERT INTO reel_comments (reel_id, user_id, comment)
       VALUES (?, ?, ?)`,
      [reelId, userId, comment]
    );

    res.status(201).json({ message: "Comment added" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.replyReelComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const reelId = req.params.reelId;
    const commentId = req.params.commentId;
    const { comment } = req.body;

    if (!comment) {
      return res.status(400).json({ message: "Reply is required" });
    }

    const [parent] = await db.promise().query(
      `SELECT id FROM reel_comments WHERE id = ? AND reel_id = ?`,
      [commentId, reelId]
    );

    if (parent.length === 0) {
      return res.status(404).json({ message: "Comment not found" });
    }

    await db.promise().query(
      `INSERT INTO reel_comments (reel_id, user_id, comment, parent_id)
       VALUES (?, ?, ?, ?)`,
      [reelId, userId, comment, commentId]
    );

    res.status(201).json({ message: "Reply added" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getReelComments = async (req, res) => {
  try {
    const reelId = req.params.reelId;
    const userId = req.user.id;

    const [comments] = await db.promise().query(
      `
      SELECT 
        rc.id,
        rc.comment,
        rc.parent_id,
        rc.created_at,

        u.id AS user_id,
        u.username,
        u.profile_pic,

        COUNT(DISTINCT rcl.id) AS like_count,
        MAX(CASE WHEN rcl.user_id = ? THEN 1 ELSE 0 END) AS is_liked

      FROM reel_comments rc
      JOIN users u ON u.id = rc.user_id
      LEFT JOIN reel_comment_likes rcl ON rcl.comment_id = rc.id

      WHERE rc.reel_id = ?
      GROUP BY rc.id
      ORDER BY rc.created_at ASC
      `,
      [userId, reelId]
    );

    // 🧠 Build nested structure
    const map = {};
    const roots = [];

    comments.forEach(c => {
      c.replies = [];
      c.is_liked = !!c.is_liked; 
      map[c.id] = c;
    });

    comments.forEach(c => {
      if (c.parent_id) {
        map[c.parent_id]?.replies.push(c);
      } else {
        roots.push(c);
      }
    });

    res.json({ comments: roots });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteReelComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const reelId = req.params.reelId;
    const commentId = req.params.commentId;

    // Check ownership
    const [comment] = await db.promise().query(
      `
      SELECT id 
      FROM reel_comments 
      WHERE id = ? AND reel_id = ? AND user_id = ?
      `,
      [commentId, reelId, userId]
    );

    if (comment.length === 0) {
      return res.status(403).json({
        message: "You can only delete your own comment",
      });
    }

    await db.promise().query(
      `DELETE FROM reel_comments WHERE id = ?`,
      [commentId]
    );

    res.json({ message: "Comment deleted successfully" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.toggleReelCommentLike = async (req, res) => {
  try {
    const userId = req.user.id;
    const commentId = req.params.commentId;

    // Check if already liked
    const [liked] = await db.promise().query(
      `SELECT id FROM reel_comment_likes 
       WHERE comment_id = ? AND user_id = ?`,
      [commentId, userId]
    );

    if (liked.length > 0) {
      // Unlike
      await db.promise().query(
        `DELETE FROM reel_comment_likes 
         WHERE comment_id = ? AND user_id = ?`,
        [commentId, userId]
      );

      return res.json({ message: "Comment unliked" });
    }

    // Like
    await db.promise().query(
      `INSERT INTO reel_comment_likes (comment_id, user_id)
       VALUES (?, ?)`,
      [commentId, userId]
    );

    res.status(201).json({ message: "Comment liked" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.addReelView = async (req, res) => {
  try {
    const userId = req.user.id;
    const reelId = req.params.reelId;

    // Try inserting view
    const [result] = await db.promise().query(
      `INSERT IGNORE INTO reel_views (reel_id, user_id)
       VALUES (?, ?)`,
      [reelId, userId]
    );

    // If inserted (new view), increment counter
    if (result.affectedRows === 1) {
      await db.promise().query(
        `UPDATE reels SET view_count = view_count + 1 WHERE id = ?`,
        [reelId]
      );
    }

    res.json({ message: "View recorded" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getReelViewCount = async (req, res) => {
  try {
    const userId = req.user.id;
    const reelId = req.params.reelId;

    const [[reel]] = await db.promise().query(
      `
      SELECT user_id, view_count 
      FROM reels 
      WHERE id = ?
      `,
      [reelId]
    );

    if (!reel) {
      return res.status(404).json({ message: "Reel not found" });
    }

    if (reel.user_id !== userId) {
      return res.status(403).json({
        message: "You are not allowed to view reel analytics"
      });
    }

    res.json({
      reel_id: reelId,
      views: reel.view_count
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
