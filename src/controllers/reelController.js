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
