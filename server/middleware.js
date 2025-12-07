
import jwt from 'jsonwebtoken';

const SECRET_KEY = 'your_super_secret_key_for_dev_only'; // In prod, use env var

export const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name },
    SECRET_KEY,
    { expiresIn: '24h' }
  );
};

export const verifyToken = (token) => {
  try {
    return jwt.verify(token, SECRET_KEY);
  } catch (err) {
    return null;
  }
};

export const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token provided' });

  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  
  if (!decoded) return res.status(401).json({ error: 'Invalid token' });
  
  req.user = decoded;
  next();
};

export const socketAuthMiddleware = (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication error: No token'));
  
  const decoded = verifyToken(token);
  if (!decoded) return next(new Error('Authentication error: Invalid token'));
  
  socket.user = decoded;
  next();
};
