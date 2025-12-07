
import React, { createContext, useContext, useEffect, useState, useRef, useCallback, ReactNode } from 'react';
import { io, Socket } from 'socket.io-client';

// Types
export type Role = 'admin' | 'editor' | 'viewer';

export interface Collaborator {
  id: string;
  name: string;
  role: Role;
  socketId?: string;
  email?: string;
}

export interface MemberInfo {
  id: string;
  name: string;
  email: string;
  role: Role;
}

export interface ProjectData {
  result: any;
  episodes: any[];
  globalAssets: any;
}

export interface ProjectInfo {
  id: string;
  name: string;
  creator: string;
  description: string;
}

interface CollaborationContextType {
  socket: Socket | null;
  role: Role;
  activeUsers: Collaborator[];
  members: Record<string, MemberInfo>; // userId -> full member info
  currentUserId: string; // Current logged-in user ID
  updateProject: (data: any) => void;
  updatePermission: (targetUserId: string, newRole: Role) => void;
  isConnected: boolean;
  isLoading: boolean; // Loading state for project data
  projectData: ProjectData | null; // Project data from server
  projectInfo: ProjectInfo | null; // Project metadata
  isRemoteUpdate: boolean; // Flag to indicate if current update is from remote
  setIsRemoteUpdate: (value: boolean) => void;
}

const CollaborationContext = createContext<CollaborationContextType | undefined>(undefined);

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

export const CollaborationProvider: React.FC<ProviderProps> = ({ 
  children, projectId, user, onProjectUpdate 
}) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [role, setRole] = useState<Role>('viewer');
  const [activeUsers, setActiveUsers] = useState<Collaborator[]>([]);
  const [members, setMembers] = useState<Record<string, MemberInfo>>({});
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [projectData, setProjectData] = useState<ProjectData | null>(null);
  const [projectInfo, setProjectInfo] = useState<ProjectInfo | null>(null);
  
  // Use ref for isRemoteUpdate to avoid race conditions in async updates
  const isRemoteUpdateRef = useRef(false);
  const [isRemoteUpdate, setIsRemoteUpdate] = useState(false);
  
  // Ref to track if we should rejoin on reconnect
  const shouldRejoinRef = useRef(false);
  // Queue for offline updates
  const offlineQueueRef = useRef<any[]>([]);
  // Stable callback ref to avoid socket reconnection
  const onProjectUpdateRef = useRef(onProjectUpdate);
  onProjectUpdateRef.current = onProjectUpdate;

  useEffect(() => {
    const token = localStorage.getItem('script2video_token');
    
    const newSocket = io('http://localhost:3001', {
      auth: { token },
      reconnection: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000
    });
    setSocket(newSocket);

    newSocket.on('connect', () => {
      console.log('Connected to collaboration server');
      setIsConnected(true);
      
      // Rejoin room on reconnect
      if (shouldRejoinRef.current) {
        console.log('Rejoining project room after reconnect');
        newSocket.emit('join-project', { projectId });
        // Flush offline queue
        if (offlineQueueRef.current.length > 0) {
          offlineQueueRef.current.forEach(data => {
            newSocket.emit('project-update', data);
          });
          offlineQueueRef.current = [];
        }
      } else {
        newSocket.emit('join-project', { projectId });
        shouldRejoinRef.current = true;
      }
    });

    newSocket.on('disconnect', () => {
      setIsConnected(false);
    });

    // Initial State from Server
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

    // Handle project not found
    newSocket.on('project-error', (error: { code: string, message: string }) => {
      console.error('Project error:', error);
      setIsLoading(false);
      // Could trigger navigation back to home here
    });

    // Room Updates
    newSocket.on('room-users-update', (users: Collaborator[]) => {
      setActiveUsers(users);
    });

    // Permission Updates - now with full member info
    newSocket.on('permissions-updated', (updatedMembers: Record<string, MemberInfo>) => {
      setMembers(updatedMembers);
      if (updatedMembers[user.id]) {
        setRole(updatedMembers[user.id].role);
      }
    });

    // Project Data Updates from other users
    newSocket.on('project-updated', (data: any) => {
      // Mark as remote update to prevent broadcast loop
      isRemoteUpdateRef.current = true;
      setIsRemoteUpdate(true);
      if (onProjectUpdateRef.current) {
        onProjectUpdateRef.current(data);
      }
      // Reset flag after a short delay to allow state updates to complete
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

    return () => {
      newSocket.disconnect();
    };
  }, [projectId, user.id]); // Remove onProjectUpdate from deps - use ref instead

  const updateProject = useCallback((data: any) => {
    if (role === 'viewer') return;
    
    if (socket && isConnected) {
      socket.emit('project-update', data);
    } else {
      // Queue update for when we reconnect
      offlineQueueRef.current.push(data);
    }
  }, [socket, role, isConnected]);

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
      setIsRemoteUpdate
    }}>
      {children}
    </CollaborationContext.Provider>
  );
};
