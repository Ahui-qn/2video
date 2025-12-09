/**
 * App.tsx - 应用主入口组件
 * 
 * 核心职责：
 * 1. 管理应用的三个主要视图：登录(auth)、项目列表(home)、工作区(workspace)
 * 2. 处理用户认证状态和项目选择
 * 3. 提供协作上下文包装器，使工作区支持实时多人协作
 */
import React, { useState, useEffect } from 'react';
import { Auth } from './components/Auth';
import { ProjectList } from './components/ProjectList';
import { Workspace } from './components/Workspace';
import { CreateProjectModal, ProjectData } from './components/CreateProjectModal';
import { Project } from './types';
import { CollaborationProvider } from './components/CollaborationContext';
import { API_BASE_URL } from './services/apiConfig';

// 视图状态：auth=登录页, home=项目列表, workspace=工作区
type ViewState = 'auth' | 'home' | 'workspace';

// 应用用户信息（简化版，用于前端状态管理）
interface AppUser {
  id: string;
  email: string;
  name: string;
  isAdmin: boolean;
}

const App: React.FC = () => {
  // 核心状态：当前视图、用户信息、当前项目
  const [view, setView] = useState<ViewState>('auth');
  const [user, setUser] = useState<AppUser | null>(null);
  const [currentProject, setCurrentProject] = useState<Project | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  // 组件挂载时检查本地存储，恢复登录状态和当前项目
  // 这样用户刷新页面后不需要重新登录，也能保持在当前项目中
  useEffect(() => {
    const storedUser = localStorage.getItem('script2video_user');
    if (storedUser) {
      setUser(JSON.parse(storedUser));
      
      // 检查是否有保存的当前项目
      const storedProjectId = localStorage.getItem('script2video_current_project');
      if (storedProjectId) {
        // 恢复到工作区，使用占位项目
        const stubProject: Project = {
          id: storedProjectId,
          name: "加载中...",
          creator: "Unknown",
          description: "正在加载项目...",
          coverImage: null,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          episodes: [],
          data: null
        };
        setCurrentProject(stubProject);
        setView('workspace');
      } else {
        setView('home');
      }
    }
  }, []);

  // 处理URL中的项目邀请链接（例如：?join=project-id）
  // 当用户点击分享链接时，自动加入对应项目
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinId = params.get('join');
    if (joinId && user) {
        // 清理URL，避免重复加入
        window.history.replaceState({}, '', '/');
        handleJoinProject(joinId);
    }
  }, [user]);

  // 登录成功回调：保存用户信息并跳转到项目列表
  const handleLogin = (userData: AppUser) => {
    setUser(userData);
    setView('home');
  };

  /**
   * 创建新项目
   * 流程：调用后端API创建项目 -> 成功后直接进入工作区
   */
  const handleCreateProject = async (data: ProjectData) => {
    try {
      const token = localStorage.getItem('script2video_token');
      const res = await fetch(`${API_BASE_URL}/project`, {
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

  /**
   * 保存项目（更新本地状态）
   * 注意：实际数据通过WebSocket实时同步到服务器，这里只更新本地引用
   */
  const handleSaveProject = (project: Project) => {
    setCurrentProject(project);
  };

  /**
   * 加入已存在的项目（通过分享链接）
   * 
   * 工作流程：
   * 1. 创建一个占位项目对象，立即显示"加载中"界面
   * 2. CollaborationProvider会自动连接WebSocket并加入项目房间
   * 3. 服务器返回真实项目数据后，通过Context更新Workspace
   * 4. 如果项目不存在，服务器会发送错误事件
   */
  const handleJoinProject = async (projectId: string) => {
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
  };

  /**
   * 加载示例项目（用于演示和测试）
   * 创建一个包含预设数据的赛博朋克主题项目
   */
  const handleLoadMockProject = async () => {
    try {
      const token = localStorage.getItem('script2video_token');
      const res = await fetch(`${API_BASE_URL}/project`, {
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
              onSelectProject={(p) => { 
                setCurrentProject(p); 
                setView('workspace');
                // 保存当前项目ID到localStorage，刷新后可恢复
                localStorage.setItem('script2video_current_project', p.id);
              }} 
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
              onBack={() => { 
                setCurrentProject(null); 
                setView('home');
                // 清除保存的当前项目，返回首页
                localStorage.removeItem('script2video_current_project');
              }} 
              onSaveProject={handleSaveProject}
            />
          </CollaborationProvider>
        )}
      </div>
    </div>
  );
};

export default App;
