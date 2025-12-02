
import React, { useMemo, useState, useEffect } from 'react';
import { Scene, Shot, Episode } from '../types';
import { Camera, Clock, MapPin, User, MessageSquare, Image as ImageIcon, Film, Hash, MonitorPlay, ChevronDown, ChevronUp } from 'lucide-react';

interface StoryboardTableProps {
  scenes?: Scene[]; // Fallback flat list
  episodes?: Episode[]; // New grouped list
  onUpdateShot: (episodeIndex: number, sceneIndex: number, shotIndex: number, field: keyof Shot, value: string) => void;
}

export const StoryboardTable: React.FC<StoryboardTableProps> = ({ scenes, episodes, onUpdateShot }) => {
  const [collapsedEpisodes, setCollapsedEpisodes] = useState<number[]>([]);

  // Normalize data: Ensure we always work with Episodes.
  const displayEpisodes: Episode[] = useMemo(() => {
    if (episodes && episodes.length > 0) {
      return episodes;
    }
    if (scenes && scenes.length > 0) {
      return [{ id: 'default', title: '全集分镜', scenes: scenes }];
    }
    return [];
  }, [scenes, episodes]);

  // Auto-collapse older episodes when a new one is added
  useEffect(() => {
    if (displayEpisodes.length > 1) {
        // Collapse all except the last one
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

  // Helper: Parse "3s", "3.5", "3秒" into number
  const parseDuration = (dur: string): number => {
    if (!dur) return 0;
    const match = dur.match(/(\d+(\.\d+)?)/);
    return match ? parseFloat(match[0]) : 0;
  };

  // Helper: Format seconds to mm:ss
  const formatDuration = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    if (m > 0) return `${m}分 ${s}秒`;
    return `${s}秒`;
  };

  if (displayEpisodes.length === 0) {
    return null; 
  }

  return (
    <div className="h-full overflow-y-auto pr-2 pb-20 custom-scrollbar">
      
      {displayEpisodes.map((episode, epIndex) => {
        // Calculate Episode Stats
        const epShotCount = episode.scenes.reduce((acc, s) => acc + s.shots.length, 0);
        const epDuration = episode.scenes.reduce((acc, s) => acc + s.shots.reduce((a, shot) => a + parseDuration(shot.duration), 0), 0);
        const isCollapsed = collapsedEpisodes.includes(epIndex);

        return (
          <div key={epIndex} className={`mb-6 bg-white/[0.02] backdrop-blur-sm border border-white/5 rounded-2xl overflow-hidden shadow-2xl transition-all duration-500 ${isCollapsed ? 'opacity-70 hover:opacity-100 scale-[0.99]' : 'scale-100'}`}>
            
            {/* --- EPISODE HEADER (Redesigned: Floating Glass Bar) --- */}
            <div 
                onClick={() => toggleCollapse(epIndex)}
                className={`px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-20 backdrop-blur-md cursor-pointer transition-all duration-300 border-b ${
                    isCollapsed 
                    ? 'bg-gradient-to-r from-white/5 to-transparent border-white/5' 
                    : 'bg-gradient-to-r from-rose-900/60 via-purple-900/40 to-[#1a0510]/80 border-rose-500/20 shadow-[0_4px_20px_-5px_rgba(244,63,94,0.1)]'
                }`}
            >
                 <div className="flex items-center gap-4">
                    <div className={`p-2.5 rounded-xl border shadow-inner transition-colors duration-300 ${
                        isCollapsed 
                        ? 'bg-white/5 text-stone-500 border-white/5' 
                        : 'bg-rose-500/20 text-rose-200 border-rose-500/20 shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                    }`}>
                       <MonitorPlay size={22} />
                    </div>
                    <div>
                        <div className="flex items-center gap-3">
                            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border transition-colors ${
                                isCollapsed 
                                ? 'bg-white/5 text-stone-500 border-white/5' 
                                : 'bg-rose-500/10 text-rose-300 border-rose-500/20'
                            }`}>
                              第 {epIndex + 1} 部分
                            </span>
                        </div>
                        <h2 className={`text-xl font-bold tracking-tight mt-1 transition-colors ${
                            isCollapsed ? 'text-stone-400' : 'text-white text-shadow-sm'
                        }`}>{episode.title || episode.id}</h2>
                    </div>
                 </div>
                 <div className="flex items-center gap-6">
                    <div className="flex items-center gap-3">
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">总镜头</span>
                            <span className={`text-sm font-mono font-bold ${isCollapsed ? 'text-stone-400' : 'text-stone-200'}`}>{epShotCount}</span>
                        </div>
                        <div className="w-px h-8 bg-white/10 mx-1"></div>
                        <div className="flex flex-col items-end">
                            <span className="text-[10px] text-stone-500 font-medium uppercase tracking-wider">总时长</span>
                            <span className={`text-sm font-mono font-bold ${isCollapsed ? 'text-stone-400' : 'text-stone-200'}`}>{formatDuration(epDuration)}</span>
                        </div>
                    </div>
                    <div className={`transition-colors ${isCollapsed ? 'text-stone-600' : 'text-rose-400'}`}>
                        {isCollapsed ? <ChevronDown size={20} /> : <ChevronUp size={20} />}
                    </div>
                 </div>
            </div>

            {/* Continuous List of Shots */}
            {!isCollapsed && (
            <div className="divide-y divide-white/5 animate-fade-in">
              {episode.scenes.map((scene, sceneIndex) => (
                <React.Fragment key={sceneIndex}>
                    
                    {/* SCENE SEPARATOR ROW */}
                    <div className="bg-white/[0.02] px-6 py-2 border-y border-white/5 flex items-center gap-3 select-none group">
                        <Film size={12} className="text-stone-600 group-hover:text-rose-400 transition-colors" />
                        <span className="text-[10px] font-bold text-stone-500 font-mono tracking-wider group-hover:text-stone-300 transition-colors">
                            第 {scene.sceneId || sceneIndex + 1} 场: {scene.header}
                        </span>
                    </div>

                    {/* SHOTS */}
                    {scene.shots.map((shot, shotIndex) => (
                        <div key={shotIndex} className="p-6 hover:bg-white/[0.04] transition-colors group relative">
                            
                            {/* Shot ID Marker */}
                            <div className="absolute left-0 top-6 w-1 h-8 bg-rose-500/0 group-hover:bg-rose-500 transition-colors rounded-r-full shadow-[0_0_8px_rgba(244,63,94,0.6)]"></div>

                            {/* Top Row: Meta Inputs */}
                            <div className="flex flex-wrap items-center gap-3 mb-5 pl-2">
                                <span className="text-stone-500 font-mono text-xs font-semibold select-none mr-2 w-8 text-right">#{shot.id}</span>
                                
                                {/* Shot Size */}
                                <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5 transition-colors focus-within:border-rose-500/50 focus-within:ring-1 focus-within:ring-rose-500/20 hover:border-white/10 shadow-sm">
                                    <Camera size={12} className="text-sky-400" />
                                    <input 
                                        className="bg-transparent border-none focus:outline-none w-20 text-xs text-stone-300 placeholder-stone-600 font-medium"
                                        value={shot.shotSize}
                                        onChange={(e) => onUpdateShot(epIndex, sceneIndex, shotIndex, 'shotSize', e.target.value)}
                                        placeholder="景别"
                                    />
                                </div>

                                {/* Angle */}
                                <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5 transition-colors focus-within:border-rose-500/50 focus-within:ring-1 focus-within:ring-rose-500/20 hover:border-white/10 shadow-sm">
                                    <MapPin size={12} className="text-emerald-400" />
                                    <input 
                                        className="bg-transparent border-none focus:outline-none w-24 text-xs text-stone-300 placeholder-stone-600 font-medium"
                                        value={shot.cameraAngle}
                                        onChange={(e) => onUpdateShot(epIndex, sceneIndex, shotIndex, 'cameraAngle', e.target.value)}
                                        placeholder="运镜"
                                    />
                                </div>

                                {/* Duration */}
                                <div className="flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5 transition-colors focus-within:border-rose-500/50 ml-auto hover:border-white/10 shadow-sm">
                                    <Clock size={12} className="text-amber-400" />
                                    <input 
                                        className="bg-transparent border-none focus:outline-none w-10 text-xs text-stone-300 text-right font-mono"
                                        value={shot.duration}
                                        onChange={(e) => onUpdateShot(epIndex, sceneIndex, shotIndex, 'duration', e.target.value)}
                                    />
                                </div>
                            </div>

                            {/* Prompt Section */}
                            <div className="mb-6 pl-12 relative">
                                <div className="absolute top-0 right-0 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <span className="text-[9px] font-bold tracking-wider text-stone-500 uppercase bg-black/40 px-2 py-1 rounded border border-white/5">画面提示词</span>
                                </div>
                                <div className="relative">
                                     <ImageIcon size={14} className="absolute -left-7 top-1 text-rose-400/50 group-hover:text-rose-400 transition-colors" />
                                     <textarea 
                                        className="w-full bg-black/20 border border-white/5 rounded-xl p-4 text-sm text-stone-200 focus:ring-1 focus:ring-rose-500/30 focus:border-rose-500/40 focus:outline-none resize-none h-24 leading-relaxed shadow-inner font-mono transition-colors hover:bg-black/30 selection:bg-rose-500/30 selection:text-white"
                                        value={shot.visualDescription}
                                        onChange={(e) => onUpdateShot(epIndex, sceneIndex, shotIndex, 'visualDescription', e.target.value)}
                                        spellCheck={false}
                                    />
                                </div>
                            </div>

                            {/* Context Grid */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pl-12">
                                <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        <User size={12} className="text-purple-400" />
                                        <span className="text-[10px] font-bold text-stone-500 uppercase">动作 (Action)</span>
                                    </div>
                                    <textarea 
                                        className="w-full bg-transparent border-none p-0 focus:ring-0 text-xs text-stone-300 resize-none h-auto overflow-hidden placeholder-stone-600 leading-relaxed"
                                        value={`${shot.characters} ${shot.action}`}
                                        rows={2}
                                        onChange={(e) => onUpdateShot(epIndex, sceneIndex, shotIndex, 'action', e.target.value)}
                                    />
                                </div>
                                <div className="bg-white/[0.02] p-4 rounded-xl border border-white/5 hover:border-white/10 transition-colors">
                                    <div className="flex items-center gap-2 mb-2">
                                        <MessageSquare size={12} className="text-pink-400" />
                                        <span className="text-[10px] font-bold text-stone-500 uppercase">台词 (Dialogue)</span>
                                    </div>
                                    <textarea 
                                        className="w-full bg-transparent border-none p-0 focus:ring-0 text-xs text-stone-300 italic resize-none h-auto overflow-hidden placeholder-stone-600 leading-relaxed"
                                        value={shot.dialogue || ""}
                                        placeholder="（无台词）"
                                        rows={2}
                                        onChange={(e) => onUpdateShot(epIndex, sceneIndex, shotIndex, 'dialogue', e.target.value)}
                                    />
                                </div>
                            </div>

                        </div>
                    ))}
                </React.Fragment>
              ))}
            </div>
            )}
          </div>
        );
      })}
    </div>
  );
};