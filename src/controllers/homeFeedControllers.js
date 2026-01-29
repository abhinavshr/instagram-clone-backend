const db = require('../config/db');

exports.getHomeFeed = async (req, res) => {
  try {
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    const [posts] = await db.promise().query(
      `
      SELECT 
        p.id AS post_id,
        p.caption,
        p.created_at,

        u.id AS user_id,
        u.username,
        u.profile_pic,

        COUNT(DISTINCT pl.id) AS like_count,
        COUNT(DISTINCT pc.id) AS comment_count,

        MAX(CASE WHEN pl.user_id = ? THEN 1 ELSE 0 END) AS is_liked

      FROM posts p
      JOIN users u ON u.id = p.user_id
      LEFT JOIN post_likes pl ON pl.post_id = p.id
      LEFT JOIN post_comments pc ON pc.post_id = p.id

      WHERE p.user_id = ?
         OR p.user_id IN (
            SELECT following_id FROM follows WHERE follower_id = ?
         )

      GROUP BY p.id
      ORDER BY p.created_at DESC
      LIMIT ? OFFSET ?
      `,
      [userId, userId, userId, limit, offset]
    );

    // Fetch media for posts
    const postIds = posts.map(p => p.post_id);
    let mediaMap = {};

    if (postIds.length > 0) {
      const [media] = await db.promise().query(
        `
        SELECT post_id, media_url, media_type
        FROM post_media
        WHERE post_id IN (?)
        `,
        [postIds]
      );

      media.forEach(m => {
        if (!mediaMap[m.post_id]) mediaMap[m.post_id] = [];
        mediaMap[m.post_id].push(m);
      });
    }

    const feed = posts.map(post => ({
      ...post,
      is_liked: !!post.is_liked,
      media: mediaMap[post.post_id] || []
    }));

    res.status(200).json({ feed });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
