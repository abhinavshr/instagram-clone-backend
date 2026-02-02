const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../config/db');
const cloudinary = require('../config/cloudinary');
const crypto = require('crypto');
const transporter = require('../utils/mailer');

// REGISTER
exports.register = async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All required fields missing' });
    }

    const checkQuery = 'SELECT id FROM users WHERE email = ? OR username = ?';
    db.query(checkQuery, [email, username], async (err, result) => {
      if (err) return res.status(500).json({ error: err });

      if (result.length > 0) {
        return res.status(409).json({ message: 'User already exists' });
      }

      const hashedPassword = await bcrypt.hash(password, 10);

      let profilePicUrl = null;
      let profilePicPublicId = null;

      if (req.file) {
        const uploadResult = await cloudinary.uploader.upload(req.file.path, {
          folder: 'instagram_profiles'
        });
        profilePicUrl = uploadResult.secure_url;
        profilePicPublicId = uploadResult.public_id;
      }

      const insertQuery = `
        INSERT INTO users (username, email, password, full_name, profile_pic, profile_pic_public_id)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      db.query(
        insertQuery,
        [username, email, hashedPassword, full_name, profilePicUrl, profilePicPublicId],
        async (err, result) => {
          if (err) {
            // rollback image upload
            if (profilePicPublicId) {
              await cloudinary.uploader.destroy(profilePicPublicId);
            }
            return res.status(500).json({ error: err });
          }

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

exports.forgotPassword = (req, res) => {
  const { email } = req.body;

  if (!email) return res.status(400).json({ message: 'Email required' });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  db.query(
    'UPDATE users SET reset_otp=?, reset_otp_expires=? WHERE email=?',
    [otp, expires, email],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });
      if (result.affectedRows === 0)
        return res.status(404).json({ message: 'User not found' });

      transporter.sendMail({
        to: email,
        subject: 'Password Reset OTP',
        html: `<h3>Your OTP is</h3><h1>${otp}</h1><p>Valid for 10 minutes</p>`
      });

      res.json({ message: 'OTP sent to email' });
    }
  );
};

exports.verifyOtp = (req, res) => {
  const { email, otp } = req.body;

  db.query(
    'SELECT * FROM users WHERE email=? AND reset_otp=? AND reset_otp_expires > NOW()',
    [email, otp],
    (err, result) => {
      if (err) return res.status(500).json({ error: err });
      if (result.length === 0)
        return res.status(400).json({ message: 'Invalid or expired OTP' });

      res.json({ message: 'OTP verified' });
    }
  );
};
