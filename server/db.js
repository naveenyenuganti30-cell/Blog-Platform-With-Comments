import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const dbPath = path.join(__dirname, 'blog.db');

export const db = new DatabaseSync(dbPath);

export function initDatabase() {
  // Enable foreign keys
  db.exec('PRAGMA foreign_keys = ON;');

  // Users table
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      full_name TEXT NOT NULL,
      avatar_url TEXT,
      bio TEXT,
      role TEXT DEFAULT 'author',
      theme_preference TEXT DEFAULT 'dark',
      email_notifications INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Column migrations for existing databases
  try {
    const userColumns = db.prepare("PRAGMA table_info(users)").all();
    const colNames = userColumns.map(c => c.name);
    if (!colNames.includes('theme_preference')) {
      db.exec("ALTER TABLE users ADD COLUMN theme_preference TEXT DEFAULT 'dark'");
    }
    if (!colNames.includes('email_notifications')) {
      db.exec("ALTER TABLE users ADD COLUMN email_notifications INTEGER DEFAULT 1");
    }
  } catch (err) {
    console.error('User migration error:', err);
  }

  // Posts table
  db.exec(`
    CREATE TABLE IF NOT EXISTS posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      excerpt TEXT,
      content TEXT NOT NULL,
      cover_image TEXT,
      category TEXT NOT NULL DEFAULT 'General',
      tags TEXT,
      read_time TEXT DEFAULT '3 min read',
      author_id INTEGER NOT NULL,
      status TEXT DEFAULT 'published',
      views INTEGER DEFAULT 0,
      likes_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE
    );
  `);

  // Comments table (supports hierarchical nested comments with parent_id)
  db.exec(`
    CREATE TABLE IF NOT EXISTS comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      parent_id INTEGER,
      content TEXT NOT NULL,
      likes_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE,
      FOREIGN KEY (author_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (parent_id) REFERENCES comments (id) ON DELETE CASCADE
    );
  `);

  // Post Likes table (tracks which users liked which posts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS post_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
    );
  `);

  // Comment Likes table
  db.exec(`
    CREATE TABLE IF NOT EXISTS comment_likes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      comment_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, comment_id),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (comment_id) REFERENCES comments (id) ON DELETE CASCADE
    );
  `);

  // Bookmarks table
  db.exec(`
    CREATE TABLE IF NOT EXISTS bookmarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      post_id INTEGER NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(user_id, post_id),
      FOREIGN KEY (user_id) REFERENCES users (id) ON DELETE CASCADE,
      FOREIGN KEY (post_id) REFERENCES posts (id) ON DELETE CASCADE
    );
  `);

  // Performance Indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_posts_status_created ON posts(status, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_posts_author ON posts(author_id);
    CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
    CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
    CREATE INDEX IF NOT EXISTS idx_post_likes_user_post ON post_likes(user_id, post_id);
    CREATE INDEX IF NOT EXISTS idx_bookmarks_user_post ON bookmarks(user_id, post_id);
  `);

  seedDefaultData();
}

