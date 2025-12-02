
import React, { useState, useEffect } from 'react';
import { X, Key, Save, Eye, EyeOff, Server, CheckCircle, XCircle, Loader2, RefreshCw, Box, Globe } from 'lucide-react';
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
  
  // Toggles
  const [showDeepSeek, setShowDeepSeek] = useState(false);
  const [showOpenAI, setShowOpenAI] = useState(false);
  const [showMoonshot, setShowMoonshot] = useState(false);
  
  // Checking states
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
      setDeepSeekStatus({ loading: false, msg: "检查失败", valid: false });
    }
  };

  const handleCheckOpenAI = async () => {
    if (!keys.openai) return;
    setOpenAIStatus({ loading: true });
    try {
      const isValid = await validateKey('openai', keys.openai);
      setOpenAIStatus({ loading: false, msg: isValid ? "Key 有效" : "Key 无效", valid: isValid });
    } catch (e) {
      setOpenAIStatus({ loading: false, msg: "连接失败", valid: false });
    }
  };

  const handleCheckMoonshot = async () => {
    if (!keys.moonshot) return;
    setMoonshotStatus({ loading: true });
    try {
      const isValid = await validateKey('moonshot', keys.moonshot);
      setMoonshotStatus({ loading: false, msg: isValid ? "Key 有效" : "Key 无效", valid: isValid });
    } catch (e) {
      setMoonshotStatus({ loading: false, msg: "连接失败", valid: false });
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-[#1a0510] border border-white/10 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-fade-in flex flex-col max-h-[85vh]">
        
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/5 bg-white/[0.02] shrink-0">
          <h3 className="text-white font-semibold flex items-center gap-2">
            <Server size={18} className="text-rose-400" />
            模型服务设置
          </h3>
          <button onClick={onClose} className="text-stone-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
          <p className="text-xs text-stone-400 leading-relaxed">
            配置各家模型的 API Key。
            <br />
            <span className="text-rose-400">Google Gemini</span> 使用系统环境变量配置。
          </p>
          
          {/* OpenAI Config */}
          <div className="space-y-3 border-t border-white/5 pt-4">
             <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-300 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_5px_rgba(34,197,94,0.5)]"></div>
                OpenAI Key (GPT-4o)
              </label>
              {openAIStatus.msg && (
                <span className={`text-[10px] font-medium flex items-center gap-1 ${openAIStatus.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                  {openAIStatus.valid ? <CheckCircle size={10} /> : <XCircle size={10} />}
                  {openAIStatus.msg}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
                  <Key size={14} />
                </div>
                <input 
                  type={showOpenAI ? "text" : "password"}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-9 pr-10 text-xs text-stone-200 focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 outline-none transition-all placeholder-stone-600"
                  placeholder="sk-..."
                  value={keys.openai || ''}
                  onChange={(e) => setKeys({...keys, openai: e.target.value})}
                />
                <button 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
                  onClick={() => setShowOpenAI(!showOpenAI)}
                >
                  {showOpenAI ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                onClick={handleCheckOpenAI}
                disabled={!keys.openai || openAIStatus.loading}
                className="px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-stone-300 disabled:opacity-50 transition-colors"
                title="验证 Key"
              >
                {openAIStatus.loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              </button>
            </div>
          </div>

          {/* Moonshot Config */}
          <div className="space-y-3 border-t border-white/5 pt-4">
             <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-300 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-purple-400 shadow-[0_0_5px_rgba(192,132,252,0.5)]"></div>
                Moonshot / Kimi Key
              </label>
              {moonshotStatus.msg && (
                <span className={`text-[10px] font-medium flex items-center gap-1 ${moonshotStatus.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                  {moonshotStatus.valid ? <CheckCircle size={10} /> : <XCircle size={10} />}
                  {moonshotStatus.msg}
                </span>
              )}
            </div>

            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
                  <Key size={14} />
                </div>
                <input 
                  type={showMoonshot ? "text" : "password"}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-9 pr-10 text-xs text-stone-200 focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 outline-none transition-all placeholder-stone-600"
                  placeholder="sk-..."
                  value={keys.moonshot || ''}
                  onChange={(e) => setKeys({...keys, moonshot: e.target.value})}
                />
                <button 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
                  onClick={() => setShowMoonshot(!showMoonshot)}
                >
                  {showMoonshot ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                onClick={handleCheckMoonshot}
                disabled={!keys.moonshot || moonshotStatus.loading}
                className="px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-stone-300 disabled:opacity-50 transition-colors"
                title="验证 Key"
              >
                {moonshotStatus.loading ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle size={14} />}
              </button>
            </div>
          </div>

          {/* DeepSeek Config */}
          <div className="space-y-3 border-t border-white/5 pt-4">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-stone-300 flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_5px_rgba(59,130,246,0.5)]"></div>
                DeepSeek API Key
              </label>
              {deepSeekStatus.msg && (
                <span className={`text-[10px] font-medium flex items-center gap-1 ${deepSeekStatus.valid ? 'text-emerald-400' : 'text-red-400'}`}>
                  {deepSeekStatus.valid ? <CheckCircle size={10} /> : <XCircle size={10} />}
                  {deepSeekStatus.msg}
                </span>
              )}
            </div>
            
            <div className="flex gap-2">
              <div className="relative flex-1">
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500">
                  <Key size={14} />
                </div>
                <input 
                  type={showDeepSeek ? "text" : "password"}
                  className="w-full bg-black/20 border border-white/10 rounded-xl py-2.5 pl-9 pr-10 text-xs text-stone-200 focus:ring-1 focus:ring-rose-500/50 focus:border-rose-500/50 outline-none transition-all placeholder-stone-600"
                  placeholder="sk-..."
                  value={keys.deepseek || ''}
                  onChange={(e) => setKeys({...keys, deepseek: e.target.value})}
                />
                <button 
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
                  onClick={() => setShowDeepSeek(!showDeepSeek)}
                >
                  {showDeepSeek ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
              <button
                onClick={handleCheckDeepSeek}
                disabled={!keys.deepseek || deepSeekStatus.loading}
                className="px-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-stone-300 disabled:opacity-50 transition-colors"
                title="查询余额"
              >
                {deepSeekStatus.loading ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
              </button>
            </div>

             <div className="relative">
                <input 
                  type="text"
                  className="w-full bg-black/10 border border-white/5 rounded-lg py-2 pl-3 pr-3 text-[10px] text-stone-400 focus:ring-1 focus:ring-rose-500/30 outline-none transition-all placeholder-stone-700"
                  placeholder="DeepSeek Base URL (可选)"
                  value={keys.deepseekBaseUrl || ''}
                  onChange={(e) => setKeys({...keys, deepseekBaseUrl: e.target.value})}
                />
            </div>
          </div>

        </div>

        <div className="px-6 py-4 bg-white/[0.02] border-t border-white/5 flex justify-end shrink-0">
          <button 
            onClick={handleSave}
            className="flex items-center gap-2 bg-rose-600 hover:bg-rose-500 text-white px-4 py-2 rounded-xl text-xs font-medium transition-all shadow-lg shadow-rose-900/20"
          >
            <Save size={14} /> 保存配置
          </button>
        </div>

      </div>
    </div>
  );
};