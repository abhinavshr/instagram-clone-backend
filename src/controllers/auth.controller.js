const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const cloudinary = require('../config/cloudinary');

// REGISTER
exports.register = async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All required fields missing' });
    }

    const checkQuery = 'SELECT * FROM users WHERE email = ? OR username = ?';
    db.query(checkQuery, [email, username], async (err, result) => {
      if (err) return res.status(500).json({ error: err });

      if (result.length > 0) {
        return res.status(409).json({ message: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      let profilePicUrl = null;
      if (req.file) {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: 'instagram_profiles'
        });
        profilePicUrl = uploadResult.secure_url;
      }

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
};

// LOGIN
exports.login = (req, res) => {
  const { email, username, password } = req.body;

  if ((!email && !username) || !password) {
    return res.status(400).json({ message: 'Email/Username and password required' });
  }

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
    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid password' });
    }

    const token = jwt.sign(
      { id: user.id },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN }
    );

    delete user.password;

    res.status(200).json({
      message: 'Login successful',
      token,
      user
    });
  });
};
