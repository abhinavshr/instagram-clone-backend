const db = require('../config/db');
const cloudinary = require('../config/cloudinary');

// UPDATE PROFILE
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { full_name, bio, username } = req.body;

    let newProfilePicUrl = null;
    let newProfilePicPublicId = null;

    // 1️⃣ Get old image public_id
    const getUserQuery = 'SELECT profile_pic_public_id FROM users WHERE id = ?';

    db.query(getUserQuery, [userId], async (err, result) => {
      if (err) return res.status(500).json({ error: err });

      const oldPublicId = result[0]?.profile_pic_public_id;

      // 2️⃣ Upload new image (if exists)
      if (req.file) {
        // Delete old image if exists
        if (oldPublicId) {
          await cloudinary.uploader.destroy(oldPublicId);
        }

        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: 'instagram_profiles'
        });

        newProfilePicUrl = uploadResult.secure_url;
        newProfilePicPublicId = uploadResult.public_id;
      }

      // 3️⃣ Build dynamic update query
      const fields = [];
      const values = [];

      if (full_name) {
        fields.push('full_name = ?');
        values.push(full_name);
      }

      if (bio) {
        fields.push('bio = ?');
        values.push(bio);
      }

      if (username) {
        fields.push('username = ?');
        values.push(username);
      }

      if (newProfilePicUrl) {
        fields.push('profile_pic = ?');
        values.push(newProfilePicUrl);
        fields.push('profile_pic_public_id = ?');
        values.push(newProfilePicPublicId);
      }

      if (fields.length === 0) {
        return res.status(400).json({ message: 'Nothing to update' });
      }

      values.push(userId);

      const updateQuery = `
        UPDATE users
        SET ${fields.join(', ')}
        WHERE id = ?
      `;

      db.query(updateQuery, values, (err) => {
        if (err) {
          if (err.code === 'ER_DUP_ENTRY') {
            return res.status(409).json({ message: 'Username already exists' });
          }
          return res.status(500).json({ error: err });
        }

        res.status(200).json({
          message: 'Profile updated successfully',
          profile_pic: newProfilePicUrl || undefined
        });
      });
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.getProfile = (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT 
      id,
      username,
      email,
      full_name,
      bio,
      profile_pic,
      created_at
    FROM users
    WHERE id = ?
  `;

  db.query(query, [userId], (err, result) => {
    if (err) return res.status(500).json({ error: err });

    if (result.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.status(200).json({
      message: 'Profile fetched successfully',
      user: result[0]
    });
  });
};

exports.togglePrivacy = (req, res) => {
  const userId = req.user.id;
  const { is_private } = req.body;

  // Validate input
  if (typeof is_private === 'undefined') {
    return res.status(400).json({ message: 'is_private field is required (0 or 1)' });
  }

  if (![0, 1].includes(Number(is_private))) {
    return res.status(400).json({ message: 'is_private must be 0 or 1' });
  }

  const query = 'UPDATE users SET is_private = ? WHERE id = ?';

  db.query(query, [is_private, userId], (err) => {
    if (err) return res.status(500).json({ error: err });

    res.status(200).json({
      message: `Account is now ${is_private == 1 ? 'private' : 'public'}`
    });
  });
};