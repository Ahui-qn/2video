
import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, Trash2, Loader2, CloudUpload, Sliders, ChevronUp, ChevronDown, Clock, Hash, Mic2, AlertCircle, Lock, CheckCircle2, Edit3, Plus } from 'lucide-react';
import { readFileContent } from '../services/fileService';
import { ScriptEpisode } from '../types';

interface ScriptEditorProps {
  episodes: ScriptEpisode[];
  onUpdateEpisode: (id: string, updates: Partial<ScriptEpisode>) => void;
  onExpandEpisode: (id: string) => void;
  onAddEpisode: () => void;
  customInstructions: string;
  setCustomInstructions: (s: string) => void;
  isAnalyzing: boolean;
  locked?: boolean;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({ 
  episodes, onUpdateEpisode, onExpandEpisode, onAddEpisode, customInstructions, setCustomInstructions, isAnalyzing, locked
}) => {
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  
  // Find active episode (the expanded one)
  const activeEpisode = episodes.find(e => e.isExpanded);

  // Constraint States (Global)
  const [maxDuration, setMaxDuration] = useState('');
  const [shotCount, setShotCount] = useState('');
  const [speakingRate, setSpeakingRate] = useState('4'); 

  // Parse existing constraints on mount
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
      alert(error.message || "文件读取失败");
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

  // Helper to extract first non-empty line as title preview
  const getPreviewTitle = (text: string) => {
      const lines = text.split('\n').map(l => l.trim()).filter(l => l);
      return lines.length > 0 ? lines[0].substring(0, 30) + (lines[0].length > 30 ? '...' : '') : '暂无内容';
  };

  return (
    <div 
      className={`flex flex-col h-full bg-white/[0.02] backdrop-blur-xl rounded-2xl border transition-colors duration-300 overflow-hidden shadow-sm relative ${isDragging ? 'border-rose-500/50 bg-rose-500/5' : 'border-white/10'} ${locked ? 'opacity-60 grayscale' : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Locked Overlay */}
      {locked && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-black/40 backdrop-blur-[1px] text-center p-6 cursor-not-allowed select-none">
          <div className="p-4 rounded-full bg-white/5 border border-white/10 mb-3 shadow-xl">
             <Lock size={24} className="text-stone-400" />
          </div>
          <p className="text-sm font-semibold text-stone-300">编辑区已锁定</p>
          <p className="text-xs text-stone-500 mt-1 max-w-[200px]">
            请先在右侧上传完整剧本(Bible)以提取全局资产。
          </p>
        </div>
      )}

      {/* Main List Area */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-3 space-y-3">
        {episodes.map((ep, index) => {
          const isExpanded = ep.isExpanded;
          const charCount = ep.content.length;
          const isOverLimit = charCount > 2500;
          const isActive = ep.id === activeEpisode?.id;

          return (
             <div 
               key={ep.id} 
               className={`rounded-xl transition-all duration-300 border group/card ${
                 isExpanded 
                   ? 'bg-gradient-to-br from-rose-500/5 to-purple-500/5 border-rose-500/30 shadow-[0_0_15px_rgba(244,63,94,0.1)]' 
                   : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03] cursor-pointer hover:border-white/10'
               }`}
               onClick={() => !locked && onExpandEpisode(ep.id)}
             >
                {/* Header / Summary */}
                <div className={`px-4 py-3 flex items-center justify-between ${isExpanded ? 'border-b border-white/5 bg-white/[0.01]' : ''}`}>
                   <div className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold border transition-colors ${
                          ep.status === 'analyzed' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 
                          ep.status === 'analyzing' ? 'bg-rose-500/20 text-rose-400 border-rose-500/30 animate-pulse' :
                          'bg-stone-700/50 text-stone-400 border-white/10 group-hover/card:border-white/20 group-hover/card:bg-stone-600/50'
                      }`}>
                          {ep.status === 'analyzed' ? <CheckCircle2 size={12} /> : (index + 1)}
                      </div>
                      <div className="flex flex-col">
                          <span className={`text-xs font-medium ${isExpanded ? 'text-rose-200 shadow-rose-500/50' : 'text-stone-300'}`}>{ep.title}</span>
                          {!isExpanded && (
                              <span className="text-[10px] text-stone-500 truncate max-w-[200px]">
                                {getPreviewTitle(ep.content)}
                              </span>
                          )}
                      </div>
                   </div>
                   <div className="flex items-center gap-2">
                       {isExpanded ? <ChevronUp size={14} className="text-stone-500" /> : <ChevronDown size={14} className="text-stone-500" />}
                   </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                   <div className="relative animate-fade-in" onClick={(e) => e.stopPropagation()}>
                       {/* Toolbar */}
                       <div className="absolute top-2 right-4 flex items-center gap-2 z-10">
                          {ep.content && (
                            <button 
                              onClick={(e) => { e.stopPropagation(); handleClear(); }}
                              className="p-1.5 text-stone-500 hover:text-red-400 hover:bg-white/5 rounded-md transition-all"
                              title="清空"
                              disabled={isProcessingFile || isAnalyzing}
                            >
                              <Trash2 size={12} />
                            </button>
                          )}
                          <label 
                            className={`cursor-pointer px-2 py-1 rounded-md bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all flex items-center gap-1.5 group/upload ${isProcessingFile || isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`} 
                            title="上传本集文件"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isProcessingFile ? (
                              <Loader2 size={10} className="animate-spin text-rose-400" />
                            ) : (
                              <Upload size={10} className="text-stone-400 group-hover/upload:text-white" />
                            )}
                            <span className="text-[10px] font-medium text-stone-400 group-hover/upload:text-white">导入</span>
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
                        className="w-full h-64 bg-transparent text-stone-200 p-4 pt-8 resize-none focus:outline-none font-mono text-xs leading-relaxed custom-scrollbar placeholder-stone-600/50"
                        placeholder={`请粘贴【${ep.title}】剧本 (建议 2000 字以内)...\n\n第1集：重返地球\n内景。飞船驾驶舱 - 日...`}
                        value={ep.content}
                        onChange={(e) => onUpdateEpisode(ep.id, { content: e.target.value })}
                        disabled={isAnalyzing || isProcessingFile}
                        spellCheck={false}
                        onClick={(e) => e.stopPropagation()}
                      />

