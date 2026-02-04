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

exports.forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email required' });
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 min

  db.query(
    'UPDATE users SET reset_otp=?, reset_otp_expires=? WHERE email=?',
    [otp, expires, email],
    async (err, result) => {
      if (err) {
        return res.status(500).json({ error: err });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      try {
        await transporter.sendMail({
          from: `"Instagram" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Reset your password',
          html: `
          <div style="background-color:#fafafa;padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <div style="max-width:420px;margin:0 auto;background:#ffffff;border:1px solid #dbdbdb;border-radius:8px;padding:32px;text-align:center;">
              
              <h2 style="margin:0 0 20px;font-weight:600;color:#262626;">
                Password Reset
              </h2>

              <p style="font-size:14px;color:#8e8e8e;line-height:1.5;margin-bottom:24px;">
                We received a request to reset your password.  
                Use the code below to continue.
              </p>

              <div style="font-size:32px;letter-spacing:6px;font-weight:700;color:#262626;margin:24px 0;">
                ${otp}
              </div>

              <p style="font-size:13px;color:#8e8e8e;margin-bottom:24px;">
                This code will expire in <strong>10 minutes</strong>.
              </p>

              <hr style="border:none;border-top:1px solid #efefef;margin:24px 0;" />

              <p style="font-size:12px;color:#b0b0b0;line-height:1.5;">
                If you didn’t request a password reset, you can safely ignore this email.
              </p>

            </div>

            <p style="text-align:center;font-size:12px;color:#b0b0b0;margin-top:20px;">
              © ${new Date().getFullYear()} Instagram
            </p>
          </div>
          `
        });

        return res.json({ message: 'OTP sent to email' });

      } catch (mailError) {
        console.error('Email send failed:', mailError);

        return res.status(500).json({
          message: 'Failed to send OTP email. Please try again later.'
        });
      }
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

exports.resetPassword = async (req, res) => {
  const { email, otp, new_password } = req.body;

  // Get the user and check OTP
  db.query(
    `SELECT password FROM users WHERE email=? AND reset_otp=? AND reset_otp_expires > NOW()`,
    [email, otp],
    async (err, results) => {
      if (err) return res.status(500).json({ error: err });
      if (results.length === 0)
        return res.status(400).json({ message: 'Invalid OTP' });

      const currentHashed = results[0].password;

      // Check if new password is same as old
      const isSame = await bcrypt.compare(new_password, currentHashed);
      if (isSame)
        return res.status(400).json({ message: 'New password cannot be same as old password' });

      // Hash new password
      const hashed = await bcrypt.hash(new_password, 10);

      // Update password
      db.query(
        `UPDATE users 
         SET password=?, reset_otp=NULL, reset_otp_expires=NULL
         WHERE email=?`,
        [hashed, email],
        (err, result) => {
          if (err) return res.status(500).json({ error: err });
          res.json({ message: 'Password reset successful' });
        }
      );
    }
  );
};

exports.resendOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: 'Email required' });
  }

  // generate new OTP
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

  db.query(
    `
    UPDATE users 
    SET reset_otp=?, reset_otp_expires=?
    WHERE email=?
    `,
    [otp, expires, email],
    async (err, result) => {
      if (err) return res.status(500).json({ error: err });

      if (result.affectedRows === 0) {
        return res.status(404).json({ message: 'User not found' });
      }

      try {
        await transporter.sendMail({
          from: `"Instagram" <${process.env.EMAIL_USER}>`,
          to: email,
          subject: 'Your new password reset code',
          html: `
          <div style="background-color:#fafafa;padding:40px 0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
            <div style="max-width:420px;margin:0 auto;background:#ffffff;border:1px solid #dbdbdb;border-radius:8px;padding:32px;text-align:center;">
              
              <h2 style="margin:0 0 20px;font-weight:600;color:#262626;">
                New Login Code
              </h2>

              <p style="font-size:14px;color:#8e8e8e;line-height:1.5;margin-bottom:24px;">
                You requested a new code to reset your password.  
                Use the code below to continue.
              </p>

              <div style="font-size:32px;letter-spacing:6px;font-weight:700;color:#262626;margin:24px 0;">
                ${otp}
              </div>

              <p style="font-size:13px;color:#8e8e8e;margin-bottom:24px;">
                This code will expire in <strong>10 minutes</strong>.
              </p>

              <hr style="border:none;border-top:1px solid #efefef;margin:24px 0;" />

              <p style="font-size:12px;color:#b0b0b0;line-height:1.5;">
                If you didn’t request this code, you can ignore this email.
              </p>

            </div>

            <p style="text-align:center;font-size:12px;color:#b0b0b0;margin-top:20px;">
              © ${new Date().getFullYear()} Instagram
            </p>
          </div>
          `
        });

        return res.status(200).json({ message: 'OTP resent successfully' });

      } catch (mailError) {
        console.error('Failed to resend OTP:', mailError);

        return res.status(500).json({
          message: 'Failed to send OTP email. Please try again later.'
        });
      }
    }
  );
};
