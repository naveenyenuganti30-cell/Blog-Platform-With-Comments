import { Router } from 'express';
import { db } from '../db.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const router = Router();

// Helper: Nest flat comment list into parent -> replies tree
function buildCommentTree(comments, currentUserId, userLikedCommentIds) {
  const map = new Map();
  const roots = [];

  comments.forEach(c => {
    map.set(c.id, {
      ...c,
      is_liked: userLikedCommentIds.has(c.id),
      replies: []
    });
  });

  comments.forEach(c => {
    const item = map.get(c.id);
    if (c.parent_id && map.has(c.parent_id)) {
      map.get(c.parent_id).replies.push(item);
    } else {
      roots.push(item);
    }
  });

  return roots;
}

// GET /api/comments/post/:postId
router.get('/post/:postId', optionalAuth, (req, res) => {
  try {
    const postId = Number(req.params.postId);

    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const comments = db.prepare(`
      SELECT 
        c.id, c.post_id, c.author_id, c.parent_id, c.content, c.likes_count, c.created_at,
        u.username as author_username, u.full_name as author_name, 
        u.avatar_url as author_avatar, u.role as author_role
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.post_id = ?
      ORDER BY c.created_at ASC
    `).all(postId);

    const currentUserId = req.user ? req.user.id : null;
    let userLikedCommentIds = new Set();

    if (currentUserId) {
      const likes = db.prepare('SELECT comment_id FROM comment_likes WHERE user_id = ?').all(currentUserId);
      likes.forEach(l => userLikedCommentIds.add(l.comment_id));
    }

    const tree = buildCommentTree(comments, currentUserId, userLikedCommentIds);

    return res.json({
      total: comments.length,
      comments: tree
    });
  } catch (err) {
    console.error('Fetch comments error:', err);
    return res.status(500).json({ error: 'Failed to fetch comments.' });
  }
});

// POST /api/comments/post/:postId - Add comment or reply
router.post('/post/:postId', authenticateToken, (req, res) => {
  try {
    const postId = Number(req.params.postId);
    const { content, parent_id } = req.body;

    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Comment text cannot be empty.' });
    }

    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    let parentIdVal = null;
    if (parent_id) {
      const parent = db.prepare('SELECT id FROM comments WHERE id = ? AND post_id = ?').get(Number(parent_id), postId);
      if (!parent) {
        return res.status(400).json({ error: 'The parent comment being replied to was not found.' });
      }
      parentIdVal = parent.id;
    }

    const insert = db.prepare(`
      INSERT INTO comments (post_id, author_id, parent_id, content)
      VALUES (?, ?, ?, ?)
    `);

    const result = insert.run(postId, req.user.id, parentIdVal, content.trim());
    const newCommentId = Number(result.lastInsertRowid);

    const newComment = db.prepare(`
      SELECT 
        c.id, c.post_id, c.author_id, c.parent_id, c.content, c.likes_count, c.created_at,
        u.username as author_username, u.full_name as author_name, 
        u.avatar_url as author_avatar, u.role as author_role
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.id = ?
    `).get(newCommentId);

    return res.status(201).json({
      message: parentIdVal ? 'Reply posted successfully!' : 'Comment posted successfully!',
      comment: {
        ...newComment,
        is_liked: false,
        replies: []
      }
    });
  } catch (err) {
    console.error('Add comment error:', err);
    return res.status(500).json({ error: 'Failed to post comment.' });
  }
});

// POST /api/comments/:id/like - Toggle comment like
router.post('/:id/like', authenticateToken, (req, res) => {
  try {
    const commentId = Number(req.params.id);
    const userId = req.user.id;

    const comment = db.prepare('SELECT id, likes_count FROM comments WHERE id = ?').get(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    const existingLike = db.prepare('SELECT id FROM comment_likes WHERE user_id = ? AND comment_id = ?').get(userId, commentId);

    let isLiked = false;
    let newLikesCount = comment.likes_count;

    if (existingLike) {
      db.prepare('DELETE FROM comment_likes WHERE id = ?').run(existingLike.id);
      db.prepare('UPDATE comments SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').run(commentId);
      newLikesCount = Math.max(0, newLikesCount - 1);
      isLiked = false;
    } else {
      db.prepare('INSERT INTO comment_likes (user_id, comment_id) VALUES (?, ?)').run(userId, commentId);
      db.prepare('UPDATE comments SET likes_count = likes_count + 1 WHERE id = ?').run(commentId);
      newLikesCount += 1;
      isLiked = true;
    }

    return res.json({
      is_liked: isLiked,
      likes_count: newLikesCount
    });
  } catch (err) {
    console.error('Comment like error:', err);
    return res.status(500).json({ error: 'Failed to update like status.' });
  }
});

// DELETE /api/comments/:id - Delete comment
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const commentId = Number(req.params.id);
    const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(commentId);

    if (!comment) {
      return res.status(404).json({ error: 'Comment not found.' });
    }

    // Must be author or admin
    if (comment.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You are not authorized to delete this comment.' });
    }

    // Delete comment (cascade will delete replies or child likes)
    db.prepare('DELETE FROM comments WHERE id = ?').run(commentId);

    return res.json({ message: 'Comment deleted successfully.' });
  } catch (err) {
    console.error('Delete comment error:', err);
    return res.status(500).json({ error: 'Failed to delete comment.' });
  }
});

export default router;
