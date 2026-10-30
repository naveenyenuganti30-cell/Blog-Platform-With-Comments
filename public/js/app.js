import { api } from './api.js';
import { state } from './state.js';
import { parseMarkdown } from './markdown.js';

// ============================================================================
// Utilities & Helpers
// ============================================================================
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const iconSvg = type === 'success' 
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"></polyline></svg>'
    : type === 'error'
    ? '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>'
    : '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>';

  toast.innerHTML = `
    <span style="color: ${type === 'success' ? 'var(--accent-emerald)' : type === 'error' ? 'var(--accent-rose)' : 'var(--accent-secondary)'}; display: flex; align-items: center;">
      ${iconSvg}
    </span>
    <span style="flex: 1;">${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 250);
  }, 4000);
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function timeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const seconds = Math.floor((new Date() - date) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(dateStr);
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

// Light dismiss helper for native <dialog>
function setupDialogDismiss(dialog) {
  if (!dialog) return;
  dialog.addEventListener('click', (e) => {
    const rect = dialog.getBoundingClientRect();
    const isInDialog = (
      rect.top <= e.clientY &&
      e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX &&
      e.clientX <= rect.left + rect.width
    );
    if (!isInDialog) {
      dialog.close();
    }
  });
}

// ============================================================================
// Navigation & Views Manager
// ============================================================================
const views = {
  feed: document.getElementById('view-feed'),
  post: document.getElementById('view-post'),
  editor: document.getElementById('view-editor'),
  profile: document.getElementById('view-profile')
};

function switchView(viewName) {
  Object.keys(views).forEach(k => {
    if (views[k]) {
      if (k === viewName) {
        views[k].classList.add('active');
        views[k].style.display = 'block';
      } else {
        views[k].classList.remove('active');
        views[k].style.display = 'none';
      }
    }
  });
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ============================================================================
// Auth State & User Interface
// ============================================================================
const authModal = document.getElementById('authModal');
setupDialogDismiss(authModal);

function updateAuthUI() {
  const guestNav = document.getElementById('guestNavControls');
  const userMenu = document.getElementById('userMenuWrapper');
  const navAvatar = document.getElementById('navUserAvatar');
  const dropdownName = document.getElementById('dropdownUserName');
  const dropdownEmail = document.getElementById('dropdownUserEmail');

  if (state.user) {
    guestNav.style.display = 'none';
    userMenu.style.display = 'block';
    navAvatar.src = state.user.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${state.user.username}`;
    dropdownName.textContent = state.user.full_name;
    dropdownEmail.textContent = state.user.email;
  } else {
    guestNav.style.display = 'flex';
    userMenu.style.display = 'none';
  }
}

async function checkAuthSession() {
  const token = api.getToken();
  if (!token) {
    state.setUser(null);
    updateAuthUI();
    return;
  }

  try {
    const res = await api.getMe();
    state.setUser(res.user);
  } catch (err) {
    api.logout();
    state.setUser(null);
  }
  updateAuthUI();
}

// ============================================================================
// Feed View: Hero Spotlight, Filters & Cards Grid
// ============================================================================
function renderHeroSpotlight(post) {
  const container = document.getElementById('heroSpotlightContainer');
  if (!post) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = `
    <div class="hero-spotlight">
      <div class="hero-cover-container">
        <img src="${post.cover_image}" alt="${post.title}" class="hero-cover-img" />
      </div>
      <div class="hero-content">
        <div>
          <div class="hero-meta-top">
            <span class="featured-pill">Featured Article</span>
            <span class="badge badge-primary">${post.category}</span>
            <span style="font-size: 0.8rem; color: var(--text-muted);">${post.read_time}</span>
          </div>
          <h2 class="hero-title">
            <a href="#/post/${post.slug}">${post.title}</a>
          </h2>
          <p class="hero-excerpt">${post.excerpt}</p>
        </div>
        <div class="hero-author-row">
          <div class="hero-author-info">
            <img src="${post.author_avatar}" alt="${post.author_name}" class="author-avatar-sm" />
            <div>
              <div class="author-name-text">${post.author_name}</div>
              <div class="post-date-text">${formatDate(post.created_at)}</div>
            </div>
          </div>
          <a href="#/post/${post.slug}" class="btn btn-primary" style="padding: 0.5rem 1.15rem;">
            <span>Read Article</span>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="9 18 15 12 9 6"></polyline></svg>
          </a>
        </div>
      </div>
    </div>
  `;
}

let feedCurrentPage = 1;
const FEED_PAGE_SIZE = 6;
let feedHasMore = false;
let feedTotalPosts = 0;

