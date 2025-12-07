/**
 * server/index.js - 后端服务器入口
 * 
 * 架构说明：
 * 1. Express HTTP服务器：处理REST API请求（登录、项目CRUD）
 * 2. Socket.IO服务器：处理WebSocket连接（实时协作）
 * 3. SQLite数据库：持久化用户、项目、成员关系
 * 
 * 端口：3001
 */
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
app.use(cors());  // 允许跨域请求（开发环境）
app.use(express.json());  // 解析JSON请求体

// REST API路由
app.use('/api/auth', authRoutes);      // 认证相关：登录、注册
app.use('/api/project', projectRoutes); // 项目相关：创建、查询、更新

// 创建HTTP服务器（Express和Socket.IO共用）
const server = createServer(app);

// 创建Socket.IO服务器，用于实时协作
const io = new Server(server, {
  cors: {
    origin: "*",  // 生产环境应限制为具体域名
    methods: ["GET", "POST"]
  }
});

// Socket.IO中间件：验证JWT token，拒绝未认证的连接
io.use(socketAuthMiddleware);

// 设置Socket.IO事件处理器（加入房间、同步数据、权限管理等）
setupSocket(io);

/**
 * 启动服务器
 * 1. 初始化数据库（创建表结构）
 * 2. 启动HTTP服务器监听3001端口
 */
async function startServer() {
  await initDB();

  const PORT = 3001;
  server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

startServer();
