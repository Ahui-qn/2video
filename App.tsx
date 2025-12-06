import React, { useState, useEffect } from 'react';
import { Auth } from './components/Auth';
import { ProjectList } from './components/ProjectList';
import { Workspace } from './components/Workspace';
import { CreateProjectModal, ProjectData } from './components/CreateProjectModal';
import { Project, AnalysisResult } from './types';

type ViewState = 'auth' | 'home' | 'workspace';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>('auth');
  const [user, setUser] = useState<{ email: string; name: string; isAdmin: boolean } | null>(null);
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

  const handleLogin = (userData: { email: string; name: string; isAdmin: boolean }) => {
    setUser(userData);
    setView('home');
  };

  const handleCreateProject = (data: ProjectData) => {
    const newProject: Project = {
      id: Date.now().toString(),
      name: data.name,
      creator: data.creator,
      description: data.description,
      coverImage: data.coverImage,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      data: null, // Initial empty data
      episodes: []
    };

    // Save to localStorage
    const stored = localStorage.getItem('script2video_projects');
    const projects = stored ? JSON.parse(stored) : [];
    const updatedProjects = [newProject, ...projects];
    localStorage.setItem('script2video_projects', JSON.stringify(updatedProjects));

    setIsCreateModalOpen(false);
    setCurrentProject(newProject);
    setView('workspace');
  };

  const handleSaveProject = (project: Project) => {
    setCurrentProject(project);
    // Update persistence
    const stored = localStorage.getItem('script2video_projects');
    if (stored) {
      const projects: Project[] = JSON.parse(stored);
      const updatedProjects = projects.map(p => p.id === project.id ? project : p);
      localStorage.setItem('script2video_projects', JSON.stringify(updatedProjects));
    }
  };

  const handleLoadMockProject = () => {
    const mockId = `mock-${Date.now()}`;
    const mockProject: Project = {
      id: mockId,
      name: "赛博朋克：边缘行者 (示例)",
      creator: "Script2Video Bot",
      description: "这是一个自动生成的示例项目，用于展示分镜表和资产库的功能。\n\n背景设定在2077年的夜之城，讲述一名街头小子如何一步步成为传奇的故事。",
      coverImage: "https://images.unsplash.com/photo-1535295972055-1c762f4483e5?q=80&w=2574&auto=format&fit=crop",
      createdAt: Date.now(),
      updatedAt: Date.now(),
      episodes: [
        { id: 'ep1', title: '第一集：坠落', content: 'Mock Script Content 1', status: 'analyzed', isExpanded: false },
        { id: 'ep2', title: '第二集：觉醒', content: 'Mock Script Content 2', status: 'analyzed', isExpanded: false }
      ],
      data: {
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
                    { 
                        id: 'sh1', 
                        visualDescription: '大卫的眼睛猛然睁开，瞳孔收缩。', 
                        shotSize: '特写 (CU)', 
                        cameraAngle: '俯视', 
                        environment: '大卫的公寓 - 卧室',
                        characters: '大卫',
                        action: '静止', 
                        duration: '2s', 
                        dialogue: '大卫（混响）：又是这个梦...' 
                    },
                    { 
                        id: 'sh2', 
                        visualDescription: '大卫从床上坐起，揉了揉头发。房间里堆满了电子零件。', 
                        shotSize: '全景 (LS)', 
                        cameraAngle: '平视', 
                        environment: '大卫的公寓 - 卧室',
                        characters: '大卫',
                        action: '缓慢推镜头', 
                        duration: '4s', 
                        dialogue: '' 
                    }
                ]
              },
              {
                sceneId: 's2',
                header: '夜之城 - 街道 - 日',
                shots: [
                    { 
                        id: 'sh3', 
                        visualDescription: '夜之城的高楼大厦，巨大的全息锦鲤在楼宇间游动。', 
                        shotSize: '大远景 (ELS)', 
                        cameraAngle: '仰视', 
                        environment: '夜之城 - 街道',
                        characters: '无',
                        action: '横摇', 
                        duration: '5s', 
                        dialogue: '旁白：夜之城，梦开始的地方，也是梦破碎的地方。' 
                    },
                    { 
                        id: 'sh4', 
                        visualDescription: '大卫低头走着，撞到了一个路人。', 
                        shotSize: '中景 (MS)', 
                        cameraAngle: '侧视', 
                        environment: '夜之城 - 街道',
                        characters: '大卫, 路人',
                        action: '跟拍', 
                        duration: '3s', 
                        dialogue: '路人：喂！看着点路！' 
                    }
                ]
              }
            ]
          },
          {
            id: 'ep2',
            title: '第二集：觉醒',
            scenes: [
                {
                    sceneId: 's3',
                    header: '露西的藏身处 - 夜',
                    shots: [
                        { 
                            id: 'sh5', 
                            visualDescription: '露西专注的侧脸，霓虹光映在脸上。', 
                            shotSize: '近景 (MCU)', 
                            cameraAngle: '侧视', 
                            environment: '露西的藏身处',
                            characters: '露西',
                            action: '静止', 
                            duration: '3s', 
                            dialogue: '露西：搞定。' 
                        }
                    ]
                }
            ]
          }
        ],
        scenes: [], 
        characters: [
          {
            name: "大卫·马丁内斯",
            visualSummary: "17岁少年，身穿黄色夹克，留着朋克发型。眼神中透着倔强和迷茫。经常背着一个灰色的双肩包。",
            traits: "热血, 冲动, 重情义, 赛博朋克",
            imageUrls: ["https://images.unsplash.com/photo-1542598953-41310c43f54b?q=80&w=2670&auto=format&fit=crop"]
          },
          {
            name: "露西",
            visualSummary: "神秘的黑客少女，白发，穿着性感的连体衣。眼神冷酷，总是若有所思。",
            traits: "高冷, 神秘, 技术高超, 孤独",
            imageUrls: ["https://images.unsplash.com/photo-1605218427306-022ba8c6c6b3?q=80&w=2670&auto=format&fit=crop"]
          },
          {
             name: "曼恩",
             visualSummary: "体型巨大的雇佣兵，全身经过重度义体改造。性格豪爽，是团队的领袖。",
             traits: "强壮, 领袖气质, 义气, 狂暴",
             imageUrls: ["https://images.unsplash.com/photo-1559535332-db9971090158?q=80&w=2574&auto=format&fit=crop"]
          }
        ],
        assets: [
          {
            name: "荒坂塔",
            type: "Location",
            description: "夜之城的地标建筑，巨大的黑色高塔，象征着绝对的权力和控制。顶部有红色的荒坂标志。",
            imageUrls: ["https://images.unsplash.com/photo-1478760329108-5c3ed9d495a0?q=80&w=2574&auto=format&fit=crop"]
          },
          {
            name: "桑德威斯坦 (义体)",
            type: "Prop",
            description: "脊柱植入体，启动时可以让使用者进入超高速状态，周围世界仿佛静止。",
            imageUrls: ["https://images.unsplash.com/photo-1580927752452-89d86da3fa0a?q=80&w=2670&auto=format&fit=crop"]
          },
          {
            name: "大卫的夹克",
            type: "Prop",
            description: "鲜黄色的急救队夹克，背后有反光条。虽然有些磨损，但依然很醒目。",
            imageUrls: ["https://images.unsplash.com/photo-1591047139829-d91aecb6caea?q=80&w=2536&auto=format&fit=crop"]
          }
        ]
      }
    };

    // Save and load
    const stored = localStorage.getItem('script2video_projects');
    const projects = stored ? JSON.parse(stored) : [];
    const updatedProjects = [mockProject, ...projects];
    localStorage.setItem('script2video_projects', JSON.stringify(updatedProjects));
    
    setCurrentProject(mockProject);
    setView('workspace');
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
            />
          </>
        )}

        {view === 'workspace' && currentProject && (
          <Workspace 
            project={currentProject} 
            onBack={() => { setCurrentProject(null); setView('home'); }} 
            onSaveProject={handleSaveProject}
          />
        )}
      </div>
    </div>
  );
};

export default App;
