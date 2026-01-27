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

// LOGIN API (WITHOUT JWT)
router.post('/login', (req, res) => {
  const { email, username, password } = req.body;

  // 1. Validate input
  if ((!email && !username) || !password) {
    return res.status(400).json({ message: 'Email/Username and password required' });
  }

  // 2. Find user
  const query = email
    ? 'SELECT * FROM users WHERE email = ?'
    : 'SELECT * FROM users WHERE username = ?';

  const value = email || username;

  db.query(query, [value], async (err, result) => {
    if (err) return res.status(500).json({ error: err });

    if (result.length === 0) {
      return res.status(404).json({ message: 'User not found' });
    }

    const user = result[0];

    // 3. Compare password
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    // 4. Remove password before sending response
    delete user.password;

    res.status(200).json({
      message: 'Login successful',
      user
    });
  });
});


module.exports = router;
