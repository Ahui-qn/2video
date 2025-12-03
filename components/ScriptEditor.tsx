
import React, { useState, useCallback, useEffect } from 'react';
import { Upload, Trash2, Loader2, CloudUpload, Sliders, ChevronUp, ChevronDown, Clock, Hash, Mic2, AlertCircle, Lock, CheckCircle2, Plus, Sparkles } from 'lucide-react';
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
  setCustomInstructions: (s: string) => void;
  isAnalyzing: boolean;
  locked?: boolean;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({ 
  episodes, onUpdateEpisode, onExpandEpisode, onAddEpisode, onAnalyzeEpisode, onDeleteEpisode, customInstructions, setCustomInstructions, isAnalyzing, locked
}) => {
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  const activeEpisode = episodes.find(e => e.isExpanded);

  const [maxDuration, setMaxDuration] = useState('');
  const [shotCount, setShotCount] = useState('');
  const [speakingRate, setSpeakingRate] = useState('4'); 

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
      className={`flex flex-col h-full bg-[#0f0518]/60 backdrop-blur-2xl border-t border-l border-white/10 border-r border-b border-black/50 rounded-3xl transition-all duration-500 overflow-hidden shadow-[10px_10px_30px_rgba(0,0,0,0.5)] relative ${isDragging ? 'border-[#ccff00] shadow-[0_0_50px_rgba(204,255,0,0.2)]' : ''} ${locked ? 'opacity-50 grayscale' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Locked Overlay */}
      {locked && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm cursor-not-allowed">
          <Lock size={48} className="text-slate-600 mb-4" />
          <p className="text-sm font-mono text-slate-500 uppercase tracking-widest">未解锁 / 请先上传剧本</p>
        </div>
      )}

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 flex flex-col gap-2">
        {episodes.map((ep, index) => {
          const isExpanded = ep.isExpanded;
          const charCount = ep.content.length;
          const isOverLimit = charCount > 2500;
          const isActive = ep.id === activeEpisode?.id;

          return (
             <div 
               key={ep.id} 
               className={`transition-all duration-300 border backdrop-blur-md group/card overflow-hidden flex flex-col shrink-0 ${
                 isExpanded 
                   ? 'bg-black/40 border-[#ccff00] rounded-2xl shadow-[0_0_20px_rgba(204,255,0,0.1)]' 
                   : 'bg-white/5 border-white/5 rounded-xl hover:bg-white/10 cursor-pointer hover:border-white/10'
               }`}
               onClick={() => !locked && onExpandEpisode(ep.id)}
             >
                {/* Header */}
                <div className={`px-4 py-3 flex items-center justify-between shrink-0 ${isExpanded ? 'border-b border-[#ccff00]/20' : ''}`}>
                   <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded flex items-center justify-center text-[10px] font-bold font-mono transition-all ${
                          ep.status === 'analyzed' ? 'bg-[#ccff00] text-black' : 
                          ep.status === 'analyzing' ? 'bg-[#d946ef] text-white animate-pulse' :
                          'bg-white/10 text-slate-500'
                      }`}>
                          {ep.status === 'analyzed' ? <CheckCircle2 size={10} /> : (index + 1)}
                      </div>
                      <div className="flex flex-col">
                          <span className={`text-xs font-bold tracking-tight uppercase ${isExpanded ? 'text-white' : 'text-slate-400 group-hover/card:text-slate-200'}`}>{ep.title}</span>
                          {!isExpanded && (
                              <span className="text-[10px] text-slate-600 font-mono truncate max-w-[150px]">
                                {getPreviewTitle(ep.content)}
                              </span>
                          )}
                      </div>
                   </div>
                   
                   <div className="flex items-center gap-2">
                      {!locked && (
                        <button
                          onClick={(e) => {
                              e.stopPropagation();
                              onDeleteEpisode(ep.id);
                          }}
                          className="p-1.5 text-slate-500 hover:text-red-500 hover:bg-white/5 rounded-full transition-all hover:scale-110 opacity-0 group-hover/card:opacity-100"
                          title="删除此集"
                        >
                            <Trash2 size={12} />
                        </button>
                      )}
                      {isExpanded ? <ChevronUp size={14} className="text-[#ccff00]" /> : <ChevronDown size={14} className="text-slate-600" />}
                   </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                   <div className="relative animate-fade-in flex flex-col h-[65vh] min-h-[400px]" onClick={(e) => e.stopPropagation()}>
                       {/* Toolbar */}
                       <div className="absolute top-3 right-5 flex items-center gap-2 z-10">
                          {ep.content && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleClear(); }}
                              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-white/5 rounded transition-all"
                              title="清空内容"
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                          <label 
                            className={`cursor-pointer px-3 py-1 rounded bg-[#ccff00]/10 hover:bg-[#ccff00]/20 text-[#ccff00] text-[10px] font-bold border border-[#ccff00]/20 transition-all flex items-center gap-1.5 ${isProcessingFile || isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`} 
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isProcessingFile ? <Loader2 size={10} className="animate-spin" /> : <Upload size={10} />}
                            <span>导入</span>
                            <input 
                              type="file" 
                              accept=".txt,.md,.fountain,.docx,.pdf" 
                              onChange={handleFileUpload} 
                              className="hidden" 
                              disabled={isAnalyzing || isProcessingFile}
                            />
                          </label>
                       </div>

                       {/* Text Area */}
                       <textarea
                        className="flex-1 w-full bg-black/20 text-slate-300 p-5 pt-10 resize-none focus:outline-none font-mono text-xs leading-relaxed custom-scrollbar placeholder-slate-700 overflow-y-auto"
                        placeholder={`在此粘贴分集剧本内容...`}
                        value={ep.content}
                        onChange={(e) => onUpdateEpisode(ep.id, { content: e.target.value })}
                        disabled={isAnalyzing || isProcessingFile}
                        spellCheck={false}
                        onClick={(e) => e.stopPropagation()}
                      />

                      {/* Footer Info & Action */}
                      <div className="px-5 py-2 flex items-center justify-between border-t border-white/5 bg-black/30 shrink-0">
                        <div className="flex items-center gap-2">
                            <span className={`text-[10px] font-mono ${isOverLimit ? 'text-red-500 font-bold' : 'text-slate-600'}`}>
                                {charCount} / 2500 字
                            </span>
                            {isOverLimit && <AlertCircle size={10} className="text-red-500" />}
                        </div>
                        
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
                      </div>

                      {/* Drag Overlay */}
                      {isDragging && isActive && (
                        <div className="absolute inset-2 z-20 border-2 border-dashed border-[#ccff00] bg-black/80 flex flex-col items-center justify-center backdrop-blur-sm pointer-events-none">
                            <CloudUpload size={32} className="text-[#ccff00] mb-2" />
                            <p className="text-xs font-bold text-white font-mono">松开以导入</p>
                        </div>
                      )}
                   </div>
                )}
             </div>
          );
        })}
      </div>

      {/* Fixed Add Button (Purple Box Area) */}
      {!locked && (
        <div className="px-3 py-3 border-t border-white/5 bg-[#0f0518] shrink-0 z-10">
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
