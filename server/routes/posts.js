import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import { authenticateToken, optionalAuth } from '../middleware/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const uploadDir = path.join(__dirname, '../uploads');

if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Multer storage configuration for post covers
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, 'cover-' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp|gif/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('Only image files (JPEG, PNG, WEBP, GIF) are allowed.'));
    }
  }
});

const router = Router();

// Helper: Calculate reading time
function estimateReadingTime(text) {
  const words = (text || '').trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.max(1, Math.ceil(words / 200));
  return `${minutes} min read`;
}

// Helper: Slugify title
function createSlug(title) {
  const base = title
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return `${base}-${Date.now().toString().slice(-6)}`;
}

// POST /api/posts/upload-cover
router.post('/upload-cover', authenticateToken, upload.single('image'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No image file uploaded.' });
  }
  const fileUrl = `/uploads/${req.file.filename}`;
  return res.json({ url: fileUrl });
});

// GET /api/posts
router.get('/', optionalAuth, (req, res) => {
  try {
    const { search, category, tag, author_id, sort = 'latest', status = 'published', page: pageQuery, limit: limitQuery } = req.query;

    let whereSql = ' WHERE 1=1';
    const whereParams = [];

    // Filter by status (guests can only see published)
    if (req.user && req.user.role === 'admin') {
      if (status && status !== 'all') {
        whereSql += ` AND p.status = ?`;
        whereParams.push(status);
      }
    } else if (req.user && author_id && Number(author_id) === req.user.id) {
      if (status && status !== 'all') {
        whereSql += ` AND p.status = ?`;
        whereParams.push(status);
      }
    } else {
      whereSql += ` AND p.status = 'published'`;
    }

    if (search && search.trim()) {
      whereSql += ` AND (p.title LIKE ? OR p.excerpt LIKE ? OR p.content LIKE ? OR p.tags LIKE ?)`;
      const term = `%${search.trim()}%`;
      whereParams.push(term, term, term, term);
    }

    if (category && category !== 'All') {
      whereSql += ` AND LOWER(p.category) = LOWER(?)`;
      whereParams.push(category);
    }

    if (tag) {
      whereSql += ` AND LOWER(p.tags) LIKE LOWER(?)`;
      whereParams.push(`%${tag}%`);
    }

    if (author_id) {
      whereSql += ` AND p.author_id = ?`;
      whereParams.push(Number(author_id));
    }

    // Total count calculation for pagination
    const countSql = `SELECT COUNT(*) as count FROM posts p ${whereSql}`;
    const totalCount = db.prepare(countSql).get(...whereParams).count;

    let orderSql = ` ORDER BY p.created_at DESC`;
    if (sort === 'popular') {
      orderSql = ` ORDER BY p.likes_count DESC, p.created_at DESC`;
    } else if (sort === 'views') {
      orderSql = ` ORDER BY p.views DESC, p.created_at DESC`;
    } else if (sort === 'comments') {
      orderSql = ` ORDER BY comments_count DESC, p.created_at DESC`;
    }

    let query = `
      SELECT 
        p.id, p.slug, p.title, p.excerpt, p.cover_image, p.category, p.tags, p.read_time,
        p.views, p.likes_count, p.status, p.created_at, p.updated_at,
        u.id as author_id, u.username as author_username, u.full_name as author_name, 
        u.avatar_url as author_avatar, u.role as author_role,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comments_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      ${whereSql}
      ${orderSql}
    `;

    const queryParams = [...whereParams];

    // Optional pagination
    const page = Math.max(1, parseInt(pageQuery) || 1);
    const limit = limitQuery !== undefined ? Math.max(1, Math.min(100, parseInt(limitQuery) || 20)) : null;

    if (limit) {
      query += ` LIMIT ? OFFSET ?`;
      queryParams.push(limit, (page - 1) * limit);
    }

    const posts = db.prepare(query).all(...queryParams);

    // If user is authenticated, check which posts are liked or bookmarked
    const currentUserId = req.user ? req.user.id : null;
    let likedPostIds = new Set();
    let bookmarkedPostIds = new Set();

    if (currentUserId) {
      const likes = db.prepare('SELECT post_id FROM post_likes WHERE user_id = ?').all(currentUserId);
      likes.forEach(l => likedPostIds.add(l.post_id));

      const bookmarks = db.prepare('SELECT post_id FROM bookmarks WHERE user_id = ?').all(currentUserId);
      bookmarks.forEach(b => bookmarkedPostIds.add(b.post_id));
    }

    const formattedPosts = posts.map(p => ({
      ...p,
      is_liked: likedPostIds.has(p.id),
      is_bookmarked: bookmarkedPostIds.has(p.id)
    }));

    return res.json({
      total: totalCount,
      page,
      limit: limit || totalCount,
      totalPages: limit ? Math.ceil(totalCount / limit) : 1,
      hasMore: limit ? page * limit < totalCount : false,
      posts: formattedPosts
    });
  } catch (err) {
    console.error('Fetch posts error:', err);
    return res.status(500).json({ error: 'Failed to fetch posts.' });
  }
});

