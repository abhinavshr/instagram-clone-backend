const db = require('../config/db');

exports.createComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const postId = req.params.postId;
    const { comment, parent_id } = req.body;

    if (!comment || comment.trim() === "") {
      return res.status(400).json({ message: "Comment cannot be empty" });
    }

    // Check post exists
    const [post] = await db.promise().query(
      `SELECT id FROM posts WHERE id = ?`,
      [postId]
    );

    if (post.length === 0) {
      return res.status(404).json({ message: "Post not found" });
    }

    // If reply, check parent comment
    if (parent_id) {
      const [parent] = await db.promise().query(
        `SELECT id FROM post_comments WHERE id = ? AND post_id = ?`,
        [parent_id, postId]
      );

      if (parent.length === 0) {
        return res.status(404).json({ message: "Parent comment not found" });
      }
    }

    await db.promise().query(
      `INSERT INTO post_comments (post_id, user_id, comment, parent_id)
       VALUES (?, ?, ?, ?)`,
      [postId, userId, comment, parent_id || null]
    );

    res.status(201).json({ message: "Comment added successfully" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getPostComments = async (req, res) => {
  try {
    const postId = req.params.postId;

    const [comments] = await db.promise().query(
      `
      SELECT 
        c.id,
        c.comment,
        c.parent_id,
        c.created_at,
        u.id AS user_id,
        u.username,
        u.profile_pic
      FROM post_comments c
      JOIN users u ON u.id = c.user_id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
      `,
      [postId]
    );

    res.status(200).json({ comments });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.deleteComment = async (req, res) => {
  try {
    const userId = req.user.id;
    const commentId = req.params.commentId;

    const [comment] = await db.promise().query(
      `SELECT id FROM post_comments WHERE id = ? AND user_id = ?`,
      [commentId, userId]
    );

    if (comment.length === 0) {
      return res.status(403).json({ message: "Not allowed to delete this comment" });
    }

    await db.promise().query(
      `DELETE FROM post_comments WHERE id = ?`,
      [commentId]
    );

    res.status(200).json({ message: "Comment deleted" });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
