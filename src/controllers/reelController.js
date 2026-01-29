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
