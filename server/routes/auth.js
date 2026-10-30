import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { generateToken, authenticateToken } from '../middleware/auth.js';

const router = Router();

// POST /api/auth/register
router.post('/register', (req, res) => {
  try {
    const { username, email, password, full_name, bio, avatar_url } = req.body;

    if (!username || !email || !password || !full_name) {
      return res.status(400).json({ error: 'Username, email, password, and full name are required.' });
    }

    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // Check if username or email already exists
    const existing = db.prepare('SELECT id, username, email FROM users WHERE username = ? OR email = ?').get(cleanUsername, cleanEmail);
    if (existing) {
      if (existing.username === cleanUsername) {
        return res.status(409).json({ error: 'Username is already taken.' });
      }
      return res.status(409).json({ error: 'An account with this email already exists.' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const passwordHash = bcrypt.hashSync(password, salt);

    const defaultAvatar = avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${cleanUsername}`;
    const userBio = bio || 'Passionate reader and contributor on PulseBlog.';

    const insert = db.prepare(`
      INSERT INTO users (username, email, password_hash, full_name, avatar_url, bio, role)
      VALUES (?, ?, ?, ?, ?, ?, 'author')
    `);

    const result = insert.run(cleanUsername, cleanEmail, passwordHash, full_name.trim(), defaultAvatar, userBio);
    const newUserId = Number(result.lastInsertRowid);

    const newUser = db.prepare('SELECT id, username, email, full_name, avatar_url, bio, role, created_at FROM users WHERE id = ?').get(newUserId);
    const token = generateToken(newUser);

    return res.status(201).json({
      message: 'Account created successfully!',
      user: newUser,
      token
    });
  } catch (err) {
    console.error('Registration error:', err);
    return res.status(500).json({ error: 'Failed to register account. Please try again.' });
  }
});

// POST /api/auth/login
router.post('/login', (req, res) => {
  try {
    const { identifier, password } = req.body; // identifier can be email or username

    if (!identifier || !password) {
      return res.status(400).json({ error: 'Please enter your email/username and password.' });
    }

    const cleanIdentifier = identifier.trim().toLowerCase();
    const user = db.prepare('SELECT * FROM users WHERE LOWER(email) = ? OR LOWER(username) = ?').get(cleanIdentifier, cleanIdentifier);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials. User not found.' });
    }

    const isMatch = bcrypt.compareSync(password, user.password_hash);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid password. Please check your credentials.' });
    }

    const safeUser = {
      id: user.id,
      username: user.username,
      email: user.email,
      full_name: user.full_name,
      avatar_url: user.avatar_url,
      bio: user.bio,
      role: user.role,
      theme_preference: user.theme_preference || 'dark',
      email_notifications: user.email_notifications !== undefined ? user.email_notifications : 1,
      created_at: user.created_at
    };

    const token = generateToken(safeUser);

    return res.json({
      message: 'Logged in successfully!',
      user: safeUser,
      token
    });
  } catch (err) {
    console.error('Login error:', err);
    return res.status(500).json({ error: 'Failed to log in. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const user = db.prepare('SELECT id, username, email, full_name, avatar_url, bio, role, theme_preference, email_notifications, created_at FROM users WHERE id = ?').get(userId);
    const postCount = db.prepare('SELECT COUNT(*) as count FROM posts WHERE author_id = ?').get(userId).count;
    const commentCount = db.prepare('SELECT COUNT(*) as count FROM comments WHERE author_id = ?').get(userId).count;
    const bookmarkCount = db.prepare('SELECT COUNT(*) as count FROM bookmarks WHERE user_id = ?').get(userId).count;

    return res.json({
      user: {
        ...(user || req.user),
        stats: {
          posts: postCount,
          comments: commentCount,
          bookmarks: bookmarkCount
        }
      }
    });
  } catch (err) {
    console.error('Fetch me error:', err);
    return res.status(500).json({ error: 'Failed to retrieve profile.' });
  }
});

// PUT /api/auth/profile
router.put('/profile', authenticateToken, (req, res) => {
  try {
    const { full_name, bio, avatar_url, theme_preference, email_notifications } = req.body;
    const userId = req.user.id;

    const update = db.prepare(`
      UPDATE users 
      SET full_name = COALESCE(?, full_name),
          bio = COALESCE(?, bio),
          avatar_url = COALESCE(?, avatar_url),
          theme_preference = COALESCE(?, theme_preference),
          email_notifications = COALESCE(?, email_notifications)
      WHERE id = ?
    `);

    update.run(
      full_name ? full_name.trim() : null,
      bio ? bio.trim() : null,
      avatar_url || null,
      theme_preference || null,
      email_notifications !== undefined ? (email_notifications ? 1 : 0) : null,
      userId
    );

    const updatedUser = db.prepare('SELECT id, username, email, full_name, avatar_url, bio, role, theme_preference, email_notifications, created_at FROM users WHERE id = ?').get(userId);
    return res.json({
      message: 'Profile updated successfully!',
      user: updatedUser
    });
  } catch (err) {
    console.error('Update profile error:', err);
    return res.status(500).json({ error: 'Failed to update profile.' });
  }
});

// PUT /api/auth/password
router.put('/password', authenticateToken, (req, res) => {
  try {
    const { current_password, new_password } = req.body;
    const userId = req.user.id;

    if (!current_password || !new_password) {
      return res.status(400).json({ error: 'Both current password and new password are required.' });
    }

    if (new_password.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
    }

    const user = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const isMatch = bcrypt.compareSync(current_password, user.password_hash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Incorrect current password.' });
    }

    const salt = bcrypt.genSaltSync(10);
    const newHash = bcrypt.hashSync(new_password, salt);

    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, userId);

    return res.json({ message: 'Password updated successfully!' });
  } catch (err) {
    console.error('Update password error:', err);
    return res.status(500).json({ error: 'Failed to update password.' });
  }
});

// GET /api/auth/settings
router.get('/settings', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const user = db.prepare('SELECT theme_preference, email_notifications FROM users WHERE id = ?').get(userId);
    return res.json({
      settings: {
        theme_preference: user?.theme_preference || 'dark',
        email_notifications: user?.email_notifications === 1
      }
    });
  } catch (err) {
    console.error('Get settings error:', err);
    return res.status(500).json({ error: 'Failed to retrieve settings.' });
  }
});

// PUT /api/auth/settings
router.put('/settings', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const { theme_preference, email_notifications } = req.body;

    const update = db.prepare(`
      UPDATE users
      SET theme_preference = COALESCE(?, theme_preference),
          email_notifications = COALESCE(?, email_notifications)
      WHERE id = ?
    `);

    update.run(
      theme_preference || null,
      email_notifications !== undefined ? (email_notifications ? 1 : 0) : null,
      userId
    );

    const user = db.prepare('SELECT theme_preference, email_notifications FROM users WHERE id = ?').get(userId);
    return res.json({
      message: 'Settings updated successfully!',
      settings: {
        theme_preference: user?.theme_preference || 'dark',
        email_notifications: user?.email_notifications === 1
      }
    });
  } catch (err) {
    console.error('Update settings error:', err);
    return res.status(500).json({ error: 'Failed to update settings.' });
  }
});

export default router;