function seedDefaultData() {
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount > 0) return;

  console.log('🌱 Seeding default users, posts, and interactive comments...');

  const defaultPassword = 'password123';
  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(defaultPassword, salt);

  // Insert Users
  const insertUser = db.prepare(`
    INSERT INTO users (username, email, password_hash, full_name, avatar_url, bio, role)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);

  insertUser.run(
    'elena_vance',
    'elena@pulseblog.dev',
    passwordHash,
    'Dr. Elena Vance',
    'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=250&q=80',
    'AI Research Scientist & Distributed Systems Architect. Writing on synthetic intelligence and next-gen tech.',
    'admin'
  );

  insertUser.run(
    'marcus_dev',
    'marcus@pulseblog.dev',
    passwordHash,
    'Marcus Thorne',
    'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=250&q=80',
    'Staff Frontend Engineer specializing in WebGL, CSS Architecture, and micro-interactions.',
    'author'
  );

  insertUser.run(
    'sophia_ux',
    'sophia@pulseblog.dev',
    passwordHash,
    'Sophia Laurent',
    'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=250&q=80',
    'Principal Product Designer exploring tactile glassmorphic interfaces and spatial UI design.',
    'author'
  );

  // Insert Seed Posts
  const insertPost = db.prepare(`
    INSERT INTO posts (slug, title, excerpt, content, cover_image, category, tags, read_time, author_id, views, likes_count, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  insertPost.run(
    'autonomous-ai-agents-orchestration-patterns-2026',
    'Autonomous AI Agents: Orchestration Patterns and Architectural Pitfalls',
    'A deep dive into multi-agent consensus protocols, state drift prevention, and memory graph architectures that power real-world cognitive workflows.',
    `# Autonomous AI Agents: Orchestration Patterns and Architectural Pitfalls

Over the past two years, the landscape of software engineering has shifted from single-turn LLM completions to **autonomous multi-agent workflows**. But orchestrating cooperating agents at enterprise scale reveals critical engineering challenges that simple prompt chaining cannot solve.

---

## 1. The Core Challenge: Semantic State Drift

When multiple agents collaborate across distributed tasks, context windows become lossy communication channels. Each intermediate agent introduces subtle hallucinations that compound over long trajectories:

\`\`\`javascript
// Agent Communication Interface
interface AgentEnvelope<T = unknown> {
  traceId: string;
  senderRole: 'architect' | 'executor' | 'validator';
  payload: T;
  confidenceScore: number;
  epistemicContext: Map<string, FactAssertion>;
}
\`\`\`

To mitigate drift, production agent meshes rely on **typed contract checkpoints** rather than unstructured natural language dialogue.

### Recommended Architectural Rules:
- **Immutable Context Logs**: Treat all agent interactions as append-only event streams.
- **Deterministic Tool Calling**: Validate tool outputs against strict JSON Schemas prior to injecting them into context.
- **Ephemeral Sandbox Execution**: Run any dynamic shell or python evaluation inside isolated microVMs.

---

## 2. Memory Graphs vs Flat Vector Search

Traditional RAG systems flatten contextual memory into cosine similarity vectors. For complex agent loops, this produces catastrophic failure modes where recent corrections are superseded by historically dense passages.

> **Key Insight**: Memory graphs must capture directional causality (A caused B which invalidated C) rather than pure lexical similarity.

\`\`\`
[User Goal] 
    └──► [Planning Agent] 
              ├──► [Code Synthesizer] 
              │          └──► [Static Linter]
              └──► [Automated Tester] ◄──┘
\`\`\`

---

## 3. Human-in-the-Loop Safeguards

No mission-critical system should operate fully dark. Designing **ambient interruption channels** where human supervisors can steer or rollback agent actions in real time is the defining hallmark of mature agentic software.

What patterns are you implementing in your teams? Share your architecture in the comments below!`,
    '/assets/images/tech-future.jpg',
    'Artificial Intelligence',
    'AI,Agents,Architecture,Machine Learning',
    '7 min read',
    1,
    342,
    48,
    'published'
  );

  insertPost.run(
    'tactile-glassmorphic-design-renaissance',
    'The Renaissance of Tactile & Glassmorphic Design Systems',
    'Why flat minimalism is giving way to dimensional depth, physical tactile cues, and dynamic ambient lighting in modern web interfaces.',
    `# The Renaissance of Tactile & Glassmorphic Design Systems

For over a decade, flat design dominated our screens. While it solved early mobile responsiveness, it also stripped digital interfaces of emotional resonance, tactile affordance, and visual delight.

Today, we are witnessing a renaissance: **hyper-refined glassmorphism, dynamic backdrop diffusion, and responsive light-reactive surfaces**.

---

## Why Tactility Matters in 2026

Modern OLED and high-PPI displays render subtle light refraction with photorealistic fidelity. Users naturally respond to visual hierarchy rooted in physical intuition:

1. **Elevation through Luminescence**: Instead of muddy drop shadows, elevated surfaces project soft chromatic ambient glows.
2. **Contextual Translucency**: Glass layers communicate spatial relationships without obscuring background state.
3. **Micro-tactile Feedback**: Interactive buttons depress smoothly and reflect ambient cursor direction.

---

## Building a Production Glassmorphic Card

Here is how we construct high-performance translucent surfaces using pure CSS modern primitives:

\`\`\`css
.glass-panel {
  background: rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(16px) saturate(180%);
  -webkit-backdrop-filter: blur(16px) saturate(180%);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  box-shadow: 
    0 8px 32px 0 rgba(0, 0, 0, 0.37),
    inset 0 1px 1px 0 rgba(255, 255, 255, 0.2);
  transition: transform 0.25s cubic-bezier(0.16, 1, 0.3, 1),
              box-shadow 0.25s ease;
}

.glass-panel:hover {
  transform: translateY(-4px);
  border-color: rgba(255, 255, 255, 0.25);
  box-shadow: 0 16px 48px -8px rgba(99, 102, 241, 0.25);
}
\`\`\`

> "Good design is not just what looks good; it is what feels undeniably alive under your fingertips."

Try toggling between Dark and Light mode using the sun/moon button in the top navigation to observe how this palette seamlessly adapts!`,
    '/assets/images/design-workspace.jpg',
    'Design',
    'UI/UX,CSS,Design Systems,Glassmorphism',
    '5 min read',
    3,
    512,
    82,
    'published'
  );

  insertPost.run(
    'building-scalable-distributed-systems-modern-node',
    'Building Ultra-Fast Distributed APIs with Modern Node.js',
    'Harnessing native SQLite, asynchronous streaming, connection multiplexing, and zero-dependency microservices for blazing response times.',
    `# Building Ultra-Fast Distributed APIs with Modern Node.js

Node.js has evolved dramatically with recent releases. With native features like built-in SQLite (\`node:sqlite\`), ES Modules, native test runners, and WebStreams, creating high-throughput web APIs no longer requires heavy external tooling.

---

## The Zero-Dependency Philosophy

Why pull in massive heavyweight dependencies when the Node runtime now delivers production-grade native capabilities?

Let's look at how fast embedded databases provide sub-millisecond query execution:

\`\`\`javascript
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync('data.db');
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA synchronous = NORMAL;');

const getPost = db.prepare('SELECT * FROM posts WHERE slug = ?');
const post = getPost.get('my-post-slug');
\`\`\`

---

## 3 Pillars of Distributed Performance:
1. **WAL Mode (Write-Ahead Logging)**: Allows concurrent readers without blocking writes.
2. **Predictable Memory Footprints**: Using streaming pipelines to deliver payloads without buffer exhaustion.
3. **Clean RESTful Contracts**: Consistent error envelopes and stateless JWT token authentication.

We built this very blog platform on these exact principles! Inspect the network tab to see instant sub-10ms response times.`,
    '/assets/images/coding-matrix.jpg',
    'Engineering',
    'Node.js,SQLite,Backend,Performance,APIs',
    '6 min read',
    2,
    428,
    63,
    'published'
  );

  // Insert Comments (including threaded replies)
  const insertComment = db.prepare(`
    INSERT INTO comments (post_id, author_id, parent_id, content, likes_count)
    VALUES (?, ?, ?, ?, ?)
  `);

  // Top level comment on Post 1
  insertComment.run(
    1,
    2,
    null,
    'Incredible breakdown, Elena! The point on semantic state drift is spot on. We encountered this exact issue when our orchestrator looped more than 4 times. Implementing typed contracts cut our hallucination rate by over 60%.',
    14
  );

  // Reply to comment 1
  insertComment.run(
    1,
    1,
    1,
    'Thanks Marcus! Yes, once teams switch to structured schema enforcement between agent steps, the reliability jump is night and day.',
    8
  );

  // Top level comment on Post 1
  insertComment.run(
    1,
    3,
    null,
    'How do you handle human intervention latency when an agent is waiting for approval in an interactive user flow? Does the session hold state in Redis?',
    6
  );

  // Reply to comment 3
  insertComment.run(
    1,
    1,
    3,
    'Great question Sophia. We serialize the execution tree into SQLite or Postgres as an awaiting-review status, so no active worker thread is blocked!',
    5
  );

  // Comments on Post 2 (Design)
  insertComment.run(
    2,
    1,
    null,
    'The subtle inset box-shadow trick for simulated glass refraction is brilliant. It gives that authentic 3D edge highlight without heavy WebGL shaders.',
    12
  );

  insertComment.run(
    2,
    2,
    null,
    'Can confirm this renders smoothly even on mobile devices at 120Hz. Fantastic CSS architecture!',
    9
  );

  // Likes and Bookmarks seeds
  const insertLike = db.prepare('INSERT OR IGNORE INTO post_likes (user_id, post_id) VALUES (?, ?)');
  insertLike.run(1, 1);
  insertLike.run(2, 1);
  insertLike.run(3, 1);
  insertLike.run(1, 2);
  insertLike.run(2, 2);
  insertLike.run(1, 3);

  const insertBookmark = db.prepare('INSERT OR IGNORE INTO bookmarks (user_id, post_id) VALUES (?, ?)');
  insertBookmark.run(1, 2);
  insertBookmark.run(2, 1);

  console.log('✅ Database initialization and seed completed successfully.');
}
