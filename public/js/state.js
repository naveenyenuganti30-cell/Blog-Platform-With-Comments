// Global Reactive State Store for PulseBlog
export const state = {
  user: null,
  theme: localStorage.getItem('pulseblog_theme') || 'dark',
  posts: [],
  featuredPost: null,
  stats: null,
  currentPost: null,
  comments: [],
  bookmarks: [],
  filters: {
    search: '',
    category: 'All',
    sort: 'latest'
  },
  editingPostId: null,

  listeners: new Set(),

  subscribe(listener) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  },

  notify(event, data) {
    this.listeners.forEach(cb => cb(event, data));
  },

  setUser(user) {
    this.user = user;
    this.notify('user:changed', user);
  },

  setTheme(theme) {
    this.theme = theme;
    localStorage.setItem('pulseblog_theme', theme);
    document.documentElement.setAttribute('data-theme', theme);
    this.notify('theme:changed', theme);
  },

  toggleTheme() {
    this.setTheme(this.theme === 'dark' ? 'light' : 'dark');
  },

  setPosts(posts) {
    this.posts = posts;
    if (posts.length > 0) {
      // Pick highest liked or latest post as featured spotlight
      this.featuredPost = [...posts].sort((a, b) => b.likes_count - a.likes_count)[0];
    } else {
      this.featuredPost = null;
    }
    this.notify('posts:updated', posts);
  },

  setCurrentPost(post) {
    this.currentPost = post;
    this.notify('post:changed', post);
  },

  setComments(comments) {
    this.comments = comments;
    this.notify('comments:updated', comments);
  },

  setFilters(newFilters) {
    this.filters = { ...this.filters, ...newFilters };
    this.notify('filters:changed', this.filters);
  }
};
