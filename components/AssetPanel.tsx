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
  onSaveAsset?: () => void;  // 保存资产时同步到服务器
}

export const AssetPanel: React.FC<AssetPanelProps> = ({ 
    data, onUpdateImage, onUpdateText, onRemoveImage, onAddCharacter, onAddAsset, onDeleteCharacter, onDeleteAsset, onAddHistory, onSaveAsset 
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

  // 当没有数据时，显示空状态但仍然允许添加资产
  const hasData = data && (data.characters?.length > 0 || data.assets?.length > 0);
  const characters = data?.characters || [];
  const assets = data?.assets || [];

  // Filtering logic
  const filteredCharacters = characters; 
  const locationAssets = assets.filter(a => a.type === 'Location');
  const propAssets = assets.filter(a => a.type !== 'Location');

  /**
   * 渲染资产卡片 - 统一大小和酸性设计风格
   */
  const renderCard = (item: any, type: 'character' | 'asset', index: number, originalIndex: number) => {
      const isEditing = editingId === `${type}-${originalIndex}`;
      const isMenuOpen = activeMenuId === `${type}-${originalIndex}`;
      const isDragActive = draggingIndex?.type === type && draggingIndex.index === originalIndex;

      // 根据类型设置不同的强调色
      const accentColor = type === 'character' ? '#d946ef' : (item.type === 'Location' ? '#ccff00' : '#06b6d4');

      return (
        <div 
            key={`${type}-${originalIndex}`}
            className={`
              bg-white/[0.03] border shadow-lg transition-all group relative overflow-hidden backdrop-blur-md 
              flex flex-col rounded-2xl h-[280px]
              ${isDragActive ? `border-[${accentColor}] bg-[${accentColor}]/10` : 'border-white/10 hover:border-white/20'}
              hover:shadow-[0_0_30px_rgba(217,70,239,0.1)] hover:scale-[1.02]
            `}
            onDragOver={(e) => handleDragOver(e, type, originalIndex)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, type, originalIndex)}
        >
             {/* 顶部渐变装饰 */}
             <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-white/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>

             {/* Header & Menu */}
             <div className="flex justify-between items-center p-3 border-b border-white/5 bg-black/20">
                 {isEditing ? (
                     <input 
                        className="text-sm font-bold font-display text-white bg-black/40 border border-white/20 rounded px-2 py-1 w-full outline-none focus:border-[#d946ef]"
                        value={item.name}
                        onChange={(e) => onUpdateText(type, originalIndex, 'name', e.target.value)}
                     />
                 ) : (
                     <h4 className="text-sm font-bold font-display text-white truncate pr-6">{item.name}</h4>
                 )}

                 {/* 菜单按钮 */}
                 <div className="shrink-0">
                     {isEditing ? (
                         <button onClick={() => { setEditingId(null); onSaveAsset?.(); }} className="p-1.5 bg-[#ccff00] text-black rounded-lg hover:scale-110 transition-transform">
                             <Check size={12} />
                         </button>
                     ) : (
                         <div className="relative">
                             <button 
                                onClick={() => setActiveMenuId(isMenuOpen ? null : `${type}-${originalIndex}`)}
                                className="p-1.5 text-slate-400 hover:text-white transition-colors opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded-lg"
                             >
                                 <MoreVertical size={14} />
                             </button>
                             {isMenuOpen && (
                                 <>
                                     <div className="fixed inset-0 z-40" onClick={() => setActiveMenuId(null)} />
                                     <div className="absolute right-0 top-8 bg-[#1a1a1a] border border-white/10 rounded-xl shadow-xl py-1 w-28 z-50 flex flex-col overflow-hidden">
                                         <button onClick={() => { setEditingId(`${type}-${originalIndex}`); setActiveMenuId(null); }} className="px-3 py-2.5 text-xs text-left hover:bg-white/5 text-slate-300 flex items-center gap-2 transition-colors">
                                             <Pencil size={12} /> 编辑
                                         </button>
                                         <button onClick={() => { copyToClipboard(item.visualSummary || item.description); setActiveMenuId(null); }} className="px-3 py-2.5 text-xs text-left hover:bg-white/5 text-slate-300 flex items-center gap-2 transition-colors">
                                             <Copy size={12} /> 复制
                                         </button>
                                         <button onClick={() => { 
                                             if(type === 'character') onDeleteCharacter?.(originalIndex);
                                             else onDeleteAsset?.(originalIndex);
                                             setActiveMenuId(null); 
                                         }} className="px-3 py-2.5 text-xs text-left hover:bg-red-500/10 text-red-400 flex items-center gap-2 transition-colors">
                                             <Trash2 size={12} /> 删除
                                         </button>
                                     </div>
                                 </>
                             )}
                         </div>
                     )}
                 </div>
             </div>

             {/* 图片区域 - 固定高度 */}
             <div className="p-3 flex-1 min-h-0">
                  <div className="grid grid-cols-2 gap-2 h-full">
                      {item.imageUrls?.slice(0, 4).map((url: string, imgIdx: number) => (
                          <div key={imgIdx} className="relative aspect-square group/img transition-transform hover:scale-[1.02]">
                              <img 
                                src={url} 
                                className="w-full h-full object-cover rounded-xl shadow-sm border border-white/10 cursor-pointer hover:border-[#d946ef] transition-colors"
                                onClick={() => setLightboxImage(url)}
                              />
                              {isEditing && (
                                  <button 
                                    onClick={(e) => { e.stopPropagation(); onRemoveImage(type, originalIndex, imgIdx); }}
                                    className="absolute -top-1 -right-1 p-1 bg-red-500 text-white rounded-full hover:bg-red-600 cursor-pointer z-20 shadow-lg"
                                  >
                                    <X size={10} />
                                  </button>
                              )}
                          </div>
                      ))}
                      {(!item.imageUrls || item.imageUrls.length < 4) && (
                        <label className="aspect-square border-2 border-dashed border-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer hover:border-[#d946ef] hover:bg-white/5 transition-all group/add">
                            <Plus size={20} className="text-slate-600 group-hover/add:text-[#d946ef] transition-colors" />
                            <span className="text-[9px] text-slate-600 mt-1 group-hover/add:text-slate-400">添加图片</span>
                            <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => handleFileChange(e, type, originalIndex)} />
                        </label>
                      )}
                  </div>
             </div>

             {/* 描述文本 - 固定高度 */}
             <div className="p-3 pt-0 h-[60px]">
                {isEditing ? (
                    <textarea 
                        className="w-full bg-black/40 border border-white/20 rounded-lg p-2 text-xs text-slate-300 resize-none h-full outline-none focus:border-[#d946ef]"
                        value={type === 'character' ? item.visualSummary : item.description}
                        onChange={(e) => onUpdateText(type, originalIndex, type === 'character' ? 'visualSummary' : 'description', e.target.value)}
                    />
                ) : (
                    <p className="text-xs text-slate-400 leading-relaxed line-clamp-2">
                        {type === 'character' ? item.visualSummary : item.description}
                    </p>
                )}
             </div>
        </div>
      );
  };

  return (
    <>
    {/* 全局资产库 - 与分镜表区域大小一致 */}
    <div className="h-full overflow-y-auto pr-2 pb-20 custom-scrollbar">
        <div className="flex flex-col gap-6 p-4">
            {/* 角色区域 */}
            <div className="bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-[#d946ef]/10 to-transparent">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#d946ef] shadow-[0_0_8px_#d946ef]"></span>
                        角色 (Characters)
                    </h3>
                    <button onClick={onAddCharacter} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-[#d946ef] transition-colors">
                        <Plus size={16}/>
                    </button>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredCharacters.map((char, idx) => renderCard(char, 'character', idx, characters.indexOf(char)))}
                    {filteredCharacters.length === 0 && (
                        <div className="col-span-full text-center py-8 text-slate-500 text-xs">
                            暂无角色，点击右上角 + 添加
                        </div>
                    )}
                </div>
            </div>

            {/* 场景区域 */}
            <div className="bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-[#ccff00]/10 to-transparent">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-[#ccff00] shadow-[0_0_8px_#ccff00]"></span>
                        场景 (Scenes)
                    </h3>
                    <button onClick={onAddAsset} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-[#ccff00] transition-colors">
                        <Plus size={16}/>
                    </button>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {locationAssets.map((asset, idx) => renderCard(asset, 'asset', idx, assets.indexOf(asset)))}
                    {locationAssets.length === 0 && (
                        <div className="col-span-full text-center py-8 text-slate-500 text-xs">
                            暂无场景，点击右上角 + 添加
                        </div>
                    )}
                </div>
            </div>

            {/* 道具区域 */}
            <div className="bg-black/20 rounded-2xl border border-white/5 overflow-hidden">
                <div className="px-4 py-3 border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-cyan-500/10 to-transparent">
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-cyan-500 shadow-[0_0_8px_#06b6d4]"></span>
                        道具 (Props)
                    </h3>
                    <button onClick={onAddAsset} className="p-1.5 hover:bg-white/10 rounded-lg text-slate-400 hover:text-cyan-400 transition-colors">
                        <Plus size={16}/>
                    </button>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {propAssets.map((asset, idx) => renderCard(asset, 'asset', idx, assets.indexOf(asset)))}
                    {propAssets.length === 0 && (
                        <div className="col-span-full text-center py-8 text-slate-500 text-xs">
                            暂无道具，点击右上角 + 添加
                        </div>
                    )}
                </div>
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
