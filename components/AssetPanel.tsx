
import React from 'react';
import { AnalysisResult } from '../types';
import { User, Box, Copy, Sparkles, MapPin } from 'lucide-react';

interface AssetPanelProps {
  data: AnalysisResult;
}

export const AssetPanel: React.FC<AssetPanelProps> = ({ data }) => {
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (!data.characters.length && !data.assets.length) {
    return null;
  }

  return (
    <div className="h-full overflow-y-auto pr-4 pb-20 custom-scrollbar">
      
      {/* Characters Section */}
      <div className="mb-10">
        <h3 className="text-white font-bold mb-6 flex items-center gap-3 sticky top-0 bg-[#1a0510]/80 backdrop-blur-xl py-4 z-10 border-b border-white/5 -mx-2 px-2">
          <div className="bg-fuchsia-500/20 p-2 rounded-xl border border-fuchsia-500/20 shadow-[0_0_10px_rgba(217,70,239,0.2)]">
             <User className="text-fuchsia-300" size={16} />
          </div>
          角色档案
          <span className="text-xs font-normal text-stone-400 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5">{data.characters.length}</span>
        </h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {data.characters.map((char, idx) => (
            <div key={idx} className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 shadow-lg hover:border-fuchsia-500/30 hover:shadow-fuchsia-900/20 transition-all duration-300 group">
              <div className="flex justify-between items-start mb-4">
                <h4 className="text-white font-bold text-lg tracking-tight group-hover:text-fuchsia-300 transition-colors">{char.name}</h4>
                <button 
                  onClick={() => copyToClipboard(char.visualSummary)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-stone-300 hover:text-white flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/5 hover:bg-white/20"
                  title="复制外貌Prompt"
                >
                  <Copy size={12} /> 复制
                </button>
              </div>
              <div className="space-y-4">
                <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                  <div className="flex items-center gap-2 mb-2">
                    <Sparkles size={12} className="text-fuchsia-400" />
                    <span className="text-[10px] uppercase text-stone-500 font-bold tracking-wider">Visual Prompt</span>
                  </div>
                  <p className="text-xs text-stone-300 leading-relaxed font-mono opacity-90">{char.visualSummary}</p>
                </div>
                <div>
                  <span className="text-[10px] uppercase text-stone-500 font-bold mb-2 block">性格特征</span>
                  <div className="flex flex-wrap gap-2">
                     {char.traits.split(/[,，、]/).map((trait, tIdx) => (
                        <span key={tIdx} className="text-xs text-stone-300 bg-white/5 px-2.5 py-1 rounded-md border border-white/5">
                          {trait.trim()}
                        </span>
                     ))}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Props & Locations Section */}
      <div>
        <h3 className="text-white font-bold mb-6 flex items-center gap-3 sticky top-0 bg-[#1a0510]/80 backdrop-blur-xl py-4 z-10 border-b border-white/5 -mx-2 px-2">
           <div className="bg-amber-500/20 p-2 rounded-xl border border-amber-500/20 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
            <Box className="text-amber-300" size={16} />
           </div>
          场景与道具
           <span className="text-xs font-normal text-stone-400 bg-white/5 px-2.5 py-0.5 rounded-full border border-white/5">{data.assets.length}</span>
        </h3>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {data.assets.map((asset, idx) => (
            <div key={idx} className="bg-white/[0.03] border border-white/5 rounded-2xl p-6 shadow-lg hover:border-amber-500/30 hover:shadow-amber-900/20 transition-all duration-300 group">
              <div className="flex justify-between items-start mb-4">
                 <div className="flex items-center gap-3">
                    <span className={`text-[10px] px-2 py-1 rounded-md font-bold tracking-wider border ${
                      asset.type === 'Location' 
                      ? 'bg-rose-500/10 text-rose-300 border-rose-500/20' 
                      : 'bg-orange-500/10 text-orange-300 border-orange-500/20'
                    }`}>
                      {asset.type === 'Location' ? 'LOCATION' : 'PROP'}
                    </span>
                    <h4 className="text-white font-semibold">{asset.name}</h4>
                 </div>
                 <button 
                  onClick={() => copyToClipboard(asset.description)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-xs text-stone-300 hover:text-white flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 rounded-lg border border-white/5 hover:bg-white/20"
                  title="复制描述"
                >
                  <Copy size={12} /> 复制
                </button>
              </div>
              <div className="bg-black/20 p-4 rounded-xl border border-white/5 flex gap-3">
                 <div className="mt-0.5 shrink-0">
                    {asset.type === 'Location' ? <MapPin size={14} className="text-stone-500" /> : <Box size={14} className="text-stone-500" />}
                 </div>
                 <p className="text-xs text-stone-300 leading-relaxed">{asset.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};