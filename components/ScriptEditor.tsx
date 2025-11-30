
import React, { useState, useCallback, useEffect } from 'react';
import { Upload, FileText, Trash2, Loader2, CloudUpload, Sliders, ChevronUp, ChevronDown, Clock, Hash, Mic2 } from 'lucide-react';
// @ts-ignore
import mammoth from 'mammoth';
// @ts-ignore
import * as pdfjsLib from 'pdfjs-dist';

// Set the worker source for PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://esm.sh/pdfjs-dist@4.0.379/build/pdf.worker.min.mjs';

interface ScriptEditorProps {
  script: string;
  setScript: (s: string) => void;
  customInstructions: string;
  setCustomInstructions: (s: string) => void;
  isAnalyzing: boolean;
}

export const ScriptEditor: React.FC<ScriptEditorProps> = ({ 
  script, setScript, customInstructions, setCustomInstructions, isAnalyzing 
}) => {
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Constraint States
  const [maxDuration, setMaxDuration] = useState('');
  const [shotCount, setShotCount] = useState('');
  const [speakingRate, setSpeakingRate] = useState('4'); // Default 4 chars/sec

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
    // Regex to remove existing constraint block to avoid duplication
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
    // Only allow numbers
    if (value && !/^\d*(\.\d+)?$/.test(value)) return;

    let newMax = maxDuration;
    let newCount = shotCount;
    let newRate = speakingRate;

    if (field === 'max') { setMaxDuration(value); newMax = value; }
    if (field === 'count') { setShotCount(value); newCount = value; }
    if (field === 'rate') { setSpeakingRate(value); newRate = value; }

    updateInstructions(newMax, newCount, newRate);
  };

  const readDocx = async (arrayBuffer: ArrayBuffer) => {
    try {
      const result = await mammoth.extractRawText({ arrayBuffer });
      return result.value;
    } catch (error) {
      console.error("Error reading DOCX:", error);
      throw new Error("无法读取 DOCX 文件，请确保文件未损坏。");
    }
  };

  const readPdf = async (arrayBuffer: ArrayBuffer) => {
    try {
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      let fullText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        // @ts-ignore
        const pageText = textContent.items.map(item => item.str).join(" ");
        fullText += pageText + "\n\n";
      }
      return fullText;
    } catch (error) {
      console.error("Error reading PDF:", error);
      throw new Error("无法读取 PDF 文件，可能是加密文件或格式不支持。");
    }
  };

  const processFile = async (file: File) => {
    setIsProcessingFile(true);
    try {
      let text = "";
      const arrayBuffer = await file.arrayBuffer();

      if (file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || file.name.endsWith('.docx')) {
        text = await readDocx(arrayBuffer);
      } else if (file.type === "application/pdf" || file.name.endsWith('.pdf')) {
        text = await readPdf(arrayBuffer);
      } else if (file.type === "text/plain" || file.name.endsWith('.md') || file.name.endsWith('.fountain') || file.name.endsWith('.txt')) {
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (event) => resolve(event.target?.result as string);
          reader.onerror = reject;
          reader.readAsText(file);
        });
      } else {
        alert("不支持的文件格式。请上传 .txt, .md, .docx 或 .pdf 文件。");
        setIsProcessingFile(false);
        return;
      }
      setScript(text);
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
    if (!isAnalyzing && !isProcessingFile) setIsDragging(true);
  }, [isAnalyzing, isProcessingFile]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set dragging to false if we leave the main container
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (isAnalyzing || isProcessingFile) return;

    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [isAnalyzing, isProcessingFile]);

  const handleClear = () => setScript('');

  return (
    <div 
      className={`flex flex-col h-full bg-white/[0.03] backdrop-blur-xl rounded-2xl border transition-colors duration-300 overflow-hidden shadow-sm relative ${isDragging ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-white/5'}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-white/5 shrink-0 bg-white/[0.01]">
        <h2 className="text-xs font-semibold text-slate-300 flex items-center gap-2">
          <FileText size={14} className="text-indigo-400" />
          剧本编辑器
        </h2>
        <div className="flex items-center gap-2">
          {script && (
            <button 
              onClick={handleClear}
              className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-white/5 rounded-md transition-all"
              title="清空"
              disabled={isProcessingFile}
            >
              <Trash2 size={14} />
            </button>
          )}
          <label 
            className={`cursor-pointer px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/10 transition-all flex items-center gap-1.5 group/upload ${isProcessingFile || isAnalyzing ? 'opacity-50 cursor-not-allowed' : ''}`} 
            title="上传文件"
          >
            {isProcessingFile ? (
              <Loader2 size={12} className="animate-spin text-indigo-400" />
            ) : (
              <Upload size={12} className="text-slate-400 group-hover/upload:text-white" />
            )}
            <span className="text-[10px] font-medium text-slate-400 group-hover/upload:text-white">导入</span>
            <input 
              type="file" 
              accept=".txt,.md,.fountain,.docx,.pdf" 
              onChange={handleFileUpload} 
              className="hidden" 
              disabled={isAnalyzing || isProcessingFile}
            />
          </label>
        </div>
      </div>

      {/* Editor Area */}
      <div className="flex-1 relative min-h-0 flex flex-col">
        {/* Loading Overlay */}
        {isProcessingFile && (
           <div className="absolute inset-0 bg-[#0f172a]/80 z-20 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in">
             <div className="p-3 bg-white/10 rounded-full mb-3">
                <Loader2 size={24} className="text-indigo-400 animate-spin" />
             </div>
             <span className="text-xs font-medium text-slate-300">解析文档中...</span>
           </div>
        )}

        {/* Drag Overlay */}
        {isDragging && (
          <div className="absolute inset-4 z-10 border-2 border-dashed border-indigo-500/30 bg-[#0f172a]/90 rounded-xl flex flex-col items-center justify-center backdrop-blur-sm pointer-events-none">
            <CloudUpload size={40} className="text-indigo-400 mb-2" />
            <p className="text-sm font-semibold text-white">释放文件</p>
          </div>
        )}

        <textarea
          className="flex-1 w-full bg-transparent text-slate-200 p-5 resize-none focus:outline-none focus:bg-white/[0.01] font-mono text-xs leading-relaxed transition-colors custom-scrollbar placeholder-slate-600/50"
          placeholder={`请粘贴剧本或拖入文件 (.docx, .pdf, .txt)...\n\n示例:\n内景。太空站 - 夜晚\n指挥官扎拉望着地球。`}
          value={script}
          onChange={(e) => setScript(e.target.value)}
          disabled={isAnalyzing || isProcessingFile}
          spellCheck={false}
        />
        
        {/* Settings Panel */}
        <div className="border-t border-white/5 bg-black/10">
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className="w-full flex items-center justify-between px-5 py-3 text-[10px] font-medium text-slate-500 hover:text-slate-300 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Sliders size={12} />
              <span>AI 定制指令 & 约束</span>
              {customInstructions && <div className="w-1 h-1 rounded-full bg-indigo-500"></div>}
            </div>
            {showSettings ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
          </button>
          
          {showSettings && (
             <div className="px-5 pb-4 animate-fade-in space-y-3">
               
               {/* Constraint Inputs */}
               <div className="grid grid-cols-3 gap-2">
                 <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2 flex flex-col gap-1 focus-within:border-indigo-500/30 transition-colors">
                    <label className="text-[9px] text-slate-500 font-medium flex items-center gap-1" title="单个镜头最大时长">
                      <Clock size={10} /> 单镜上限(秒)
                    </label>
                    <input 
                      type="text" 
                      className="bg-transparent border-none text-[11px] text-slate-200 focus:outline-none w-full placeholder-slate-600"
                      placeholder="例: 5"
                      value={maxDuration}
                      onChange={(e) => handleConstraintChange('max', e.target.value)}
                    />
                 </div>
                 <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2 flex flex-col gap-1 focus-within:border-indigo-500/30 transition-colors">
                    <label className="text-[9px] text-slate-500 font-medium flex items-center gap-1" title="每集预估镜头数量">
                      <Hash size={10} /> 单集镜头数
                    </label>
                    <input 
                      type="text" 
                      className="bg-transparent border-none text-[11px] text-slate-200 focus:outline-none w-full placeholder-slate-600"
                      placeholder="例: 20"
                      value={shotCount}
                      onChange={(e) => handleConstraintChange('count', e.target.value)}
                    />
                 </div>
                 <div className="bg-white/[0.03] border border-white/5 rounded-lg p-2 flex flex-col gap-1 focus-within:border-indigo-500/30 transition-colors">
                    <label className="text-[9px] text-slate-500 font-medium flex items-center gap-1" title="每秒阅读字数">
                      <Mic2 size={10} /> 语速(字/秒)
                    </label>
                    <input 
                      type="text" 
                      className="bg-transparent border-none text-[11px] text-slate-200 focus:outline-none w-full placeholder-slate-600"
                      placeholder="例: 4"
                      value={speakingRate}
                      onChange={(e) => handleConstraintChange('rate', e.target.value)}
                    />
                 </div>
               </div>

               <textarea
                 className="w-full bg-white/[0.03] border border-white/5 rounded-lg p-3 text-[11px] text-slate-300 placeholder-slate-600 focus:ring-1 focus:ring-indigo-500/30 focus:border-indigo-500/30 focus:outline-none resize-none h-20 leading-relaxed font-mono custom-scrollbar"
                 placeholder="更多补充要求... 例如：风格偏向赛博朋克；多用特写镜头..."
                 value={customInstructions}
                 onChange={(e) => setCustomInstructions(e.target.value)}
                 spellCheck={false}
               />
             </div>
          )}
        </div>
      </div>
    </div>
  );
};
