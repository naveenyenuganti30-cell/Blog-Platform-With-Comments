# 🌟 PulseBlog — Modern Full-Stack Blogging Platform with Interactive Comments

PulseBlog is a high-performance, full-stack publishing and blogging platform built with modern web technologies, featuring rich editorial tools, nested comment threads, user authentication, and responsive glassmorphic aesthetics.

---

## ✨ Key Features

### 1. 🔐 User Authentication & Authorization
- **JWT-Based Authentication**: Secure stateless token issuance and verification.
- **Password Security**: Strong hashing with `bcryptjs`.
- **Role-Based Access Control**: `admin` and `author` roles for editorial permissions.
- **1-Click Demo Accounts**: Pre-configured instant demo login buttons for seamless testing.
- **User Profiles**: Manage profile information (full name, avatar, bio, and social metadata).

### 2. 📝 Full CRUD Blog Post Management
- **Rich Markdown Editor**: Format articles with headers, blockquotes, syntax-highlighted code blocks, lists, and links.
- **Live Side-by-Side Preview**: Real-time markdown preview switcher before publishing.
- **Curated High-Res Hero Banners**: Select from generated hero banners, upload custom images, or paste external URLs.
- **Reading Time Estimation**: Dynamic reading time calculation based on word count.
- **Publish Status**: Support for both `draft` and `published` states.
- **Search & Filter Controls**: Real-time search by keyword, filter by categories, and sort by latest, popularity, views, or comments.

### 3. 💬 Interactive Threaded Comments Section
- **Hierarchical Discussion Tree**: Supports multi-level nested replies (`parent_id`).
- **Interactive Reactions**: Like/upvote comments with real-time counter updates.
- **Author Attribution**: User avatars, role badges (`Admin`, `Author`), and relative timestamps (`2h ago`, `Just now`).
- **Moderation**: Authors and admins can remove inappropriate comments.

### 4. ⚡ Modern RESTful Backend & Database Integration
- **Node.js & Express**: Modular routing structure (`auth`, `posts`, `comments`, `stats`).
- **Native SQLite Integration**: Powered by Node 24's built-in `node:sqlite` (`DatabaseSync`), requiring zero external database configuration or native compilation toolchains.
- **Automatic Schema & Seeding**: Auto-initializes tables and seeds initial high-quality articles, authors, and comments.

### 5. 🎨 Design & Aesthetic Excellence
- **Dark & Light Mode**: Seamless theme switching with persistent localStorage settings.
- **Curated Color Tokens**: HSL tailored palette with vibrant gradients, subtle borders, and glowing elevation.
- **Glassmorphic Card Surfaces**: Translucent backdrop blur (`backdrop-filter: blur(16px)`).
- **Responsive Reading Progress Bar**: Real-time article reading progress bar pinned to the top of the viewport.

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** v22.0.0+ (Node v24 recommended)
- **npm** v10+

### Installation & Launch

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the server**:
   ```bash
   npm start
   ```
   *Or for auto-reloading during development:*
   ```bash
   npm run dev
   ```

3. **Open the application**:
   Navigate to [http://localhost:5000](http://localhost:5000) in your web browser.

---

## 👥 Demo Accounts (Instant 1-Click Login)

The platform comes pre-seeded with three demo accounts:

| Name | Role | Email | Password |
|---|---|---|---|
| **Dr. Elena Vance** | Admin | `elena@pulseblog.dev` | `password123` |
| **Marcus Thorne** | Author / Staff Engineer | `marcus@pulseblog.dev` | `password123` |
| **Sophia Laurent** | Author / Lead Designer | `sophia@pulseblog.dev` | `password123` |

---

## 📡 RESTful API Reference

### Authentication (`/api/auth`)
- `POST /api/auth/register` — Create a new user account
- `POST /api/auth/login` — Sign in and obtain JWT token
- `GET /api/auth/me` — Retrieve authenticated user profile and stats
- `PUT /api/auth/profile` — Update name, bio, avatar, or preferences
- `PUT /api/auth/password` — Change password securely *(Auth required)*
- `GET /api/auth/settings` — Retrieve user preferences (theme, notifications) *(Auth required)*
- `PUT /api/auth/settings` — Update user preferences *(Auth required)*

### Blog Posts (`/api/posts`)
- `GET /api/posts` — Query posts with `search`, `category`, `tag`, `sort`, `page`, and `limit` (returns pagination metadata)
- `GET /api/posts/:slugOrId` — Fetch post details, view counter, and related articles
- `POST /api/posts` — Create a new blog post *(Auth required)*
- `PUT /api/posts/:id` — Edit an existing post *(Author or Admin only)*
- `DELETE /api/posts/:id` — Delete a post *(Author or Admin only)*
- `POST /api/posts/:id/like` — Toggle post like reaction *(Auth required)*
- `POST /api/posts/:id/bookmark` — Toggle post bookmark saved state *(Auth required)*
- `GET /api/posts/user/bookmarks` — Fetch current user's bookmarked articles *(Auth required)*
- `GET /api/posts/user/drafts` — Fetch current author's draft articles *(Auth required)*
- `GET /api/posts/user/published` — Fetch current author's published articles *(Auth required)*
- `POST /api/posts/upload-cover` — Upload image file for article cover *(Auth required)*

### Comments (`/api/comments`)
- `GET /api/comments/post/:postId` — Get threaded nested comments for a post
- `POST /api/comments/post/:postId` — Add comment or nested reply *(Auth required)*
- `POST /api/comments/:id/like` — Toggle comment like upvote *(Auth required)*
- `DELETE /api/comments/:id` — Delete a comment *(Author or Admin only)*

### Stats & Advanced Analytics (`/api/stats`)
- `GET /api/stats/overview` — Platform metrics, category counts, and top authors
- `GET /api/stats/trending` — Top trending articles ranked by composite engagement score
- `GET /api/stats/author/:authorId` — Author deep-dive performance metrics (views, likes, comments, categories, top post)
- `GET /api/stats/tags` — Aggregated tag frequency analysis across published articles
- `GET /api/stats/activity` — Real-time platform activity stream of recent posts and comments

