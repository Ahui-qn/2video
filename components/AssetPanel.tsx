
import React, { useState } from 'react';
import { AnalysisResult, CharacterProfile, AssetProfile } from '../types';
import { User, Box, Copy, ImagePlus, Pencil, Check, X, Download, Maximize2 } from 'lucide-react';

interface AssetPanelProps {
  data: AnalysisResult;
  onUpdateImage: (type: 'character' | 'asset', index: number, files: FileList | File[]) => void;
  onUpdateText: (type: 'character' | 'asset', index: number, field: keyof CharacterProfile | keyof AssetProfile, value: string) => void;
  onRemoveImage: (type: 'character' | 'asset', index: number, imageIndex: number) => void;
}

export const AssetPanel: React.FC<AssetPanelProps> = ({ data, onUpdateImage, onUpdateText, onRemoveImage }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [draggingIndex, setDraggingIndex] = useState<{type: 'character' | 'asset', index: number} | null>(null);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'character' | 'asset', index: number) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      onUpdateImage(type, index, files);
    }
  };

  const handleDrop = (e: React.DragEvent, type: 'character' | 'asset', index: number) => {
    e.preventDefault();
    e.stopPropagation();
    setDraggingIndex(null);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onUpdateImage(type, index, e.dataTransfer.files);
    }
  };

  const handleDragOver = (e: React.DragEvent, type: 'character' | 'asset', index: number) => {
    e.preventDefault();
    e.stopPropagation();
    if (draggingIndex?.type !== type || draggingIndex?.index !== index) {
      setDraggingIndex({ type, index });
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget.contains(e.relatedTarget as Node)) {
      return;
    }
    setDraggingIndex(null);
  };

  const downloadImage = (url: string) => {
    const link = document.createElement('a');
    link.href = url;
    link.download = 'asset-image.png';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!data.characters.length && !data.assets.length) return null;

  return (
    <>
    <div className="h-full overflow-y-auto pr-4 pb-20 custom-scrollbar p-2">
      
      {/* Characters */}
      <div className="mb-12">
        <h3 className="text-4xl font-black font-display text-white mb-8 tracking-tighter opacity-80">角色档案</h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {data.characters.map((char, idx) => {
             const isEditing = editingId === `char-${idx}`;
             const isDragActive = draggingIndex?.type === 'character' && draggingIndex.index === idx;

             return (
            <div 
                key={idx} 
                className={`bg-white/[0.02] border p-6 shadow-xl transition-all group relative overflow-visible backdrop-blur-md flex flex-col gap-6 rounded-3xl ${isDragActive ? 'border-[#d946ef] bg-[#d946ef]/10' : 'border-white/10 hover:border-[#d946ef]/50'}`}
                onDragOver={(e) => handleDragOver(e, 'character', idx)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'character', idx)}
            >
              
              {/* Image Slot - Grid Layout */}
              <div className="w-full bg-black/20 rounded-2xl p-4 border border-white/5 relative z-10">
                  <div className="grid grid-cols-5 gap-2 w-full">
                      {/* Existing Images */}
                      {char.imageUrls?.map((url, imgIdx) => (
                          <div key={url} className="relative w-full aspect-square group/img transition-transform hover:scale-[1.02]">
                              <img 
                                src={url} 
                                alt={`Character ${imgIdx}`} 
                                className="w-full h-full object-cover rounded-xl shadow-lg border border-white/10 cursor-pointer hover:border-[#d946ef] transition-colors"
                                onClick={() => setLightboxImage(url)}
                              />
                              <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveImage('character', idx, imgIdx);
                                }}
                                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all opacity-0 group-hover/img:opacity-100 shadow-md transform hover:scale-110 z-20 cursor-pointer"
                              >
                                <X size={10} strokeWidth={3} />
                              </button>
                          </div>
                      ))}
                      
                      {/* Upload Button */}
                      {(!char.imageUrls || char.imageUrls.length < 5) && (
                        <label className="w-full aspect-square border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#d946ef] hover:bg-white/5 transition-all group/upload relative">
                            <ImagePlus size={20} className="text-slate-600 group-hover/upload:text-[#d946ef] transition-colors" />
                            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFileChange(e, 'character', idx)} />
                        </label>
                      )}
                  </div>
              </div>

              {/* Text Content - Bottom */}
              <div className="flex-1 min-w-0 flex flex-col relative z-0 pl-2">
                  <div className="absolute top-0 right-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                     <button onClick={() => setEditingId(isEditing ? null : `char-${idx}`)} className="p-2 bg-white/10 text-white rounded hover:bg-white/20 transition-colors">
                        {isEditing ? <Check size={14}/> : <Pencil size={14}/>}
                     </button>
                     {!isEditing && (
                        <button onClick={() => copyToClipboard(char.visualSummary)} className="p-2 bg-[#d946ef] text-white rounded hover:scale-110 transition-transform"><Copy size={14}/></button>
                     )}
                  </div>

                  {isEditing ? (
                      <input 
                        className="text-2xl font-bold font-display text-white mb-4 bg-black/40 border border-white/20 rounded px-2 w-full outline-none focus:border-[#d946ef]"
                        value={char.name}
                        onChange={(e) => onUpdateText('character', idx, 'name', e.target.value)}
                      />
                  ) : (
                      <h4 className="text-3xl font-bold font-display text-white mb-4 tracking-tight">{char.name}</h4>
                  )}

                  <div className="space-y-4 flex-1">
                    {isEditing ? (
                         <textarea 
                            className="text-sm text-slate-300 font-light leading-relaxed bg-black/40 border border-white/20 rounded p-2 w-full h-24 outline-none focus:border-[#d946ef] resize-none"
                            value={char.visualSummary}
                            onChange={(e) => onUpdateText('character', idx, 'visualSummary', e.target.value)}
                         />
                    ) : (
                        <p className="text-sm text-slate-300 font-light leading-relaxed opacity-80">{char.visualSummary}</p>
                    )}
                    
                    {isEditing ? (
                        <input 
                            className="text-[10px] bg-black/40 border border-white/20 rounded px-2 py-1 w-full text-[#d946ef] font-bold outline-none focus:border-[#d946ef]"
                            value={char.traits}
                            onChange={(e) => onUpdateText('character', idx, 'traits', e.target.value)}
                            placeholder="特性 (逗号分隔)"
                        />
                    ) : (
                        <div className="flex flex-wrap gap-2">
                            {char.traits.split(/[,，、]/).map((trait, tIdx) => (
                                <span key={tIdx} className="text-[10px] font-bold text-[#d946ef] bg-[#d946ef]/5 border border-[#d946ef]/20 px-2 py-1 uppercase tracking-wider rounded">
                                {trait.trim()}
                                </span>
                            ))}
                        </div>
                    )}
                  </div>
              </div>
            </div>
          )})}
        </div>
      </div>

      {/* Assets */}
      <div>
        <h3 className="text-4xl font-black font-display text-white mb-8 tracking-tighter opacity-80">场景资产</h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {data.assets.map((asset, idx) => {
            const isEditing = editingId === `asset-${idx}`;
            const isDragActive = draggingIndex?.type === 'asset' && draggingIndex.index === idx;

            return (
            <div 
                key={idx} 
                className={`bg-white/[0.02] border p-6 shadow-xl transition-all group relative overflow-visible backdrop-blur-md flex flex-col gap-6 rounded-3xl ${isDragActive ? 'border-[#ccff00] bg-[#ccff00]/10' : 'border-white/10 hover:border-[#ccff00]/50'}`}
                onDragOver={(e) => handleDragOver(e, 'asset', idx)}
                onDragLeave={handleDragLeave}
                onDrop={(e) => handleDrop(e, 'asset', idx)}
            >
               
              {/* Image Slot - Grid Layout */}
              <div className="w-full bg-black/20 rounded-2xl p-4 border border-white/5 relative z-10">
                  <div className="grid grid-cols-5 gap-2 w-full">
                      {asset.imageUrls?.map((url, imgIdx) => (
                          <div key={url} className="relative w-full aspect-square group/img transition-transform hover:scale-[1.02]">
                              <img 
                                src={url} 
                                alt={`Asset ${imgIdx}`} 
                                className="w-full h-full object-cover rounded-xl shadow-lg border border-white/10 cursor-pointer hover:border-[#ccff00] transition-colors"
                                onClick={() => setLightboxImage(url)}
                              />
                              <button 
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveImage('asset', idx, imgIdx);
                                }}
                                className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 transition-all opacity-0 group-hover/img:opacity-100 shadow-md transform hover:scale-110 z-20 cursor-pointer"
                              >
                                <X size={10} strokeWidth={3} />
                              </button>
                          </div>
                      ))}
                      
                      {/* Upload Button */}
                      {(!asset.imageUrls || asset.imageUrls.length < 5) && (
                        <label className="w-full aspect-square border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#ccff00] hover:bg-white/5 transition-all group/upload relative">
                            <ImagePlus size={20} className="text-slate-600 group-hover/upload:text-[#ccff00] transition-colors" />
                            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFileChange(e, 'asset', idx)} />
                        </label>
                      )}
                  </div>
              </div>

              {/* Text Content - Bottom */}
              <div className="flex-1 min-w-0 flex flex-col relative z-0 pl-2">
                  <div className="absolute top-0 right-0 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-20">
                     <button onClick={() => setEditingId(isEditing ? null : `asset-${idx}`)} className="p-2 bg-white/10 text-white rounded hover:bg-white/20 transition-colors">
                        {isEditing ? <Check size={14}/> : <Pencil size={14}/>}
                     </button>
                     {!isEditing && (
                        <button onClick={() => copyToClipboard(asset.description)} className="p-2 bg-[#ccff00] text-black rounded hover:scale-110 transition-transform"><Copy size={14}/></button>
                     )}
                  </div>
                  
                  <div className="flex items-center gap-3 mb-4">
                    <span className={`text-[9px] font-bold px-1.5 py-0.5 border uppercase rounded ${asset.type === 'Location' ? 'text-indigo-300 border-indigo-500 bg-indigo-500/10' : 'text-orange-300 border-orange-500 bg-orange-500/10'}`}>
                        {asset.type === 'Location' ? '场景' : '道具'}
                    </span>
                    {isEditing ? (
                        <input 
                            className="text-xl font-bold font-display text-white bg-black/40 border border-white/20 rounded px-2 w-full outline-none focus:border-[#ccff00]"
                            value={asset.name}
                            onChange={(e) => onUpdateText('asset', idx, 'name', e.target.value)}
                        />
                    ) : (
                        <h4 className="text-2xl font-bold font-display text-white truncate">{asset.name}</h4>
                    )}
                  </div>

                  {isEditing ? (
                         <textarea 
                            className="text-sm text-slate-300 font-light leading-relaxed bg-black/40 border border-white/20 rounded p-2 w-full h-24 outline-none focus:border-[#ccff00] resize-none"
                            value={asset.description}
                            onChange={(e) => onUpdateText('asset', idx, 'description', e.target.value)}
                         />
                    ) : (
                        <p className="text-sm text-slate-300 font-light leading-relaxed border-l-2 border-white/10 pl-4 opacity-80">
                            {asset.description}
                        </p>
                    )}
              </div>
            </div>
          )})}
        </div>
      </div>
    </div>

    {/* Lightbox Modal */}
    {lightboxImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 backdrop-blur-md animate-fade-in" onClick={() => setLightboxImage(null)}>
            <div className="relative max-w-[90vw] max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                <img src={lightboxImage} alt="Preview" className="max-w-full max-h-[90vh] rounded-lg shadow-2xl border border-white/10" />
                <div className="absolute top-4 right-4 flex gap-2">
                    <button onClick={() => copyToClipboard(lightboxImage)} className="p-2 bg-black/50 text-white rounded-full hover:bg-white hover:text-black transition-colors border border-white/20"><Copy size={20}/></button>
                    <button onClick={() => downloadImage(lightboxImage)} className="p-2 bg-black/50 text-white rounded-full hover:bg-white hover:text-black transition-colors border border-white/20"><Download size={20}/></button>
                    <button onClick={() => setLightboxImage(null)} className="p-2 bg-red-500/80 text-white rounded-full hover:bg-red-600 transition-colors"><X size={20}/></button>
                </div>
            </div>
        </div>
    )}
    </>
  );
};
