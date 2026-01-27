const db = require('../config/db');

exports.followUser = (req, res) => {
  const followerId = req.user.id;
  const followingId = req.params.userId;

  if (followerId == followingId) {
    return res.status(400).json({ message: 'You cannot follow yourself' });
  }

  const query = `
    INSERT INTO follows (follower_id, following_id)
    VALUES (?, ?)
  `;

  db.query(query, [followerId, followingId], (err) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Already following' });
      }
      return res.status(500).json({ error: err });
    }

    res.status(201).json({ message: 'User followed successfully' });
  });
};

exports.unfollowUser = (req, res) => {
  const followerId = req.user.id;
  const followingId = req.params.userId;

  const query = `
    DELETE FROM follows
    WHERE follower_id = ? AND following_id = ?
  `;

  db.query(query, [followerId, followingId], (err, result) => {
    if (err) return res.status(500).json({ error: err });

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: 'Not following this user' });
    }

    res.status(200).json({ message: 'User unfollowed successfully' });
  });
};

exports.getFollowStatus = (req, res) => {
  const followerId = req.user.id;
  const followingId = req.params.userId;

  const query = `
    SELECT id FROM follows
    WHERE follower_id = ? AND following_id = ?
  `;

  db.query(query, [followerId, followingId], (err, result) => {
    if (err) return res.status(500).json({ error: err });

    res.status(200).json({
      isFollowing: result.length > 0
    });
  });
};
