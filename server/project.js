
import express from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getDB } from './db.js';
import { authMiddleware } from './middleware.js';

// 全局房间名称（与socket.js保持一致）
const GLOBAL_ROOM = 'global-project-list';

// 工厂函数：创建路由并注入io实例
export function createProjectRoutes(io) {
  const router = express.Router();

  // Create Project
  router.post('/', authMiddleware, async (req, res) => {
    try {
      const db = getDB();
      const { name, description, coverImage } = req.body;
      const userId = req.user.id;
      
      if (!name) {
        return res.status(400).json({ error: 'Project name is required' });
      }

      const projectId = uuidv4();
      const now = Date.now();

      await db.run(`
        INSERT INTO projects (id, name, creator_id, description, cover_image, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `, [projectId, name, userId, description || '', coverImage || null, now, now]);

      await db.run(`
        INSERT INTO project_members (project_id, user_id, role, joined_at)
        VALUES (?, ?, ?, ?)
      `, [projectId, userId, 'admin', now]);

      await db.run(`
        INSERT INTO audit_logs (project_id, user_id, action, details, created_at)
        VALUES (?, ?, ?, ?, ?)
      `, [projectId, userId, 'project_created', JSON.stringify({ name }), now]);

      const newProject = {
        id: projectId,
        name,
        creator: req.user.name,
        creatorId: userId,
        description: description || '',
        coverImage: coverImage || null,
        createdAt: now,
        updatedAt: now,
        data: null,
        episodes: []
      };

      // 注意：创建项目时不广播到全局房间
      // 项目只对创建者和被邀请的成员可见，通过邀请链接加入
      // 这样保证了项目的私密性

      res.status(201).json(newProject);
    } catch (err) {
      console.error('Create project error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });


  // Get user's projects
  router.get('/', authMiddleware, async (req, res) => {
    try {
      const db = getDB();
      const userId = req.user.id;

      const projects = await db.all(`
        SELECT p.*, u.name as creator_name, pm.role as my_role
        FROM projects p
        JOIN project_members pm ON p.id = pm.project_id
        JOIN users u ON p.creator_id = u.id
        WHERE pm.user_id = ?
        ORDER BY p.updated_at DESC
      `, userId);

      const result = projects.map(p => ({
        id: p.id,
        name: p.name,
        creator: p.creator_name,
        creatorId: p.creator_id,
        description: p.description || '',
        coverImage: p.cover_image,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
        myRole: p.my_role,
        data: p.data ? JSON.parse(p.data) : null,
        episodes: p.episodes ? JSON.parse(p.episodes) : []
      }));

      res.json(result);
    } catch (err) {
      console.error('Get projects error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get single project
  router.get('/:id', authMiddleware, async (req, res) => {
    try {
      const db = getDB();
      const { id } = req.params;
      const userId = req.user.id;

      const member = await db.get(
        'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
        [id, userId]
      );
      
      if (!member) {
        return res.status(403).json({ error: 'Access denied' });
      }

      const project = await db.get(`
        SELECT p.*, u.name as creator_name
        FROM projects p
        JOIN users u ON p.creator_id = u.id
        WHERE p.id = ?
      `, id);

      if (!project) {
        return res.status(404).json({ error: 'Project not found' });
      }

      res.json({
        id: project.id,
        name: project.name,
        creator: project.creator_name,
        creatorId: project.creator_id,
        description: project.description || '',
        coverImage: project.cover_image,
        createdAt: project.created_at,
        updatedAt: project.updated_at,
        myRole: member.role,
        data: project.data ? JSON.parse(project.data) : null,
        episodes: project.episodes ? JSON.parse(project.episodes) : []
      });
    } catch (err) {
      console.error('Get project error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });


  // Delete project (admin only)
  router.delete('/:id', authMiddleware, async (req, res) => {
    try {
      const db = getDB();
      const { id } = req.params;
      const userId = req.user.id;

      const member = await db.get(
        'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
        [id, userId]
      );
      
      if (!member || member.role !== 'admin') {
        return res.status(403).json({ error: 'Only admin can delete project' });
      }

      await db.run('DELETE FROM audit_logs WHERE project_id = ?', id);
      await db.run('DELETE FROM project_members WHERE project_id = ?', id);
      await db.run('DELETE FROM projects WHERE id = ?', id);

      // 注意：删除项目时不广播，因为项目只对成员可见
      // 成员刷新页面时会自动看不到已删除的项目

      res.json({ success: true });
    } catch (err) {
      console.error('Delete project error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  // Get Project Logs
  router.get('/:id/logs', authMiddleware, async (req, res) => {
    try {
      const db = getDB();
      const { id } = req.params;
      
      const member = await db.get('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?', [id, req.user.id]);
      if (!member) return res.status(403).json({ error: 'Access denied' });

      const logs = await db.all(`
          SELECT al.*, u.name as user_name 
          FROM audit_logs al 
          LEFT JOIN users u ON al.user_id = u.id 
          WHERE al.project_id = ? 
          ORDER BY al.created_at DESC 
          LIMIT 50
      `, id);
      
      res.json(logs);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
}
