import React, { useEffect, useState } from 'react';
import { Folder, Clock, Plus, Search, Trash2, Link, Loader2, RefreshCw, Users } from 'lucide-react';
import { Project } from '../types';

interface ServerProject extends Project {
  myRole?: string;
}

interface ProjectListProps {
  onSelectProject: (project: Project) => void;
  onCreateNew: () => void;
  onLoadMock?: () => void;
  onJoin?: (code: string) => void;
}

// Helper function to extract project ID from invite link or raw ID
const extractProjectId = (input: string): string => {
  const trimmed = input.trim();
  
  // Check if it's a full URL with ?join= parameter
  if (trimmed.includes('?join=') || trimmed.includes('&join=')) {
    try {
      const url = new URL(trimmed);
      const joinParam = url.searchParams.get('join');
      if (joinParam) {
        console.log('Extracted project ID from URL:', joinParam);
        return joinParam;
      }
    } catch (e) {
      // Not a valid URL, try regex fallback
      const match = trimmed.match(/[?&]join=([^&]+)/);
      if (match && match[1]) {
        console.log('Extracted project ID via regex:', match[1]);
        return match[1];
      }
    }
  }
  
  // Return as-is (assume it's already a project ID)
  return trimmed;
};

export const ProjectList: React.FC<ProjectListProps> = ({ onSelectProject, onCreateNew, onLoadMock, onJoin }) => {
  const [projects, setProjects] = useState<ServerProject[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadProjects = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const token = localStorage.getItem('script2video_token');
      const res = await fetch('http://localhost:3001/api/project', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (!res.ok) {
        throw new Error('Failed to load projects');
      }
      
      const data = await res.json();
      setProjects(data);
    } catch (e) {
      console.error("Failed to load projects", e);
      setError('无法加载项目列表，请检查服务器连接');
      try {
        const stored = localStorage.getItem('script2video_projects');
        if (stored) {
          setProjects(JSON.parse(stored));
        }
      } catch (e2) {
        console.error("Failed to load local projects", e2);
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadProjects();
  }, []);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这个项目吗？')) {
      try {
        const token = localStorage.getItem('script2video_token');
        const res = await fetch(`http://localhost:3001/api/project/${id}`, {
          method: 'DELETE',
          headers: { Authorization: `Bearer ${token}` }
        });
        
        if (!res.ok) {
          const data = await res.json();
          alert(data.error || '删除失败');
          return;
        }
        
        setProjects(prev => prev.filter(p => p.id !== id));
      } catch (err) {
        console.error('Delete error:', err);
        alert('删除失败，请重试');
      }
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-4">
          <div>
            <h2 className="text-3xl font-display font-bold text-white mb-1">我的项目</h2>
            <p className="text-slate-500 text-xs font-mono uppercase tracking-widest">Workspace</p>
          </div>
          <button 
            onClick={loadProjects}
            disabled={isLoading}
            className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-white transition-colors disabled:opacity-50"
            title="刷新项目列表"
          >
            <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          </button>
        </div>
        
        <div className="flex items-center gap-4">
            <div className="flex items-center bg-white/5 border border-white/10 rounded-xl px-2 focus-within:border-[#ccff00] transition-colors h-[42px]">
                <Link size={14} className="text-slate-500 ml-2" />
                <input 
                    type="text" 
                    placeholder="输入项目ID或邀请链接..." 
                    className="bg-transparent border-none text-xs text-white px-3 py-2 outline-none w-40 placeholder-slate-600 font-mono"
                    value={inviteCode}
                    onChange={(e) => setInviteCode(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && inviteCode && onJoin) {
                            const projectId = extractProjectId(inviteCode);
                            onJoin(projectId);
                            setInviteCode('');
                        }
                    }}
                />
                <button 
                    disabled={!inviteCode}
                    onClick={() => { 
                        if(onJoin) { 
                            const projectId = extractProjectId(inviteCode);
                            onJoin(projectId); 
                            setInviteCode(''); 
                        } 
                    }}
                    className="text-[10px] font-bold bg-[#ccff00]/10 text-[#ccff00] px-2 py-1 rounded hover:bg-[#ccff00]/20 disabled:opacity-50 uppercase"
                >
                    加入
                </button>
            </div>

           <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
              <input 
                 type="text" 
                 placeholder="搜索项目..." 
                 value={searchTerm}
                 onChange={(e) => setSearchTerm(e.target.value)}
                 className="bg-white/5 border border-white/10 rounded-xl py-2 pl-10 pr-4 text-sm text-white placeholder-slate-600 focus:border-[#ccff00] outline-none transition-all w-64"
              />
           </div>
           {onLoadMock && (
             <button 
                onClick={onLoadMock}
                className="px-4 py-2 bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white rounded-xl font-bold text-xs uppercase tracking-wider transition-all border border-white/5 hover:border-white/20"
             >
                加载示例
             </button>
           )}
           <button 
              onClick={onCreateNew}
              className="flex items-center gap-2 px-4 py-2 bg-[#ccff00] hover:bg-[#d9f99d] text-black rounded-xl font-bold text-xs uppercase tracking-wider transition-transform hover:scale-105"
            >
              <Plus size={16} /> 新建项目
           </button>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center justify-between">
          <span>{error}</span>
          <button onClick={loadProjects} className="text-xs bg-red-500/20 px-3 py-1 rounded hover:bg-red-500/30">
            重试
          </button>
        </div>
      )}

      {isLoading && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={32} className="animate-spin text-[#ccff00]" />
        </div>
      )}

      {!isLoading && (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <div 
          onClick={onCreateNew}
          className="group relative aspect-[4/3] border-2 border-dashed border-white/10 rounded-3xl flex flex-col items-center justify-center cursor-pointer hover:border-[#ccff00]/50 hover:bg-[#ccff00]/5 transition-all"
        >
           <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center group-hover:scale-110 transition-transform mb-4">
              <Plus size={32} className="text-slate-500 group-hover:text-[#ccff00]" />
           </div>
           <span className="text-slate-500 font-bold text-sm group-hover:text-white">创建新项目</span>
        </div>

        {filteredProjects.map(project => (
          <div 
            key={project.id}
            onClick={() => onSelectProject(project)}
            className="group relative aspect-[4/3] bg-[#0f0518] border border-white/10 rounded-3xl p-6 cursor-pointer hover:border-white/30 hover:shadow-[0_0_30px_rgba(204,255,0,0.1)] transition-all flex flex-col justify-between overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={(e) => handleDelete(e, project.id)}
                  className="p-2 hover:bg-white/10 rounded-lg text-slate-500 hover:text-red-400"
                >
                   <Trash2 size={16} />
                </button>
            </div>

            <div className="flex items-start justify-between">
               <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-white/10 to-transparent flex items-center justify-center border border-white/5 group-hover:border-[#ccff00]/30 transition-colors">
                  <Folder size={24} className="text-[#ccff00]" />
               </div>
               {project.coverImage && (
                  <div className="w-16 h-12 rounded-lg overflow-hidden opacity-50 group-hover:opacity-100 transition-opacity">
                      <img src={project.coverImage} alt="Cover" className="w-full h-full object-cover" />
                  </div>
               )}
            </div>

            <div>
               <h3 className="text-xl font-bold text-white mb-2 line-clamp-1 group-hover:text-[#ccff00] transition-colors">{project.name}</h3>
               <p className="text-slate-500 text-xs line-clamp-2 mb-4 h-8">{project.description || '无简介'}</p>
               
               <div className="flex items-center gap-4 text-[10px] text-slate-600 font-mono">
                  <span className="flex items-center gap-1">
                     <Clock size={10} />
                     {new Date(project.updatedAt).toLocaleDateString()}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-white/5 border border-white/5">
                     {project.creator}
                  </span>
                  {project.myRole && (
                    <span className={`px-2 py-0.5 rounded border flex items-center gap-1 ${
                      project.myRole === 'admin' ? 'bg-[#ccff00]/10 border-[#ccff00]/20 text-[#ccff00]' :
                      project.myRole === 'editor' ? 'bg-blue-500/10 border-blue-500/20 text-blue-400' :
                      'bg-slate-500/10 border-slate-500/20 text-slate-400'
                    }`}>
                      <Users size={8} />
                      {project.myRole === 'admin' ? '管理员' : project.myRole === 'editor' ? '编辑者' : '查看者'}
                    </span>
                  )}
               </div>
            </div>
          </div>
        ))}
      </div>
      )}
    </div>
  );
};
