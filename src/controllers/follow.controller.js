const db = require("../config/db");

// FOLLOW / SEND REQUEST
exports.followUser = (req, res) => {
  const followerId = req.user.id;       
  const followingId = req.params.userId; 

  if (followerId == followingId) {
    return res.status(400).json({ message: "You cannot follow yourself" });
  }

  const userQuery = "SELECT is_private FROM users WHERE id = ?";
  db.query(userQuery, [followingId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (result.length === 0) return res.status(404).json({ message: "User not found" });

    const isPrivate = result[0].is_private;

    if (isPrivate == 1) {
      // Private account → send follow request

      const checkQuery = `
        SELECT * FROM follow_requests
        WHERE sender_id = ? AND receiver_id = ? AND status IN ('pending','accepted')
      `;
      db.query(checkQuery, [followerId, followingId], (err, checkResult) => {
        if (err) return res.status(500).json({ error: err });

        if (checkResult.length > 0) {
          return res.status(409).json({
            message: "Follow request already sent or already following",
          });
        }

        const deleteRejected = `
          DELETE FROM follow_requests
          WHERE sender_id = ? AND receiver_id = ? AND status = 'rejected'
        `;
        db.query(deleteRejected, [followerId, followingId], (err) => {
          if (err) return res.status(500).json({ error: err });

          const insertRequest = `
            INSERT INTO follow_requests (sender_id, receiver_id, status)
            VALUES (?, ?, 'pending')
          `;
          db.query(insertRequest, [followerId, followingId], (err) => {
            if (err) return res.status(500).json({ error: err });

            return res.status(201).json({
              message: "Follow request sent, waiting for approval"
            });
          });
        });
      });

    } else {
      // Public account → follow directly
      const followQuery = `
        INSERT INTO follows (follower_id, following_id)
        VALUES (?, ?)
      `;
      db.query(followQuery, [followerId, followingId], (err) => {
        if (err) {
          if (err.code === "ER_DUP_ENTRY") {
            return res.status(409).json({ message: "Already following" });
          }
          return res.status(500).json({ error: err });
        }
        return res.status(201).json({ message: "User followed successfully" });
      });
    }
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
      return res.status(404).json({ message: "Not following this user" });
    }

    res.status(200).json({ message: "User unfollowed successfully" });
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
      isFollowing: result.length > 0,
    });
  });
};

// Accept
exports.acceptRequest = (req, res) => {
  const requestId = req.params.requestId;

  const query = `
    SELECT * FROM follow_requests WHERE id = ? AND status = 'pending'
  `;
  db.query(query, [requestId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (result.length === 0)
      return res.status(404).json({ message: "Request not found" });

    const { sender_id, receiver_id } = result[0];

    const insertFollow = `
      INSERT INTO follows (follower_id, following_id)
      VALUES (?, ?)
    `;
    db.query(insertFollow, [sender_id, receiver_id], (err) => {
      if (err) return res.status(500).json({ error: err });

      const updateRequest = `
        UPDATE follow_requests SET status = 'accepted' WHERE id = ?
      `;
      db.query(updateRequest, [requestId], (err) => {
        if (err) return res.status(500).json({ error: err });

        res.status(200).json({ message: "Follow request accepted" });
      });
    });
  });
};

// Reject
exports.rejectRequest = (req, res) => {
  const requestId = req.params.requestId;

  const query = `
    UPDATE follow_requests
    SET status = 'rejected'
    WHERE id = ? AND status = 'pending'
  `;
  db.query(query, [requestId], (err, result) => {
    if (err) return res.status(500).json({ error: err });
    if (result.affectedRows === 0)
      return res.status(404).json({ message: "Request not found" });

    res.status(200).json({ message: "Follow request rejected" });
  });
};

// Get pending requests
exports.getPendingRequests = (req, res) => {
  const userId = req.user.id;

  const query = `
    SELECT fr.id, u.id AS sender_id, u.username, u.full_name, u.profile_pic
    FROM follow_requests fr
    JOIN users u ON fr.sender_id = u.id
    WHERE fr.receiver_id = ? AND fr.status = 'pending'
  `;
  db.query(query, [userId], (err, result) => {
    if (err) return res.status(500).json({ error: err });

    res.status(200).json({ requests: result });
  });
};
