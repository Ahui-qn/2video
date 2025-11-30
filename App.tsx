
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ScriptEditor } from './components/ScriptEditor';
import { StoryboardTable } from './components/StoryboardTable';
import { AssetPanel } from './components/AssetPanel';
import { SettingsModal } from './components/SettingsModal';
import { analyzeScript } from './services/geminiService';
import { AppState, AnalysisResult, Shot, ModelConfig, UserKeys } from './types';
import { Play, Download, Clapperboard, Layers, AlertTriangle, Wand2, Sparkles, Layout, Settings, ChevronDown, Cpu, Zap, Box, Moon, Hash, Clock, Square } from 'lucide-react';

const INITIAL_SCRIPT = `内景。赛博朋克拉面店 - 夜晚

霓虹雨水划过窗户。店内，凯（20岁，机械手臂）正在大口吃面。

凯
这东西吃起来像电池酸液。

厨师（60岁，全息义眼）没有转身。

厨师
你付钱买的是氛围，小子。不是食物。

凯重重地放下筷子。他的机械手迸出火花。

凯
我在找数据驱动器。

厨师
（停顿）
第三条巷子。找那只两条尾巴的猫。`;

const MODELS: ModelConfig[] = [
  // Google Gemini
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', provider: 'google' },
  
  // OpenAI
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },

  // Moonshot (Kimi)
  { id: 'moonshot-v1-8k', name: 'Kimi (Moonshot V1)', provider: 'moonshot' }, 

  // DeepSeek
  { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek' },
];