// GET /api/posts/user/bookmarks
router.get('/user/bookmarks', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const posts = db.prepare(`
      SELECT 
        p.id, p.slug, p.title, p.excerpt, p.cover_image, p.category, p.tags, p.read_time,
        p.views, p.likes_count, p.status, p.created_at,
        u.id as author_id, u.username as author_username, u.full_name as author_name, 
        u.avatar_url as author_avatar,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comments_count
      FROM bookmarks b
      JOIN posts p ON b.post_id = p.id
      JOIN users u ON p.author_id = u.id
      WHERE b.user_id = ?
      ORDER BY b.created_at DESC
    `).all(userId);

    return res.json({ posts: posts.map(p => ({ ...p, is_bookmarked: true, is_liked: false })) });
  } catch (err) {
    console.error('Fetch bookmarks error:', err);
    return res.status(500).json({ error: 'Failed to fetch bookmarks.' });
  }
});

// GET /api/posts/user/drafts
router.get('/user/drafts', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const posts = db.prepare(`
      SELECT 
        p.id, p.slug, p.title, p.excerpt, p.cover_image, p.category, p.tags, p.read_time,
        p.views, p.likes_count, p.status, p.created_at, p.updated_at,
        u.id as author_id, u.username as author_username, u.full_name as author_name, 
        u.avatar_url as author_avatar
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.author_id = ? AND p.status = 'draft'
      ORDER BY p.updated_at DESC
    `).all(userId);

    return res.json({
      total: posts.length,
      posts
    });
  } catch (err) {
    console.error('Fetch drafts error:', err);
    return res.status(500).json({ error: 'Failed to fetch drafts.' });
  }
});

// GET /api/posts/user/published
router.get('/user/published', authenticateToken, (req, res) => {
  try {
    const userId = req.user.id;
    const posts = db.prepare(`
      SELECT 
        p.id, p.slug, p.title, p.excerpt, p.cover_image, p.category, p.tags, p.read_time,
        p.views, p.likes_count, p.status, p.created_at, p.updated_at,
        u.id as author_id, u.username as author_username, u.full_name as author_name, 
        u.avatar_url as author_avatar,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comments_count
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.author_id = ? AND p.status = 'published'
      ORDER BY p.created_at DESC
    `).all(userId);

    return res.json({
      total: posts.length,
      posts
    });
  } catch (err) {
    console.error('Fetch published articles error:', err);
    return res.status(500).json({ error: 'Failed to fetch published posts.' });
  }
});

