import React, { useEffect, useState } from 'react';
import { Folder, Clock, Plus, Search, MoreVertical, Trash2 } from 'lucide-react';
import { Project } from '../types';

interface ProjectListProps {
  onSelectProject: (project: Project) => void;
  onCreateNew: () => void;
  onLoadMock?: () => void;
}

export const ProjectList: React.FC<ProjectListProps> = ({ onSelectProject, onCreateNew, onLoadMock }) => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const loadProjects = () => {
      try {
        const stored = localStorage.getItem('script2video_projects');
        if (stored) {
          setProjects(JSON.parse(stored));
        }
      } catch (e) {
        console.error("Failed to load projects", e);
      }
    };
    loadProjects();
    // Listen for storage events (if multiple tabs) or custom events could go here
    // For now, simple load on mount
  }, []);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm('确定要删除这个项目吗？')) {
      const newProjects = projects.filter(p => p.id !== id);
      setProjects(newProjects);
      localStorage.setItem('script2video_projects', JSON.stringify(newProjects));
    }
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    p.description.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex-1 p-8 overflow-y-auto custom-scrollbar">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-display font-bold text-white mb-1">我的项目</h2>
          <p className="text-slate-500 text-xs font-mono uppercase tracking-widest">Workspace</p>
        </div>
        
        <div className="flex items-center gap-4">
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

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        
        {/* New Project Card (Alternative trigger) */}
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
            {/* Folder Tab Effect */}
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
               </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
