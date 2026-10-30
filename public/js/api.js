// API Client for PulseBlog RESTful Backend
const API_BASE = '/api';

export const api = {
  getToken() {
    return localStorage.getItem('pulseblog_token');
  },

  setToken(token) {
    if (token) {
      localStorage.setItem('pulseblog_token', token);
    } else {
      localStorage.removeItem('pulseblog_token');
    }
  },

  async request(endpoint, options = {}) {
    const headers = {
      ...(options.headers || {})
    };

    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json';
    }

    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const config = {
      ...options,
      headers
    };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Request failed. Please try again.');
      }

      return data;
    } catch (err) {
      console.error(`API Error on [${options.method || 'GET'} ${endpoint}]:`, err);
      throw err;
    }
  },

  // Auth Endpoints
  async register(userData) {
    const res = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData)
    });
    if (res.token) this.setToken(res.token);
    return res;
  },

  async login(identifier, password) {
    const res = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ identifier, password })
    });
    if (res.token) this.setToken(res.token);
    return res;
  },

  logout() {
    this.setToken(null);
  },

  async getMe() {
    return this.request('/auth/me');
  },

  async updateProfile(profileData) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData)
    });
  },

  async changePassword(passwords) {
    return this.request('/auth/password', {
      method: 'PUT',
      body: JSON.stringify(passwords)
    });
  },

  async getSettings() {
    return this.request('/auth/settings');
  },

  async updateSettings(settings) {
    return this.request('/auth/settings', {
      method: 'PUT',
      body: JSON.stringify(settings)
    });
  },

  // Posts Endpoints
  async getPosts(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.category && params.category !== 'All') query.append('category', params.category);
    if (params.tag) query.append('tag', params.tag);
    if (params.author_id) query.append('author_id', params.author_id);
    if (params.sort) query.append('sort', params.sort);
    if (params.status) query.append('status', params.status);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);

    const queryString = query.toString() ? `?${query.toString()}` : '';
    return this.request(`/posts${queryString}`);
  },

  async getPostBySlug(slugOrId) {
    return this.request(`/posts/${slugOrId}`);
  },

  async createPost(postData) {
    return this.request('/posts', {
      method: 'POST',
      body: JSON.stringify(postData)
    });
  },

  async updatePost(id, postData) {
    return this.request(`/posts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(postData)
    });
  },

  async deletePost(id) {
    return this.request(`/posts/${id}`, {
      method: 'DELETE'
    });
  },

  async togglePostLike(id) {
    return this.request(`/posts/${id}/like`, {
      method: 'POST'
    });
  },

  async togglePostBookmark(id) {
    return this.request(`/posts/${id}/bookmark`, {
      method: 'POST'
    });
  },

  async getBookmarks() {
    return this.request('/posts/user/bookmarks');
  },

  async getDrafts() {
    return this.request('/posts/user/drafts');
  },

  async getUserPosts() {
    return this.request('/posts/user/published');
  },

  async uploadCover(file) {
    const formData = new FormData();
    formData.append('image', file);
    return this.request('/posts/upload-cover', {
      method: 'POST',
      body: formData
    });
  },

  // Comments Endpoints
  async getComments(postId) {
    return this.request(`/comments/post/${postId}`);
  },

  async addComment(postId, content, parentId = null) {
    return this.request(`/comments/post/${postId}`, {
      method: 'POST',
      body: JSON.stringify({ content, parent_id: parentId })
    });
  },

  async toggleCommentLike(commentId) {
    return this.request(`/comments/${commentId}/like`, {
      method: 'POST'
    });
  },

  async deleteComment(commentId) {
    return this.request(`/comments/${commentId}`, {
      method: 'DELETE'
    });
  },

  // Stats Endpoints
  async getStats() {
    return this.request('/stats/overview');
  },

  async getTrending(limit = 5) {
    return this.request(`/stats/trending?limit=${limit}`);
  },

  async getAuthorStats(authorId) {
    return this.request(`/stats/author/${authorId}`);
  },

  async getTags() {
    return this.request('/stats/tags');
  },

  async getActivity(limit = 10) {
    return this.request(`/stats/activity?limit=${limit}`);
  }
};
