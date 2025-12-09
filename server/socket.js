
import { getDB } from './db.js';

export function setupSocket(io) {
  // In-memory tracking for active sockets (ephemeral)
  const socketUsers = {}; // socketId -> { userId, projectId, role, name }
  
  // 全局房间：用于项目列表更新通知
  const GLOBAL_ROOM = 'global-project-list';

  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.name} (${socket.id})`);
    const db = getDB();

    // --- 加入全局房间（用于项目列表更新通知）---
    socket.on('join-global', () => {
      socket.join(GLOBAL_ROOM);
      console.log(`${socket.user.name} joined global room for project list updates`);
    });

    // --- 离开全局房间 ---
    socket.on('leave-global', () => {
      socket.leave(GLOBAL_ROOM);
    });

    // --- JOIN PROJECT ---
    socket.on('join-project', async ({ projectId }) => {
      try {
        const user = socket.user; // From middleware

        // 1. Check Project Existence - NO LAZY CREATION for security
        let project = await db.get('SELECT * FROM projects WHERE id = ?', projectId);
        
        if (!project) {
          // Project doesn't exist - reject the join attempt
          console.warn(`User ${user.name} tried to join non-existent project ${projectId}`);
          socket.emit('project-error', { 
            code: 'PROJECT_NOT_FOUND', 
            message: '项目不存在或已被删除' 
          });
          return;
        }

        // 2. Check/Add Member
        let member = await db.get('SELECT * FROM project_members WHERE project_id = ? AND user_id = ?', [projectId, user.id]);
        
        if (!member) {
          // Default role: Viewer (Strict default) for new members joining via invite
          await db.run(`
            INSERT INTO project_members (project_id, user_id, role, joined_at)
            VALUES (?, ?, ?, ?)
          `, [projectId, user.id, 'viewer', Date.now()]);
          member = { role: 'viewer' };
          
          // Log new member join
          await db.run('INSERT INTO audit_logs (project_id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)',
            [projectId, user.id, 'member_joined', JSON.stringify({ role: 'viewer' }), Date.now()]
          );
        }

        // 3. Load Project Data (already loaded above)

        // 4. Setup Socket State - ensure all required fields are present
        socketUsers[socket.id] = { 
          id: user.id, 
          name: user.name, 
          email: user.email,
          role: member.role, 
          projectId,
          socketId: socket.id
        };
        socket.join(projectId);

        // 5. Broadcast Presence - format users correctly for client
        // 使用setTimeout确保socket已经完全加入房间后再广播
        setTimeout(async () => {
          const activeSockets = await io.in(projectId).fetchSockets();
          const activeUsersList = activeSockets
            .map(s => socketUsers[s.id])
            .filter(u => u && u.projectId === projectId)
            .map(u => ({
              id: u.id,
              name: u.name,
              email: u.email,
              role: u.role,
              socketId: u.socketId
            }));
          console.log('Broadcasting room-users-update:', activeUsersList.length, 'users');
          io.to(projectId).emit('room-users-update', activeUsersList);
        }, 100);

        // 6. Send Initial State to Client with full member info
        const allMembers = await db.all(`
            SELECT u.id, u.name, u.email, pm.role 
            FROM project_members pm
            JOIN users u ON pm.user_id = u.id
            WHERE pm.project_id = ?
        `, projectId);
        
        const membersMap = {};
        allMembers.forEach(m => {
          membersMap[m.id] = {
            id: m.id,
            name: m.name,
            email: m.email,
            role: m.role
          };
        });

        let parsedResult = null;
        let parsedEpisodes = [];
        let parsedGlobalAssets = null;

        try {
            if (project.data) parsedResult = JSON.parse(project.data);
            if (project.episodes) parsedEpisodes = JSON.parse(project.episodes);
            parsedGlobalAssets = parsedResult; 
        } catch (e) { console.error("Parse error", e); }

        // Get creator name
        const creator = await db.get('SELECT name FROM users WHERE id = ?', project.creator_id);
        const creatorName = creator ? creator.name : 'Unknown';

        socket.emit('project-state', {
          members: membersMap,
          role: member.role,
          projectData: {
            result: parsedResult,
            episodes: parsedEpisodes,
            globalAssets: parsedGlobalAssets
          },
          projectInfo: {
            id: project.id,
            name: project.name,
            creator: creatorName,
            description: project.description || ''
          }
        });

        console.log(`${user.name} (${member.role}) joined ${projectId}`);
        console.log('Project data sent:', {
          hasResult: !!parsedResult,
          episodesCount: parsedEpisodes?.length || 0,
          membersCount: Object.keys(membersMap).length,
          activeUsersCount: activeUsersList.length
        });

      } catch (err) {
        console.error("Join Error:", err);
      }
    });

    // --- UPDATE PERMISSION ---
    socket.on('update-permission', async ({ projectId, targetUserId, newRole }) => {
        const currentUser = socketUsers[socket.id];
        // STRICT CHECK: Must be admin
        if (!currentUser || currentUser.role !== 'admin') {
            console.warn(`Unauthorized permission update attempt by ${currentUser?.name}`);
            return;
        }

        await db.run('UPDATE project_members SET role = ? WHERE project_id = ? AND user_id = ?', 
            [newRole, projectId, targetUserId]);

        // Audit Log
        await db.run('INSERT INTO audit_logs (project_id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)',
            [projectId, currentUser.id, 'update_role', JSON.stringify({ targetUserId, newRole }), Date.now()]
        );

        // Update active socket role if user is online
        const targetSocket = (await io.in(projectId).fetchSockets()).find(s => socketUsers[s.id]?.id === targetUserId);
        if (targetSocket) {
            socketUsers[targetSocket.id].role = newRole;
        }

        const allMembers = await db.all(`
            SELECT u.id, u.name, u.email, pm.role FROM project_members pm JOIN users u ON pm.user_id = u.id WHERE pm.project_id = ?
        `, projectId);
        const membersMap = {};
        allMembers.forEach(m => {
          membersMap[m.id] = {
            id: m.id,
            name: m.name,
            email: m.email,
            role: m.role
          };
        });

        io.to(projectId).emit('permissions-updated', membersMap);
        
        const activeSockets = await io.in(projectId).fetchSockets();
        const activeUsersList = activeSockets
          .map(s => socketUsers[s.id])
          .filter(u => u && u.projectId === projectId)
          .map(u => ({
            id: u.id,
            name: u.name,
            email: u.email,
            role: u.role,
            socketId: u.socketId
          }));
        io.to(projectId).emit('room-users-update', activeUsersList);
    });

    // --- PROJECT UPDATE ---
    socket.on('project-update', async (data) => {
        const currentUser = socketUsers[socket.id];
        
        // STRICT CHECK 1: User must be tracked
        if (!currentUser) {
            console.warn(`Unauthorized update attempt: unknown socket ${socket.id}`);
            return;
        }
        
        // STRICT CHECK 2: Must be editor or admin
        if (currentUser.role === 'viewer') {
            console.warn(`Unauthorized update attempt by viewer ${currentUser.name}`);
            await db.run('INSERT INTO audit_logs (project_id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)',
                [currentUser.projectId, currentUser.id, 'unauthorized_update', JSON.stringify({ role: currentUser.role }), Date.now()]
            );
            return;
        }
        
        // STRICT CHECK 3: Verify user is actually a member of this project
        const membership = await db.get(
            'SELECT role FROM project_members WHERE project_id = ? AND user_id = ?',
            [currentUser.projectId, currentUser.id]
        );
        
        if (!membership) {
            console.warn(`User ${currentUser.name} is not a member of project ${currentUser.projectId}`);
            await db.run('INSERT INTO audit_logs (project_id, user_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)',
                [currentUser.projectId, currentUser.id, 'unauthorized_update', JSON.stringify({ reason: 'not_member' }), Date.now()]
            );
            return;
        }
        
        // Double-check role from database (in case of stale socket state)
        if (membership.role === 'viewer') {
            console.warn(`User ${currentUser.name} has viewer role in database`);
            return;
        }

        try {
            const updates = {};
            // 保存分析结果（包含分镜表数据）
            if (data.result) {
                updates.data = JSON.stringify(data.result);
                console.log('Saving result data, episodes count:', data.result.episodes?.length || 0);
            }
            // 保存剧集列表（用户输入的剧本）
            if (data.episodes) {
                updates.episodes = JSON.stringify(data.episodes);
                console.log('Saving episodes, count:', data.episodes.length);
            }
            updates.updated_at = Date.now();
            
            const fields = Object.keys(updates).map(k => `${k} = ?`).join(', ');
            const values = Object.values(updates);
            
            if (fields.length > 0) {
                console.log('Updating project:', currentUser.projectId, 'fields:', Object.keys(updates));
                await db.run(`UPDATE projects SET ${fields} WHERE id = ?`, [...values, currentUser.projectId]);
                console.log('Project saved successfully');
            } else {
                console.log('No data to save');
            }

            // 广播更新，包含更新者信息
            socket.to(currentUser.projectId).emit('project-updated', {
                ...data,
                updatedBy: {
                    id: currentUser.id,
                    name: currentUser.name
                }
            });
            console.log('Broadcast sent to room:', currentUser.projectId);
        } catch(e) {
            console.error("Save Error:", e);
        }
    });

    socket.on('disconnect', () => {
        const user = socketUsers[socket.id];
        if (user) {
            const projectId = user.projectId;
            delete socketUsers[socket.id];
            if (projectId) {
                io.in(projectId).fetchSockets().then(sockets => {
                    const list = sockets
                      .map(s => socketUsers[s.id])
                      .filter(u => u && u.projectId === projectId)
                      .map(u => ({
                        id: u.id,
                        name: u.name,
                        email: u.email,
                        role: u.role,
                        socketId: u.socketId
                      }));
                    io.to(projectId).emit('room-users-update', list);
                });
            }
        }
    });
  });
}
