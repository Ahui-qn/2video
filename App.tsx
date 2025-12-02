
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ScriptEditor } from './components/ScriptEditor';
import { StoryboardTable } from './components/StoryboardTable';
import { AssetPanel } from './components/AssetPanel';
import { SettingsModal } from './components/SettingsModal';
import { analyzeScript, extractAssetsOnly } from './services/geminiService';
import { readFileContent } from './services/fileService';
import { AppState, AnalysisResult, Shot, ModelConfig, UserKeys, ScriptEpisode } from './types';
import { Play, Download, Clapperboard, Layers, AlertTriangle, Sparkles, Layout, Settings, ChevronDown, Cpu, Moon, Hash, Clock, Square, FolderPlus, BookOpen, UploadCloud, CheckCircle, Database } from 'lucide-react';

const INITIAL_EPISODE: ScriptEpisode = {
  id: '1',
  title: '第 1 部分',
  content: '',
  status: 'draft',
  isExpanded: true
};

const MODELS: ModelConfig[] = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', provider: 'google' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'moonshot-v1-8k', name: 'Kimi (Moonshot V1)', provider: 'moonshot' }, 
  { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek' },
];

const App: React.FC = () => {
  // --- STATE ---
  const [episodes, setEpisodes] = useState<ScriptEpisode[]>([INITIAL_EPISODE]);
  const [customInstructions, setCustomInstructions] = useState('【硬性约束：单镜头<3s；每集镜头≈21；语速≈6字/秒】\n');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [activeTab, setActiveTab] = useState<'storyboard' | 'assets'>('storyboard');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState(MODELS[0].id);
  const [showSettings, setShowSettings] = useState(false);
  const [userKeys, setUserKeys] = useState<UserKeys>({});
  
  // New Workflow State
  const [globalAssets, setGlobalAssets] = useState<AnalysisResult | null>(null);
  const [isContextDragOver, setIsContextDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Progress State
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");
  const [mobileView, setMobileView] = useState<'editor' | 'preview'>('editor');

  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // --- EFFECTS ---
  useEffect(() => {
    const savedKeys = localStorage.getItem('script2video_keys');
    if (savedKeys) {
      try { setUserKeys(JSON.parse(savedKeys)); } catch (e) { console.error("Failed to load keys"); }
    }
  }, []);

  const handleSaveKeys = (keys: UserKeys) => {
    setUserKeys(keys);
    localStorage.setItem('script2video_keys', JSON.stringify(keys));
  };

  const getSelectedModel = () => MODELS.find(m => m.id === selectedModelId) || MODELS[0];

  const handleNewProject = () => {
    if (window.confirm("确定要新建项目吗？所有内容（包括全局资产）将被清空。")) {
      setEpisodes([INITIAL_EPISODE]);
      setResult(null);
      setAppState(AppState.IDLE);
      setGlobalAssets(null);
      setErrorMsg(null);
      setProgress(0);
      setMobileView('editor');
    }
  };

  const handleStopAnalysis = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current);
      progressIntervalRef.current = null;
    }
    setAppState(AppState.IDLE);
    setErrorMsg("已取消操作");
    setProgress(0);
    setProgressStatus("");
    
    // Reset status of the analyzing episode
    setEpisodes(prev => prev.map(ep => ep.status === 'analyzing' ? { ...ep, status: 'draft' } : ep));
  };

  const startSimulatedProgress = (startFrom: number, target: number, durationMs: number) => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    const startTime = Date.now();
    const startVal = Math.max(progress, startFrom);
    
    // @ts-ignore
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const ratio = Math.min(elapsed / durationMs, 1);
      const ease = 1 - Math.pow(1 - ratio, 3);
      const current = startVal + (target - startVal) * ease;
      setProgress(current);
      if (ratio >= 1 && progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }, 50);
  };

  // --- EPISODE MANAGEMENT ---
  const handleUpdateEpisode = (id: string, updates: Partial<ScriptEpisode>) => {
      setEpisodes(prev => prev.map(ep => ep.id === id ? { ...ep, ...updates } : ep));
  };

  const handleExpandEpisode = (id: string) => {
      setEpisodes(prev => prev.map(ep => {
        // Logic: If clicking the same episode, toggle it. If clicking different, open new and close others.
        if (ep.id === id) {
            return { ...ep, isExpanded: !ep.isExpanded };
        }
        return { ...ep, isExpanded: false };
      }));
  };

  const handleAddEpisode = () => {
      const nextId = (episodes.length + 1).toString();
      const newEp: ScriptEpisode = {
          id: nextId,
          title: `第 ${nextId} 部分`,
          content: '',
          status: 'draft',
          isExpanded: true
      };
      setEpisodes(prev => [...prev.map(e => ({...e, isExpanded: false})), newEp]);
  };


  // --- STEP 1: UPLOAD FULL SCRIPT (Global Context) ---
  const processContextFile = async (file: File) => {
    setAppState(AppState.EXTRACTING_CONTEXT);
    setErrorMsg(null);
    setProgress(0);
    setProgressStatus("正在读取剧本文件...");
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentModel = getSelectedModel();

    if (currentModel.provider !== 'google' && !checkKeys(currentModel)) {
        setAppState(AppState.IDLE);
        return;
    }

    try {
        const text = await readFileContent(file);
        
        setProgressStatus("正在解析完整剧本 (Bible)...");
        startSimulatedProgress(10, 90, 8000);
        
        const assets = await extractAssetsOnly(
            text,
            customInstructions,
            currentModel.id,
            currentModel.provider,
            userKeys,
            controller.signal
        );
        
        setGlobalAssets(assets);
        setAppState(AppState.IDLE);
        setProgress(100);
        setProgressStatus("全局资产提取完成");
        
        if (!result) {
            setResult({
                title: assets.title,
                synopsis: assets.synopsis,
                characters: assets.characters,
                assets: assets.assets,
                scenes: [],
                episodes: []
            });
            setActiveTab('assets');
        }
    } catch (err: any) {
        handleError(err);
    } finally {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        abortControllerRef.current = null;
        if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleUploadContext = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processContextFile(file);
  };

  const handleContextDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!globalAssets && appState === AppState.IDLE) setIsContextDragOver(true);
  }, [globalAssets, appState]);

  const handleContextDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsContextDragOver(false);
  }, []);

  const handleContextDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsContextDragOver(false);
    
    if (globalAssets || appState !== AppState.IDLE) return;

    const file = e.dataTransfer.files?.[0];
    if (file) processContextFile(file);
  }, [globalAssets, appState]);


  // --- STEP 2: ANALYZE EPISODE (In Editor) ---
  const handleAnalyzeEpisode = async () => {
    // Priority: Find the first 'draft' episode with content.
    const targetEp = episodes.find(e => e.status === 'draft' && e.content.trim().length > 0);
    
    if (!targetEp) return;
    
    setAppState(AppState.ANALYZING);
    setMobileView('preview');
    setErrorMsg(null);
    setProgress(0);
    setProgressStatus("正在初始化...");

    // Mark target episode as analyzing
    handleUpdateEpisode(targetEp.id, { status: 'analyzing' });
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentModel = getSelectedModel();

    if (currentModel.provider !== 'google' && !checkKeys(currentModel)) {
        setAppState(AppState.IDLE);
        handleUpdateEpisode(targetEp.id, { status: 'draft' });
        return;
    }

    try {
      startSimulatedProgress(0, 30, 2000);
      
      const newData = await analyzeScript(
        targetEp.content, 
        customInstructions, 
        currentModel.id, 
        currentModel.provider,
        userKeys,
        (prog, msg) => {
           if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
           const totalProg = 30 + (prog * 0.7);
           setProgress(totalProg);
           setProgressStatus(msg);
           startSimulatedProgress(totalProg, Math.min(totalProg + 10, 99), 5000);
        },
        controller.signal,
        globalAssets || undefined 
      );
      
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setProgress(100);
      setProgressStatus("分析完成！");
      
      setTimeout(() => {
        // Update Result (Append Mode)
        if (result && result.episodes) {
            const updatedEpisodes = [...(result.episodes || []), ...(newData.episodes || [])];
            setResult({
                ...result,
                episodes: updatedEpisodes,
                scenes: updatedEpisodes.flatMap(e => e.scenes)
            });
        } else {
            setResult(newData);
        }
        
        setActiveTab('storyboard');
        setAppState(AppState.COMPLETE);

        // Workflow: Mark current done, collapse it, create next one
        const currentEpId = targetEp.id;
        const nextId = (parseInt(currentEpId) + 1).toString();
        
        setEpisodes(prev => {
            const updated = prev.map(ep => ep.id === currentEpId ? { ...ep, status: 'analyzed' as const, isExpanded: false, title: newData.episodes?.[0]?.title || ep.title } : ep);
            
            // Check if next episode already exists (to avoid duplicates if re-analyzing an old one)
            const nextExists = prev.some(e => e.id === nextId);
            if (!nextExists) {
                updated.push({
                    id: nextId,
                    title: `第 ${nextId} 部分`,
                    content: '',
                    status: 'draft',
                    isExpanded: true
                });
            } else {
                // If it exists, maybe expand it if it's draft? 
                // Let's just expand the first draft one found in the new list to be helpful
            }
            return updated;
        });

      }, 500);

    } catch (err: any) {
      handleError(err);
      handleUpdateEpisode(targetEp.id, { status: 'draft' });
    } finally {
      abortControllerRef.current = null;
    }
  };

  const checkKeys = (model: ModelConfig) => {
    if (model.provider === 'google') return true; // Managed by env
    let key = '';
    switch (model.provider) {
      case 'deepseek': key = userKeys.deepseek || ''; break;
      case 'openai': key = userKeys.openai || ''; break;
      case 'moonshot': key = userKeys.moonshot || ''; break;
    }
    if (!key) {
      setAppState(AppState.ERROR);
      setErrorMsg(`请配置 ${model.provider} API Key。`);
      setShowSettings(true);
      return false;
    }
    return true;
  };

  const handleError = (err: any) => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (err.name === 'AbortError') return;
    console.error(err);
    setErrorMsg(err.message || "分析失败，请检查网络设置或重试。");
    setAppState(AppState.ERROR);
  };

  const handleUpdateShot = (episodeIndex: number, sceneIndex: number, shotIndex: number, field: keyof Shot, value: string) => {
    if (!result) return;
    if (result.episodes && result.episodes.length > 0) {
       const newEpisodes = [...result.episodes];
       if (!newEpisodes[episodeIndex]) return;
       const newEpisode = { ...newEpisodes[episodeIndex] };
       const newScenes = [...newEpisode.scenes];
       if (!newScenes[sceneIndex]) return;
       const newScene = { ...newScenes[sceneIndex] };
       const newShots = [...newScene.shots];
       if (!newShots[shotIndex]) return;

       newShots[shotIndex] = { ...newShots[shotIndex], [field]: value };
       newScene.shots = newShots;
       newScenes[sceneIndex] = newScene;
       newEpisode.scenes = newScenes;
       newEpisodes[episodeIndex] = newEpisode;
       const flattenedScenes = newEpisodes.flatMap(e => e.scenes);
       setResult({ ...result, episodes: newEpisodes, scenes: flattenedScenes });
    }
  };

  const handleExport = () => {
    if (!result) return;
    const headers = ['集数', '场号', '镜头编号', '景别', '运镜', '生图提示词(Prompt)', '环境', '人物与动作', '台词', '时长'];
    let rows: string[] = [];
    
    // Ensure we handle both structure types safely
    const eps = result.episodes && result.episodes.length > 0 
        ? result.episodes 
        : [{ id: '1', title: '第1集', scenes: result.scenes }];

    rows = eps.flatMap(ep => ep.scenes.flatMap(scene => scene.shots.map(shot => 
        [`"${ep.title || ep.id}"`, `"${scene.header.replace(/"/g, '""')}"`, shot.id, shot.shotSize, shot.cameraAngle, `"${shot.visualDescription.replace(/"/g, '""')}"`, `"${shot.environment.replace(/"/g, '""')}"`, `"${(shot.characters + ' ' + shot.action).replace(/"/g, '""')}"`, `"${(shot.dialogue || '').replace(/"/g, '""')}"`, shot.duration].join(',')
    )));

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
      case 'deepseek': return <div className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]" />;
      case 'openai': return <div className="w-3.5 h-3.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]" />;
      case 'moonshot': return <Moon size={14} className="text-purple-400 drop-shadow-[0_0_5px_rgba(192,132,252,0.8)]" />;
      default: return <Cpu size={14} className="text-rose-400 drop-shadow-[0_0_5px_rgba(251,113,133,0.8)]" />;
    }
  }

  const stats = useMemo(() => {
    if (!result) return { totalShots: 0, totalDuration: 0 };
    let totalShots = 0;
    let totalDuration = 0;
    const items = result.episodes ? result.episodes.flatMap(e => e.scenes) : result.scenes;
    items.forEach(scene => {
      totalShots += scene.shots.length;
      totalDuration += scene.shots.reduce((acc, shot) => {
          const dur = parseFloat(shot.duration.match(/(\d+(\.\d+)?)/)?.[0] || '0');
          return acc + dur;
      }, 0);
    });
    return { totalShots, totalDuration };
  }, [result]);

  const formatDuration = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return m > 0 ? `${m}分 ${sec}秒` : `${sec}秒`;
  };

  // Find next runnable episode
  const nextDraftEpisode = episodes.find(e => e.status === 'draft' && e.content.trim().length > 0);

  return (
    <div className="relative h-screen w-screen bg-[#1a0510] overflow-hidden text-rose-50 font-sans flex flex-col selection:bg-rose-500/30 selection:text-white">
      {/* Background Orbs (Pink/Fuchsia Theme) */}
      <div className="fixed top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-rose-900/20 rounded-full blur-[120px] pointer-events-none opacity-40 mix-blend-screen animate-pulse-slow" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-fuchsia-900/20 rounded-full blur-[120px] pointer-events-none opacity-40 mix-blend-screen animate-pulse-slow" />
      
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} userKeys={userKeys} onSave={handleSaveKeys} />

      <div className="flex flex-col h-full p-2 md:p-6 gap-3 md:gap-4 z-10 relative">
        {/* Header */}
        <header className="px-4 py-3 md:py-0 md:h-16 rounded-2xl bg-white/[0.02] backdrop-blur-xl border border-white/10 flex flex-col md:flex-row md:items-center justify-between shrink-0 shadow-sm gap-3 md:gap-0">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-rose-500 to-fuchsia-600 p-2 rounded-lg shadow-lg shadow-rose-500/20">
                 <Clapperboard className="text-white" size={18} />
              </div>
              <div className="flex flex-col">
                <h1 className="font-semibold text-lg tracking-tight text-white leading-none">Script2Video</h1>
                <span className="text-[10px] text-stone-400 font-medium tracking-wide mt-0.5">PRO PRODUCTION TOOL</span>
              </div>
            </div>
             <button onClick={handleNewProject} className="md:hidden p-2 text-stone-400 hover:text-white" title="新建项目"><FolderPlus size={18} /></button>
             <button onClick={() => setShowSettings(true)} className="md:hidden p-2 text-stone-400 hover:text-white"><Settings size={18} /></button>
          </div>
          
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
            {appState === AppState.ERROR && (
              <div className="flex items-center gap-2 text-red-200 text-xs bg-red-500/20 px-3 py-2 rounded-lg border border-red-500/20">
                <AlertTriangle size={14} /> <span title={errorMsg || ""}>{errorMsg}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2 w-full md:w-auto">
              
              {/* STEP 1: GLOBAL CONTEXT BUTTON */}
              <input 
                 type="file" 
                 accept=".txt,.md,.fountain,.docx,.pdf" 
                 ref={fileInputRef} 
                 className="hidden" 
                 onChange={handleUploadContext}
                 disabled={appState === AppState.EXTRACTING_CONTEXT || appState === AppState.ANALYZING}
              />
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={appState === AppState.EXTRACTING_CONTEXT || appState === AppState.ANALYZING}
                className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${globalAssets ? 'bg-rose-500/10 border-rose-500/30 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : 'bg-white/5 border-white/10 text-stone-400 hover:bg-white/10 hover:text-stone-200'}`}
                title="上传完整剧本(Bible)以提取全局资产"
              >
                {globalAssets ? <CheckCircle size={14} /> : <BookOpen size={14} />}
                <span>{globalAssets ? `已加载背景 (${globalAssets.assets.length})` : "上传完整剧本"}</span>
              </button>

              <button onClick={handleNewProject} className="hidden md:block p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-stone-400 transition-colors" title="新建项目">
                <FolderPlus size={16} />
              </button>

              <div className="relative group flex-1 md:flex-none">
                <div className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 px-3 py-2 rounded-xl transition-all w-full md:min-w-[180px]">
                  {getProviderIcon(getSelectedModel().provider)}
                  <select 
                    className="bg-transparent border-none outline-none appearance-none text-xs font-medium text-stone-200 cursor-pointer w-full"
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    disabled={appState === AppState.ANALYZING || appState === AppState.EXTRACTING_CONTEXT}
                  >
                    {MODELS.map(model => (
                      <option key={model.id} value={model.id} className="bg-[#1a0510] text-stone-200">{model.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="text-stone-500 absolute right-3" />
                </div>
              </div>

              <button onClick={() => setShowSettings(true)} className="hidden md:block p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-stone-400" title="设置">
                <Settings size={16} />
              </button>

              {appState === AppState.ANALYZING || appState === AppState.EXTRACTING_CONTEXT ? (
                <button onClick={handleStopAnalysis} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-medium bg-red-500/10 text-red-300 border border-red-500/20 shadow-lg shadow-red-900/10 hover:bg-red-500/20 transition-all">
                  <Square size={14} fill="currentColor" /> <span>停止</span>
                </button>
              ) : (
                <button
                  onClick={handleAnalyzeEpisode}
                  disabled={!nextDraftEpisode || !globalAssets}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all ${
                    !nextDraftEpisode || !globalAssets ? 'bg-white/5 text-stone-500 border border-white/5 cursor-not-allowed' : 'bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-500 hover:to-pink-500 text-white shadow-lg shadow-rose-900/30 border border-rose-500/20'
                  }`}
                  title={!globalAssets ? "请先上传完整剧本" : !nextDraftEpisode ? "没有可分析的分集内容" : ""}
                >
                  <Play size={16} fill="currentColor" /> <span>立即分析</span>
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden min-h-0 relative">
          {/* Left Panel: EDITOR (For Single Episode) */}
          <div className={`w-full md:w-[38%] md:min-w-[320px] md:max-w-[500px] flex flex-col transition-all duration-300 absolute md:relative inset-0 ${mobileView === 'editor' ? 'z-20 translate-x-0 opacity-100' : 'z-0 -translate-x-full md:translate-x-0 opacity-0 md:opacity-100'}`}>
            <ScriptEditor 
               episodes={episodes}
               onUpdateEpisode={handleUpdateEpisode}
               onExpandEpisode={handleExpandEpisode}
               onAddEpisode={handleAddEpisode}
               customInstructions={customInstructions} 
               setCustomInstructions={setCustomInstructions} 
               isAnalyzing={appState === AppState.ANALYZING || appState === AppState.EXTRACTING_CONTEXT} 
               locked={!globalAssets}
            />
          </div>

          {/* Right Panel: RESULT / DROP ZONE */}
          <div 
             className={`flex-1 flex flex-col min-w-0 bg-white/[0.02] backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl relative overflow-hidden transition-all duration-300 absolute md:relative inset-0 ${mobileView === 'preview' ? 'z-20 translate-x-0 opacity-100' : 'z-0 translate-x-full md:translate-x-0 opacity-0 md:opacity-100'} ${isContextDragOver ? 'border-rose-500/50 bg-rose-500/10' : ''}`}
             onDragOver={handleContextDragOver}
             onDragLeave={handleContextDragLeave}
             onDrop={handleContextDrop}
          >
             {/* Global Drag Overlay */}
             {isContextDragOver && (
               <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in pointer-events-none">
                  <UploadCloud size={64} className="text-rose-400 mb-4 animate-bounce" />
                  <h3 className="text-xl font-bold text-white">释放上传完整剧本 (Bible)</h3>
                  <p className="text-stone-400 mt-2">支持 .docx, .pdf, .txt</p>
               </div>
             )}

            <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 md:px-6 bg-white/[0.01] shrink-0">
                <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
                <div className="flex items-center p-1 bg-black/20 rounded-lg border border-white/5 shrink-0">
                    <button onClick={() => setActiveTab('storyboard')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'storyboard' ? 'bg-white/10 text-white shadow-sm' : 'text-stone-500 hover:text-stone-300 hover:bg-white/5'}`}>
                    <Layout size={14} /> 分镜表
                    </button>
                    <button onClick={() => setActiveTab('assets')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'assets' ? 'bg-white/10 text-white shadow-sm' : 'text-stone-500 hover:text-stone-300 hover:bg-white/5'}`}>
                    <Database size={14} /> 全局资产库
                    </button>
                </div>
                {result && (
                    <div className="hidden sm:flex items-center gap-3 animate-fade-in pl-2 border-l border-white/5 shrink-0">
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-xs text-rose-300 font-mono"><Hash size={12} /><span>{stats.totalShots} 镜头</span></div>
                    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-xs text-blue-300 font-mono"><Clock size={12} /><span>{formatDuration(stats.totalDuration)}</span></div>
                    </div>
                )}
                </div>
                {result && (
                <button onClick={handleExport} className="flex items-center gap-2 text-xs font-medium text-stone-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors shrink-0 border border-transparent hover:border-white/10">
                    <Download size={14} /> <span className="hidden sm:inline">导出 CSV</span>
                </button>
                )}
            </div>

            <div className="flex-1 overflow-hidden p-3 md:p-6 relative">
                {(appState === AppState.ANALYZING || appState === AppState.EXTRACTING_CONTEXT) && (
                <div className="absolute inset-0 bg-[#1a0510]/80 z-20 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in">
                    <div className="flex flex-col items-center p-8 text-center">
                        <div className="relative mb-6">
                        <div className="absolute inset-0 bg-rose-500/30 blur-xl rounded-full animate-pulse"></div>
                        {appState === AppState.EXTRACTING_CONTEXT ? (
                             <BookOpen size={40} className="text-rose-400 relative z-10 animate-bounce-slow" />
                        ) : (
                             <Sparkles size={40} className="text-rose-400 relative z-10 animate-pulse" />
                        )}
                        </div>
                        <h3 className="text-lg font-medium text-white mb-2">
                           {appState === AppState.EXTRACTING_CONTEXT ? "正在构建全局资产库" : "正在生成分镜脚本"}
                        </h3>
                        <p className="text-stone-400 text-xs tracking-wide text-center max-w-[200px]">
                           {appState === AppState.EXTRACTING_CONTEXT 
                             ? "读取完整剧本(Bible)并提取核心场景与角色..." 
                             : `正在参考 ${globalAssets?.assets.length || 0} 个固定资产进行分析...`}
                        </p>
                        <div className="w-64 h-1.5 bg-white/10 rounded-full mt-6 overflow-hidden relative">
                        <div className="h-full bg-gradient-to-r from-rose-500 to-fuchsia-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}>
                            <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}></div>
                        </div>
                        </div>
                        <p className="text-[10px] text-stone-500 mt-3 font-mono">{progressStatus || "初始化中..."} ({Math.round(progress)}%)</p>
                    </div>
                </div>
                )}

                {result ? (
                activeTab === 'storyboard' ? <StoryboardTable scenes={result.scenes} episodes={result.episodes} onUpdateShot={handleUpdateShot} /> : <AssetPanel data={result} />
                ) : (
                    <div className="flex flex-col items-center justify-center h-full text-stone-500/60 pb-10 px-4 text-center relative w-full pointer-events-none">
                        <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mb-6 shadow-xl transform -rotate-2 pointer-events-auto cursor-pointer hover:scale-105 hover:border-rose-500/30 hover:bg-rose-500/5 transition-all group" onClick={() => fileInputRef.current?.click()}>
                            <UploadCloud size={40} className="text-white/20 group-hover:text-rose-400/80 transition-colors" />
                        </div>
                        <h3 className="text-lg font-medium text-stone-300 mb-2">工作流指引</h3>
                        <p className="text-sm max-w-xs text-center text-stone-500 leading-relaxed mb-6">
                            1. <span className="text-rose-400 font-medium">拖拽上传</span> 完整剧本(Bible)至此区域。<br />
                            2. 提取全局资产 (角色/场景)。<br />
                            3. 在左侧粘贴/上传 "单集剧本" 生成分镜。
                        </p>
                        <button 
                           onClick={() => fileInputRef.current?.click()}
                           className="pointer-events-auto px-4 py-2 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 text-xs font-medium rounded-lg border border-rose-500/20 transition-colors shadow-[0_0_15px_rgba(244,63,94,0.1)]"
                        >
                            开始第一步：上传完整剧本
                        </button>
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