const App: React.FC = () => {
  const [script, setScript] = useState(INITIAL_SCRIPT);
  const [customInstructions, setCustomInstructions] = useState('');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'storyboard' | 'assets'>('storyboard');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState(MODELS[0].id);
  const [showSettings, setShowSettings] = useState(false);
  const [userKeys, setUserKeys] = useState<UserKeys>({});

  // Abort Controller for cancelling analysis
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load keys from localStorage
  useEffect(() => {
    const savedKeys = localStorage.getItem('script2video_keys');
    if (savedKeys) {
      try {
        setUserKeys(JSON.parse(savedKeys));
      } catch (e) { console.error("Failed to load keys"); }
    }
  }, []);

  const handleSaveKeys = (keys: UserKeys) => {
    setUserKeys(keys);
    localStorage.setItem('script2video_keys', JSON.stringify(keys));
  };

  const getSelectedModel = () => MODELS.find(m => m.id === selectedModelId) || MODELS[0];

  const handleStopAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setAppState(AppState.IDLE);
    setErrorMsg("已取消分析");
  };

  const handleAnalyze = async () => {
    if (!script.trim()) return;
    
    setAppState(AppState.ANALYZING);
    setErrorMsg(null);
    
    // Setup AbortController
    const controller = new AbortController();
    abortControllerRef.current = controller;
    
    const currentModel = getSelectedModel();

    // Check if key is missing for 3rd party
    if (currentModel.provider !== 'google') {
      let key = '';
      let providerName = '';
      
      switch (currentModel.provider) {
        case 'deepseek': key = userKeys.deepseek || ''; providerName = 'DeepSeek'; break;
        case 'openai': key = userKeys.openai || ''; providerName = 'OpenAI'; break;
        case 'moonshot': key = userKeys.moonshot || ''; providerName = 'Moonshot (Kimi)'; break;
      }

      if (!key) {
        setAppState(AppState.ERROR);
        setErrorMsg(`请点击右上角设置图标，配置 ${providerName} API Key。`);
        setShowSettings(true);
        return;
      }
    }

    try {
      const data = await analyzeScript(
        script, 
        customInstructions, 
        currentModel.id, 
        currentModel.provider,
        userKeys,
        undefined, // Pass undefined for onProgress
        controller.signal
      );
      setResult(data);
      setAppState(AppState.COMPLETE);
    } catch (err: any) {
      // Ignore abort errors
      if (err.name === 'AbortError' || err.message === '分析已取消') {
        console.log("Analysis cancelled by user");
        return;
      }

      console.error(err);
      setErrorMsg(err.message || "分析失败，请检查网络设置或重试。");
      setAppState(AppState.ERROR);
    } finally {
      abortControllerRef.current = null;
    }
  };

  const handleUpdateShot = (sceneIndex: number, shotIndex: number, field: keyof Shot, value: string) => {
    if (!result) return;
    const newScenes = [...result.scenes];
    newScenes[sceneIndex].shots[shotIndex] = {
      ...newScenes[sceneIndex].shots[shotIndex],
      [field]: value
    };
    setResult({ ...result, scenes: newScenes });
  };

  const handleExport = () => {
    if (!result) return;
    const headers = ['场号', '镜头编号', '景别', '运镜', '生图提示词(Prompt)', '环境', '人物与动作', '台词', '时长'];
    const rows = result.scenes.flatMap(scene => 
      scene.shots.map(shot => [
        `"${scene.header.replace(/"/g, '""')}"`,
        shot.id,
        shot.shotSize,
        shot.cameraAngle,
        `"${shot.visualDescription.replace(/"/g, '""')}"`,
        `"${shot.environment.replace(/"/g, '""')}"`,
        `"${(shot.characters + ' ' + shot.action).replace(/"/g, '""')}"`,
        `"${(shot.dialogue || '').replace(/"/g, '""')}"`,
        shot.duration
      ].join(','))
    );
    const csvContent = "\uFEFF" + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${result.title || 'storyboard'}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case 'deepseek': return <div className="w-3.5 h-3.5 rounded-full bg-blue-500" />;
      case 'openai': return <div className="w-3.5 h-3.5 rounded-full bg-green-500" />;
      case 'moonshot': return <Moon size={14} className="text-purple-400" />;
      default: return <Cpu size={14} className="text-indigo-400" />;
    }
  }

  // --- Statistics Logic ---
  const parseDuration = (dur: string): number => {
    if (!dur) return 0;
    const match = dur.match(/(\d+(\.\d+)?)/);
    return match ? parseFloat(match[0]) : 0;
  };
  const formatDuration = (totalSeconds: number) => {
    const m = Math.floor(totalSeconds / 60);
    const s = Math.floor(totalSeconds % 60);
    return m > 0 ? `${m}分 ${s}秒` : `${s}秒`;
  };

  const stats = useMemo(() => {
    if (!result) return { totalShots: 0, totalDuration: 0 };
    let totalShots = 0;
    let totalDuration = 0;
    result.scenes.forEach(scene => {
      totalShots += scene.shots.length;
      totalDuration += scene.shots.reduce((acc, shot) => acc + parseDuration(shot.duration), 0);
    });
    return { totalShots, totalDuration };
  }, [result]);

  return (
    <div className="relative h-screen w-screen bg-[#0f172a] overflow-hidden text-slate-200 font-sans flex flex-col selection:bg-indigo-500/30 selection:text-white">
      
      {/* Background Lights */}
      <div className="fixed top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none opacity-40 mix-blend-screen" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none opacity-40 mix-blend-screen" />

      {/* Settings Modal */}
      <SettingsModal 
        isOpen={showSettings} 
        onClose={() => setShowSettings(false)} 
        userKeys={userKeys}
        onSave={handleSaveKeys}
      />

      {/* Main Layout */}
      <div className="flex flex-col h-full p-4 md:p-6 gap-4 z-10 relative">
        
        {/* Header */}
        <header className="h-16 px-6 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/5 flex items-center justify-between shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
               <Clapperboard className="text-white" size={18} />
            </div>
            <div className="flex flex-col">
              <h1 className="font-semibold text-lg tracking-tight text-white leading-none">
                Script2Video
              </h1>
              <span className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">PRO PRODUCTION TOOL</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            {appState === AppState.ERROR && (
              <div className="hidden md:flex items-center gap-2 text-red-200 text-xs bg-red-500/20 px-3 py-1.5 rounded-lg border border-red-500/20 animate-fade-in max-w-xl">
                <AlertTriangle size={14} className="shrink-0" />
                <span title={errorMsg || ""} className="line-clamp-2">{errorMsg}</span>
              </div>
            )}

            {/* Model Selector */}
            <div className="flex items-center gap-2">
              <div className="relative group">
                <div className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 px-3 py-2 rounded-xl transition-all cursor-pointer min-w-[180px]">
                  {getProviderIcon(getSelectedModel().provider)}
                  <select 
                    className="bg-transparent border-none outline-none appearance-none text-xs font-medium text-slate-200 cursor-pointer w-full"
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    disabled={appState === AppState.ANALYZING}
                  >
                    {MODELS.map(model => (
                      <option key={model.id} value={model.id} className="bg-[#1e293b] text-slate-200">
                        {model.name}
                      </option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="text-slate-500 pointer-events-none absolute right-3" />
                </div>
              </div>
              
              {/* Settings Trigger */}
              <button 
                onClick={() => setShowSettings(true)}
                className="p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 hover:text-white text-slate-400 transition-colors"
                title="配置 API Key"
              >
                <Settings size={16} />
              </button>
            </div>

            {appState === AppState.ANALYZING ? (
              <button
                onClick={handleStopAnalysis}
                className="flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all duration-300 transform active:scale-95 bg-red-500/10 hover:bg-red-500/20 text-red-300 border border-red-500/20 shadow-lg"
              >
                <Square size={14} fill="currentColor" /> <span>停止</span>
              </button>
            ) : (
              <button
                onClick={handleAnalyze}
                disabled={!script.trim()}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all duration-300 transform active:scale-95 ${
                  !script.trim()
                    ? 'bg-white/5 text-slate-400 cursor-not-allowed border border-white/5' 
                    : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20 border border-indigo-500/50'
                }`}
              >
                <Play size={16} fill="currentColor" /> <span>生成分镜</span>
              </button>
            )}
          </div>
        </header>

        {/* Error Banner Mobile */}
        {appState === AppState.ERROR && (
          <div className="md:hidden flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-200 text-xs mx-1">
             <AlertTriangle size={16} className="shrink-0 mt-0.5" />
             <span>{errorMsg}</span>
          </div>
        )}

        {/* Main Workspace */}
        <main className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden min-h-0">
          
          {/* Left Panel */}
          <div className="w-full md:w-[38%] min-w-[320px] max-w-[500px] flex flex-col">
            <ScriptEditor 
              script={script} 
              setScript={setScript} 
              customInstructions={customInstructions}
              setCustomInstructions={setCustomInstructions}
              isAnalyzing={appState === AppState.ANALYZING} 
            />
          </div>

          {/* Right Panel */}
          <div className="flex-1 flex flex-col min-w-0 bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl relative overflow-hidden">
            
            <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 md:px-6 bg-white/[0.01]">
              <div className="flex items-center gap-4">
                 {/* Tabs */}
                <div className="flex items-center p-1 bg-black/20 rounded-lg border border-white/5">
                  <button
                    onClick={() => setActiveTab('storyboard')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                      activeTab === 'storyboard' 
                        ? 'bg-white/10 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <Layout size={14} /> 分镜表
                  </button>
                  <button
                    onClick={() => setActiveTab('assets')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ${
                      activeTab === 'assets' 
                        ? 'bg-white/10 text-white shadow-sm' 
                        : 'text-slate-500 hover:text-slate-300 hover:bg-white/5'
                    }`}
                  >
                    <Layers size={14} /> 资产库
                  </button>
                </div>

                {/* Live Stats */}
                {result && (
                  <div className="hidden lg:flex items-center gap-3 animate-fade-in pl-2 border-l border-white/5">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-xs text-indigo-300 font-mono">
                      <Hash size={12} className="text-slate-500" />
                      <span>{stats.totalShots} 镜头</span>
                    </div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-xs text-blue-300 font-mono">
                      <Clock size={12} className="text-slate-500" />
                      <span>{formatDuration(stats.totalDuration)}</span>
                    </div>
                  </div>
                )}
              </div>

              {result && (
                <button 
                  onClick={handleExport}
                  className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors"
                >
                  <Download size={14} /> 导出 CSV
                </button>
              )}
            </div>

            <div className="flex-1 overflow-hidden p-4 md:p-6 relative">
               {appState === AppState.ANALYZING && (
                 <div className="absolute inset-0 bg-[#0f172a]/80 z-20 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in">
                   <div className="flex flex-col items-center p-8">
                      <div className="relative mb-6">
                        <div className="absolute inset-0 bg-indigo-500/30 blur-xl rounded-full animate-pulse"></div>
                        <Sparkles size={40} className="text-indigo-400 relative z-10 animate-bounce-slow" />
                      </div>
                      <h3 className="text-lg font-medium text-white mb-2">AI 正在构建视觉方案</h3>
                      <p className="text-slate-400 text-xs tracking-wide text-center">
                        正在使用 {getSelectedModel().name} 解析剧本...
                      </p>
                   </div>
                 </div>
               )}

               {result ? (
                 activeTab === 'storyboard' ? (
                   <StoryboardTable scenes={result.scenes} onUpdateShot={handleUpdateShot} />
                 ) : (
                   <AssetPanel data={result} />
                 )
               ) : (
                  <div className="flex flex-col items-center justify-center h-full text-slate-500/60 pb-10">
                     <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mb-6 shadow-xl transform -rotate-2">
                        <Clapperboard size={40} className="text-white/20" />
                     </div>
                    <h3 className="text-lg font-medium text-slate-300 mb-2">准备就绪</h3>
                    <p className="text-sm max-w-xs text-center text-slate-500 leading-relaxed">
                      当前选择模型: <span className="text-indigo-400 font-mono">{getSelectedModel().name}</span>
                    </p>
                  </div>
               )}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
