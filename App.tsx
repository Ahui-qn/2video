import React, { useState, useEffect } from 'react';
import { Auth } from './components/Auth';
import { ProjectList } from './components/ProjectList';
import { Workspace } from './components/Workspace';
import { CreateProjectModal, ProjectData } from './components/CreateProjectModal';
import { Project } from './types';
import { CollaborationProvider } from './components/CollaborationContext';

type ViewState = 'auth' | 'home' | 'workspace';

interface AppUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('auth');
  const [user, setUser] = useState<AppUser | null>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // Auth Check on Mount
  useEffect(() => {
    const storedUser = localStorage.getItem('script2video_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      setView('home');
    }
  }, []);

  // URL Join Handler
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    if (joinId && user) {
        // Clean URL
        window.history.replaceState({}, '', '/');
        handleJoinProject(joinId);
    }
  }, [user]);

  const handleLogin = (userData: AppUser) => {
    setUser(userData);
    setView('home');
  };

  const handleCreateProject = async (data: ProjectData) => {
    try {
      const token = localStorage.getItem('script2video_token');
      const res = await fetch('http://localhost:3001/api/project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: data.name,
          description: data.description,
          coverImage: data.coverImage
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || '创建项目失败');
        return;
      }

      const newProject: Project = await res.json();
      
      setIsCreateModalOpen(false);
      setCurrentProject(newProject);
      setView('workspace');
    } catch (err) {
      console.error('Create project error:', err);
      alert('创建项目失败，请检查服务器连接');
    }
  };

  const handleSaveProject = (project: Project) => {
    setCurrentProject(project);
    // Note: Project data is now saved via socket collaboration
    // No need to save to localStorage as server is the source of truth
  };

  const handleJoinProject = async (projectId: string) => {
      // Create a stub project - the CollaborationProvider will fetch real data
      // and update the Workspace state via context
      const stubProject: Project = {
          id: projectId,
          name: "加载中...",
          creator: "Unknown",
          description: "正在加入项目...",
          coverImage: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          episodes: [],
          data: null
      };
      
      setCurrentProject(stubProject);
      setView('workspace');
      // Note: The CollaborationProvider will handle:
      // 1. Connecting to socket
      // 2. Joining the project room
      // 3. Receiving project-state with real data
      // 4. Updating Workspace state via context
      // 5. Handling project-error if project doesn't exist
  };

  const handleLoadMockProject = async () => {
    // Create a demo project on the server
    try {
      const token = localStorage.getItem('script2video_token');
      const res = await fetch('http://localhost:3001/api/project', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          name: "赛博朋克：边缘行者 (示例)",
          description: "这是一个自动生成的示例项目，用于展示分镜表和资产库的功能。\n\n背景设定在2077年的夜之城，讲述一名街头小子如何一步步成为传奇的故事。",
          coverImage: "https://images.unsplash.com/photo-1535295972055-1c762f4483e5?q=80&w=2574&auto=format&fit=crop"
        })
      });

      if (!res.ok) {
        const errData = await res.json();
        alert(errData.error || '创建示例项目失败');
        return;
      }

      const newProject: Project = await res.json();
      
      // Add mock data to the project (will be synced via socket)
      newProject.episodes = [
        { id: 'ep1', title: '第一集：坠落', content: 'Mock Script Content 1', status: 'analyzed', isExpanded: false },
        { id: 'ep2', title: '第二集：觉醒', content: 'Mock Script Content 2', status: 'analyzed', isExpanded: false }
      ];
      newProject.data = {
        title: "赛博朋克：边缘行者",
        synopsis: "赛博朋克故事",
        episodes: [
          { 
            id: 'ep1', 
            title: '第一集：坠落', 
            scenes: [
              {
                sceneId: 's1',
                header: '大卫的公寓 - 卧室 - 清晨',
                shots: [
                    { id: 'sh1', visualDescription: '大卫的眼睛猛然睁开，瞳孔收缩。', shotSize: '特写 (CU)', cameraAngle: '俯视', environment: '大卫的公寓 - 卧室', characters: '大卫', action: '静止', duration: '2s', dialogue: '大卫（混响）：又是这个梦...' },
                    { id: 'sh2', visualDescription: '大卫从床上坐起，揉了揉头发。房间里堆满了电子零件。', shotSize: '全景 (LS)', cameraAngle: '平视', environment: '大卫的公寓 - 卧室', characters: '大卫', action: '缓慢推镜头', duration: '4s', dialogue: '' }
                ]
              }
            ]
          }
        ],
        scenes: [], 
        characters: [
          { name: "大卫·马丁内斯", visualSummary: "17岁少年，身穿黄色夹克，留着朋克发型。", traits: "热血, 冲动, 重情义", imageUrls: [] },
          { name: "露西", visualSummary: "神秘的黑客少女，白发，穿着性感的连体衣。", traits: "高冷, 神秘, 技术高超", imageUrls: [] }
        ],
        assets: [
          { name: "荒坂塔", type: "Location", description: "夜之城的地标建筑，巨大的黑色高塔。", imageUrls: [] },
          { name: "桑德威斯坦", type: "Prop", description: "脊柱植入体，启动时可以让使用者进入超高速状态。", imageUrls: [] }
        ]
      };
      
      setCurrentProject(newProject);
      setView('workspace');
    } catch (err) {
      console.error('Create mock project error:', err);
      alert('创建示例项目失败，请检查服务器连接');
    }
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden text-slate-200 font-sans flex flex-col selection:bg-[#d946ef] selection:text-white bg-transparent">
      {/* Liquid Mesh Background - Z:0 */}
      <div className="liquid-bg">
        <div className="liquid-blob blob-1"></div>
        <div className="liquid-blob blob-2"></div>
        <div className="liquid-blob blob-3"></div>
        <div className="liquid-blob blob-4"></div>
      </div>

      {/* Content - Z:10 */}
      <div className="relative z-10 flex-1 flex flex-col h-full">
        {view === 'auth' && (
          <Auth onLogin={handleLogin} />
        )}

        {view === 'home' && (
          <>
            <CreateProjectModal 
              isOpen={isCreateModalOpen} 
              onClose={() => setIsCreateModalOpen(false)} 
              onCreate={handleCreateProject} 
            />
            <ProjectList 
              onSelectProject={(p) => { setCurrentProject(p); setView('workspace'); }} 
              onCreateNew={() => setIsCreateModalOpen(true)} 
              onLoadMock={handleLoadMockProject}
              onJoin={handleJoinProject}
            />
          </>
        )}

        {view === 'workspace' && currentProject && user && (
          <CollaborationProvider 
            projectId={currentProject.id} 
            user={{ id: user.id, name: user.name, email: user.email }}
          >
            <Workspace 
              project={currentProject} 
              onBack={() => { setCurrentProject(null); setView('home'); }} 
              onSaveProject={handleSaveProject}
            />
          </CollaborationProvider>
        )}
      </div>
    </div>
  );
};

export default App;
