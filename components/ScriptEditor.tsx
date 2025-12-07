import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Trash2, Loader2, CloudUpload, Sliders, ChevronUp, ChevronDown, AlertCircle, Lock, CheckCircle2, Plus, Sparkles, Edit3, Save, X } from 'lucide-react';
import { readFileContent } from '../services/fileService';
import { ScriptEpisode } from '../types';

interface ScriptEditorProps {
  episodes: ScriptEpisode[];
  onUpdateEpisode: (id: string, updates: Partial<ScriptEpisode>) => void;
  onExpandEpisode: (id: string) => void;
  onAddEpisode: () => void;
  onAnalyzeEpisode: (id: string) => void;
  onDeleteEpisode: (id: string) => void;
  customInstructions: string;
  setCustomInstructions: (val: string) => void;
  isAnalyzing: boolean;
  locked: boolean;
  onAddHistory?: (summary: string) => void;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({ 
  episodes, onUpdateEpisode, onExpandEpisode, onAddEpisode, onAnalyzeEpisode, onDeleteEpisode, customInstructions, setCustomInstructions, isAnalyzing, locked, onAddHistory
}) => {
  // --- 组件内部状态 (Local State) ---
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // 编辑模式状态：记录当前正在编辑哪一集的内容
  const [editingContentId, setEditingContentId] = useState<string | null>(null);
  // 临时内容缓存，用于编辑时的实时输入，避免频繁触发上层更新
  const [tempContent, setTempContent] = useState('');

  const activeEpisode = episodes.find(e => e.isExpanded);
  const hasExpanded = !!activeEpisode;

  const [maxDuration, setMaxDuration] = useState('');
  const [shotCount, setShotCount] = useState('');
  const [speakingRate, setSpeakingRate] = useState('4'); 

  // ... (useEffect remains same)

  const startEditing = (ep: ScriptEpisode) => {
    setEditingContentId(ep.id);
    setTempContent(ep.content);
  };

  const cancelEditing = () => {
    setEditingContentId(null);
    setTempContent('');
  };

  const saveContent = (ep: ScriptEpisode) => {
    onUpdateEpisode(ep.id, { content: tempContent });
    setEditingContentId(null);
    if (onAddHistory) onAddHistory(`更新了 ${ep.title} 的剧本内容`);
  };

  const handleStatusChange = (ep: ScriptEpisode, newStatus: any) => {
      onUpdateEpisode(ep.id, { status: newStatus });
      if (onAddHistory) onAddHistory(`更新了 ${ep.title} 的状态为 ${newStatus}`);
  };

  useEffect(() => {
    const match = customInstructions.match(/【硬性约束：(.*?)】/);
    if (match) {
      const content = match[1];
      const maxM = content.match(/单镜头<(\d+)s/);
      if (maxM) setMaxDuration(maxM[1]);
      const countM = content.match(/(?:每集镜头|总数)≈(\d+)/);
      if (countM) setShotCount(countM[1]);
      const rateM = content.match(/语速≈(\d+)字\/秒/);
      if (rateM) setSpeakingRate(rateM[1]);
    }
  }, []);

  const updateInstructions = (max: string, count: string, rate: string) => {
    const regex = /【硬性约束：.*?】\n?/;
    let cleanText = customInstructions.replace(regex, '');
    const parts = [];
    if (max) parts.push(`单镜头<${max}s`);
    if (count) parts.push(`每集镜头≈${count}`);
    if (rate) parts.push(`语速≈${rate}字/秒`);
    if (parts.length > 0) {
      const block = `【硬性约束：${parts.join('；')}】\n`;
      setCustomInstructions(block + cleanText);
    } else {
      setCustomInstructions(cleanText);
    }
  };

  const handleConstraintChange = (field: 'max' | 'count' | 'rate', value: string) => {
    if (value && !/^\d*(\.\d+)?$/.test(value)) return;
    let newMax = maxDuration;
    let newCount = shotCount;
    let newRate = speakingRate;
    if (field === 'max') { setMaxDuration(value); newMax = value; }
    if (field === 'count') { setShotCount(value); newCount = value; }
    if (field === 'rate') { setSpeakingRate(value); newRate = value; }
    updateInstructions(newMax, newCount, newRate);
  };

  const processFile = async (file: File) => {
    if (!activeEpisode) return;
    setIsProcessingFile(true);
    try {
      const text = await readFileContent(file);
      onUpdateEpisode(activeEpisode.id, { content: text });
    } catch (error: any) {
      alert(error.message || "Failed to read file");
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isAnalyzing && !isProcessingFile && !locked && activeEpisode) setIsDragging(true);
  }, [isAnalyzing, isProcessingFile, locked, activeEpisode]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isAnalyzing || isProcessingFile || locked || !activeEpisode) return;
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [isAnalyzing, isProcessingFile, locked, activeEpisode]);

  const handleClear = () => {
    if (activeEpisode) onUpdateEpisode(activeEpisode.id, { content: '' });
  };

  const getPreviewTitle = (text: string) => {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      return lines.length > 0 ? lines[0].substring(0, 30) + (lines[0].length > 30 ? '...' : '') : '暂无内容';
  };

  return (
    <div 
      className={`flex flex-col h-full bg-[#0f0518] relative ${isDragging ? 'shadow-[0_0_50px_rgba(204,255,0,0.2)]' : ''} ${locked ? 'opacity-50 grayscale' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* HEADER */}
      <div className="px-4 py-2 border-b border-white/5 bg-black/20 text-xs font-bold text-slate-500 uppercase tracking-widest shrink-0 flex items-center justify-between">
          <span>剧本分集 (EPISODES)</span>
      </div>

      {/* 查看者可以看到内容，但不能编辑 - 移除全屏遮罩 */}

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col min-h-0">
        {episodes.map((ep, index) => {
          const isExpanded = ep.isExpanded;
          const isEditing = editingContentId === ep.id;
          const displayContent = isEditing ? tempContent : ep.content;
          const charCount = displayContent.length;
          const isOverLimit = charCount > 1500;
          const isActive = ep.id === activeEpisode?.id;
          const isHidden = hasExpanded && !isActive;
          
          return (
             <div 
               key={ep.id} 
               className={`
                 transition-all duration-300 ease-[cubic-bezier(0.23,1,0.32,1)]
                 border backdrop-blur-md group/card overflow-hidden flex flex-col shrink-0 relative
                 
                 ${isHidden
                     ? 'max-h-0 opacity-0 mb-0 border-0 pointer-events-none' 
                     : 'opacity-100 scale-100'
                 }
                 
                 ${!isHidden && !isExpanded
                     ? 'max-h-[80px] mb-2 bg-white/5 border-white/5 rounded-xl hover:bg-white/10 cursor-pointer hover:border-white/10' 
                     : ''
                 }
                 
                 ${isExpanded
                     ? 'flex-1 max-h-full mb-2 bg-black/40 border-[#ccff00] rounded-2xl shadow-[0_0_20px_rgba(204,255,0,0.1)]'
                     : ''
                 }
               `}
               onClick={() => !isHidden && !isExpanded && onExpandEpisode(ep.id)}
             >
                {/* Header */}
                <div className={`px-4 py-4 flex items-center justify-between shrink-0 relative ${isExpanded ? 'border-b border-[#ccff00]/20' : ''}`}>
                   <div className="flex items-center gap-3 min-w-0">
                      {/* Status Dropdown */}
                      <div 
                        className="relative z-50"
                        onClick={(e) => e.stopPropagation()}
                      >
                          <select 
                            value={ep.status || 'draft'} 
                            onChange={(e) => handleStatusChange(ep, e.target.value)}
                            className={`appearance-none w-16 h-6 rounded flex items-center justify-center text-[10px] font-bold font-mono transition-all shrink-0 cursor-pointer outline-none text-center
                                ${ep.status === 'analyzed' || ep.status === 'completed' ? 'bg-green-500 text-black' : 
                                  ep.status === 'analyzing' ? 'bg-blue-500 text-white animate-pulse' : 
                                  'bg-gray-500 text-white'}
                            `}
                            disabled={locked || isAnalyzing}
                          >
                             <option value="draft">待生成</option>
                             <option value="analyzing">生成中</option>
                             <option value="completed">已完成</option>
                          </select>
                      </div>

                      <div className="flex flex-col min-w-0">
                          <span className={`text-xs font-bold tracking-tight uppercase truncate ${isExpanded ? 'text-white' : 'text-slate-400 group-hover/card:text-slate-200'}`}>{ep.title}</span>
                          {!isExpanded && (
                              <span className="text-[10px] text-slate-600 font-mono truncate max-w-[150px]">
                                {getPreviewTitle(ep.content)}
                              </span>
                          )}
                      </div>
                   </div>
                   
                   {/* Controls */}
                   <div 
                      className="flex items-center gap-2 shrink-0 z-50 isolate" 
                      onClick={(e) => e.stopPropagation()}
                   >
                      {isExpanded && !isEditing && !locked && (
                          <button 
                            onClick={() => startEditing(ep)}
                            className="p-1.5 text-slate-400 hover:text-white bg-white/5 hover:bg-white/10 rounded transition-all"
                            title="编辑内容"
                          >
                              <Edit3 size={12} />
                          </button>
                      )}
                      
                      <button 
                        type="button"
                        onClick={(e) => {
                            e.preventDefault(); 
                            e.stopPropagation();
                            if(!isHidden) onExpandEpisode(ep.id);
                        }} 
                        className="cursor-pointer p-1 text-slate-400 hover:text-white"
                      >
                        {isExpanded ? <ChevronUp size={14} className="text-[#ccff00]" /> : <ChevronDown size={14} />}
                      </button>
                   </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                   <div className="relative animate-fade-in flex flex-col flex-1 min-h-0 cursor-default" onClick={(e) => e.stopPropagation()}>
                       {/* Text Area */}
                       <textarea
                        className={`flex-1 w-full bg-black/20 text-slate-300 p-5 pt-5 resize-none focus:outline-none font-mono text-xs leading-relaxed custom-scrollbar placeholder-slate-700 overflow-y-auto ${!isEditing ? 'cursor-default' : ''}`}
                        placeholder={isEditing ? "在此粘贴分集剧本内容..." : "暂无内容"}
                        value={displayContent}
                        onChange={(e) => isEditing && setTempContent(e.target.value)}
                        disabled={!isEditing}
                        spellCheck={false}
                        onPaste={(e) => {
                            // Optional: Handle paste logic if strict restriction is needed
                        }}
                      />

                      {/* Footer Info & Action */}
                      <div className="px-5 py-2 flex items-center justify-between border-t border-white/5 bg-black/30 shrink-0">
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono ${isOverLimit ? 'text-red-500 font-bold' : 'text-slate-600'}`}>
                                {charCount} / 1500 字
                            </span>
                            {isOverLimit && <AlertCircle size={10} className="text-red-500" />}
                        </div>
                        
                        <div className="flex items-center gap-2">
                            {isEditing ? (
                                <>
                                    <button 
                                        onClick={cancelEditing}
                                        className="px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all bg-red-500/10 text-red-400 hover:bg-red-500/20"
                                    >
                                        取消
                                    </button>
                                    <button 
                                        onClick={() => saveContent(ep)}
                                        className="flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all bg-green-500/10 text-green-400 hover:bg-green-500/20"
                                    >
                                        <Save size={10} />
                                        保存
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (!locked && !isAnalyzing && ep.content.trim().length > 0) {
                                            onAnalyzeEpisode(ep.id);
                                        }
                                    }}
                                    disabled={locked || isAnalyzing || ep.content.trim().length === 0}
                                    className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider transition-all ${
                                        locked || isAnalyzing || ep.content.trim().length === 0
                                        ? 'bg-white/5 text-slate-600 cursor-not-allowed'
                                        : 'bg-gradient-to-r from-[#d946ef] to-[#c026d3] text-white shadow-lg hover:shadow-purple-500/20 hover:scale-105 active:scale-95'
                                    }`}
                                >
                                    <Sparkles size={10} />
                                    立即分析
                                </button>
                            )}
                        </div>
                      </div>
                   </div>
                )}
             </div>
          );
        })}
      </div>

      {/* Fixed Add Button (Purple Box Area) */}
      {!locked && (
        <div className="px-3 py-3 border-t border-white/5 bg-[#0f0518] shrink-0 z-10 h-auto opacity-100">
            <button 
                onClick={onAddEpisode}
                className="w-full py-3 bg-[#2a2a2a] hover:bg-[#353535] border border-white/10 hover:border-[#d946ef] rounded-lg text-slate-400 hover:text-[#d946ef] transition-all flex items-center justify-center gap-2 text-xs font-bold tracking-widest uppercase shadow-lg group"
            >
                <Plus size={14} className="group-hover:scale-110 transition-transform" /> 
                添加新集
            </button>
        </div>
      )}

      {/* Settings Footer */}
      <div className="border-t border-white/5 bg-black/20 shrink-0 backdrop-blur-xl">
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center justify-between px-6 py-4 text-[10px] font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-wider"
          disabled={locked}
        >
          <div className="flex items-center gap-2">
            <Sliders size={12} />
            <span>硬性约束</span>
          </div>
          {showSettings ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
        
        {showSettings && (
            <div className="px-6 pb-6 animate-fade-in space-y-4 bg-black/40 pt-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  { id: 'max', label: '最长(s)' }, 
                  { id: 'count', label: '总数' }, 
                  { id: 'rate', label: '语速' }
                ].map(field => (
                    <div key={field.id} className="bg-white/5 border border-white/5 rounded p-2">
                        <label className="text-[8px] text-slate-500 uppercase font-bold block mb-1">{field.label}</label>
                        <input 
                            type="text" 
                            className="bg-transparent text-white text-xs font-mono w-full outline-none"
                            placeholder="-"
                            value={field.id === 'max' ? maxDuration : field.id === 'count' ? shotCount : speakingRate}
                            onChange={(e) => handleConstraintChange(field.id as any, e.target.value)}
                        />
                    </div>
                ))}
              </div>
              <textarea
                className="w-full bg-black/40 border border-white/10 rounded-lg p-3 text-[10px] text-slate-300 focus:border-[#ccff00] outline-none h-20 font-mono"
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
              />
            </div>
        )}
      </div>
    </div>
  );
};