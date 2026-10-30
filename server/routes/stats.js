import { Router } from 'express';
import { db } from '../db.js';

const router = Router();

// GET /api/stats/overview
router.get('/overview', (req, res) => {
  try {
    const postCount = db.prepare("SELECT COUNT(*) as count FROM posts WHERE status = 'published'").get().count;
    const commentCount = db.prepare("SELECT COUNT(*) as count FROM comments").get().count;
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;

    const categories = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM posts
      WHERE status = 'published'
      GROUP BY category
      ORDER BY count DESC
    `).all();

    const topAuthors = db.prepare(`
      SELECT 
        u.id, u.username, u.full_name, u.avatar_url, u.bio,
        COUNT(p.id) as post_count,
        COALESCE(SUM(p.likes_count), 0) as total_likes
      FROM users u
      JOIN posts p ON u.id = p.author_id
      WHERE p.status = 'published'
      GROUP BY u.id
      ORDER BY total_likes DESC
      LIMIT 5
    `).all();

    return res.json({
      metrics: {
        posts: postCount,
        comments: commentCount,
        authors: userCount
      },
      categories,
      topAuthors
    });
  } catch (err) {
    console.error('Stats overview error:', err);
    return res.status(500).json({ error: 'Failed to retrieve stats.' });
  }
});

// GET /api/stats/trending
// Calculates an engagement score: views + (likes * 5) + (comments * 10)
router.get('/trending', (req, res) => {
  try {
    const limit = Math.max(1, Math.min(20, parseInt(req.query.limit) || 5));
    const trendingPosts = db.prepare(`
      SELECT 
        p.id, p.slug, p.title, p.excerpt, p.cover_image, p.category, p.read_time,
        p.views, p.likes_count, p.created_at,
        u.id as author_id, u.username as author_username, u.full_name as author_name, u.avatar_url as author_avatar,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comments_count,
        (p.views + (p.likes_count * 5) + ((SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) * 10)) as trending_score
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.status = 'published'
      ORDER BY trending_score DESC, p.created_at DESC
      LIMIT ?
    `).all(limit);

    return res.json({ trending: trendingPosts });
  } catch (err) {
    console.error('Trending stats error:', err);
    return res.status(500).json({ error: 'Failed to retrieve trending posts.' });
  }
});

// GET /api/stats/author/:authorId
// Deep-dive author performance analytics
router.get('/author/:authorId', (req, res) => {
  try {
    const authorId = Number(req.params.authorId);
    const author = db.prepare('SELECT id, username, full_name, avatar_url, bio, role, created_at FROM users WHERE id = ?').get(authorId);

    if (!author) {
      return res.status(404).json({ error: 'Author not found.' });
    }

    const publishedCount = db.prepare("SELECT COUNT(*) as count FROM posts WHERE author_id = ? AND status = 'published'").get(authorId).count;
    const draftCount = db.prepare("SELECT COUNT(*) as count FROM posts WHERE author_id = ? AND status = 'draft'").get(authorId).count;

    const totals = db.prepare(`
      SELECT 
        COALESCE(SUM(views), 0) as total_views,
        COALESCE(SUM(likes_count), 0) as total_likes
      FROM posts
      WHERE author_id = ? AND status = 'published'
    `).get(authorId);

    const commentsReceived = db.prepare(`
      SELECT COUNT(c.id) as count
      FROM comments c
      JOIN posts p ON c.post_id = p.id
      WHERE p.author_id = ?
    `).get(authorId).count;

    const topPost = db.prepare(`
      SELECT id, slug, title, views, likes_count
      FROM posts
      WHERE author_id = ? AND status = 'published'
      ORDER BY (views + likes_count * 5) DESC
      LIMIT 1
    `).get(authorId);

    const categories = db.prepare(`
      SELECT category, COUNT(*) as count
      FROM posts
      WHERE author_id = ? AND status = 'published'
      GROUP BY category
      ORDER BY count DESC
    `).all(authorId);

    return res.json({
      author,
      analytics: {
        published_posts: publishedCount,
        draft_posts: draftCount,
        total_views: totals.total_views,
        total_likes: totals.total_likes,
        comments_received: commentsReceived,
        avg_views_per_post: publishedCount > 0 ? Math.round(totals.total_views / publishedCount) : 0,
        top_post: topPost || null,
        categories
      }
    });
  } catch (err) {
    console.error('Author stats error:', err);
    return res.status(500).json({ error: 'Failed to retrieve author stats.' });
  }
});

// GET /api/stats/tags
// Extracts and counts all tags across published articles
router.get('/tags', (req, res) => {
  try {
    const rows = db.prepare("SELECT tags FROM posts WHERE status = 'published' AND tags IS NOT NULL").all();
    const tagCountMap = {};

    rows.forEach(r => {
      if (!r.tags) return;
      const tags = r.tags.split(',').map(t => t.trim()).filter(Boolean);
      tags.forEach(tag => {
        tagCountMap[tag] = (tagCountMap[tag] || 0) + 1;
      });
    });

    const sortedTags = Object.entries(tagCountMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    return res.json({ tags: sortedTags });
  } catch (err) {
    console.error('Tags stats error:', err);
    return res.status(500).json({ error: 'Failed to retrieve tags stats.' });
  }
});

// GET /api/stats/activity
// Recent platform activity stream (new articles, new comments)
router.get('/activity', (req, res) => {
  try {
    const limit = Math.max(1, Math.min(20, parseInt(req.query.limit) || 10));

    const recentPosts = db.prepare(`
      SELECT 
        'post' as type,
        p.id, p.slug, p.title, p.created_at,
        u.username as author_username, u.full_name as author_name, u.avatar_url as author_avatar
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.status = 'published'
      ORDER BY p.created_at DESC
      LIMIT ?
    `).all(limit);

    const recentComments = db.prepare(`
      SELECT 
        'comment' as type,
        c.id, c.content, c.created_at, c.post_id,
        p.title as post_title, p.slug as post_slug,
        u.username as author_username, u.full_name as author_name, u.avatar_url as author_avatar
      FROM comments c
      JOIN posts p ON c.post_id = p.id
      JOIN users u ON c.author_id = u.id
      ORDER BY c.created_at DESC
      LIMIT ?
    `).all(limit);

    // Merge and sort by created_at DESC
    const activity = [...recentPosts, ...recentComments]
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
      .slice(0, limit);

    return res.json({ activity });
  } catch (err) {
    console.error('Activity stats error:', err);
    return res.status(500).json({ error: 'Failed to retrieve activity stream.' });
  }
});

export default router;
