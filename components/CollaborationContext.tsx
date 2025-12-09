/**
 * CollaborationContext.tsx - 实时协作上下文
 * 
 * 核心功能：
 * 1. 管理WebSocket连接，实现多人实时协作
 * 2. 同步项目数据变更到所有在线用户
 * 3. 处理权限控制（admin/editor/viewer）
 * 4. 管理在线用户列表和成员信息
 * 5. 处理断线重连和离线队列
 * 
 * 关键设计：
 * - 使用ref避免循环依赖和竞态条件
 * - 防止同步循环：通过isRemoteUpdate标记区分本地更新和远程更新
 * - 离线队列：断线期间的更新会在重连后自动发送
 */
import React, { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../services/apiConfig';

// 用户角色：admin=管理员(所有权限), editor=编辑者(可编辑), viewer=观察者(只读)
export type Role = 'admin' | 'editor' | 'viewer';

// 在线协作者信息（当前在线的用户）
export interface Collaborator {
  id: string;
  name: string;
  role: Role;
  socketId?: string;
  email?: string;
}

// 项目成员信息（所有被邀请的成员，包括离线的）
export interface MemberInfo {
  id: string;
  name: string;
  email: string;
  role: Role;
}

// 项目数据结构（用于同步的核心数据）
export interface ProjectData {
  result: any;        // AI分析结果
  episodes: any[];    // 剧集列表
  globalAssets: any;  // 全局资产库
}

// 项目元信息
export interface ProjectInfo {
  id: string;
  name: string;
  creator: string;
  description: string;
}

// Context提供的API
interface CollaborationContextType {
  socket: Socket | null;
  role: Role;
  activeUsers: Collaborator[];        // 当前在线用户
  members: Record<string, MemberInfo>; // 所有成员（包括离线）
  currentUserId: string;
  updateProject: (data: any) => void;  // 广播项目更新
  updatePermission: (targetUserId: string, newRole: Role) => void; // 修改成员权限
  isConnected: boolean;
  isLoading: boolean;
  projectData: ProjectData | null;
  projectInfo: ProjectInfo | null;
  isRemoteUpdate: boolean;  // 标记：当前更新是否来自远程（防止循环同步）
  setIsRemoteUpdate: (value: boolean) => void;
  hasRemoteChanges: boolean;  // 是否有远程更新待刷新
  clearRemoteChanges: () => void;  // 清除远程更新标记
  lastUpdateBy: string | null;  // 最后更新者名称
}

const CollaborationContext = createContext<CollaborationContextType | undefined>(undefined);

// Hook：在组件中使用协作功能
export const useCollaboration = () => {
  const context = useContext(CollaborationContext);
  if (!context) {
    throw new Error('useCollaboration must be used within a CollaborationProvider');
  }
  return context;
};

interface ProviderProps {
  children: ReactNode;
  projectId: string;
  user: { id: string; name: string; email: string };
  onProjectUpdate?: (data: any) => void; // Callback when data comes from socket
}

/**
 * CollaborationProvider - 协作上下文提供者
 * 
 * 包裹在Workspace外层，为整个工作区提供实时协作能力
 */
export const CollaborationProvider: React.FC<ProviderProps> = ({ 
  children, projectId, user, onProjectUpdate 
}) => {
  // 核心状态
  const [socket, setSocket] = useState<Socket | null>(null);
  const [role, setRole] = useState<Role>('viewer');
  const [activeUsers, setActiveUsers] = useState<Collaborator[]>([]);
  const [members, setMembers] = useState<Record<string, MemberInfo>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  
  // 使用ref避免异步更新中的竞态条件
  // 当收到远程更新时，设置此标记，防止再次广播造成循环
  const isRemoteUpdateRef = useRef(false);
  const [isRemoteUpdate, setIsRemoteUpdate] = useState(false);
  
  // 远程更新提示状态
  const [hasRemoteChanges, setHasRemoteChanges] = useState(false);
  const [lastUpdateBy, setLastUpdateBy] = useState<string | null>(null);
  
  // 重连标记：首次连接后设为true，断线重连时自动重新加入房间
  const shouldRejoinRef = useRef(false);
  
  // 离线队列：断线期间的更新会暂存，重连后自动发送
  const offlineQueueRef = useRef<any[]>([]);
  
  // 使用ref保存回调，避免socket因依赖变化而重新创建
  const onProjectUpdateRef = useRef(onProjectUpdate);
  onProjectUpdateRef.current = onProjectUpdate;
  
  // 清除远程更新标记
  const clearRemoteChanges = useCallback(() => {
    setHasRemoteChanges(false);
    setLastUpdateBy(null);
  }, []);

  /**
   * WebSocket连接管理
   * 
   * 生命周期：
   * 1. 组件挂载时创建socket连接
   * 2. 连接成功后自动加入项目房间
   * 3. 监听各种事件（状态同步、用户进出、权限变更等）
   * 4. 组件卸载时断开连接
   */
  useEffect(() => {
    const token = localStorage.getItem('script2video_token');
    
    // 创建socket连接，配置自动重连
    const newSocket = io(SOCKET_URL, {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    setSocket(newSocket);

    // 连接成功
    newSocket.on('connect', () => {
      console.log('Connected to collaboration server');
      setIsConnected(true);
      
      // 如果是重连，需要重新加入房间并发送离线期间的更新
      if (shouldRejoinRef.current) {
        console.log('Rejoining project room after reconnect');
        newSocket.emit('join-project', { projectId });
        
        // 发送离线队列中的更新
        if (offlineQueueRef.current.length > 0) {
          offlineQueueRef.current.forEach(data => {
            newSocket.emit('project-update', data);
          });
          offlineQueueRef.current = [];
        }
      } else {
        // 首次连接，加入项目房间
        newSocket.emit('join-project', { projectId });
        shouldRejoinRef.current = true;
      }
    });

    // 断开连接
    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    /**
     * 接收项目初始状态
     * 服务器在用户加入房间后发送，包含：
     * - 项目成员列表和权限
     * - 当前用户的角色
     * - 项目数据和元信息
     */
    newSocket.on('project-state', (state: { 
      members: Record<string, MemberInfo>, 
      role: Role,
      projectData?: ProjectData,
      projectInfo?: ProjectInfo
    }) => {
      setMembers(state.members);
      setRole(state.role);
      if (state.projectData) {
        setProjectData(state.projectData);
      }
      if (state.projectInfo) {
        setProjectInfo(state.projectInfo);
      }
      setIsLoading(false);
    });

    // 项目不存在或无权限
    newSocket.on('project-error', (error: { code: string, message: string }) => {
      console.error('Project error:', error);
      setIsLoading(false);
    });

    // 房间用户列表更新（有人进入或离开）
    newSocket.on('room-users-update', (users: Collaborator[]) => {
      setActiveUsers(users);
    });

    /**
     * 权限变更通知
     * 管理员修改成员权限后，所有人都会收到更新
     */
    newSocket.on('permissions-updated', (updatedMembers: Record<string, MemberInfo>) => {
      setMembers(updatedMembers);
      // 如果自己的权限被修改，更新本地角色
      if (updatedMembers[user.id]) {
        setRole(updatedMembers[user.id].role);
      }
    });

    /**
     * 接收其他用户的项目数据更新
     * 
     * 关键：设置isRemoteUpdate标记，防止再次广播造成循环
     * 流程：收到更新 -> 设置标记 -> 更新本地状态 -> 200ms后清除标记
     */
    newSocket.on('project-updated', (data: any) => {
      isRemoteUpdateRef.current = true;
      setIsRemoteUpdate(true);
      
      // 设置远程更新提示
      setHasRemoteChanges(true);
      if (data.updatedBy?.name) {
        setLastUpdateBy(data.updatedBy.name);
      }
      
      if (onProjectUpdateRef.current) {
        onProjectUpdateRef.current(data);
      }
      // 延迟清除标记，确保状态更新完成
      setTimeout(() => {
        isRemoteUpdateRef.current = false;
        setIsRemoteUpdate(false);
      }, 200);
    });

    newSocket.on('connect_error', (err) => {
      console.error("Socket connection error:", err.message);
      setIsLoading(false);
    });

    newSocket.on('reconnect_failed', () => {
      console.error('Failed to reconnect after multiple attempts');
    });

    // 清理：组件卸载时断开连接
    return () => {
      newSocket.disconnect();
    };
  }, [projectId, user.id]);

  /**
   * 广播项目更新到其他用户
   * 
   * 权限检查：viewer无法更新
   * 离线处理：如果断线，更新会加入队列，重连后自动发送
   */
  const updateProject = useCallback((data: any) => {
    if (role === 'viewer') {
      console.log('updateProject blocked: viewer role');
      return;
    }
    
    console.log('updateProject called:', {
      hasSocket: !!socket,
      isConnected,
      dataKeys: Object.keys(data || {})
    });
    
    if (socket && isConnected) {
      socket.emit('project-update', data);
      console.log('project-update emitted');
    } else {
      offlineQueueRef.current.push(data);
      console.log('Added to offline queue');
    }
  }, [socket, role, isConnected]);

  /**
   * 修改成员权限（仅管理员可用）
   */
  const updatePermission = useCallback((targetUserId: string, newRole: Role) => {
    if (socket && role === 'admin') {
      socket.emit('update-permission', { projectId, targetUserId, newRole });
    }
  }, [socket, role, projectId]);

  return (
    <CollaborationContext.Provider value={{
      socket,
      role,
      activeUsers,
      members,
      currentUserId: user.id,
      updateProject,
      updatePermission,
      isConnected,
      isLoading,
      projectData,
      projectInfo,
      isRemoteUpdate,
      setIsRemoteUpdate,
      hasRemoteChanges,
      clearRemoteChanges,
      lastUpdateBy
    }}>
      {children}
    </CollaborationContext.Provider>
  );
};