                      {/* Footer Info */}
                      <div className="px-4 py-2 flex items-center justify-between border-t border-white/5 bg-black/5 text-[10px]">
                        <div className="flex items-center gap-2">
                            <span className={`font-mono font-medium ${isOverLimit ? 'text-red-400' : 'text-stone-500'}`}>
                                {charCount} / 2500 chars
                            </span>
                            {isOverLimit && (
                            <span className="flex items-center gap-1 text-red-400 bg-red-500/10 px-2 py-0.5 rounded">
                                <AlertCircle size={10} /> 建议分集
                            </span>
                            )}
                        </div>
                      </div>

                      {/* Drag Overlay (Scoped to this card) */}
                      {isDragging && isActive && (
                        <div className="absolute inset-2 z-20 border-2 border-dashed border-rose-500/30 bg-[#1a0510]/90 rounded-lg flex flex-col items-center justify-center backdrop-blur-sm pointer-events-none">
                            <CloudUpload size={30} className="text-rose-400 mb-2" />
                            <p className="text-xs font-semibold text-white">释放文件至 {ep.title}</p>
                        </div>
                      )}
                      
                      {/* Global Loading Overlay (Scoped) */}
                      {isProcessingFile && isActive && (
                        <div className="absolute inset-0 bg-[#1a0510]/80 z-20 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in rounded-b-xl">
                            <Loader2 size={20} className="text-rose-400 animate-spin mb-2" />
                            <span className="text-[10px] font-medium text-stone-300">解析文档中...</span>
                        </div>
                      )}
                   </div>
                )}
             </div>
          );
        })}

        {/* Manual Add Button */}
        {!locked && (
            <button 
                onClick={onAddEpisode}
                className="w-full py-3 border border-dashed border-white/10 rounded-xl text-stone-500 hover:text-rose-200 hover:border-rose-500/20 hover:bg-rose-500/5 transition-all flex items-center justify-center gap-2 text-xs font-medium"
            >
                <Plus size={14} /> 添加新分集
            </button>
        )}
      </div>

      {/* Global Settings Footer */}
      <div className="border-t border-white/5 bg-black/10 shrink-0 z-20">
        <button 
          onClick={() => setShowSettings(!showSettings)}
          className="w-full flex items-center justify-between px-5 py-3 text-[10px] font-medium text-stone-500 hover:text-stone-300 hover:bg-white/5 transition-colors"
          disabled={locked}
        >
          <div className="flex items-center gap-2">
            <Sliders size={12} />
            <span>AI 定制指令 & 约束 (全局生效)</span>
            {customInstructions && <div className="w-1 h-1 rounded-full bg-rose-500 shadow-[0_0_5px_rgba(244,63,94,0.8)]"></div>}
          </div>
          {showSettings ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
        </button>
        
        {showSettings && (
            <div className="px-5 pb-4 animate-fade-in space-y-3 border-t border-white/5 bg-[#1a0510]">
              <div className="grid grid-cols-3 gap-2 mt-3">
                <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2 flex flex-col gap-1 focus-within:border-rose-500/30 transition-colors">
                  <label className="text-[9px] text-stone-500 font-medium flex items-center gap-1" title="单个镜头最大时长">
                    <Clock size={10} /> 单镜上限(秒)
                  </label>
                  <input 
                    type="text" 
                    className="bg-transparent border-none text-[11px] text-stone-200 focus:outline-none w-full placeholder-stone-600"
                    placeholder="例: 5"
                    value={maxDuration}
                    onChange={(e) => handleConstraintChange('max', e.target.value)}
                  />
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2 flex flex-col gap-1 focus-within:border-rose-500/30 transition-colors">
                  <label className="text-[9px] text-stone-500 font-medium flex items-center gap-1" title="每集预估镜头数量">
                    <Hash size={10} /> 单集镜头数
                  </label>
                  <input 
                    type="text" 
                    className="bg-transparent border-none text-[11px] text-stone-200 focus:outline-none w-full placeholder-stone-600"
                    placeholder="例: 20"
                    value={shotCount}
                    onChange={(e) => handleConstraintChange('count', e.target.value)}
                  />
                </div>
                <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2 flex flex-col gap-1 focus-within:border-rose-500/30 transition-colors">
                  <label className="text-[9px] text-stone-500 font-medium flex items-center gap-1" title="每秒阅读字数">
                    <Mic2 size={10} /> 语速(字/秒)
                  </label>
                  <input 
                    type="text" 
                    className="bg-transparent border-none text-[11px] text-stone-200 focus:outline-none w-full placeholder-stone-600"
                    placeholder="例: 4"
                    value={speakingRate}
                    onChange={(e) => handleConstraintChange('rate', e.target.value)}
                  />
                </div>
              </div>
              <textarea
                className="w-full bg-white/[0.03] border border-white/5 rounded-lg p-3 text-[11px] text-stone-300 placeholder-stone-600 focus:ring-1 focus:ring-rose-500/30 focus:border-rose-500/30 focus:outline-none resize-none h-20 leading-relaxed font-mono custom-scrollbar"
                placeholder="更多补充要求..."
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                spellCheck={false}
              />
            </div>
        )}
      </div>
    </div>
  );
};