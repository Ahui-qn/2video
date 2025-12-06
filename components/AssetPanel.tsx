import React, { useState, useEffect, useRef, useMemo } from 'react';
import { AnalysisResult, CharacterProfile, AssetProfile } from '../types';
import { Copy, ImagePlus, Pencil, Check, X, Download, Plus, Trash2, Search, MoreVertical } from 'lucide-react';

interface AssetPanelProps {
  data: AnalysisResult;
  onUpdateImage: (type: 'character' | 'asset', index: number, files: FileList | File[]) => void;
  onUpdateText: (type: 'character' | 'asset', index: number, field: keyof CharacterProfile | keyof AssetProfile, value: string) => void;
  onRemoveImage: (type: 'character' | 'asset', index: number, imageIndex: number) => void;
  onAddCharacter?: () => void;
  onAddAsset?: () => void;
  onDeleteCharacter?: (index: number) => void;
  onDeleteAsset?: (index: number) => void;
  onAddHistory?: (summary: string) => void;
}

export const AssetPanel: React.FC<AssetPanelProps> = ({ 
    data, onUpdateImage, onUpdateText, onRemoveImage, onAddCharacter, onAddAsset, onDeleteCharacter, onDeleteAsset, onAddHistory 
}) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<{type: 'character' | 'asset', index: number} | null>(null);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);
  
  // Refs
  const charactersEndRef = useRef<HTMLDivElement>(null);
  const assetsEndRef = useRef<HTMLDivElement>(null);

  const copyToClipboard = (text: string) => { navigator.clipboard.writeText(text); };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'character' | 'asset', index: number) => {
    if (e.target.files?.length) onUpdateImage(type, index, e.target.files);
  };
  
  const handleDrop = (e: React.DragEvent, type: 'character' | 'asset', index: number) => {
    e.preventDefault(); e.stopPropagation(); setDraggingIndex(null);
    if (e.dataTransfer.files?.length) onUpdateImage(type, index, e.dataTransfer.files);
  };
  
  const handleDragOver = (e: React.DragEvent, type: 'character' | 'asset', index: number) => {
    e.preventDefault(); e.stopPropagation();
    if (draggingIndex?.type !== type || draggingIndex?.index !== index) setDraggingIndex({ type, index });
  };
  
  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDraggingIndex(null);
  };
  
  const downloadImage = (url: string) => {
    const link = document.createElement('a'); link.href = url; link.download = 'asset.png';
    document.body.appendChild(link); link.click(); document.body.removeChild(link);
  };

  if (!data) return <div className="flex-1 flex items-center justify-center text-slate-500 font-mono text-xs h-full">未检测到资产库</div>;

  // Filtering logic
  const filteredCharacters = data.characters; 
  const locationAssets = data.assets.filter(a => a.type === 'Location');
  const propAssets = data.assets.filter(a => a.type !== 'Location');

  // Render Card Helper
  const renderCard = (item: any, type: 'character' | 'asset', index: number, originalIndex: number) => {
      const isEditing = editingId === `${type}-${originalIndex}`;
      const isMenuOpen = activeMenuId === `${type}-${originalIndex}`;
      const isDragActive = draggingIndex?.type === type && draggingIndex.index === originalIndex;

      return (
        <div 
            key={`${type}-${originalIndex}`}
            className={`bg-white/[0.02] border p-3 shadow-lg transition-all group relative overflow-visible backdrop-blur-md flex flex-col gap-3 rounded-2xl ${isDragActive ? 'border-[#d946ef] bg-[#d946ef]/10' : 'border-white/10 hover:border-[#d946ef]/50'}`}
            onDragOver={(e) => handleDragOver(e, type, originalIndex)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, type, originalIndex)}
        >
             {/* Header & Menu */}
             <div className="flex justify-between items-start relative z-20">
                 {isEditing ? (
                     <input 
                        className="text-sm font-bold font-display text-white bg-black/40 border border-white/20 rounded px-1 w-full outline-none focus:border-[#d946ef]"
                        value={item.name}
                        onChange={(e) => onUpdateText(type, originalIndex, 'name', e.target.value)}
                     />
                 ) : (
                     <h4 className="text-sm font-bold font-display text-white truncate pr-6">{item.name}</h4>
                 )}

                 {/* Kebab Menu or Confirm Button */}
                 <div className="absolute right-0 top-0">
                     {isEditing ? (
                         <button onClick={() => setEditingId(null)} className="p-1 bg-[#ccff00] text-black rounded hover:scale-110 transition-transform">
                             <Check size={12} />
                         </button>
                     ) : (
                         <div className="relative">
                             <button 
                                onClick={() => setActiveMenuId(isMenuOpen ? null : `${type}-${originalIndex}`)}
                                className="p-1 text-slate-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                             >
                                 <MoreVertical size={14} />
                             </button>
                             {isMenuOpen && (
                                 <div className="absolute right-0 top-6 bg-[#0f0518] border border-white/10 rounded-lg shadow-xl py-1 w-24 z-50 flex flex-col">
                                     <button onClick={() => { setEditingId(`${type}-${originalIndex}`); setActiveMenuId(null); }} className="px-3 py-2 text-[10px] text-left hover:bg-white/5 text-slate-300 flex items-center gap-2">
                                         <Pencil size={10} /> 编辑
                                     </button>
                                     <button onClick={() => { copyToClipboard(item.visualSummary || item.description); setActiveMenuId(null); }} className="px-3 py-2 text-[10px] text-left hover:bg-white/5 text-slate-300 flex items-center gap-2">
                                         <Copy size={10} /> 复制
                                     </button>
                                     <button onClick={() => { 
                                         if(type === 'character') onDeleteCharacter?.(originalIndex);
                                         else onDeleteAsset?.(originalIndex);
                                         setActiveMenuId(null); 
                                     }} className="px-3 py-2 text-[10px] text-left hover:bg-red-500/20 text-red-400 flex items-center gap-2">
                                         <Trash2 size={10} /> 删除
                                     </button>
                                 </div>
                             )}
                         </div>
                     )}
                 </div>
             </div>

             {/* Image Grid */}
             <div className="w-full bg-black/20 rounded-xl p-2 border border-white/5 relative z-10">
                  <div className="grid grid-cols-4 gap-1 w-full">
                      {item.imageUrls?.map((url: string, imgIdx: number) => (
                          <div key={imgIdx} className="relative w-full aspect-square group/img transition-transform hover:scale-[1.02]">
                              <img 
                                src={url} 
                                className="w-full h-full object-cover rounded-lg shadow-sm border border-white/10 cursor-pointer hover:border-[#d946ef]"
                                onClick={() => setLightboxImage(url)}
                              />
                              {isEditing && (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); onRemoveImage(type, originalIndex, imgIdx); }}
                                    className="absolute -top-1 -right-1 p-0.5 bg-red-500 text-white rounded-full hover:bg-red-600 cursor-pointer z-20"
                                  >
                                    <X size={8} />
                                  </button>
                              )}
                          </div>
                      ))}
                      {(!item.imageUrls || item.imageUrls.length < 4) && (
                        <label className="w-full aspect-square border border-dashed border-white/10 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-[#d946ef] hover:bg-white/5 transition-all">
                            <Plus size={12} className="text-slate-600" />
                            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFileChange(e, type, originalIndex)} />
                        </label>
                      )}
                  </div>
             </div>

             {/* Text Content */}
             <div className="space-y-2">
                {isEditing ? (
                    <textarea 
                        className="w-full bg-black/40 border border-white/20 rounded p-2 text-[10px] text-slate-300 resize-none h-16 outline-none focus:border-[#d946ef]"
                        value={type === 'character' ? item.visualSummary : item.description}
                        onChange={(e) => onUpdateText(type, originalIndex, type === 'character' ? 'visualSummary' : 'description', e.target.value)}
                    />
                ) : (
                    <p className="text-[10px] text-slate-400 leading-relaxed line-clamp-3">
                        {type === 'character' ? item.visualSummary : item.description}
                    </p>
                )}
             </div>
        </div>
      );
  };

  return (
    <>
    <div className="h-full flex overflow-hidden p-2 gap-2 bg-[#0f0518]">
        {/* Column 1: Characters */}
        <div className="flex-1 flex flex-col min-w-0 bg-white/[0.02] rounded-xl border border-white/5 overflow-hidden">
            <div className="p-3 border-b border-white/5 flex items-center justify-between bg-black/20">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">角色 (Characters)</h3>
                <button onClick={onAddCharacter} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"><Plus size={14}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar grid grid-cols-1 lg:grid-cols-2 gap-2 content-start">
                {filteredCharacters.map((char, idx) => renderCard(char, 'character', idx, data.characters.indexOf(char)))}
            </div>
        </div>

        {/* Column 2: Scenes */}
        <div className="flex-1 flex flex-col min-w-0 bg-white/[0.02] rounded-xl border border-white/5 overflow-hidden">
            <div className="p-3 border-b border-white/5 flex items-center justify-between bg-black/20">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">场景 (Scenes)</h3>
                <button onClick={onAddAsset} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"><Plus size={14}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar grid grid-cols-1 lg:grid-cols-2 gap-2 content-start">
                {locationAssets.map((asset, idx) => renderCard(asset, 'asset', idx, data.assets.indexOf(asset)))}
            </div>
        </div>

        {/* Column 3: Props */}
        <div className="flex-1 flex flex-col min-w-0 bg-white/[0.02] rounded-xl border border-white/5 overflow-hidden">
            <div className="p-3 border-b border-white/5 flex items-center justify-between bg-black/20">
                <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider">道具 (Props)</h3>
                <button onClick={onAddAsset} className="p-1 hover:bg-white/10 rounded text-slate-400 hover:text-white"><Plus size={14}/></button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-2 custom-scrollbar grid grid-cols-1 lg:grid-cols-2 gap-2 content-start">
                {propAssets.map((asset, idx) => renderCard(asset, 'asset', idx, data.assets.indexOf(asset)))}
            </div>
        </div>
    </div>

    {/* Lightbox (same as before) */}
    {lightboxImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md animate-fade-in" onClick={() => setLightboxImage(null)}>
            <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <img src={lightboxImage} alt="Preview" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl border border-white/10" />
                <button onClick={() => setLightboxImage(null)} className="absolute top-4 right-4 p-2 bg-red-500/80 text-white rounded-full hover:bg-red-600 transition-colors"><X size={20}/></button>
            </div>
        </div>
    )}
    </>
  );
};
