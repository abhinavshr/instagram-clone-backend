const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const db = require('../config/db');

// REGISTER API
router.post('/register', async (req, res) => {
  try {
    const { username, email, password, full_name } = req.body;

    // 1. Validate input
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'All required fields missing' });
    }

    // 2. Check if user exists
    const checkQuery = 'SELECT * FROM users WHERE email = ? OR username = ?';
    db.query(checkQuery, [email, username], async (err, result) => {
      if (err) return res.status(500).json({ error: err });

      if (result.length > 0) {
        return res.status(409).json({ message: 'User already exists' });
      }

      // 3. Hash password
      const salt = await bcrypt.genSalt(10);
      const hashedPassword = await bcrypt.hash(password, salt);

      // 4. Insert user
      const insertQuery = `
        INSERT INTO users (username, email, password, full_name)
        VALUES (?, ?, ?, ?)
      `;

      db.query(
        insertQuery,
        [username, email, hashedPassword, full_name],
        (err, result) => {
          if (err) return res.status(500).json({ error: err });

          res.status(201).json({
            message: 'User registered successfully',
            user_id: result.insertId
          });
        }
      );
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
