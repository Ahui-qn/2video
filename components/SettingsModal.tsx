
import React, { useState, useEffect } from 'react';
import { X, Key, Save, Eye, EyeOff, Server, CheckCircle, XCircle, Loader2, RefreshCw } from 'lucide-react';
import { UserKeys } from '../types';
import { getDeepSeekBalance, validateKey } from '../services/geminiService';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  userKeys: UserKeys;
  onSave: (keys: UserKeys) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({ isOpen, onClose, userKeys, onSave }) => {
  const [keys, setKeys] = useState<UserKeys>(userKeys);
  const [showDeepSeek, setShowDeepSeek] = useState(false);
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [showMoonshot, setShowMoonshot] = useState(false);
  
  const [deepSeekStatus, setDeepSeekStatus] = useState<{loading: boolean, msg?: string, valid?: boolean}>({ loading: false });
  const [openAIStatus, setOpenAIStatus] = useState<{loading: boolean, msg?: string, valid?: boolean}>({ loading: false });
  const [moonshotStatus, setMoonshotStatus] = useState<{loading: boolean, msg?: string, valid?: boolean}>({ loading: false });

  useEffect(() => {
    setKeys(userKeys);
  }, [userKeys, isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    onSave(keys);
    onClose();
  };

  const handleCheckDeepSeek = async () => {
    if (!keys.deepseek) return;
    setDeepSeekStatus({ loading: true });
    try {
      const balanceMsg = await getDeepSeekBalance(keys.deepseek, keys.deepseekBaseUrl);
      const isValid = !balanceMsg.includes("无效") && !balanceMsg.includes("无法连接");
      setDeepSeekStatus({ loading: false, msg: balanceMsg, valid: isValid });
    } catch (e) {
      setDeepSeekStatus({ loading: false, msg: "Failed", valid: false });
    }
  };

  const handleCheckOpenAI = async () => {
    if (!keys.openai) return;
    setOpenAIStatus({ loading: true });
    try {
      const isValid = await validateKey('openai', keys.openai);
      setOpenAIStatus({ loading: false, msg: isValid ? "有效" : "无效", valid: isValid });
    } catch (e) {
      setOpenAIStatus({ loading: false, msg: "验证失败", valid: false });
    }
  };

  const handleCheckMoonshot = async () => {
    if (!keys.moonshot) return;
    setMoonshotStatus({ loading: true });
    try {
      const isValid = await validateKey('moonshot', keys.moonshot);
      setMoonshotStatus({ loading: false, msg: isValid ? "有效" : "无效", valid: isValid });
    } catch (e) {
      setMoonshotStatus({ loading: false, msg: "验证失败", valid: false });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-xl" onClick={onClose} />
      <div className="relative bg-[#0f0518] border-t border-l border-white/20 border-b border-r border-black/50 w-full max-w-md shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[85vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between px-8 py-6 border-b border-white/10 bg-white/[0.02] shrink-0">
          <h3 className="text-white font-bold flex items-center gap-3 text-xl font-display tracking-tight">
            服务配置 (SERVICE PROTOCOLS)
          </h3>
          <button onClick={onClose} className="text-slate-500 hover:text-white transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-8 space-y-8">
          
          {/* OpenAI */}
          <div className="space-y-2">
             <label className="text-xs font-bold text-[#ccff00] uppercase tracking-widest block">OpenAI (GPT-4o)</label>
             <div className="flex gap-2">
                 <input 
                  type={showOpenAI ? "text" : "password"}
                  className="flex-1 bg-black/40 border border-white/10 py-3 px-4 text-xs text-white outline-none focus:border-[#ccff00] font-mono shadow-inner"
                  placeholder="sk-..."
                  value={keys.openai || ''}
                  onChange={(e) => setKeys({...keys, openai: e.target.value})}
                />
                 <button onClick={handleCheckOpenAI} className="px-3 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300">
                    {openAIStatus.loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                 </button>
             </div>
             {openAIStatus.msg && <p className="text-[10px] text-right text-slate-400">{openAIStatus.msg}</p>}
          </div>

          {/* Moonshot */}
          <div className="space-y-2">
             <label className="text-xs font-bold text-[#d946ef] uppercase tracking-widest block">Moonshot (Kimi)</label>
             <div className="flex gap-2">
                 <input 
                  type={showMoonshot ? "text" : "password"}
                  className="flex-1 bg-black/40 border border-white/10 py-3 px-4 text-xs text-white outline-none focus:border-[#d946ef] font-mono shadow-inner"
                  placeholder="sk-..."
                  value={keys.moonshot || ''}
                  onChange={(e) => setKeys({...keys, moonshot: e.target.value})}
                />
                 <button onClick={handleCheckMoonshot} className="px-3 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300">
                    {moonshotStatus.loading ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                 </button>
             </div>
             {moonshotStatus.msg && <p className="text-[10px] text-right text-slate-400">{moonshotStatus.msg}</p>}
          </div>

          {/* DeepSeek */}
          <div className="space-y-2">
             <label className="text-xs font-bold text-blue-400 uppercase tracking-widest block">DeepSeek</label>
             <div className="flex gap-2">
                 <input 
                  type={showDeepSeek ? "text" : "password"}
                  className="flex-1 bg-black/40 border border-white/10 py-3 px-4 text-xs text-white outline-none focus:border-blue-400 font-mono shadow-inner"
                  placeholder="sk-..."
                  value={keys.deepseek || ''}
                  onChange={(e) => setKeys({...keys, deepseek: e.target.value})}
                />
                 <button onClick={handleCheckDeepSeek} className="px-3 bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300">
                    {deepSeekStatus.loading ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                 </button>
             </div>
             <input 
                  type="text"
                  className="w-full bg-black/20 border border-white/5 py-2 px-4 text-[10px] text-slate-400 outline-none font-mono"
                  placeholder="Base URL (可选)"
                  value={keys.deepseekBaseUrl || ''}
                  onChange={(e) => setKeys({...keys, deepseekBaseUrl: e.target.value})}
                />
             {deepSeekStatus.msg && <p className="text-[10px] text-right text-slate-400">{deepSeekStatus.msg}</p>}
          </div>

        </div>

        <div className="px-8 py-6 bg-white/[0.02] border-t border-white/10 flex justify-end shrink-0">
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 bg-[#ccff00] hover:bg-[#dfff40] text-black px-8 py-3 text-xs font-bold uppercase tracking-wider transition-colors shadow-lg"
          >
            <Save size={16} /> 保存配置
          </button>
        </div>

      </div>
    </div>
  );
};