function renderPostCards(posts, targetGrid = null) {
  const grid = targetGrid || document.getElementById('postsGrid');
  const emptyState = document.getElementById('feedEmptyState');

  if (!posts || posts.length === 0) {
    grid.innerHTML = '';
    if (!targetGrid && emptyState) emptyState.style.display = 'block';
    return;
  }

  if (!targetGrid && emptyState) emptyState.style.display = 'none';
  grid.innerHTML = posts.map(p => `
    <article class="post-card" data-id="${p.id}">
      <div class="card-cover-wrapper">
        <img src="${p.cover_image || '/assets/images/tech-future.jpg'}" alt="${p.title}" class="card-cover-img" loading="lazy" />
        <span class="badge ${p.status === 'draft' ? 'badge-secondary' : 'badge-primary'} card-category-tag">
          ${p.status === 'draft' ? 'Draft' : p.category}
        </span>
        ${p.status === 'draft' ? '' : `
          <button 
            class="card-bookmark-btn ${p.is_bookmarked ? 'bookmarked' : ''}" 
            data-action="bookmark" 
            data-id="${p.id}"
            title="${p.is_bookmarked ? 'Remove bookmark' : 'Bookmark post'}"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="${p.is_bookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
          </button>
        `}
      </div>

      <div class="card-body">
        <div class="card-meta-line">
          <span>${formatDate(p.created_at)}</span>
          <span class="meta-dot"></span>
          <span>${p.read_time || '3 min read'}</span>
        </div>

        <h3 class="card-title">
          <a href="${p.status === 'draft' ? `#/editor/${p.slug}` : `#/post/${p.slug}`}">${p.title}</a>
        </h3>

        <p class="card-excerpt">${p.excerpt || ''}</p>

        <div class="card-footer">
          <div class="card-author">
            <img src="${p.author_avatar || `https://api.dicebear.com/7.x/notionists/svg?seed=${p.author_username}`}" alt="${p.author_name}" class="card-author-avatar" />
            <span class="card-author-name">${p.author_name}</span>
          </div>

          ${p.status === 'draft' ? `
            <a href="#/editor/${p.slug}" class="btn btn-secondary" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;">
              <span>Edit Draft</span>
            </a>
          ` : `
            <div class="card-metrics">
              <span class="metric-pill" title="Likes">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="${p.is_liked ? '#f43f5e' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
                <span>${p.likes_count || 0}</span>
              </span>
              <span class="metric-pill" title="Comments">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                <span>${p.comments_count || 0}</span>
              </span>
            </div>
          `}
        </div>
      </div>
    </article>
  `).join('');
}

async function loadFeed(append = false) {
  try {
    if (!append) {
      feedCurrentPage = 1;
    }

    const res = await api.getPosts({
      search: state.filters.search,
      category: state.filters.category,
      sort: state.filters.sort,
      page: feedCurrentPage,
      limit: FEED_PAGE_SIZE
    });

    feedHasMore = res.hasMore;
    feedTotalPosts = res.total;

    if (append) {
      state.posts = [...state.posts, ...res.posts];
      const grid = document.getElementById('postsGrid');
      const tempWrapper = document.createElement('div');
      renderPostCards(res.posts, tempWrapper);
      grid.insertAdjacentHTML('beforeend', tempWrapper.innerHTML);
    } else {
      state.setPosts(res.posts);
      renderHeroSpotlight(state.featuredPost);
      renderPostCards(state.posts);
    }

    // Active filter badge
    const badge = document.getElementById('activeFilterBadge');
    const text = document.getElementById('activeFilterText');
    if (state.filters.search || state.filters.category !== 'All') {
      badge.style.display = 'flex';
      const parts = [];
      if (state.filters.category !== 'All') parts.push(`Category: <strong>${state.filters.category}</strong>`);
      if (state.filters.search) parts.push(`Search: <strong>"${state.filters.search}"</strong>`);
      text.innerHTML = `Showing results for ${parts.join(' & ')} (${res.total} articles)`;
    } else {
      badge.style.display = 'none';
    }

    // Pagination controls
    const paginationWrapper = document.getElementById('feedPaginationWrapper');
    const paginationInfo = document.getElementById('feedPaginationInfo');
    if (paginationWrapper) {
      if (feedHasMore) {
        paginationWrapper.style.display = 'flex';
        if (paginationInfo) paginationInfo.textContent = `Showing ${state.posts.length} of ${feedTotalPosts} articles`;
      } else {
        paginationWrapper.style.display = 'none';
      }
    }

    loadSidebarStats();
  } catch (err) {
    showToast('Failed to load blog posts.', 'error');
  }
}

async function loadSidebarStats() {
  try {
    const stats = await api.getStats();
    state.stats = stats;

    document.getElementById('statPostsCount').textContent = stats.metrics.posts;
    document.getElementById('statCommentsCount').textContent = stats.metrics.comments;
    document.getElementById('statAuthorsCount').textContent = stats.metrics.authors;

    // Render top authors list
    const authorsContainer = document.getElementById('sidebarTopAuthors');
    authorsContainer.innerHTML = stats.topAuthors.map(a => `
      <div class="author-spotlight-item">
        <img src="${a.avatar_url}" alt="${a.full_name}" class="author-avatar-sm" />
        <div style="flex: 1; min-width: 0;">
          <div class="author-spotlight-name">${a.full_name}</div>
          <div class="author-spotlight-meta">${a.post_count} articles · ${a.total_likes} likes</div>
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Sidebar stats load error:', err);
  }
}

