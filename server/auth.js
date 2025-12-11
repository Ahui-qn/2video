
import express from 'express';
import bcrypt from 'bcryptjs';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from './db.js';
import { generateToken, authMiddleware } from './middleware.js';

const router = express.Router();

// REGISTER
router.post('/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const db = getDB();
    const existing = await db.get('SELECT id FROM users WHERE email = ?', email);
    if (existing) {
      return res.status(409).json({ error: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await db.run(
      'INSERT INTO users (id, name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      [userId, name, email, hashedPassword, Date.now()]
    );

    const token = generateToken({ id: userId, email, name });
    res.status(201).json({ user: { id: userId, name, email }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const db = getDB();
    
    const user = await db.get('SELECT * FROM users WHERE email = ?', email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValid = await bcrypt.compare(password, user.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken(user);
    res.json({ user: { id: user.id, name: user.name, email: user.email }, token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * VALIDATE - 验证当前token是否有效
 * 
 * 用于应用启动时验证存储的token是否仍然有效
 * 如果token有效，返回用户信息；如果无效，返回401
 * 
 * Requirements: 1.1 - 应用启动时验证JWT_Token
 */
router.get('/validate', authMiddleware, async (req, res) => {
  try {
    // authMiddleware已经验证了token并将用户信息放在req.user中
    // 返回用户信息确认会话有效
    res.json({ 
      valid: true, 
      user: { 
        id: req.user.id, 
        email: req.user.email, 
        name: req.user.name 
      } 
    });
  } catch (err) {
    console.error('Validate error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

export default router;
