require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { Pool } = require('pg');
const crypto = require('crypto');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: ['http://localhost:3000', 'http://localhost:3001', 'http://127.0.0.1:5500'],
    methods: ['GET', 'POST']
  }
});
const pool = new Pool({
  host: process.env.PGHOST,
  port: process.env.PGPORT,
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE,
});

// JWT secret
const JWT_SECRET = process.env.JWT_SECRET || 'admin-chat-secret-key';

app.use(cors());
app.use(express.json());

// 🔍 1. Ініціалізація (отримати/створити anonymous_id)
app.get('/api/init', (req, res) => {
  let anonId = req.headers['x-anonymous-id'];
  if (!anonId) {
    anonId = crypto.randomUUID();
    res.setHeader('X-Anonymous-Id', anonId);
  }
  res.json({ anonymous_id: anonId });
});

// 🔐 2. Старт чату (або продовження)
app.post('/api/conversation/start', async (req, res) => {
  const { anonymous_id } = req.body;

  if (!anonymous_id) {
    return res.status(400).json({ error: 'Missing anonymous_id' });
  }

  try {
    // Спробуємо вставити — якщо існує — нічого не змінюємо
    await pool.query(
      `INSERT INTO customers (anonymous_id) VALUES ($1) 
       ON CONFLICT (anonymous_id) DO NOTHING`,
      [anonymous_id]
    );

    // Отримати customer
    const customerRes = await pool.query(
      'SELECT id FROM customers WHERE anonymous_id = $1',
      [anonymous_id]
    );
    const customer = customerRes.rows[0];
    if (!customer) {
      throw new Error('Customer not found');
    }

    // Знайти або створити відкриту розмову
    let convRes = await pool.query(
      'SELECT id FROM conversations WHERE customer_id = $1 AND status = $2 ORDER BY created_at DESC LIMIT 1',
      [customer.id, 'open']
    );
    if (!convRes.rows[0]) {
      convRes = await pool.query(
        'INSERT INTO conversations (customer_id, status) VALUES ($1, $2) RETURNING id',
        [customer.id, 'open']
      );
    }

    const conversation_id = convRes.rows[0].id;

    // Повідомити клієнту
    res.json({ conversation_id, new_conversation: !convRes.rows[0].id });
  } catch (err) {
    console.error('Error starting conversation:', err);
    res.status(500).json({ error: 'Failed to start conversation' });
  }
});

// 📥 3. Надсилання повідомлення
app.post('/api/messages', async (req, res) => {
  const { conversation_id, content, sender_type, sender_id } = req.body;

  if (
    !conversation_id ||
    !content?.trim() ||
    !sender_type ||
    !['customer', 'admin'].includes(sender_type)
  ) {
    return res.status(400).json({ error: 'Invalid message data' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO messages (conversation_id, content, sender_type, sender_id)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [conversation_id, content.trim(), sender_type, sender_id || null]
    );

    // Оновити last_message_at
    await pool.query(
      'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
      [conversation_id]
    );

    // Розіслати через Socket.IO
    io.to(`conversation:${conversation_id}`).emit('new_message', result.rows[0]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error sending message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// 📤 4. Завантажити історію
app.get('/api/conversations/:id/messages', async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT m.*, c.anonymous_id AS customer_anon_id, a.username AS admin_username
       FROM messages m
       JOIN conversations conv ON m.conversation_id = conv.id
       JOIN customers c ON conv.customer_id = c.id
       LEFT JOIN admins a ON m.sender_type = 'admin' AND m.sender_id = a.id
       WHERE conv.id = $1
       ORDER BY m.created_at ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error loading messages:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// ==========================================
// АДМІН КІНЦЕВІ ТОЧКИ
// ==========================================

// Middleware: Перевірка JWT токена
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.adminId = decoded.adminId;
    req.adminUsername = decoded.username;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
};

// 🔐 Адмін: Login
app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Missing username or password' });
  }

  try {
    const result = await pool.query(
      'SELECT id, username, password_hash FROM admins WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const admin = result.rows[0];
    const isValidPassword = await bcrypt.compare(password, admin.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { adminId: admin.id, username: admin.username },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, admin: { id: admin.id, username: admin.username } });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Failed to login' });
  }
});

// 📋 Адмін: Список активних розмов
app.get('/api/admin/conversations', authenticateAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT conv.id, conv.created_at, conv.last_message_at,
              c.anonymous_id AS customer_anon_id,
              COUNT(m.id) AS message_count
       FROM conversations conv
       JOIN customers c ON conv.customer_id = c.id
       LEFT JOIN messages m ON conv.id = m.conversation_id
       WHERE conv.status = 'open'
       GROUP BY conv.id, c.anonymous_id
       ORDER BY conv.last_message_at DESC NULLS LAST`,
      []
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error loading conversations:', err);
    res.status(500).json({ error: 'Failed to load conversations' });
  }
});

// 📬 Адмін: Відповідь у розмову
app.post('/api/admin/conversations/:id/messages', authenticateAdmin, async (req, res) => {
  const { id: conversation_id } = req.params;
  const { content } = req.body;

  if (!content?.trim()) {
    return res.status(400).json({ error: 'Missing content' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO messages (conversation_id, content, sender_type, sender_id)
       VALUES ($1, $2, 'admin', $3) RETURNING *,
              (SELECT c.anonymous_id FROM conversations conv
               JOIN customers c ON conv.customer_id = c.id WHERE conv.id = $1) AS customer_anon_id`,
      [conversation_id, content.trim(), req.adminId]
    );

    // Оновити last_message_at
    await pool.query(
      'UPDATE conversations SET last_message_at = NOW() WHERE id = $1',
      [conversation_id]
    );

    // Відправити клієнту через Socket.IO
    io.to(`conversation:${conversation_id}`).emit('new_message', result.rows[0]);

    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Error sending admin message:', err);
    res.status(500).json({ error: 'Failed to send message' });
  }
});

// 📖 Адмін: Історія розмови
app.get('/api/admin/conversations/:id/messages', authenticateAdmin, async (req, res) => {
  const { id } = req.params;

  try {
    const result = await pool.query(
      `SELECT m.*, c.anonymous_id AS customer_anon_id, a.username AS admin_username
       FROM messages m
       JOIN conversations conv ON m.conversation_id = conv.id
       JOIN customers c ON conv.customer_id = c.id
       LEFT JOIN admins a ON m.sender_type = 'admin' AND m.sender_id = a.id
       WHERE conv.id = $1
       ORDER BY m.created_at ASC`,
      [id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error('Error loading messages:', err);
    res.status(500).json({ error: 'Failed to load messages' });
  }
});

// 🔌 Socket.IO
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  socket.on('join_conversation', (conversation_id) => {
    socket.join(`conversation:${conversation_id}`);
    console.log(`User ${socket.id} joined conversation ${conversation_id}`);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

server.listen(process.env.PORT, () => {
  console.log(`🚀 Server running on port ${process.env.PORT}`);
});