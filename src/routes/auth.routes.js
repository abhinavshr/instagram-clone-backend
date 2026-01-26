const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');
const cloudinary = require('../config/cloudinary');
const upload = require('../middlewares/upload.middleware');

// REGISTER API WITH PROFILE PIC
router.post('/register', upload.single('profile_pic'), async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All required fields missing' });
    }

    // Check existing user
    const checkQuery = 'SELECT * FROM users WHERE email = ? OR username = ?';
    db.query(checkQuery, [email, username], async (err, result) => {
      if (err) return res.status(500).json({ error: err });

      if (result.length > 0) {
        return res.status(409).json({ message: 'User already exists' });
      }

      // Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      let profilePicUrl = null;

      // Upload image to Cloudinary (if exists)
      if (req.file) {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: 'instagram_profiles',
        });

        profilePicUrl = uploadResult.secure_url;
      }

      // Insert user
      const insertQuery = `
        INSERT INTO users (username, email, password, full_name, profile_pic)
        VALUES (?, ?, ?, ?, ?)
      `;

      db.query(
        insertQuery,
        [username, email, hashedPassword, full_name, profilePicUrl],
        (err, result) => {
          if (err) return res.status(500).json({ error: err });

          res.status(201).json({
            message: 'User registered successfully',
            user_id: result.insertId,
            profile_pic: profilePicUrl
          });
        }
      );
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