// ============================================================================
// Article Reader View & Comments Tree
// ============================================================================
async function loadArticleView(slug) {
  try {
    const res = await api.getPostBySlug(slug);
    const post = res.post;
    state.setCurrentPost(post);

    const isOwnerOrAdmin = state.user && (state.user.id === post.author_id || state.user.role === 'admin');

    const container = document.getElementById('articleReaderContainer');
    container.innerHTML = `
      <!-- Back Navigation & Edit/Delete Controls -->
      <div class="article-nav-bar">
        <a href="#/" class="back-btn">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="15 18 9 12 15 6"></polyline></svg>
          <span>All Articles</span>
        </a>

        ${isOwnerOrAdmin ? `
          <div class="article-manage-actions">
            <a href="#/editor/${post.id}" class="btn btn-secondary" style="padding: 0.4rem 0.9rem; font-size: 0.82rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
              <span>Edit Article</span>
            </a>
            <button class="btn btn-danger" id="deletePostActionBtn" data-id="${post.id}" style="padding: 0.4rem 0.9rem; font-size: 0.82rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              <span>Delete</span>
            </button>
          </div>
        ` : ''}
      </div>

      <!-- Article Header -->
      <header>
        <div class="article-meta-row">
          <span class="badge badge-primary">${post.category}</span>
          <div class="article-read-meta">
            <span>${formatDate(post.created_at)}</span>
            <span class="meta-dot"></span>
            <span>${post.read_time}</span>
            <span class="meta-dot"></span>
            <span>${post.views} views</span>
          </div>
        </div>

        <h1 class="article-headline">${post.title}</h1>

        <div class="article-author-card">
          <div class="author-profile-left">
            <img src="${post.author_avatar}" alt="${post.author_name}" class="author-large-avatar" />
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span class="author-full-name">${post.author_name}</span>
                <span class="author-role-tag ${post.author_role}">${post.author_role}</span>
              </div>
              <div class="author-bio-line">${post.author_bio || 'Contributor at PulseBlog'}</div>
            </div>
          </div>
        </div>
      </header>

      <!-- Hero Cover Image -->
      <div class="article-cover-box">
        <img src="${post.cover_image}" alt="${post.title}" class="article-cover-img" />
      </div>

      <!-- Floating Sticky Engagement Dock -->
      <div class="engagement-dock">
        <div class="engagement-group">
          <!-- Like Button -->
          <button class="reaction-btn ${post.is_liked ? 'liked' : ''}" id="articleLikeBtn" data-id="${post.id}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${post.is_liked ? '#f43f5e' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            <span id="articleLikesCounter">${post.likes_count}</span>
          </button>

          <!-- Bookmark Button -->
          <button class="reaction-btn ${post.is_bookmarked ? 'bookmarked' : ''}" id="articleBookmarkBtn" data-id="${post.id}">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="${post.is_bookmarked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"></path></svg>
            <span>Save</span>
          </button>

          <!-- Jump to Comments -->
          <button class="reaction-btn" id="articleScrollToCommentsBtn">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
            <span id="articleCommentsDockCount">${post.comments_count}</span>
          </button>
        </div>

        <div>
          <!-- Share Button -->
          <button class="btn btn-secondary" id="articleShareBtn" style="padding: 0.4rem 0.85rem; font-size: 0.82rem;">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"></circle><circle cx="6" cy="12" r="3"></circle><circle cx="18" cy="19" r="3"></circle><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line></svg>
            <span>Share</span>
          </button>
        </div>
      </div>

      <!-- Article Rendered Markdown Body -->
      <div class="article-content-body">
        ${parseMarkdown(post.content)}
      </div>

      <!-- Tags Row -->
      ${post.tags ? `
        <div class="article-tags-row">
          <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-muted); margin-right: 0.5rem;">Tags:</span>
          ${post.tags.split(',').map(t => `<span class="tag-chip" data-tag="${t.trim()}">#${t.trim()}</span>`).join(' ')}
        </div>
      ` : ''}

      <!-- Interactive Comments Section -->
      <section class="comments-section" id="commentsSection">
        <div class="comments-header">
          <h2 class="comments-heading">
            <span>Discussion</span>
            <span class="comments-count-badge" id="commentsCountBadge">${post.comments_count}</span>
          </h2>
        </div>

        <!-- Add Comment Box -->
        <div id="commentComposerContainer">
          ${state.user ? `
            <div class="comment-composer-box">
              <div class="composer-user-header">
                <img src="${state.user.avatar_url}" alt="${state.user.full_name}" class="composer-user-avatar" />
                <span class="composer-user-name">${state.user.full_name}</span>
              </div>
              <textarea id="mainCommentInput" class="comment-textarea" placeholder="Join the discussion... What are your thoughts?"></textarea>
              <div class="composer-actions-bar">
                <button class="btn btn-primary" id="submitMainCommentBtn">Post Comment</button>
              </div>
            </div>
          ` : `
            <div class="guest-comment-banner">
              <h3 class="guest-banner-title">Join the Conversation</h3>
              <p class="guest-banner-text">Sign in to leave a comment, reply to other developers, and upvote insights.</p>
              <button class="btn btn-primary" id="guestCommentSignInBtn">Sign In to Comment</button>
            </div>
          `}
        </div>

        <!-- Threaded Comments Tree -->
        <div class="comments-tree" id="commentsTreeContainer">
          <!-- Loaded dynamically -->
        </div>
      </section>

      <!-- Related Articles Section -->
      ${post.related && post.related.length > 0 ? `
        <section class="related-posts-section">
          <h3 class="related-title">More in ${post.category}</h3>
          <div class="related-grid">
            ${post.related.map(r => `
              <div class="post-card" style="margin-bottom: 0;">
                <div class="card-cover-wrapper" style="height: 130px;">
                  <img src="${r.cover_image}" alt="${r.title}" class="card-cover-img" />
                </div>
                <div class="card-body" style="padding: 1rem;">
                  <span style="font-size: 0.72rem; color: var(--text-muted); margin-bottom: 0.25rem;">${r.read_time}</span>
                  <h4 style="font-size: 0.95rem; font-weight: 700; line-height: 1.35; margin-bottom: 0.5rem;">
                    <a href="#/post/${r.slug}">${r.title}</a>
                  </h4>
                </div>
              </div>
            `).join('')}
          </div>
        </section>
      ` : ''}
    `;

    // Hook up delete post button if present
    const delBtn = document.getElementById('deletePostActionBtn');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        openDeleteModal('Delete Article', 'Are you sure you want to permanently delete this article?', async () => {
          await api.deletePost(post.id);
          showToast('Article deleted successfully.');
          window.location.hash = '#/';
        });
      });
    }

    loadComments(post.id);
    switchView('post');
  } catch (err) {
    showToast('Failed to load article.', 'error');
    window.location.hash = '#/';
  }
}

// Render Threaded Comments Tree
function renderCommentNode(c, postId) {
  const isAuthorOrAdmin = state.user && (state.user.id === c.author_id || state.user.role === 'admin');

  return `
    <div class="comment-item" id="comment-${c.id}">
      <div class="comment-card">
        <div class="comment-header-row">
          <div class="comment-author-info">
            <img src="${c.author_avatar}" alt="${c.author_name}" class="comment-avatar" />
            <div>
              <div style="display: flex; align-items: center; gap: 0.4rem;">
                <span class="comment-author-name">${c.author_name}</span>
                <span class="author-role-tag ${c.author_role}">${c.author_role}</span>
              </div>
              <span class="comment-timestamp">${timeAgo(c.created_at)}</span>
            </div>
          </div>
        </div>

        <div class="comment-body">${c.content}</div>

        <div class="comment-footer-actions">
          <button class="comment-action-btn ${c.is_liked ? 'liked' : ''}" data-action="like-comment" data-id="${c.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="${c.is_liked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
            <span>${c.likes_count}</span>
          </button>

          <button class="comment-action-btn" data-action="reply-comment" data-id="${c.id}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 17 4 12 9 7"></polyline><path d="M20 18v-2a4 4 0 0 0-4-4H4"></path></svg>
            <span>Reply</span>
          </button>

          ${isAuthorOrAdmin ? `
            <button class="comment-action-btn delete-btn" data-action="delete-comment" data-id="${c.id}" title="Delete comment">
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              <span>Delete</span>
            </button>
          ` : ''}
        </div>

        <!-- Inline Reply Input Container -->
        <div class="inline-reply-box" id="replyBox-${c.id}">
          <textarea class="comment-textarea" placeholder="Write your reply to ${c.author_name}..." style="min-height: 70px; margin-bottom: 0.75rem;"></textarea>
          <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
            <button class="btn btn-ghost cancel-reply-btn" data-id="${c.id}" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;">Cancel</button>
            <button class="btn btn-primary submit-reply-btn" data-id="${c.id}" data-post="${postId}" style="padding: 0.35rem 0.85rem; font-size: 0.8rem;">Reply</button>
          </div>
        </div>
      </div>

      <!-- Nested Replies List -->
      ${c.replies && c.replies.length > 0 ? `
        <div class="comment-replies-list">
          ${c.replies.map(r => renderCommentNode(r, postId)).join('')}
        </div>
      ` : ''}
    </div>
  `;
}

