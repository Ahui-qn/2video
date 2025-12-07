
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { initDB } from './db.js';
import authRoutes from './auth.js';
import projectRoutes from './project.js';
import { socketAuthMiddleware } from './middleware.js';
import { setupSocket } from './socket.js';

const app = express();
app.use(cors());
app.use(express.json());

// Auth Routes
app.use('/api/auth', authRoutes);
app.use('/api/project', projectRoutes);

const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*", 
    methods: ["GET", "POST"]
  }
});

// Socket Middleware (Strict Auth)
io.use(socketAuthMiddleware);

// Socket Logic
setupSocket(io);

async function startServer() {
  await initDB();

  const PORT = 3001;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
