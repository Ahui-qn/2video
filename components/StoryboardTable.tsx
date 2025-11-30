
import React, { useMemo } from 'react';
import { Scene, Shot } from '../types';
import { Camera, Clock, MapPin, User, MessageSquare, Image as ImageIcon, Film, Hash } from 'lucide-react';

interface StoryboardTableProps {
  scenes: Scene[];
  onUpdateShot: (sceneIndex: number, shotIndex: number, field: keyof Shot, value: string) => void;
}

export const StoryboardTable: React.FC<StoryboardTableProps> = ({ scenes, onUpdateShot }) => {
  
  // Helper: Parse "3s", "3.5", "3秒" into number
  const parseDuration = (dur: string): number => {
    if (!dur) return 0;
    // Match first integer or float
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

  // Calculate Stats
  const stats = useMemo(() => {
    const sceneStats = scenes.map(scene => {
      const sCount = scene.shots.length;
      const sDur = scene.shots.reduce((acc, shot) => acc + parseDuration(shot.duration), 0);
      return { count: sCount, duration: sDur };
    });

    return { sceneStats };
  }, [scenes]);

  if (scenes.length === 0) {
    return null; // Handled by parent
  }

  return (
    <div className="h-full overflow-y-auto pr-4 pb-20 custom-scrollbar">
      
      {scenes.map((scene, sceneIndex) => {
        const sceneStat = stats.sceneStats[sceneIndex];
        
        return (
          <div key={sceneIndex} className="mb-10 bg-white/[0.03] backdrop-blur-sm border border-white/5 rounded-2xl overflow-hidden shadow-lg transition-all hover:border-white/10">
            
            {/* Scene Header */}
            <div className="bg-white/[0.05] px-6 py-4 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 sticky top-0 z-10 backdrop-blur-md">
               <div className="flex items-center gap-4 overflow-hidden">
                 <div className="shrink-0 flex items-center gap-2 text-indigo-300 font-mono text-xs font-bold bg-indigo-500/10 px-3 py-1 rounded-lg border border-indigo-500/20">
                  <Film size={12} />
                  SCENE {scene.sceneId || sceneIndex + 1}
                </div>
                <h3 className="text-white font-semibold text-base tracking-wide truncate" title={scene.header}>{scene.header}</h3>
               </div>

               {/* Scene Specific Stats */}
               <div className="flex items-center gap-3 shrink-0">
                 <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/20 border border-white/5 text-[10px] text-slate-400 font-mono">
                    <Hash size={10} />
                    <span>{sceneStat.count} SHOTS</span>
                 </div>
                 <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-black/20 border border-white/5 text-[10px] text-slate-400 font-mono">
                    <Clock size={10} />
                    <span>{formatDuration(sceneStat.duration)}</span>
                 </div>
               </div>
            </div>

            {/* Shots List */}
            <div className="divide-y divide-white/5">
              {scene.shots.map((shot, shotIndex) => (
                <div key={shotIndex} className="p-6 hover:bg-white/[0.02] transition-colors group">
                  
                  {/* Top Row: Meta info pills */}
                  <div className="flex flex-wrap items-center gap-3 mb-5">
                    <span className="text-slate-500 font-mono text-xs font-semibold select-none mr-1">#{shot.id}</span>
                    
                    {/* Shot Size Pill */}
                    <div className="group/input flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5 transition-colors hover:border-white/10 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20">
                      <Camera size={12} className="text-sky-400" />
                      <input 
                        className="bg-transparent border-none focus:outline-none w-20 text-xs text-slate-300 placeholder-slate-600 font-medium"
                        value={shot.shotSize}
                        onChange={(e) => onUpdateShot(sceneIndex, shotIndex, 'shotSize', e.target.value)}
                        placeholder="景别"
                      />
                    </div>

                    {/* Camera Angle Pill */}
                    <div className="group/input flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5 transition-colors hover:border-white/10 focus-within:border-indigo-500/50 focus-within:ring-1 focus-within:ring-indigo-500/20">
                      <MapPin size={12} className="text-emerald-400" />
                      <input 
                        className="bg-transparent border-none focus:outline-none w-28 text-xs text-slate-300 placeholder-slate-600 font-medium"
                        value={shot.cameraAngle}
                        onChange={(e) => onUpdateShot(sceneIndex, shotIndex, 'cameraAngle', e.target.value)}
                        placeholder="运镜"
                      />
                    </div>

                    {/* Duration Pill */}
                     <div className="group/input flex items-center gap-2 bg-black/20 px-3 py-1.5 rounded-lg border border-white/5 transition-colors hover:border-white/10 focus-within:border-indigo-500/50 ml-auto">
                      <Clock size={12} className="text-amber-400" />
                      <input 
                        className="bg-transparent border-none focus:outline-none w-10 text-xs text-slate-300 text-right font-mono"
                        value={shot.duration}
                        onChange={(e) => onUpdateShot(sceneIndex, shotIndex, 'duration', e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Middle Row: The Prompt (Crucial) */}
                  <div className="mb-6 relative">
                    <div className="absolute top-0 right-0 z-10">
                      <span className="text-[9px] font-bold tracking-wider text-slate-400 uppercase bg-white/5 px-2 py-0.5 rounded border border-white/5">Prompt</span>
                    </div>
                    <label className="block text-xs font-medium text-indigo-300 mb-2.5 tracking-wide flex items-center gap-2">
                      <ImageIcon size={14} />
                      AI 画面提示词
                    </label>
                    <textarea 
                      className="w-full bg-black/20 border border-white/10 rounded-xl p-4 text-sm text-slate-200 focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500/40 focus:outline-none resize-none h-28 leading-relaxed shadow-inner transition-all hover:bg-black/30 font-mono"
                      value={shot.visualDescription}
                      onChange={(e) => onUpdateShot(sceneIndex, shotIndex, 'visualDescription', e.target.value)}
                      spellCheck={false}
                    />
                  </div>

                  {/* Bottom Grid: Context */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-white/[0.02] p-5 rounded-xl border border-white/5">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <User size={14} className="text-purple-400" />
                        <span className="text-xs font-semibold text-slate-400">人物与动作</span>
                      </div>
                      <textarea 
                        className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm text-slate-300 resize-none h-auto overflow-hidden placeholder-slate-600 leading-relaxed"
                        value={`${shot.characters} ${shot.action}`}
                        rows={2}
                        onChange={(e) => onUpdateShot(sceneIndex, shotIndex, 'action', e.target.value)}
                      />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <MessageSquare size={14} className="text-pink-400" />
                        <span className="text-xs font-semibold text-slate-400">台词</span>
                      </div>
                      <textarea 
                        className="w-full bg-transparent border-none p-0 focus:ring-0 text-sm text-slate-300 italic resize-none h-auto overflow-hidden placeholder-slate-600 leading-relaxed"
                        value={shot.dialogue || ""}
                        placeholder="（无台词）"
                        rows={2}
                        onChange={(e) => onUpdateShot(sceneIndex, shotIndex, 'dialogue', e.target.value)}
                      />
                    </div>
                  </div>

                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
};