// GET /api/posts/:slugOrId
router.get('/:slugOrId', optionalAuth, (req, res) => {
  try {
    const { slugOrId } = req.params;
    let post = null;

    if (/^\d+$/.test(slugOrId)) {
      post = db.prepare(`
        SELECT 
          p.*,
          u.username as author_username, u.full_name as author_name, 
          u.avatar_url as author_avatar, u.bio as author_bio, u.role as author_role,
          (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comments_count
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.id = ?
      `).get(Number(slugOrId));
    } else {
      post = db.prepare(`
        SELECT 
          p.*,
          u.username as author_username, u.full_name as author_name, 
          u.avatar_url as author_avatar, u.bio as author_bio, u.role as author_role,
          (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comments_count
        FROM posts p
        JOIN users u ON p.author_id = u.id
        WHERE p.slug = ?
      `).get(slugOrId);
    }

    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    // Increment views safely
    db.prepare('UPDATE posts SET views = views + 1 WHERE id = ?').run(post.id);
    post.views += 1;

    // Check like / bookmark state
    let is_liked = false;
    let is_bookmarked = false;

    if (req.user) {
      const liked = db.prepare('SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?').get(req.user.id, post.id);
      is_liked = !!liked;
      const bookmarked = db.prepare('SELECT id FROM bookmarks WHERE user_id = ? AND post_id = ?').get(req.user.id, post.id);
      is_bookmarked = !!bookmarked;
    }

    // Get 3 related posts in the same category
    const related = db.prepare(`
      SELECT id, slug, title, cover_image, category, read_time, created_at
      FROM posts
      WHERE category = ? AND id != ? AND status = 'published'
      ORDER BY likes_count DESC
      LIMIT 3
    `).all(post.category, post.id);

    return res.json({
      post: {
        ...post,
        is_liked,
        is_bookmarked,
        related
      }
    });
  } catch (err) {
    console.error('Fetch post by slug/id error:', err);
    return res.status(500).json({ error: 'Failed to retrieve post details.' });
  }
});

// POST /api/posts - Create post
router.post('/', authenticateToken, (req, res) => {
  try {
    const { title, excerpt, content, cover_image, category, tags, status = 'published' } = req.body;

    if (!title || !content) {
      return res.status(400).json({ error: 'Post title and content are required.' });
    }

    const slug = createSlug(title);
    const read_time = estimateReadingTime(content);
    const postCategory = category || 'General';
    const postExcerpt = excerpt || content.slice(0, 160).replace(/[#*`_]/g, '') + '...';
    const postCover = cover_image || '/assets/images/tech-future.jpg';

    const insert = db.prepare(`
      INSERT INTO posts (slug, title, excerpt, content, cover_image, category, tags, read_time, author_id, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = insert.run(
      slug,
      title.trim(),
      postExcerpt.trim(),
      content.trim(),
      postCover,
      postCategory,
      tags ? tags.trim() : '',
      read_time,
      req.user.id,
      status
    );

    const createdPost = db.prepare(`
      SELECT p.*, u.username as author_username, u.full_name as author_name, u.avatar_url as author_avatar
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.id = ?
    `).get(Number(result.lastInsertRowid));

    return res.status(201).json({
      message: 'Post created successfully!',
      post: createdPost
    });
  } catch (err) {
    console.error('Create post error:', err);
    return res.status(500).json({ error: 'Failed to create post.' });
  }
});

// PUT /api/posts/:id - Update post
router.put('/:id', authenticateToken, (req, res) => {
  try {
    const postId = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);

    if (!existing) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    // Only author or admin can edit
    if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You are not authorized to edit this post.' });
    }

    const { title, excerpt, content, cover_image, category, tags, status } = req.body;

    const newTitle = title ? title.trim() : existing.title;
    const newContent = content ? content.trim() : existing.content;
    const newExcerpt = excerpt ? excerpt.trim() : (newContent.slice(0, 160).replace(/[#*`_]/g, '') + '...');
    const newCover = cover_image !== undefined ? cover_image : existing.cover_image;
    const newCategory = category || existing.category;
    const newTags = tags !== undefined ? tags : existing.tags;
    const newStatus = status || existing.status;
    const newReadTime = estimateReadingTime(newContent);

    const update = db.prepare(`
      UPDATE posts
      SET title = ?,
          excerpt = ?,
          content = ?,
          cover_image = ?,
          category = ?,
          tags = ?,
          status = ?,
          read_time = ?,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `);

    update.run(newTitle, newExcerpt, newContent, newCover, newCategory, newTags, newStatus, newReadTime, postId);

    const updated = db.prepare(`
      SELECT p.*, u.username as author_username, u.full_name as author_name, u.avatar_url as author_avatar
      FROM posts p
      JOIN users u ON p.author_id = u.id
      WHERE p.id = ?
    `).get(postId);

    return res.json({
      message: 'Post updated successfully!',
      post: updated
    });
  } catch (err) {
    console.error('Update post error:', err);
    return res.status(500).json({ error: 'Failed to update post.' });
  }
});

