import React, { useState, useRef } from 'react';
import { X, UploadCloud, FileText, CheckCircle2, Loader2 } from 'lucide-react';

interface UploadScriptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
  progress: number;
  progressStatus: string;
  isAnalyzing: boolean;
}

export const UploadScriptModal: React.FC<UploadScriptModalProps> = ({ 
  isOpen, 
  onClose, 
  onUpload, 
  progress, 
  progressStatus,
  isAnalyzing 
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && !isAnalyzing) onUpload(file);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && !isAnalyzing) onUpload(file);
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-xl bg-[#0f0518] border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(204,255,0,0.1)] overflow-hidden relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-black/20">
          <h2 className="text-xl font-display font-bold text-white tracking-tight">
            自动生成分镜表 <span className="text-[#ccff00] text-sm ml-2">AUTO STORYBOARD</span>
          </h2>
          {!isAnalyzing && (
            <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
              <X size={24} />
            </button>
          )}
        </div>

        {/* Body */}
        <div className="p-8">
          {isAnalyzing ? (
            <div className="flex flex-col items-center justify-center py-10">
               <div className="relative mb-6">
                  <Loader2 size={48} className="text-[#ccff00] animate-spin" />
                  <div className="absolute inset-0 blur-xl bg-[#ccff00]/20 animate-pulse" />
               </div>
               <h3 className="text-white font-bold text-lg mb-2">正在分析剧本...</h3>
               <div className="w-full max-w-xs h-1 bg-white/10 rounded-full overflow-hidden mb-2">
                  <div className="h-full bg-[#ccff00] transition-all duration-300" style={{ width: `${progress}%` }} />
               </div>
               <p className="text-slate-500 text-xs font-mono">{progressStatus}</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Drag Area */}
              <div 
                className={`relative w-full h-64 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer overflow-hidden group
                  ${isDragging ? 'border-[#ccff00] bg-[#ccff00]/5 scale-[0.99]' : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5'}
                `}
                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                 <UploadCloud size={48} className={`mb-4 transition-colors ${isDragging ? 'text-[#ccff00]' : 'text-slate-500 group-hover:text-white'}`} />
                 <h3 className="text-white font-bold text-lg mb-1">点击或拖拽上传剧本</h3>
                 <p className="text-slate-500 text-xs mb-6">支持 .txt, .md, .pdf, .docx, .fountain</p>
                 
                 <div className="px-4 py-2 bg-white/5 rounded-lg border border-white/5 text-[10px] text-slate-400 font-mono">
                    MAX FILE SIZE: 10MB
                 </div>

                 <input 
                    type="file" 
                    ref={fileInputRef} 
                    className="hidden" 
                    accept=".txt,.md,.pdf,.docx,.fountain"
                    onChange={handleFileSelect}
                 />
              </div>

              <div className="flex items-center justify-between text-xs text-slate-500 px-2">
                 <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#ccff00]" />
                    <span>智能场景拆分</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#ccff00]" />
                    <span>自动提取角色</span>
                 </div>
                 <div className="flex items-center gap-2">
                    <CheckCircle2 size={14} className="text-[#ccff00]" />
                    <span>AI 视觉化描述</span>
                 </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
