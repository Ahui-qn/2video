import React, { useMemo, useState, useEffect } from 'react';
import { Scene, Shot, Episode } from '../types';
import { Camera, User, MessageSquare, Plus, Trash2, Video, Edit3, Save, X, Image as ImageIcon, Download, Copy, Maximize2, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';

interface StoryboardTableProps {
  scenes?: Scene[]; 
  episodes?: Episode[]; 
  onUpdateShot: (episodeIndex: number, sceneIndex: number, shotIndex: number, field: keyof Shot, value: any) => void;
  onAddShot?: (episodeIndex: number, sceneIndex: number) => void;
  onDeleteShot?: (episodeIndex: number, sceneIndex: number, shotIndex: number) => void;
  onInsertShot?: (episodeIndex: number, sceneIndex: number, insertIndex: number) => void;
  onSaveEpisode?: (episodeId: string, scenes: Scene[]) => Promise<void>; // Async for status
}

export const StoryboardTable: React.FC<StoryboardTableProps> = ({ scenes, episodes, onUpdateShot, onAddShot, onDeleteShot, onInsertShot, onSaveEpisode }) => {
  const [collapsedEpisodes, setCollapsedEpisodes] = useState<number[]>([]);
  const [editingEpisodeId, setEditingEpisodeId] = useState<string | null>(null);
  const [localEpisodes, setLocalEpisodes] = useState<Episode[]>([]);
  
  // Save Status
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  // Image Preview Modal
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Normalize input into episodes list
  const sourceEpisodes: Episode[] = useMemo(() => {
    if (episodes && episodes.length > 0) return episodes;
    if (scenes && scenes.length > 0) return [{ id: 'default', title: '全部分镜', scenes: scenes }];
    return [];
  }, [scenes, episodes]);

  // Sync local state when source changes (only if not editing)
  useEffect(() => {
    if (!editingEpisodeId) {
      setLocalEpisodes(sourceEpisodes);
    }
  }, [sourceEpisodes, editingEpisodeId]);

  // Initialize collapsed state
  useEffect(() => {
    if (sourceEpisodes.length > 1) {
        const allIndices = sourceEpisodes.map((_, i) => i);
        const allExceptLast = allIndices.slice(0, -1);
        setCollapsedEpisodes(prev => {
            const unique = Array.from(new Set([...prev, ...allExceptLast]));
            return unique;
        });
    }
  }, [sourceEpisodes.length]);

  const toggleCollapse = (index: number) => {
    setCollapsedEpisodes(prev => 
        prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
    );
  };

  const handleEnterEdit = (ep: Episode) => {
    setEditingEpisodeId(ep.id);
    setSaveStatus('idle');
    setLocalEpisodes(prev => prev.map(e => e.id === ep.id ? JSON.parse(JSON.stringify(ep)) : e));
  };

  const handleCancelEdit = () => {
    setEditingEpisodeId(null);
    setSaveStatus('idle');
    setLocalEpisodes(sourceEpisodes); // Revert
  };

  const handleSaveEdit = async (ep: Episode) => {
    if (onSaveEpisode) {
        setSaveStatus('saving');
        try {
            await onSaveEpisode(ep.id, ep.scenes);
            setSaveStatus('success');
            setTimeout(() => {
                setEditingEpisodeId(null);
                setSaveStatus('idle');
            }, 1000);
        } catch (e) {
            console.error(e);
            setSaveStatus('error');
        }
    } else {
        setEditingEpisodeId(null);
    }
  };

  const handleLocalUpdate = (epId: string, sceneIdx: number, shotIdx: number, field: keyof Shot, value: any) => {
    setLocalEpisodes(prev => prev.map(ep => {
        if (ep.id !== epId) return ep;
        const newScenes = [...ep.scenes];
        const newScene = { ...newScenes[sceneIdx] };
        const newShots = [...newScene.shots];
        newShots[shotIdx] = { ...newShots[shotIdx], [field]: value };
        newScene.shots = newShots;
        newScenes[sceneIdx] = newScene;
        return { ...ep, scenes: newScenes };
    }));
  };

  const handleImageUpload = (epId: string, sceneIdx: number, shotIdx: number, file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
        const url = e.target?.result as string;
        // Find current shots
        const ep = localEpisodes.find(e => e.id === epId);
        if (!ep) return;
        const currentUrls = ep.scenes[sceneIdx].shots[shotIdx].imageUrls || [];
        if (currentUrls.length >= 2) {
            alert("最多只能上传两张图片");
            return;
        }
        handleLocalUpdate(epId, sceneIdx, shotIdx, 'imageUrls', [...currentUrls, url]);
    };
    reader.readAsDataURL(file);
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

  const copyToClipboard = async (url: string) => {
    try {
        const response = await fetch(url);
        const blob = await response.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        alert("图片已复制到剪贴板");
    } catch (err) {
        console.error(err);
        alert("复制失败");
    }
  };

  const downloadImage = (url: string, name: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (sourceEpisodes.length === 0) return null; 

  return (
    <div className="h-full overflow-y-auto pr-2 pb-20 custom-scrollbar">
      {/* Image Preview Modal */}
      {previewImage && (
        <div 
            className="fixed inset-0 z-[300] bg-black/90 flex items-center justify-center p-10 cursor-zoom-out"
            onClick={() => setPreviewImage(null)}
        >
            <img src={previewImage} className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" alt="Preview" />
        </div>
      )}

      {localEpisodes.map((episode, epIndex) => {
        const epShotCount = episode.scenes.reduce((acc, s) => acc + s.shots.length, 0);
        const epDuration = episode.scenes.reduce((acc, s) => acc + s.shots.reduce((a, shot) => a + parseDuration(shot.duration), 0), 0);
        const isCollapsed = collapsedEpisodes.includes(epIndex);
        const isEditing = editingEpisodeId === episode.id;

        return (
          <div key={episode.id} className={`mb-8 transition-all duration-500 ${isCollapsed ? 'opacity-50 grayscale hover:grayscale-0 hover:opacity-100' : ''}`}>
            
            {/* --- HEADER --- */}
            <div 
                className="group relative mb-4 select-none flex items-center justify-between"
            >
                 <div 
                    className="flex items-baseline gap-4 cursor-pointer"
                    onClick={() => toggleCollapse(epIndex)}
                 >
                     <div className="absolute -left-4 top-0 bottom-0 w-1 bg-[#d946ef] transform scale-y-0 group-hover:scale-y-100 transition-transform duration-300"></div>
                     <h2 className="text-3xl font-black font-display tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-600 group-hover:from-[#d946ef] group-hover:to-white transition-all duration-300">
                        {episode.title || `第 ${epIndex + 1} 集`}
                     </h2>
                     <div className="flex gap-3 text-xs font-mono font-bold text-[#ccff00] opacity-60 group-hover:opacity-100 transition-opacity">
                        <span>{epShotCount} SHOTS</span>
                        <span>{formatDuration(epDuration)}</span>
                     </div>
                 </div>

                 {/* EDIT CONTROLS */}
                 <div className="flex items-center gap-2">
                    {!isEditing ? (
                        <button 
                            onClick={() => handleEnterEdit(episode)}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 hover:border-[#d946ef]/50 transition-all text-xs font-bold text-slate-400 hover:text-white"
                        >
                            <Edit3 size={12} />
                            修改
                        </button>
                    ) : (
                        <>
                            {saveStatus === 'error' && <span className="text-xs text-red-500 flex items-center gap-1"><AlertCircle size={12}/> 保存失败</span>}
                            {saveStatus === 'success' && <span className="text-xs text-green-500 flex items-center gap-1"><CheckCircle2 size={12}/> 保存成功</span>}
                            
                            <button 
                                onClick={() => handleCancelEdit()}
                                disabled={saveStatus === 'saving'}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 transition-all text-xs font-bold text-red-400 hover:text-red-300 disabled:opacity-50"
                            >
                                <X size={12} />
                                取消
                            </button>
                            <button 
                                onClick={() => handleSaveEdit(episode)}
                                disabled={saveStatus === 'saving'}
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ccff00]/10 hover:bg-[#ccff00]/20 border border-[#ccff00]/20 transition-all text-xs font-bold text-[#ccff00] hover:text-[#d9f99d] disabled:opacity-50"
                            >
                                {saveStatus === 'saving' ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                保存
                            </button>
                        </>
                    )}
                 </div>
            </div>

            {/* List */}
            {!isCollapsed && (
            <div className="space-y-4 animate-fade-in pl-1">
              {episode.scenes.map((scene, sceneIndex) => (
                <div key={sceneIndex} className={`border rounded-2xl p-4 backdrop-blur-sm shadow-sm transition-colors ${isEditing ? 'bg-white/[0.05] border-[#d946ef]/30' : 'bg-white/[0.02] border-white/5'}`}>
                    
                    {/* SCENE HEADER */}
                    <div className="flex items-center justify-between mb-4 pb-2 border-b border-white/5">
                        <div className="flex items-center gap-3">
                             <div className="px-2 py-1 bg-[#ccff00]/10 text-[#ccff00] border border-[#ccff00]/20 text-[10px] font-bold font-mono uppercase rounded">SCENE {scene.sceneId || sceneIndex + 1}</div>
                             <span className="text-sm font-bold text-slate-300 uppercase tracking-wider font-display max-w-[400px] truncate" title={scene.header}>
                                 {scene.header}
                             </span>
                        </div>
                    </div>

                    {/* SHOTS LIST */}
                    <div className="flex flex-col gap-0">
                        {scene.shots.map((shot, shotIndex) => (
                            <React.Fragment key={shotIndex}>
                                {/* INSERT SHOT UI (Only in Edit Mode) */}
                                {isEditing && onInsertShot && (
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

                                <div className={`group/shot relative flex gap-3 p-3 rounded-xl transition-all my-1 z-20 ${isEditing ? 'bg-black/40 border border-white/10' : 'bg-transparent border border-transparent hover:bg-white/5'}`}>
                                    
                                    {/* 1. INDEX Column */}
                                    <div className="flex flex-col items-center justify-start pt-1 gap-2 w-8 shrink-0">
                                        <span className="text-[10px] font-mono text-slate-500 font-bold">#{shot.id}</span>
                                        {isEditing && onDeleteShot && (
                                            <button 
                                                onMouseDown={(e) => e.stopPropagation()}
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onDeleteShot(epIndex, sceneIndex, shotIndex);
                                                }}
                                                className="text-slate-600 hover:text-red-500 transition-all p-1 cursor-pointer pointer-events-auto"
                                                title="删除镜头"
                                            >
                                                <Trash2 size={12} />
                                            </button>
                                        )}
                                    </div>

                                    {/* 2. Main Content Grid */}
                                    <div className="flex-1 grid grid-cols-12 gap-3">
                                        
                                        {/* VISUALS (Left - Wider) */}
                                        <div className="col-span-12 md:col-span-5 flex flex-col gap-2">
                                            <div className="flex gap-2">
                                                {/* Parameters Row */}
                                                <div className="flex items-center gap-1.5 bg-white/5 rounded px-2 py-1 border border-white/5">
                                                    <Camera size={10} className="text-[#ccff00]" />
                                                    {isEditing ? (
                                                        <input 
                                                            className="bg-transparent w-16 text-[10px] text-slate-300 font-bold placeholder-slate-600 outline-none" 
                                                            value={shot.shotSize} 
                                                            onChange={(e) => handleLocalUpdate(episode.id, sceneIndex, shotIndex, 'shotSize', e.target.value)} 
                                                            placeholder="景别" 
                                                        />
                                                    ) : (
                                                        <span className="w-16 text-[10px] text-slate-300 font-bold truncate">{shot.shotSize}</span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1.5 bg-white/5 rounded px-2 py-1 border border-white/5">
                                                    <Video size={10} className="text-[#d946ef]" />
                                                    {isEditing ? (
                                                        <input 
                                                            className="bg-transparent w-16 text-[10px] text-slate-300 font-bold placeholder-slate-600 outline-none" 
                                                            value={shot.cameraAngle} 
                                                            onChange={(e) => handleLocalUpdate(episode.id, sceneIndex, shotIndex, 'cameraAngle', e.target.value)} 
                                                            placeholder="角度" 
                                                        />
                                                    ) : (
                                                        <span className="w-16 text-[10px] text-slate-300 font-bold truncate">{shot.cameraAngle}</span>
                                                    )}
                                                </div>
                                                <div className="flex-1"></div>
                                                <div className="flex items-center gap-1.5 bg-white/5 rounded px-2 py-1 border border-white/5 ml-auto">
                                                    {isEditing ? (
                                                        <input 
                                                            className="bg-transparent w-8 text-[10px] text-[#ccff00] font-mono font-bold text-right outline-none" 
                                                            value={shot.duration} 
                                                            onChange={(e) => handleLocalUpdate(episode.id, sceneIndex, shotIndex, 'duration', e.target.value)} 
                                                        />
                                                    ) : (
                                                        <span className="w-8 text-[10px] text-[#ccff00] font-mono font-bold text-right">{shot.duration}</span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Visual Description */}
                                            {isEditing ? (
                                                <textarea 
                                                    className="w-full bg-black/20 hover:bg-black/30 border border-white/5 hover:border-white/20 rounded-lg p-2 text-xs text-slate-200 focus:border-[#ccff00] focus:ring-0 outline-none resize-none h-20 leading-relaxed shadow-inner transition-colors font-sans"
                                                    value={shot.visualDescription}
                                                    onChange={(e) => handleLocalUpdate(episode.id, sceneIndex, shotIndex, 'visualDescription', e.target.value)}
                                                    spellCheck={false}
                                                    placeholder="画面描述..."
                                                />
                                            ) : (
                                                <div className="w-full bg-transparent border border-transparent p-2 text-xs text-slate-300 h-20 overflow-y-auto custom-scrollbar leading-relaxed font-sans whitespace-pre-wrap">
                                                    {shot.visualDescription}
                                                </div>
                                            )}
                                        </div>

                                        {/* AUDIO / ACTION (Right - Narrower) */}
                                        <div className="col-span-12 md:col-span-4 flex flex-col gap-2">
                                            <div className="flex flex-col gap-1 h-full">
                                                {/* Characters Field */}
                                                <div className="flex items-center gap-1.5 opacity-50">
                                                    <User size={10} />
                                                    <span className="text-[9px] font-bold uppercase">Characters</span>
                                                </div>
                                                {isEditing ? (
                                                    <input 
                                                        className="w-full bg-white/[0.02] border border-white/5 rounded p-1.5 text-[10px] text-slate-300 outline-none h-6 mb-1 font-bold"
                                                        value={shot.characters}
                                                        onChange={(e) => handleLocalUpdate(episode.id, sceneIndex, shotIndex, 'characters', e.target.value)}
                                                        placeholder="角色..."
                                                    />
                                                ) : (
                                                    shot.characters && (
                                                        <div className="w-full px-1.5 py-0.5 text-[10px] text-slate-200 font-bold mb-1 truncate">
                                                            {shot.characters}
                                                        </div>
                                                    )
                                                )}

                                                {/* Action Field */}
                                                <div className="flex items-center gap-1.5 opacity-50">
                                                    <span className="text-[9px] font-bold uppercase">Action</span>
                                                </div>
                                                {isEditing ? (
                                                    <textarea 
                                                        className="w-full bg-white/[0.02] border border-white/5 rounded p-1.5 text-[10px] text-slate-400 resize-none outline-none leading-relaxed h-10 mb-1"
                                                        value={shot.action}
                                                        onChange={(e) => handleLocalUpdate(episode.id, sceneIndex, shotIndex, 'action', e.target.value)}
                                                        placeholder="动作..."
                                                    />
                                                ) : (
                                                    <div className="w-full p-1.5 text-[10px] text-slate-400 h-10 mb-1 overflow-y-auto custom-scrollbar leading-relaxed">
                                                        {shot.action}
                                                    </div>
                                                )}
                                                
                                                <div className="flex items-center gap-1.5 opacity-50">
                                                    <MessageSquare size={10} />
                                                    <span className="text-[9px] font-bold uppercase">Dialogue</span>
                                                </div>
                                                {isEditing ? (
                                                    <textarea 
                                                        className="w-full bg-white/[0.02] border border-white/5 rounded p-1.5 text-[10px] text-slate-400 italic resize-none outline-none leading-relaxed flex-1 min-h-[40px]"
                                                        value={shot.dialogue || ""}
                                                        placeholder="（无台词）"
                                                        onChange={(e) => handleLocalUpdate(episode.id, sceneIndex, shotIndex, 'dialogue', e.target.value)}
                                                    />
                                                ) : (
                                                    <div className="w-full p-1.5 text-[10px] text-slate-400 italic flex-1 min-h-[40px] overflow-y-auto custom-scrollbar leading-relaxed">
                                                        {shot.dialogue || "（无台词）"}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* IMAGE MANAGEMENT (New Column) */}
                                        <div className="col-span-12 md:col-span-3 flex flex-col gap-2">
                                            <div className="flex items-center gap-1.5 opacity-50 mb-1">
                                                <ImageIcon size={10} />
                                                <span className="text-[9px] font-bold uppercase">Reference</span>
                                            </div>
                                            
                                            <div className="grid grid-cols-2 gap-2">
                                                {(shot.imageUrls || []).map((url, imgIdx) => (
                                                    <div 
                                                        key={imgIdx} 
                                                        className="group/img relative aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/20 hover:border-[#ccff00]/50 transition-all cursor-pointer"
                                                    >
                                                        <img src={url} alt={`Ref ${imgIdx}`} className="w-full h-full object-cover" />
                                                        
                                                        {/* Hover Overlay */}
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover/img:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2 backdrop-blur-sm">
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setPreviewImage(url); }}
                                                                className="p-1 rounded bg-white/10 hover:bg-white/20 text-white"
                                                                title="查看大图"
                                                            >
                                                                <Maximize2 size={12} />
                                                            </button>
                                                            <div className="flex gap-1">
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); copyToClipboard(url); }}
                                                                    className="p-1 rounded bg-white/10 hover:bg-white/20 text-white"
                                                                    title="复制"
                                                                >
                                                                    <Copy size={10} />
                                                                </button>
                                                                <button 
                                                                    onClick={(e) => { e.stopPropagation(); downloadImage(url, `shot_${shot.id}_${imgIdx}.png`); }}
                                                                    className="p-1 rounded bg-white/10 hover:bg-white/20 text-white"
                                                                    title="下载"
                                                                >
                                                                    <Download size={10} />
                                                                </button>
                                                            </div>
                                                            {isEditing && (
                                                                <button 
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        const newUrls = [...(shot.imageUrls || [])];
                                                                        newUrls.splice(imgIdx, 1);
                                                                        handleLocalUpdate(episode.id, sceneIndex, shotIndex, 'imageUrls', newUrls);
                                                                    }}
                                                                    className="absolute top-1 right-1 text-red-400 hover:text-red-300"
                                                                >
                                                                    <X size={12} />
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                ))}

                                                {/* Upload Button */}
                                                {isEditing && (shot.imageUrls || []).length < 2 && (
                                                    <div className="aspect-square rounded-lg border border-dashed border-white/10 hover:border-[#ccff00]/50 bg-white/5 hover:bg-[#ccff00]/5 flex flex-col items-center justify-center cursor-pointer transition-all relative overflow-hidden">
                                                        <Plus size={16} className="text-slate-500 mb-1" />
                                                        <span className="text-[8px] text-slate-600 uppercase">Upload</span>
                                                        <input 
                                                            type="file" 
                                                            className="absolute inset-0 opacity-0 cursor-pointer" 
                                                            accept="image/*"
                                                            onChange={(e) => {
                                                                const file = e.target.files?.[0];
                                                                if (file) handleImageUpload(episode.id, sceneIndex, shotIndex, file);
                                                            }}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </React.Fragment>
                        ))}

                        {/* ADD SHOT BUTTON (Only in Edit Mode) */}
                        {isEditing && onAddShot && (
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