async function loadComments(postId) {
  try {
    const res = await api.getComments(postId);
    state.setComments(res.comments);

    const countBadge = document.getElementById('commentsCountBadge');
    if (countBadge) countBadge.textContent = res.total;

    const dockCount = document.getElementById('articleCommentsDockCount');
    if (dockCount) dockCount.textContent = res.total;

    const container = document.getElementById('commentsTreeContainer');
    if (res.comments.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted); background: var(--bg-surface); border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
          <p>No comments yet. Be the first to share your perspective!</p>
        </div>
      `;
    } else {
      container.innerHTML = res.comments.map(c => renderCommentNode(c, postId)).join('');
    }
  } catch (err) {
    console.error('Comments load error:', err);
  }
}

// ============================================================================
// Post Editor Suite (Create & Edit)
// ============================================================================
function initEditor(post = null) {
  state.editingPostId = post ? post.id : null;

  document.getElementById('editorViewTitle').textContent = post ? 'Edit Article' : 'Create New Article';
  document.getElementById('editorPublishBtnText').textContent = post ? 'Save Changes' : 'Publish Article';
  document.getElementById('editorTitle').value = post ? post.title : '';
  document.getElementById('editorCategory').value = post ? post.category : 'Artificial Intelligence';
  document.getElementById('editorTags').value = post ? post.tags : '';
  document.getElementById('editorExcerpt').value = post ? post.excerpt : '';
  document.getElementById('editorContent').value = post ? post.content : '';
  document.getElementById('editorStatusSelect').value = post ? post.status : 'published';

  const coverUrl = post ? post.cover_image : '/assets/images/tech-future.jpg';
  document.getElementById('editorCoverUrl').value = coverUrl;

  // Highlight matching cover preset thumbnail
  document.querySelectorAll('.cover-preset-thumbnail').forEach(t => {
    if (t.dataset.cover === coverUrl) {
      t.classList.add('selected');
    } else {
      t.classList.remove('selected');
    }
  });

  // Reset tabs to Write
  document.getElementById('editorWriteTab').classList.add('active');
  document.getElementById('editorPreviewTab').classList.remove('active');
  document.getElementById('editorContent').style.display = 'block';
  document.getElementById('editorPreviewPanel').classList.remove('show');

  switchView('editor');
}

// ============================================================================
// Profile & Bookmarks View
// ============================================================================
async function loadProfileView(activeTab = 'posts') {
  if (!state.user) {
    showToast('Please sign in to access your profile.', 'info');
    authModal.showModal();
    return;
  }

  document.getElementById('profileUserAvatar').src = state.user.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${state.user.username}`;
  document.getElementById('profileUserName').textContent = state.user.full_name;
  document.getElementById('profileUserRole').textContent = state.user.role;
  document.getElementById('profileUserRole').className = `author-role-tag ${state.user.role}`;
  document.getElementById('profileUserHandle').textContent = `@${state.user.username}`;
  document.getElementById('profileUserBio').textContent = state.user.bio || 'PulseBlog Contributor';

  const tabPosts = document.getElementById('profileTabPosts');
  const tabDrafts = document.getElementById('profileTabDrafts');
  const tabBookmarks = document.getElementById('profileTabBookmarks');
  const tabSettings = document.getElementById('profileTabSettings');
  const grid = document.getElementById('profilePostsGrid');
  const settingsContainer = document.getElementById('profileSettingsContainer');

  [tabPosts, tabDrafts, tabBookmarks, tabSettings].forEach(t => t?.classList.remove('active'));

  if (activeTab === 'settings') {
    tabSettings?.classList.add('active');
    grid.style.display = 'none';
    settingsContainer.style.display = 'block';

    try {
      const res = await api.getSettings();
      document.getElementById('settingThemeSelect').value = res.settings.theme_preference || 'dark';
      document.getElementById('settingEmailNotifications').checked = res.settings.email_notifications;
    } catch (err) {
      document.getElementById('settingThemeSelect').value = state.user.theme_preference || 'dark';
      document.getElementById('settingEmailNotifications').checked = state.user.email_notifications !== 0;
    }
  } else {
    grid.style.display = 'grid';
    settingsContainer.style.display = 'none';

    if (activeTab === 'drafts') {
      tabDrafts?.classList.add('active');
      try {
        const res = await api.getDrafts();
        if (res.posts.length === 0) {
          grid.innerHTML = `
            <div class="feed-empty-state" style="grid-column: 1 / -1;">
              <p>You have no saved drafts.</p>
              <a href="#/editor" class="btn btn-secondary" style="margin-top: 1rem;">Create a New Draft</a>
            </div>
          `;
        } else {
          renderPostCards(res.posts, grid);
        }
      } catch (err) {
        showToast('Failed to load drafts.', 'error');
      }
    } else if (activeTab === 'bookmarks') {
      tabBookmarks?.classList.add('active');
      try {
        const res = await api.getBookmarks();
        if (res.posts.length === 0) {
          grid.innerHTML = `
            <div class="feed-empty-state" style="grid-column: 1 / -1;">
              <p>You haven't bookmarked any articles yet.</p>
              <a href="#/" class="btn btn-secondary" style="margin-top: 1rem;">Explore Articles</a>
            </div>
          `;
        } else {
          renderPostCards(res.posts, grid);
        }
      } catch (err) {
        showToast('Failed to load bookmarks.', 'error');
      }
    } else {
      tabPosts?.classList.add('active');
      try {
        const res = await api.getUserPosts();
        if (res.posts.length === 0) {
          grid.innerHTML = `
            <div class="feed-empty-state" style="grid-column: 1 / -1;">
              <p>You haven't published any articles yet.</p>
              <a href="#/editor" class="btn btn-primary" style="margin-top: 1rem;">Write Your First Article</a>
            </div>
          `;
        } else {
          renderPostCards(res.posts, grid);
        }
      } catch (err) {
        showToast('Failed to load your articles.', 'error');
      }
    }
  }

  switchView('profile');
}

// ============================================================================
// Modals & Dialogs Setup
// ============================================================================
const editProfileModal = document.getElementById('editProfileModal');
setupDialogDismiss(editProfileModal);

const deleteModal = document.getElementById('deleteModal');
setupDialogDismiss(deleteModal);

const shareModal = document.getElementById('shareModal');
setupDialogDismiss(shareModal);

let pendingDeleteAction = null;
function openDeleteModal(title, message, onConfirm) {
  document.getElementById('deleteModalTitle').textContent = title;
  document.getElementById('deleteModalMessage').textContent = message;
  pendingDeleteAction = onConfirm;
  deleteModal.showModal();
}

document.getElementById('deleteConfirmBtn').addEventListener('click', async () => {
  if (pendingDeleteAction) {
    try {
      await pendingDeleteAction();
    } catch (err) {
      showToast('Delete operation failed.', 'error');
    }
    pendingDeleteAction = null;
  }
  deleteModal.close();
});

document.getElementById('deleteCancelBtn').addEventListener('click', () => deleteModal.close());
document.getElementById('deleteModalCloseBtn').addEventListener('click', () => deleteModal.close());

// ============================================================================
// Global Event Delegation & Handlers
// ============================================================================
document.addEventListener('DOMContentLoaded', async () => {
  // 1. Initialize Theme
  state.setTheme(state.theme);
  document.getElementById('themeToggleBtn').addEventListener('click', () => {
    state.toggleTheme();
  });

  // 2. Verify Session
  await checkAuthSession();

  // 3. User Avatar Dropdown
  const userMenuBtn = document.getElementById('userMenuBtn');
  const dropdownPanel = document.getElementById('userDropdownPanel');

  userMenuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    dropdownPanel.classList.toggle('show');
    userMenuBtn.setAttribute('aria-expanded', dropdownPanel.classList.contains('show'));
  });

  document.addEventListener('click', (e) => {
    if (!dropdownPanel.contains(e.target) && e.target !== userMenuBtn) {
      dropdownPanel.classList.remove('show');
      userMenuBtn.setAttribute('aria-expanded', 'false');
    }
  });

  document.getElementById('dropdownLogoutBtn').addEventListener('click', () => {
    api.logout();
    state.setUser(null);
    updateAuthUI();
    dropdownPanel.classList.remove('show');
    showToast('Logged out successfully.');
    window.location.hash = '#/';
  });

  // 4. Auth Modal Triggers
  document.getElementById('openSignInBtn').addEventListener('click', () => {
    switchAuthTab('signin');
    authModal.showModal();
  });

  document.getElementById('openSignUpBtn').addEventListener('click', () => {
    switchAuthTab('signup');
    authModal.showModal();
  });

  document.getElementById('authModalCloseBtn').addEventListener('click', () => authModal.close());

  function switchAuthTab(tab) {
    const tabSignIn = document.getElementById('authTabSignIn');
    const tabSignUp = document.getElementById('authTabSignUp');
    const formSignIn = document.getElementById('signInForm');
    const formSignUp = document.getElementById('signUpForm');

    if (tab === 'signin') {
      tabSignIn.classList.add('active');
      tabSignIn.style.color = 'var(--text-primary)';
      tabSignIn.style.borderBottom = '2px solid var(--accent-primary)';
      tabSignUp.classList.remove('active');
      tabSignUp.style.color = 'var(--text-muted)';
      tabSignUp.style.borderBottom = 'none';
      formSignIn.style.display = 'block';
      formSignUp.style.display = 'none';
    } else {
      tabSignUp.classList.add('active');
      tabSignUp.style.color = 'var(--text-primary)';
      tabSignUp.style.borderBottom = '2px solid var(--accent-primary)';
      tabSignIn.classList.remove('active');
      tabSignIn.style.color = 'var(--text-muted)';
      tabSignIn.style.borderBottom = 'none';
      formSignUp.style.display = 'block';
      formSignIn.style.display = 'none';
    }
  }

  document.getElementById('authTabSignIn').addEventListener('click', () => switchAuthTab('signin'));
  document.getElementById('authTabSignUp').addEventListener('click', () => switchAuthTab('signup'));

  // Quick Demo Account Auto-Fill
  document.querySelectorAll('.demo-fill-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchAuthTab('signin');
      document.getElementById('signInIdentifier').value = btn.dataset.email;
      document.getElementById('signInPassword').value = btn.dataset.pass;
      document.getElementById('signInSubmitBtn').focus();
    });
  });

  // Sign In Form Submit
  document.getElementById('signInForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const identifier = document.getElementById('signInIdentifier').value;
    const password = document.getElementById('signInPassword').value;

    try {
      const res = await api.login(identifier, password);
      state.setUser(res.user);
      updateAuthUI();
      authModal.close();
      showToast(`Welcome back, ${res.user.full_name}!`);
      handleRoute();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Sign Up Form Submit
  document.getElementById('signUpForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('signUpFullName').value;
    const username = document.getElementById('signUpUsername').value;
    const email = document.getElementById('signUpEmail').value;
    const password = document.getElementById('signUpPassword').value;
    const bio = document.getElementById('signUpBio').value;

    try {
      const res = await api.register({
        full_name: fullName,
        username,
        email,
        password,
        bio
      });
      state.setUser(res.user);
      updateAuthUI();
      authModal.close();
      showToast(`Account created! Welcome, ${res.user.full_name}!`);
      handleRoute();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 5. Global Search Bar & Keyboard Shortcut (Cmd+K / Ctrl+K)
  const searchInput = document.getElementById('globalSearchInput');
  window.addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      searchInput.focus();
    }
  });

  searchInput.addEventListener('input', debounce((e) => {
    state.setFilters({ search: e.target.value });
    if (window.location.hash !== '#/' && window.location.hash !== '') {
      window.location.hash = '#/';
    } else {
      loadFeed();
    }
  }, 350));

  // Category filter tabs
  document.querySelectorAll('.category-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.category-tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      state.setFilters({ category: btn.dataset.category });
      loadFeed();
    });
  });

  // Sort dropdown
  document.getElementById('feedSortSelect').addEventListener('change', (e) => {
    state.setFilters({ sort: e.target.value });
    loadFeed();
  });

  // Clear filters
  document.getElementById('clearFilterBtn').addEventListener('click', () => {
    searchInput.value = '';
    state.setFilters({ search: '', category: 'All' });
    document.querySelectorAll('.category-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.category === 'All');
    });
    loadFeed();
  });

  document.getElementById('resetFiltersBtn').addEventListener('click', () => {
    searchInput.value = '';
    state.setFilters({ search: '', category: 'All' });
    document.querySelectorAll('.category-tab-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.category === 'All');
    });
    loadFeed();
  });

  // Tag click in tag cloud
  document.addEventListener('click', (e) => {
    const chip = e.target.closest('.tag-chip');
    if (chip) {
      const tag = chip.dataset.tag;
      searchInput.value = tag;
      state.setFilters({ search: tag });
      window.location.hash = '#/';
      loadFeed();
    }
  });

  // Join Community Callout Button
  document.getElementById('sidebarJoinBtn').addEventListener('click', () => {
    if (!state.user) {
      switchAuthTab('signup');
      authModal.showModal();
    } else {
      window.location.hash = '#/editor';
    }
  });

  // 6. Post Card Interactions (Bookmark & Likes)
  document.addEventListener('click', async (e) => {
    // Bookmark Toggle on Card
    const bookmarkBtn = e.target.closest('[data-action="bookmark"]');
    if (bookmarkBtn) {
      e.preventDefault();
      e.stopPropagation();

      if (!state.user) {
        showToast('Please sign in to save bookmarks.', 'info');
        authModal.showModal();
        return;
      }

      const postId = Number(bookmarkBtn.dataset.id);
      try {
        const res = await api.togglePostBookmark(postId);
        bookmarkBtn.classList.toggle('bookmarked', res.is_bookmarked);
        bookmarkBtn.querySelector('svg').setAttribute('fill', res.is_bookmarked ? 'currentColor' : 'none');
        showToast(res.message);
      } catch (err) {
        showToast('Failed to update bookmark.', 'error');
      }
    }
  });

  // 7. Article View Engagement Bar
  document.addEventListener('click', async (e) => {
    // Like Article
    const likeBtn = e.target.closest('#articleLikeBtn');
    if (likeBtn) {
      if (!state.user) {
        showToast('Please sign in to like this article.', 'info');
        authModal.showModal();
        return;
      }

      const postId = Number(likeBtn.dataset.id);
      try {
        const res = await api.togglePostLike(postId);
        likeBtn.classList.toggle('liked', res.is_liked);
        likeBtn.querySelector('svg').setAttribute('fill', res.is_liked ? '#f43f5e' : 'none');
        document.getElementById('articleLikesCounter').textContent = res.likes_count;
      } catch (err) {
        showToast('Failed to like article.', 'error');
      }
    }

    // Bookmark Article
    const bookBtn = e.target.closest('#articleBookmarkBtn');
    if (bookBtn) {
      if (!state.user) {
        showToast('Please sign in to save this article.', 'info');
        authModal.showModal();
        return;
      }

      const postId = Number(bookBtn.dataset.id);
      try {
        const res = await api.togglePostBookmark(postId);
        bookBtn.classList.toggle('bookmarked', res.is_bookmarked);
        bookBtn.querySelector('svg').setAttribute('fill', res.is_bookmarked ? 'currentColor' : 'none');
        showToast(res.message);
      } catch (err) {
        showToast('Failed to save article.', 'error');
      }
    }

    // Scroll to comments
    if (e.target.closest('#articleScrollToCommentsBtn')) {
      const el = document.getElementById('commentsSection');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }

    // Share Article
    if (e.target.closest('#articleShareBtn')) {
      const url = window.location.href;
      document.getElementById('shareUrlInput').value = url;
      document.getElementById('shareTwitterBtn').href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(state.currentPost ? state.currentPost.title : 'Check out this article on PulseBlog')}`;
      document.getElementById('shareLinkedInBtn').href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`;
      document.getElementById('shareWhatsAppBtn').href = `https://api.whatsapp.com/send?text=${encodeURIComponent((state.currentPost ? state.currentPost.title : 'PulseBlog Article') + ' ' + url)}`;
      shareModal.showModal();
    }

    // Copy Code Block Button
    const copyCodeBtn = e.target.closest('.copy-code-btn');
    if (copyCodeBtn) {
      const code = decodeURIComponent(copyCodeBtn.dataset.copy || '');
      navigator.clipboard.writeText(code).then(() => {
        const label = copyCodeBtn.querySelector('span');
        const prev = label.textContent;
        label.textContent = 'Copied!';
        setTimeout(() => { label.textContent = prev; }, 2000);
      });
    }

    // Guest comment sign in prompt button
    if (e.target.closest('#guestCommentSignInBtn')) {
      switchAuthTab('signin');
      authModal.showModal();
    }
  });

  // Copy Share Link
  document.getElementById('copyShareUrlBtn').addEventListener('click', () => {
    const input = document.getElementById('shareUrlInput');
    input.select();
    navigator.clipboard.writeText(input.value).then(() => {
      showToast('Article link copied to clipboard!');
      shareModal.close();
    });
  });
  document.getElementById('shareModalCloseBtn').addEventListener('click', () => shareModal.close());

  // 8. Comment Operations (Add, Reply, Like, Delete)
  document.addEventListener('click', async (e) => {
    // Submit Top-Level Comment
    if (e.target.closest('#submitMainCommentBtn')) {
      const input = document.getElementById('mainCommentInput');
      const text = (input.value || '').trim();
      if (!text) {
        showToast('Please type your comment before posting.', 'error');
        return;
      }

      if (!state.currentPost) return;

      try {
        await api.addComment(state.currentPost.id, text);
        input.value = '';
        showToast('Comment posted successfully!');
        loadComments(state.currentPost.id);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    // Like Comment
    const commentLikeBtn = e.target.closest('[data-action="like-comment"]');
    if (commentLikeBtn) {
      if (!state.user) {
        showToast('Please sign in to upvote comments.', 'info');
        authModal.showModal();
        return;
      }

      const commentId = Number(commentLikeBtn.dataset.id);
      try {
        const res = await api.toggleCommentLike(commentId);
        commentLikeBtn.classList.toggle('liked', res.is_liked);
        commentLikeBtn.querySelector('span').textContent = res.likes_count;
      } catch (err) {
        showToast('Failed to update like.', 'error');
      }
    }

    // Toggle Inline Reply Form
    const replyTriggerBtn = e.target.closest('[data-action="reply-comment"]');
    if (replyTriggerBtn) {
      if (!state.user) {
        showToast('Please sign in to reply.', 'info');
        authModal.showModal();
        return;
      }

      const commentId = replyTriggerBtn.dataset.id;
      const box = document.getElementById(`replyBox-${commentId}`);
      if (box) {
        box.classList.toggle('show');
        if (box.classList.contains('show')) {
          box.querySelector('textarea').focus();
        }
      }
    }

    // Cancel Reply Form
    const cancelReplyBtn = e.target.closest('.cancel-reply-btn');
    if (cancelReplyBtn) {
      const commentId = cancelReplyBtn.dataset.id;
      const box = document.getElementById(`replyBox-${commentId}`);
      if (box) box.classList.remove('show');
    }

    // Submit Reply
    const submitReplyBtn = e.target.closest('.submit-reply-btn');
    if (submitReplyBtn) {
      const commentId = Number(submitReplyBtn.dataset.id);
      const postId = Number(submitReplyBtn.dataset.post);
      const box = document.getElementById(`replyBox-${commentId}`);
      const text = box ? box.querySelector('textarea').value.trim() : '';

      if (!text) {
        showToast('Reply text cannot be empty.', 'error');
        return;
      }

      try {
        await api.addComment(postId, text, commentId);
        box.classList.remove('show');
        showToast('Reply posted successfully!');
        loadComments(postId);
      } catch (err) {
        showToast(err.message, 'error');
      }
    }

    // Delete Comment
    const deleteCommentBtn = e.target.closest('[data-action="delete-comment"]');
    if (deleteCommentBtn) {
      const commentId = Number(deleteCommentBtn.dataset.id);
      openDeleteModal('Delete Comment', 'Are you sure you want to delete this comment and its replies?', async () => {
        await api.deleteComment(commentId);
        showToast('Comment deleted.');
        if (state.currentPost) {
          loadComments(state.currentPost.id);
        }
      });
    }
  });

  // 9. Post Editor Events
  // Cover preset clicks
  document.querySelectorAll('.cover-preset-thumbnail').forEach(thumb => {
    thumb.addEventListener('click', () => {
      document.querySelectorAll('.cover-preset-thumbnail').forEach(t => t.classList.remove('selected'));
      thumb.classList.add('selected');
      document.getElementById('editorCoverUrl').value = thumb.dataset.cover;
    });
  });

  // Cover image local file upload
  document.getElementById('editorCoverFileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      showToast('Uploading cover image...', 'info');
      const res = await api.uploadCover(file);
      document.getElementById('editorCoverUrl').value = res.url;
      document.querySelectorAll('.cover-preset-thumbnail').forEach(t => t.classList.remove('selected'));
      showToast('Cover image uploaded successfully!');
    } catch (err) {
      showToast('Failed to upload image.', 'error');
    }
  });

  // Editor Write vs Preview Tabs
  const writeTab = document.getElementById('editorWriteTab');
  const previewTab = document.getElementById('editorPreviewTab');
  const editorContent = document.getElementById('editorContent');
  const previewPanel = document.getElementById('editorPreviewPanel');

  writeTab.addEventListener('click', () => {
    writeTab.classList.add('active');
    previewTab.classList.remove('active');
    editorContent.style.display = 'block';
    previewPanel.classList.remove('show');
  });

  previewTab.addEventListener('click', () => {
    previewTab.classList.add('active');
    writeTab.classList.remove('active');
    editorContent.style.display = 'none';
    previewPanel.classList.add('show');
    previewPanel.innerHTML = parseMarkdown(editorContent.value || '*No content to preview yet.*');
  });

  // Editor Markdown Toolbar Buttons
  document.querySelectorAll('.toolbar-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const tool = btn.dataset.tool;
      const start = editorContent.selectionStart;
      const end = editorContent.selectionEnd;
      const text = editorContent.value;
      const selected = text.substring(start, end);

      let replacement = '';
      switch (tool) {
        case 'bold':
          replacement = `**${selected || 'bold text'}**`;
          break;
        case 'italic':
          replacement = `*${selected || 'italic text'}*`;
          break;
        case 'h2':
          replacement = `\n## ${selected || 'Subheading'}\n`;
          break;
        case 'h3':
          replacement = `\n### ${selected || 'Section Heading'}\n`;
          break;
        case 'quote':
          replacement = `\n> ${selected || 'Inspiring quote or callout passage'}\n`;
          break;
        case 'code':
          replacement = `\n\`\`\`javascript\n${selected || '// Your code here'}\n\`\`\`\n`;
          break;
        case 'list':
          replacement = `\n- ${selected || 'List item 1'}\n- List item 2\n`;
          break;
        case 'link':
          replacement = `[${selected || 'Link Title'}](https://example.com)`;
          break;
      }

      editorContent.value = text.substring(0, start) + replacement + text.substring(end);
      editorContent.focus();
      editorContent.selectionStart = start + replacement.length;
      editorContent.selectionEnd = start + replacement.length;
    });
  });

  // Discard Editor changes
  document.getElementById('editorCancelBtn').addEventListener('click', () => {
    if (confirm('Discard changes and return to feed?')) {
      window.location.hash = '#/';
    }
  });

  // Publish / Save Article
  document.getElementById('editorPublishBtn').addEventListener('click', async () => {
    if (!state.user) {
      showToast('Please sign in to publish articles.', 'info');
      authModal.showModal();
      return;
    }

    const title = document.getElementById('editorTitle').value.trim();
    const content = document.getElementById('editorContent').value.trim();
    const category = document.getElementById('editorCategory').value;
    const tags = document.getElementById('editorTags').value.trim();
    const cover_image = document.getElementById('editorCoverUrl').value.trim();
    const excerpt = document.getElementById('editorExcerpt').value.trim();
    const status = document.getElementById('editorStatusSelect').value;

    if (!title) {
      showToast('Please enter an article title.', 'error');
      document.getElementById('editorTitle').focus();
      return;
    }

    if (!content) {
      showToast('Please enter content for your article.', 'error');
      document.getElementById('editorContent').focus();
      return;
    }

    const payload = {
      title,
      content,
      category,
      tags,
      cover_image,
      excerpt,
      status
    };

    try {
      if (state.editingPostId) {
        const res = await api.updatePost(state.editingPostId, payload);
        showToast('Article updated successfully!');
        window.location.hash = `#/post/${res.post.slug}`;
      } else {
        const res = await api.createPost(payload);
        showToast('Article published successfully!');
        window.location.hash = `#/post/${res.post.slug}`;
      }
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 10. Profile Tabs & Modal
  document.getElementById('profileTabPosts').addEventListener('click', () => loadProfileView('posts'));
  document.getElementById('profileTabDrafts')?.addEventListener('click', () => loadProfileView('drafts'));
  document.getElementById('profileTabBookmarks').addEventListener('click', () => loadProfileView('bookmarks'));
  document.getElementById('profileTabSettings')?.addEventListener('click', () => loadProfileView('settings'));

  // Feed Load More Button
  document.getElementById('feedLoadMoreBtn')?.addEventListener('click', () => {
    feedCurrentPage++;
    loadFeed(true);
  });

  // Settings Form Submit
  document.getElementById('userSettingsForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const theme = document.getElementById('settingThemeSelect').value;
    const emailNotifs = document.getElementById('settingEmailNotifications').checked;

    try {
      const res = await api.updateSettings({ theme_preference: theme, email_notifications: emailNotifs });
      state.setTheme(theme);
      showToast('Preferences saved successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Change Password Form Submit
  document.getElementById('changePasswordForm')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const currentPassword = document.getElementById('currentPasswordInput').value;
    const newPassword = document.getElementById('newPasswordInput').value;

    try {
      await api.changePassword({ current_password: currentPassword, new_password: newPassword });
      document.getElementById('currentPasswordInput').value = '';
      document.getElementById('newPasswordInput').value = '';
      showToast('Password updated successfully!');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  document.getElementById('editProfileModalTrigger').addEventListener('click', () => {
    if (state.user) {
      document.getElementById('editProfileFullName').value = state.user.full_name;
      document.getElementById('editProfileAvatarUrl').value = state.user.avatar_url || '';
      document.getElementById('editProfileBio').value = state.user.bio || '';
      editProfileModal.showModal();
    }
  });

  document.getElementById('editProfileCloseBtn').addEventListener('click', () => editProfileModal.close());
  document.getElementById('editProfileCancelBtn').addEventListener('click', () => editProfileModal.close());

  document.getElementById('editProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fullName = document.getElementById('editProfileFullName').value;
    const avatarUrl = document.getElementById('editProfileAvatarUrl').value;
    const bio = document.getElementById('editProfileBio').value;

    try {
      const res = await api.updateProfile({ full_name: fullName, avatar_url: avatarUrl, bio });
      state.setUser(res.user);
      updateAuthUI();
      editProfileModal.close();
      showToast('Profile updated successfully!');
      loadProfileView('posts');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 11. Reading Progress Bar on Scroll
  window.addEventListener('scroll', () => {
    const postView = document.getElementById('view-post');
    const progressBar = document.getElementById('readingProgressBar');
    if (postView.classList.contains('active')) {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight;
      if (totalScroll > 0) {
        const progress = (window.scrollY / totalScroll) * 100;
        progressBar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
      }
    } else {
      progressBar.style.width = '0%';
    }
  });

  // 12. Hash Routing
  window.addEventListener('hashchange', handleRoute);
  handleRoute();
});

// Router dispatcher
async function handleRoute() {
  const hash = window.location.hash || '#/';

  if (hash === '#/' || hash === '#') {
    switchView('feed');
    loadFeed();
  } else if (hash.startsWith('#/post/')) {
    const slug = hash.replace('#/post/', '');
    loadArticleView(slug);
  } else if (hash === '#/editor') {
    if (!state.user) {
      showToast('Please sign in to write an article.', 'info');
      authModal.showModal();
      window.location.hash = '#/';
      return;
    }
    initEditor(null);
  } else if (hash.startsWith('#/editor/')) {
    if (!state.user) {
      showToast('Please sign in to edit articles.', 'info');
      authModal.showModal();
      window.location.hash = '#/';
      return;
    }
    const id = hash.replace('#/editor/', '');
    try {
      const res = await api.getPostBySlug(id);
      initEditor(res.post);
    } catch (err) {
      showToast('Failed to load article for editing.', 'error');
      window.location.hash = '#/';
    }
  } else if (hash === '#/profile') {
    loadProfileView('posts');
  } else if (hash === '#/drafts') {
    loadProfileView('drafts');
  } else if (hash === '#/bookmarks') {
    loadProfileView('bookmarks');
  } else if (hash === '#/settings') {
    loadProfileView('settings');
  } else {
    switchView('feed');
    loadFeed();
  }
}