// DELETE /api/posts/:id - Delete post
router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const postId = Number(req.params.id);
    const existing = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);

    if (!existing) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    if (existing.author_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'You are not authorized to delete this post.' });
    }

    db.prepare('DELETE FROM posts WHERE id = ?').run(postId);

    return res.json({ message: 'Post deleted successfully.' });
  } catch (err) {
    console.error('Delete post error:', err);
    return res.status(500).json({ error: 'Failed to delete post.' });
  }
});

// POST /api/posts/:id/like - Toggle like
router.post('/:id/like', authenticateToken, (req, res) => {
  try {
    const postId = Number(req.params.id);
    const userId = req.user.id;

    const post = db.prepare('SELECT id, likes_count FROM posts WHERE id = ?').get(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const existingLike = db.prepare('SELECT id FROM post_likes WHERE user_id = ? AND post_id = ?').get(userId, postId);

    let isLiked = false;
    let newLikesCount = post.likes_count;

    if (existingLike) {
      // Unlike
      db.prepare('DELETE FROM post_likes WHERE id = ?').run(existingLike.id);
      db.prepare('UPDATE posts SET likes_count = MAX(0, likes_count - 1) WHERE id = ?').run(postId);
      newLikesCount = Math.max(0, newLikesCount - 1);
      isLiked = false;
    } else {
      // Like
      db.prepare('INSERT INTO post_likes (user_id, post_id) VALUES (?, ?)').run(userId, postId);
      db.prepare('UPDATE posts SET likes_count = likes_count + 1 WHERE id = ?').run(postId);
      newLikesCount += 1;
      isLiked = true;
    }

    return res.json({
      is_liked: isLiked,
      likes_count: newLikesCount
    });
  } catch (err) {
    console.error('Like toggle error:', err);
    return res.status(500).json({ error: 'Failed to update like status.' });
  }
});

// POST /api/posts/:id/bookmark - Toggle bookmark
router.post('/:id/bookmark', authenticateToken, (req, res) => {
  try {
    const postId = Number(req.params.id);
    const userId = req.user.id;

    const post = db.prepare('SELECT id FROM posts WHERE id = ?').get(postId);
    if (!post) {
      return res.status(404).json({ error: 'Post not found.' });
    }

    const existingBookmark = db.prepare('SELECT id FROM bookmarks WHERE user_id = ? AND post_id = ?').get(userId, postId);

    let isBookmarked = false;

    if (existingBookmark) {
      db.prepare('DELETE FROM bookmarks WHERE id = ?').run(existingBookmark.id);
      isBookmarked = false;
    } else {
      db.prepare('INSERT INTO bookmarks (user_id, post_id) VALUES (?, ?)').run(userId, postId);
      isBookmarked = true;
    }

    return res.json({
      is_bookmarked: isBookmarked,
      message: isBookmarked ? 'Article saved to bookmarks.' : 'Article removed from bookmarks.'
    });
  } catch (err) {
    console.error('Bookmark toggle error:', err);
    return res.status(500).json({ error: 'Failed to toggle bookmark.' });
  }
});

export default router;
