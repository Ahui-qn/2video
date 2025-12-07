import React, { useState, useRef } from 'react';
import { X, Upload, Type, FileText, Image as ImageIcon } from 'lucide-react';

interface CreateProjectModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (project: ProjectData) => void;
}

export interface ProjectData {
  name: string;
  description: string;
  coverImage: string | null;
}

export const CreateProjectModal: React.FC<CreateProjectModalProps> = ({ isOpen, onClose, onCreate }) => {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleImageUpload = (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      alert("图片大小不能超过 5MB");
      return;
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      alert("仅支持 JPG/PNG 格式");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      setCoverImage(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleImageUpload(file);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    onCreate({ name, description, coverImage });
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in">
      <div 
        className="w-full max-w-2xl bg-[#0f0518] border border-white/10 rounded-3xl shadow-[0_0_50px_rgba(204,255,0,0.1)] overflow-hidden relative flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-8 py-6 border-b border-white/5 flex items-center justify-between bg-black/20">
          <h2 className="text-2xl font-display font-bold text-white tracking-tight">
            新建项目 <span className="text-[#ccff00] text-lg">NEW PROJECT</span>
          </h2>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto custom-scrollbar max-h-[70vh]">
          
          {/* Project Name */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-[#ccff00] uppercase tracking-widest">
              <Type size={12} /> 项目名称 *
            </label>
            <input 
              type="text" 
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={50}
              placeholder="输入项目名称（最多50字）"
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-slate-600 focus:border-[#ccff00] focus:bg-white/10 outline-none transition-all font-bold text-lg"
              autoFocus
              required
            />
            <div className="text-right text-[10px] text-slate-600 font-mono">{name.length}/50</div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <FileText size={12} /> 项目简介 (Markdown)
            </label>
            <textarea 
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="支持 Markdown 格式..."
              className="w-full h-32 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-slate-300 placeholder-slate-600 focus:border-white/30 outline-none transition-all resize-none custom-scrollbar font-mono text-sm"
            />
          </div>

          {/* Cover Image */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
              <ImageIcon size={12} /> 封面图片
            </label>
            <div 
              className={`relative w-full h-48 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center transition-all cursor-pointer overflow-hidden group
                ${isDragging ? 'border-[#ccff00] bg-[#ccff00]/5' : 'border-white/10 bg-black/20 hover:border-white/20 hover:bg-white/5'}
              `}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              {coverImage ? (
                <>
                  <img src={coverImage} alt="Cover" className="w-full h-full object-cover opacity-50 group-hover:opacity-70 transition-opacity" />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-white font-bold text-xs uppercase tracking-widest">点击更换</span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col items-center text-slate-500 group-hover:text-slate-300 transition-colors">
                  <Upload size={32} className="mb-2" />
                  <span className="text-xs font-bold uppercase tracking-widest">点击或拖拽上传</span>
                  <span className="text-[10px] mt-1 opacity-60">支持 JPG/PNG, 最大 5MB</span>
                </div>
              )}
              <input 
                type="file" 
                ref={fileInputRef} 
                className="hidden" 
                accept="image/png, image/jpeg"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleImageUpload(file);
                }}
              />
            </div>
          </div>

        </form>

        {/* Footer */}
        <div className="px-8 py-6 border-t border-white/5 bg-black/20 flex items-center justify-end gap-4">
          <button 
            onClick={onClose}
            className="px-6 py-2.5 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-white/5 transition-all uppercase tracking-wider"
          >
            取消
          </button>
          <button 
            onClick={handleSubmit}
            disabled={!name.trim()}
            className={`px-8 py-2.5 rounded-xl text-xs font-bold text-black transition-all uppercase tracking-wider flex items-center gap-2 shadow-[0_0_20px_rgba(204,255,0,0.2)]
              ${name.trim() ? 'bg-[#ccff00] hover:bg-[#d9f99d] hover:scale-105 cursor-pointer' : 'bg-slate-700 cursor-not-allowed opacity-50'}
            `}
          >
            确认创建
          </button>
        </div>
      </div>
    </div>
  );
};
