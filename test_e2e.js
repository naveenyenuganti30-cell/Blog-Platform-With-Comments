// End-to-end Verification Script for PulseBlog Platform
const BASE_URL = 'http://localhost:5000';

async function testSuite() {
  console.log('🚀 Starting PulseBlog E2E Automated Verification...\n');
  let token = '';
  let createdPostId = null;
  let createdPostSlug = '';
  let topCommentId = null;
  let replyCommentId = null;

  // 1. Health Check
  console.log('1️⃣ Checking Health Endpoint...');
  const healthRes = await fetch(`${BASE_URL}/api/health`);
  const health = await healthRes.json();
  if (health.status !== 'online') throw new Error('Health check failed');
  console.log('   ✅ Health status: online, Node:', health.nodeVersion);

  // 2. Static Asset Check (index.html, CSS, generated images)
  console.log('2️⃣ Verifying Static File Serving...');
  const htmlRes = await fetch(`${BASE_URL}/index.html`);
  if (!htmlRes.ok || !(await htmlRes.text()).includes('PulseBlog')) throw new Error('index.html failed');
  const imgRes = await fetch(`${BASE_URL}/assets/images/tech-future.jpg`);
  if (!imgRes.ok) throw new Error('tech-future.jpg failed');
  console.log('   ✅ HTML and generated hero assets served with status 200');

  // 3. User Login with Demo Account
  console.log('3️⃣ Testing User Authentication (Login)...');
  const loginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'elena@pulseblog.dev', password: 'password123' })
  });
  const loginData = await loginRes.json();
  if (!loginRes.ok || !loginData.token) throw new Error(`Login failed: ${loginData.error}`);
  token = loginData.token;
  console.log('   ✅ Logged in successfully as:', loginData.user.full_name, `(Role: ${loginData.user.role})`);

  // 4. Verify /api/auth/me
  console.log('4️⃣ Testing /api/auth/me token authorization...');
  const meRes = await fetch(`${BASE_URL}/api/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const meData = await meRes.json();
  if (!meRes.ok) throw new Error('Auth me failed');
  console.log('   ✅ Verified token session for user:', meData.user.username);

  // 5. Create a New Blog Post
  console.log('5️⃣ Testing Blog Post Creation (POST /api/posts)...');
  const newPostPayload = {
    title: 'Testing Real-time Collaborative Web Applications in 2026',
    excerpt: 'An exploratory review of state synchronization, operational transformation, and reactive UI architecture.',
    content: `# Testing Real-time Systems\n\nCollaborative applications require high throughput and minimal latency.\n\n\`\`\`javascript\nconst ws = new WebSocket('wss://api.example.com');\nws.send(JSON.stringify({ type: 'sync' }));\n\`\`\`\n\n> "Consistency and partition tolerance define modern state engines."`,
    category: 'Engineering',
    tags: 'WebSockets,Engineering,Architecture',
    cover_image: '/assets/images/coding-matrix.jpg',
    status: 'published'
  };

  const createPostRes = await fetch(`${BASE_URL}/api/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(newPostPayload)
  });
  const createPostData = await createPostRes.json();
  if (!createPostRes.ok) throw new Error(`Create post failed: ${createPostData.error}`);
  createdPostId = createPostData.post.id;
  createdPostSlug = createPostData.post.slug;
  console.log('   ✅ Post created:', createPostData.post.title, `(ID: ${createdPostId}, Slug: ${createdPostSlug})`);

  // 6. Fetch the Created Post by Slug
  console.log('6️⃣ Fetching post by slug (GET /api/posts/:slug)...');
  const getPostRes = await fetch(`${BASE_URL}/api/posts/${createdPostSlug}`);
  const getPostData = await getPostRes.json();
  if (!getPostRes.ok || getPostData.post.id !== createdPostId) throw new Error('Fetch by slug failed');
  console.log('   ✅ Fetched post with views:', getPostData.post.views, 'Author:', getPostData.post.author_name);

  // 7. Like the Post
  console.log('7️⃣ Toggling Post Like (POST /api/posts/:id/like)...');
  const likeRes = await fetch(`${BASE_URL}/api/posts/${createdPostId}/like`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const likeData = await likeRes.json();
  if (!likeRes.ok || !likeData.is_liked) throw new Error('Post like failed');
  console.log('   ✅ Post liked! New count:', likeData.likes_count);

  // 8. Bookmark the Post
  console.log('8️⃣ Toggling Post Bookmark (POST /api/posts/:id/bookmark)...');
  const bkmkRes = await fetch(`${BASE_URL}/api/posts/${createdPostId}/bookmark`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const bkmkData = await bkmkRes.json();
  if (!bkmkRes.ok || !bkmkData.is_bookmarked) throw new Error('Bookmark toggle failed');
  console.log('   ✅ Post bookmarked! Message:', bkmkData.message);

  // 9. Add Top-Level Comment
  console.log('9️⃣ Adding Top-Level Comment (POST /api/comments/post/:postId)...');
  const commentRes = await fetch(`${BASE_URL}/api/comments/post/${createdPostId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ content: 'Exciting insights! How do you handle conflict resolution with simultaneous typing?' })
  });
  const commentData = await commentRes.json();
  if (!commentRes.ok) throw new Error(`Add comment failed: ${commentData.error}`);
  topCommentId = commentData.comment.id;
  console.log('   ✅ Top-level comment added (ID:', topCommentId, ')');

  // 10. Add Threaded Nested Reply
  console.log('🔟 Adding Threaded Reply to Comment (parent_id)...');
  const replyRes = await fetch(`${BASE_URL}/api/comments/post/${createdPostId}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ content: 'We employ CRDTs (Conflict-free Replicated Data Types) for zero-lock merging!', parent_id: topCommentId })
  });
  const replyData = await replyRes.json();
  if (!replyRes.ok) throw new Error(`Reply failed: ${replyData.error}`);
  replyCommentId = replyData.comment.id;
  console.log('   ✅ Nested reply added (ID:', replyCommentId, 'Parent ID:', topCommentId, ')');

  // 11. Like a Comment
  console.log('1️⃣1️⃣ Upvoting/Liking Comment...');
  const cLikeRes = await fetch(`${BASE_URL}/api/comments/${topCommentId}/like`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const cLikeData = await cLikeRes.json();
  if (!cLikeRes.ok || !cLikeData.is_liked) throw new Error('Comment like failed');
  console.log('   ✅ Comment liked! New like count:', cLikeData.likes_count);

  // 12. Fetch Comments Tree
  console.log('1️⃣2️⃣ Fetching Nested Comments Tree...');
  const treeRes = await fetch(`${BASE_URL}/api/comments/post/${createdPostId}`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const treeData = await treeRes.json();
  if (!treeRes.ok || treeData.total !== 2 || treeData.comments[0].replies.length !== 1) {
    throw new Error('Comments tree hierarchy structure mismatch');
  }
  console.log('   ✅ Verified nested comments tree: 1 root with', treeData.comments[0].replies.length, 'nested reply');

  // 13. Edit the Post
  console.log('1️⃣3️⃣ Editing the Blog Post (PUT /api/posts/:id)...');
  const updateRes = await fetch(`${BASE_URL}/api/posts/${createdPostId}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ title: 'Testing Real-time Collaborative Web Applications in 2026 (Updated Edition)' })
  });
  const updateData = await updateRes.json();
  if (!updateRes.ok || !updateData.post.title.includes('Updated Edition')) throw new Error('Post update failed');
  console.log('   ✅ Post updated title to:', updateData.post.title);

  // 14. Delete the Nested Reply
  console.log('1️⃣4️⃣ Deleting Comment (DELETE /api/comments/:id)...');
  const delCommentRes = await fetch(`${BASE_URL}/api/comments/${replyCommentId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` }
  });
  if (!delCommentRes.ok) throw new Error('Delete comment failed');
  console.log('   ✅ Nested reply deleted cleanly');

  // 15. Verify Stats Overview
  console.log('1️⃣5️⃣ Verifying Platform Stats (GET /api/stats/overview)...');
  const statsRes = await fetch(`${BASE_URL}/api/stats/overview`);
  const statsData = await statsRes.json();
  if (!statsRes.ok || statsData.metrics.posts < 4) throw new Error('Stats overview failed');
  console.log('   ✅ Platform stats verified! Total articles:', statsData.metrics.posts, 'Categories count:', statsData.categories.length);

  // 16. Test Pagination API
  console.log('1️⃣6️⃣ Testing Posts Pagination API (GET /api/posts?page=1&limit=2)...');
  const pageRes = await fetch(`${BASE_URL}/api/posts?page=1&limit=2`);
  const pageData = await pageRes.json();
  if (!pageRes.ok || pageData.page !== 1 || pageData.limit !== 2 || !pageData.totalPages || pageData.posts.length > 2) {
    throw new Error('Pagination response format mismatch');
  }
  console.log('   ✅ Pagination verified: Page', pageData.page, 'of', pageData.totalPages, `(Total: ${pageData.total}, hasMore: ${pageData.hasMore})`);

  // 17. Test Drafts Management API
  console.log('1️⃣7️⃣ Testing Post Drafts (Create draft & GET /api/posts/user/drafts)...');
  const draftCreateRes = await fetch(`${BASE_URL}/api/posts`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      title: 'Architecting Resilient Distributed Cache Invalidation',
      content: 'Draft content for testing drafts workflow...',
      status: 'draft',
      category: 'Engineering'
    })
  });
  const draftCreateData = await draftCreateRes.json();
  if (!draftCreateRes.ok || draftCreateData.post.status !== 'draft') throw new Error('Create draft failed');

  const draftsListRes = await fetch(`${BASE_URL}/api/posts/user/drafts`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const draftsListData = await draftsListRes.json();
  if (!draftsListRes.ok || !draftsListData.posts.some(d => d.id === draftCreateData.post.id)) {
    throw new Error('Draft not found in user drafts');
  }
  console.log('   ✅ Draft post created and retrieved from /api/posts/user/drafts! (ID:', draftCreateData.post.id, ')');

  // 18. Test User Settings Preferences API
  console.log('1️⃣8️⃣ Testing User Settings (GET/PUT /api/auth/settings)...');
  const settingsUpdateRes = await fetch(`${BASE_URL}/api/auth/settings`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      theme_preference: 'light',
      email_notifications: true
    })
  });
  const settingsUpdateData = await settingsUpdateRes.json();
  if (!settingsUpdateRes.ok || settingsUpdateData.settings.theme_preference !== 'light') {
    throw new Error('Update settings failed');
  }

  const settingsGetRes = await fetch(`${BASE_URL}/api/auth/settings`, {
    headers: { 'Authorization': `Bearer ${token}` }
  });
  const settingsGetData = await settingsGetRes.json();
  if (!settingsGetRes.ok || settingsGetData.settings.theme_preference !== 'light') {
    throw new Error('Get settings failed');
  }
  console.log('   ✅ User settings preferences verified: Theme =', settingsGetData.settings.theme_preference, 'Notifications =', settingsGetData.settings.email_notifications);

  // 19. Test Password Update API
  console.log('1️⃣9️⃣ Testing Password Update API (PUT /api/auth/password)...');
  const pwdRes = await fetch(`${BASE_URL}/api/auth/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      current_password: 'password123',
      new_password: 'newpassword456'
    })
  });
  const pwdData = await pwdRes.json();
  if (!pwdRes.ok) throw new Error('Password update failed');

  // Verify login with new password
  const testNewLoginRes = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: 'elena@pulseblog.dev', password: 'newpassword456' })
  });
  if (!testNewLoginRes.ok) throw new Error('Login with new password failed');
  
  // Revert back to original password123 for demo consistency
  const testNewLoginData = await testNewLoginRes.json();
  await fetch(`${BASE_URL}/api/auth/password`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${testNewLoginData.token}`
    },
    body: JSON.stringify({
      current_password: 'newpassword456',
      new_password: 'password123'
    })
  });
  console.log('   ✅ Password update and re-verification successful (reverted to password123)');

  // 20. Test Advanced Trending & Tags Analytics
  console.log('2️⃣0️⃣ Testing Advanced Analytics (/api/stats/trending & /api/stats/tags)...');
  const trendingRes = await fetch(`${BASE_URL}/api/stats/trending?limit=3`);
  const trendingData = await trendingRes.json();
  if (!trendingRes.ok || !Array.isArray(trendingData.trending) || trendingData.trending.length === 0) {
    throw new Error('Trending stats failed');
  }

  const tagsRes = await fetch(`${BASE_URL}/api/stats/tags`);
  const tagsData = await tagsRes.json();
  if (!tagsRes.ok || !Array.isArray(tagsData.tags) || tagsData.tags.length === 0) {
    throw new Error('Tags stats failed');
  }
  console.log('   ✅ Trending posts count:', trendingData.trending.length, 'Top tag:', tagsData.tags[0].name, `(${tagsData.tags[0].count} posts)`);

  // 21. Test Author Deep Analytics & Activity Stream
  console.log('2️⃣1️⃣ Testing Author Analytics & Activity Stream (/api/stats/author/:id & /activity)...');
  const authorRes = await fetch(`${BASE_URL}/api/stats/author/1`);
  const authorData = await authorRes.json();
  if (!authorRes.ok || !authorData.analytics || authorData.analytics.published_posts === undefined) {
    throw new Error('Author stats failed');
  }

  const actRes = await fetch(`${BASE_URL}/api/stats/activity?limit=5`);
  const actData = await actRes.json();
  if (!actRes.ok || !Array.isArray(actData.activity)) {
    throw new Error('Activity stream failed');
  }
  console.log('   ✅ Author analytics verified for:', authorData.author.full_name, `(Views: ${authorData.analytics.total_views}, Likes: ${authorData.analytics.total_likes})`);
  console.log('   ✅ Activity stream verified:', actData.activity.length, 'recent events');

  console.log('\n🎉 ALL 21 END-TO-END VERIFICATION TESTS PASSED WITH 100% SUCCESS!');
}

testSuite().catch(err => {
  console.error('\n❌ E2E Test Failure:', err.message);
  process.exit(1);
});
