
import React, { useMemo, useState, useEffect } from 'react';
import { Scene, Shot, Episode } from '../types';
import { Camera, Clock, MapPin, User, MessageSquare, Image as ImageIcon, Film, Hash, MonitorPlay, ChevronDown, ChevronUp } from 'lucide-react';

interface StoryboardTableProps {
  scenes?: Scene[]; 
  episodes?: Episode[]; 
  onUpdateShot: (episodeIndex: number, sceneIndex: number, shotIndex: number, field: keyof Shot, value: string) => void;
}

export const StoryboardTable: React.FC<StoryboardTableProps> = ({ scenes, episodes, onUpdateShot }) => {
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
          <div key={epIndex} className={`mb-12 transition-all duration-500 ${isCollapsed ? 'opacity-50 grayscale hover:grayscale-0 hover:opacity-100' : ''}`}>
            
            {/* --- MASSIVE HEADER --- */}
            <div 
                onClick={() => toggleCollapse(epIndex)}
                className="cursor-pointer group relative mb-6"
            >
                 <div className="absolute -left-4 top-0 bottom-0 w-1 bg-[#d946ef] transform scale-y-0 group-hover:scale-y-100 transition-transform duration-300"></div>
                 <h2 className="text-6xl md:text-8xl font-black font-display tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-600 group-hover:from-[#d946ef] group-hover:to-white transition-all duration-500 opacity-20 group-hover:opacity-100 select-none">
                    第 0{epIndex + 1} 集
                 </h2>
                 <div className="absolute bottom-2 left-2 md:left-4 flex items-baseline gap-4">
                     <h3 className="text-xl md:text-2xl font-bold text-white drop-shadow-md">{episode.title || episode.id}</h3>
                     <div className="flex gap-3 text-xs font-mono font-bold text-[#ccff00]">
                        <span>{epShotCount} 个镜头</span>
                        <span>{formatDuration(epDuration)}</span>
                     </div>
                 </div>
            </div>

            {/* List */}
            {!isCollapsed && (
            <div className="space-y-4 animate-fade-in pl-2 md:pl-6">
              {episode.scenes.map((scene, sceneIndex) => (
                <div key={sceneIndex} className="bg-white/5 border-t border-l border-white/10 border-r border-b border-black/40 rounded-3xl p-6 backdrop-blur-md">
                    
                    {/* SCENE HEADER */}
                    <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/5">
                        <div className="px-2 py-1 bg-[#ccff00] text-black text-[10px] font-bold font-mono uppercase rounded">第 {scene.sceneId || sceneIndex + 1} 场</div>
                        <span className="text-sm font-bold text-slate-300 uppercase tracking-wider font-display">
                            {scene.header}
                        </span>
                    </div>

                    {/* SHOTS GRID */}
                    <div className="grid grid-cols-1 gap-6">
                        {scene.shots.map((shot, shotIndex) => (
                            <div key={shotIndex} className="relative group/shot">
                                {/* Shot Number */}
                                <div className="absolute -left-3 top-0 text-[10px] font-mono text-slate-600 -rotate-90 origin-top-right mt-4 select-none">#{shot.id}</div>
                                
                                <div className="flex flex-col md:flex-row gap-6">
                                    
                                    {/* Left: Visuals */}
                                    <div className="flex-1 space-y-4">
                                        <div className="flex gap-2">
                                            {/* Carved Inputs */}
                                            <div className="flex-1 bg-black/40 shadow-inner border border-white/5 rounded-lg px-3 py-2 flex items-center gap-2">
                                                <Camera size={12} className="text-[#ccff00]" />
                                                <input className="bg-transparent w-full text-xs text-white font-bold placeholder-slate-600 outline-none" 
                                                    value={shot.shotSize} onChange={(e) => onUpdateShot(epIndex, sceneIndex, shotIndex, 'shotSize', e.target.value)} placeholder="景别" />
                                            </div>
                                            <div className="flex-1 bg-black/40 shadow-inner border border-white/5 rounded-lg px-3 py-2 flex items-center gap-2">
                                                <MapPin size={12} className="text-[#d946ef]" />
                                                <input className="bg-transparent w-full text-xs text-white font-bold placeholder-slate-600 outline-none" 
                                                    value={shot.cameraAngle} onChange={(e) => onUpdateShot(epIndex, sceneIndex, shotIndex, 'cameraAngle', e.target.value)} placeholder="角度" />
                                            </div>
                                            <div className="w-20 bg-black/40 shadow-inner border border-white/5 rounded-lg px-3 py-2 text-right">
                                                <input className="bg-transparent w-full text-xs text-[#ccff00] font-mono font-bold text-right outline-none" 
                                                    value={shot.duration} onChange={(e) => onUpdateShot(epIndex, sceneIndex, shotIndex, 'duration', e.target.value)} />
                                            </div>
                                        </div>

                                        <textarea 
                                            className="w-full bg-black/20 hover:bg-black/30 border border-white/5 hover:border-white/20 rounded-xl p-4 text-sm text-slate-200 focus:border-[#ccff00] focus:ring-0 outline-none resize-none h-32 leading-relaxed shadow-inner transition-colors font-sans"
                                            value={shot.visualDescription}
                                            onChange={(e) => onUpdateShot(epIndex, sceneIndex, shotIndex, 'visualDescription', e.target.value)}
                                            spellCheck={false}
                                            placeholder="画面描述"
                                        />
                                    </div>

                                    {/* Right: Audio/Action */}
                                    <div className="w-full md:w-1/3 space-y-4">
                                        <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 group-hover/shot:border-white/10 transition-colors">
                                            <div className="flex items-center gap-2 mb-2">
                                                <User size={10} className="text-slate-500" />
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">画面 / 动作</span>
                                            </div>
                                            <textarea 
                                                className="w-full bg-transparent border-none p-0 text-xs text-slate-300 resize-none outline-none leading-relaxed"
                                                value={`${shot.characters} ${shot.action}`}
                                                rows={3}
                                                onChange={(e) => onUpdateShot(epIndex, sceneIndex, shotIndex, 'action', e.target.value)}
                                            />
                                        </div>
                                        <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 group-hover/shot:border-white/10 transition-colors">
                                            <div className="flex items-center gap-2 mb-2">
                                                <MessageSquare size={10} className="text-slate-500" />
                                                <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">台词</span>
                                            </div>
                                            <textarea 
                                                className="w-full bg-transparent border-none p-0 text-xs text-slate-300 italic resize-none outline-none leading-relaxed"
                                                value={shot.dialogue || ""}
                                                placeholder="（无台词）"
                                                rows={3}
                                                onChange={(e) => onUpdateShot(epIndex, sceneIndex, shotIndex, 'dialogue', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                </div>
                                <div className="h-px w-full bg-gradient-to-r from-transparent via-white/5 to-transparent mt-8"></div>
                            </div>
                        ))}
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
