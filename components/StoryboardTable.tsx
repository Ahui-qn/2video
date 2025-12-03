import React, { useMemo, useState, useEffect } from 'react';
import { Scene, Shot, Episode } from '../types';
import { Camera, MapPin, User, MessageSquare, Plus, Trash2, Video } from 'lucide-react';

interface StoryboardTableProps {
  scenes?: Scene[]; 
  episodes?: Episode[]; 
  onUpdateShot: (episodeIndex: number, sceneIndex: number, shotIndex: number, field: keyof Shot, value: string) => void;
  onAddShot?: (episodeIndex: number, sceneIndex: number) => void;
  onDeleteShot?: (episodeIndex: number, sceneIndex: number, shotIndex: number) => void;
  onInsertShot?: (episodeIndex: number, sceneIndex: number, insertIndex: number) => void;
}

export const StoryboardTable: React.FC<StoryboardTableProps> = ({ scenes, episodes, onUpdateShot, onAddShot, onDeleteShot, onInsertShot }) => {
  const [collapsedEpisodes, setCollapsedEpisodes] = useState<number[]>([]);

  const displayEpisodes: Episode[] = useMemo(() => {
    if (episodes && episodes.length > 0) return episodes;
    if (scenes && scenes.length > 0) return [{ id: 'default', title: '全部分镜', scenes: scenes }];
    return [];
  }, [scenes, episodes]);

  useEffect(() => {
    if (displayEpisodes.length > 1) {
        const allIndices = displayEpisodes.map((_, i) => i);
        const allExceptLast = allIndices.slice(0, -1);
        setCollapsedEpisodes(prev => {
            const unique = Array.from(new Set([...prev, ...allExceptLast]));
            return unique;
        });
    }
  }, [displayEpisodes.length]);

  const toggleCollapse = (index: number) => {
    setCollapsedEpisodes(prev => 
        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const parseDuration = (dur: string): number => {
    if (!dur) return 0;
    const match = dur.match(/(\d+(\.\d+)?)/);
    return match ? parseFloat(match[0]) : 0;
  };

  const formatDuration = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    if (m > 0) return `${m}分 ${s}秒`;
    return `${s}秒`;
  };

  if (displayEpisodes.length === 0) return null; 

  return (
    <div className="h-full overflow-y-auto pr-2 pb-20 custom-scrollbar">
      {displayEpisodes.map((episode, epIndex) => {
        const epShotCount = episode.scenes.reduce((acc, s) => acc + s.shots.length, 0);
        const epDuration = episode.scenes.reduce((acc, s) => acc + s.shots.reduce((a, shot) => a + parseDuration(shot.duration), 0), 0);
        const isCollapsed = collapsedEpisodes.includes(epIndex);

        return (
          <div key={epIndex} className={`mb-8 transition-all duration-500 ${isCollapsed ? 'opacity-50 grayscale hover:grayscale-0 hover:opacity-100' : ''}`}>
            
            {/* --- HEADER --- */}
            <div 
                onClick={() => toggleCollapse(epIndex)}
                className="cursor-pointer group relative mb-4 select-none"
            >
                 <div className="absolute -left-4 top-0 bottom-0 w-1 bg-[#d946ef] transform scale-y-0 group-hover:scale-y-100 transition-transform duration-300"></div>
                 <div className="flex items-baseline gap-4">
                     <h2 className="text-3xl font-black font-display tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-600 group-hover:from-[#d946ef] group-hover:to-white transition-all duration-300">
                        {episode.title || `第 ${epIndex + 1} 集`}
                     </h2>
                     <div className="flex gap-3 text-xs font-mono font-bold text-[#ccff00] opacity-60 group-hover:opacity-100 transition-opacity">
                        <span>{epShotCount} SHOTS</span>
                        <span>{formatDuration(epDuration)}</span>
                     </div>
                 </div>
            </div>

            {/* List */}
            {!isCollapsed && (
            <div className="space-y-4 animate-fade-in pl-1">
              {episode.scenes.map((scene, sceneIndex) => (
                <div key={sceneIndex} className="bg-white/[0.02] border border-white/5 rounded-2xl p-4 backdrop-blur-sm shadow-sm">
                    
                    {/* SCENE HEADER */}
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                        <div className="flex items-center gap-3">
                             <div className="px-2 py-1 bg-[#ccff00]/10 text-[#ccff00] border border-[#ccff00]/20 text-[10px] font-bold font-mono uppercase rounded">SCENE {scene.sceneId || sceneIndex + 1}</div>
                             <span className="text-sm font-bold text-slate-300 uppercase tracking-wider font-display max-w-[400px] truncate" title={scene.header}>
                                 {scene.header}
                             </span>
                        </div>
                    </div>

                    {/* SHOTS LIST - COMPACT DESIGN */}
                    <div className="flex flex-col gap-0">
                        {scene.shots.map((shot, shotIndex) => (
                            <React.Fragment key={shotIndex}>
                                {/* INSERT SHOT UI (Before current shot) */}
                                {onInsertShot && (
                                    <div 
                                        className="h-2 w-full -my-1 relative z-10 opacity-0 hover:opacity-100 transition-all flex items-center justify-center cursor-pointer group/insert"
                                        onClick={() => onInsertShot(epIndex, sceneIndex, shotIndex)}
                                        title="在此处插入新镜头"
                                    >
                                        <div className="w-full h-[1px] bg-[#d946ef] group-hover/insert:h-[2px] shadow-[0_0_8px_#d946ef] transition-all"></div>
                                        <div className="absolute bg-[#0f0518] border border-[#d946ef] text-[#d946ef] text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 transform scale-0 group-hover/insert:scale-100 transition-transform duration-200 shadow-lg">
                                            <Plus size={8} /> 插入镜头
                                        </div>
                                    </div>
                                )}

                                <div className="group/shot relative flex gap-3 p-3 bg-black/20 hover:bg-black/40 border border-white/5 hover:border-white/10 rounded-xl transition-all my-1 z-20 hover:z-30">
                                    
                                    {/* 1. INDEX Column */}
                                    <div className="flex flex-col items-center justify-start pt-1 gap-2 w-8 shrink-0">
                                        <span className="text-[10px] font-mono text-slate-500 font-bold">#{shot.id}</span>
                                        {onDeleteShot && (
                                            <button 
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteShot(epIndex, sceneIndex, shotIndex);
                                                }}
                                                className="opacity-0 group-hover/shot:opacity-100 text-slate-600 hover:text-red-500 transition-all p-1 cursor-pointer pointer-events-auto"
                                                title="删除镜头"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>

                                    {/* 2. Main Content Grid */}
                                    <div className="flex-1 grid grid-cols-12 gap-3">
                                        
                                        {/* VISUALS (Left - Wider) */}
                                        <div className="col-span-12 md:col-span-7 flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                {/* Parameters Row */}
                                                <div className="flex items-center gap-1.5 bg-white/5 rounded px-2 py-1 border border-white/5">
                                                    <Camera size={10} className="text-[#ccff00]" />
                                                    <input 
                                                        className="bg-transparent w-16 text-[10px] text-slate-300 font-bold placeholder-slate-600 outline-none" 
                                                        value={shot.shotSize} 
                                                        onChange={(e) => onUpdateShot(epIndex, sceneIndex, shotIndex, 'shotSize', e.target.value)} 
                                                        placeholder="景别" 
                                                    />
                                                </div>
                                                <div className="flex items-center gap-1.5 bg-white/5 rounded px-2 py-1 border border-white/5">
                                                    <Video size={10} className="text-[#d946ef]" />
                                                    <input 
                                                        className="bg-transparent w-16 text-[10px] text-slate-300 font-bold placeholder-slate-600 outline-none" 
                                                        value={shot.cameraAngle} 
                                                        onChange={(e) => onUpdateShot(epIndex, sceneIndex, shotIndex, 'cameraAngle', e.target.value)} 
                                                        placeholder="角度" 
                                                    />
                                                </div>
                                                <div className="flex-1"></div>
                                                <div className="flex items-center gap-1.5 bg-white/5 rounded px-2 py-1 border border-white/5 ml-auto">
                                                    <input 
                                                        className="bg-transparent w-8 text-[10px] text-[#ccff00] font-mono font-bold text-right outline-none" 
                                                        value={shot.duration} 
                                                        onChange={(e) => onUpdateShot(epIndex, sceneIndex, shotIndex, 'duration', e.target.value)} 
                                                    />
                                                </div>
                                            </div>

                                            {/* Visual Description */}
                                            <textarea 
                                                className="w-full bg-black/20 hover:bg-black/30 border border-white/5 hover:border-white/20 rounded-lg p-2 text-xs text-slate-200 focus:border-[#ccff00] focus:ring-0 outline-none resize-none h-20 leading-relaxed shadow-inner transition-colors font-sans"
                                                value={shot.visualDescription}
                                                onChange={(e) => onUpdateShot(epIndex, sceneIndex, shotIndex, 'visualDescription', e.target.value)}
                                                spellCheck={false}
                                                placeholder="画面描述..."
                                            />
                                        </div>

                                        {/* AUDIO / ACTION (Right - Narrower) */}
                                        <div className="col-span-12 md:col-span-5 flex flex-col gap-2">
                                            <div className="flex flex-col gap-1 h-full">
                                                <div className="flex items-center gap-1.5 opacity-50">
                                                    <User size={10} />
                                                    <span className="text-[9px] font-bold uppercase">Action</span>
                                                </div>
                                                <textarea 
                                                    className="w-full bg-white/[0.02] border border-white/5 rounded p-1.5 text-[10px] text-slate-400 resize-none outline-none leading-relaxed h-10 mb-1"
                                                    value={`${shot.characters} ${shot.action}`}
                                                    onChange={(e) => onUpdateShot(epIndex, sceneIndex, shotIndex, 'action', e.target.value)}
                                                    placeholder="动作..."
                                                />
                                                
                                                <div className="flex items-center gap-1.5 opacity-50">
                                                    <MessageSquare size={10} />
                                                    <span className="text-[9px] font-bold uppercase">Dialogue</span>
                                                </div>
                                                <textarea 
                                                    className="w-full bg-white/[0.02] border border-white/5 rounded p-1.5 text-[10px] text-slate-400 italic resize-none outline-none leading-relaxed flex-1 min-h-[40px]"
                                                    value={shot.dialogue || ""}
                                                    placeholder="（无台词）"
                                                    onChange={(e) => onUpdateShot(epIndex, sceneIndex, shotIndex, 'dialogue', e.target.value)}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </React.Fragment>
                        ))}

                        {/* ADD SHOT BUTTON (At the end) */}
                        {onAddShot && (
                            <button 
                                onClick={() => onAddShot(epIndex, sceneIndex)}
                                className="w-full py-2 mt-2 border border-dashed border-white/10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-bold text-slate-500 hover:text-[#ccff00] hover:border-[#ccff00]/50 hover:bg-[#ccff00]/5 transition-all group"
                            >
                                <Plus size={12} className="group-hover:scale-110 transition-transform" />
                                添加镜头 (ADD SHOT)
                            </button>
                        )}
                    </div>
                </div>
              ))}
            </div>
            )}
          </div>
        );
      })}
    </div>
  );
};