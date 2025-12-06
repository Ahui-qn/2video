import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScriptEditor } from './ScriptEditor';
import { StoryboardTable } from './StoryboardTable';
import { AssetPanel } from './AssetPanel';
import { UploadScriptModal } from './UploadScriptModal';
import { SettingsModal } from './SettingsModal';
import { analyzeScript, extractAssetsOnly } from '../services/geminiService';
import { readFileContent } from '../services/fileService';
import { AppState, AnalysisResult, Shot, ModelConfig, UserKeys, ScriptEpisode, CharacterProfile, AssetProfile, Project } from '../types';
import { Download, Clapperboard, Sparkles, Settings, ChevronDown, Cpu, Moon, Square, ArrowLeft, Layers, Image as ImageIcon } from 'lucide-react';

interface WorkspaceProps {
  project: Project;
  onBack: () => void;
  onSaveProject: (project: Project) => void;
}

const INITIAL_EPISODE: ScriptEpisode = {
  id: '1',
  title: '第 1 集',
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

export const Workspace: React.FC<WorkspaceProps> = ({ project, onBack, onSaveProject }) => {
  // --- STATE ---
  const [activeView, setActiveView] = useState<'storyboard' | 'assets'>('storyboard');
  const [episodes, setEpisodes] = useState<ScriptEpisode[]>(project.episodes || [INITIAL_EPISODE]);
  const [customInstructions, setCustomInstructions] = useState('【硬性约束：单镜头<3s；每集镜头≈21；语速≈6字/秒】\n');
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(project.data);
  const [globalAssets, setGlobalAssets] = useState<AnalysisResult | null>(project.data); // Use project data as initial global assets
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState(MODELS[0].id);
  const [showSettings, setShowSettings] = useState(false);
  const [userKeys, setUserKeys] = useState<UserKeys>({});
  
  // Modals
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");

  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // Layout
  const [layout, setLayout] = useState({ left: 320, right: 350 });
  const isResizing = useRef<'left' | 'right' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Keys
  useEffect(() => {
    const savedKeys = localStorage.getItem('script2video_keys');
    if (savedKeys) {
      try { setUserKeys(JSON.parse(savedKeys)); } catch (e) { console.error("Failed to load keys"); }
    }
  }, []);

  // Save Project when important state changes
  useEffect(() => {
    const updatedProject = {
      ...project,
      data: result,
      episodes: episodes,
      updatedAt: Date.now()
    };
    onSaveProject(updatedProject);
  }, [result, episodes]); // Debouncing might be better in prod, but fine for now

  // --- HELPERS ---
  const handleSaveKeys = (keys: UserKeys) => {
    setUserKeys(keys);
    localStorage.setItem('script2video_keys', JSON.stringify(keys));
  };

  const getSelectedModel = () => MODELS.find(m => m.id === selectedModelId) || MODELS[0];

  const checkKeys = (model: ModelConfig) => {
    if (model.provider === 'google') return true; 
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
    setErrorMsg(err.message || "操作失败");
    setAppState(AppState.ERROR);
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

  // --- LOGIC ---
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
    setEpisodes(prev => prev.map(ep => ep.status === 'analyzing' ? { ...ep, status: 'draft' } : ep));
  };

  const processContextFile = useCallback(async (file: File) => {
    setAppState(AppState.EXTRACTING_CONTEXT);
    setErrorMsg(null);
    setProgress(0);
    setProgressStatus("正在读取文件...");
    setIsUploadModalOpen(true); // Ensure modal is open to show progress
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentModel = getSelectedModel();

    if (currentModel.provider !== 'google' && !checkKeys(currentModel)) {
        setAppState(AppState.IDLE);
        return;
    }

    try {
        const text = await readFileContent(file);
        
        setProgressStatus("正在构建全局资产库...");
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
        setProgressStatus("资产提取完成");
        
        // Initialize result if empty
        if (!result) {
            setResult({
                title: assets.title,
                synopsis: assets.synopsis,
                characters: assets.characters,
                assets: assets.assets,
                scenes: [],
                episodes: []
            });
        }
        
        setTimeout(() => {
             setIsUploadModalOpen(false);
             setProgress(0);
        }, 1000);

    } catch (err: any) {
        handleError(err);
    } finally {
        if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
        abortControllerRef.current = null;
    }
  }, [userKeys, customInstructions, selectedModelId, result, getSelectedModel]);

  const handleUpdateEpisode = (id: string, updates: Partial<ScriptEpisode>) => {
      setEpisodes(prev => prev.map(ep => ep.id === id ? { ...ep, ...updates } : ep));
  };

  const handleExpandEpisode = (id: string) => {
      setEpisodes(prev => prev.map(ep => {
        if (ep.id === id) return { ...ep, isExpanded: !ep.isExpanded };
        return { ...ep, isExpanded: false };
      }));
  };

  const handleAddEpisode = () => {
      const maxNum = episodes.reduce((max, ep) => {
          const match = ep.title.match(/第\s*(\d+)\s*集/);
          return match ? Math.max(max, parseInt(match[1])) : max;
      }, 0);
      
      const nextNum = maxNum + 1;
      const nextId = Date.now().toString() + Math.random().toString(36).substr(2, 5); 

      const newEp: ScriptEpisode = {
          id: nextId,
          title: `第 ${nextNum} 集`,
          content: '',
          status: 'draft',
          isExpanded: true
      };
      setEpisodes(prev => [...prev.map(e => ({...e, isExpanded: false})), newEp]);
  };

  const handleDeleteEpisode = (id: string) => {
      if (confirm("确定要删除这一集吗？")) {
         setEpisodes(prev => prev.filter(e => e.id !== id));
      }
  };

  const handleAnalyzeEpisode = async (episodeId?: string) => {
    let targetEp: ScriptEpisode | undefined;
    if (episodeId) {
        targetEp = episodes.find(e => e.id === episodeId);
    } else {
        targetEp = episodes.find(e => e.status === 'draft' && e.content.trim().length > 0);
    }

    if (!targetEp) return;
    if (targetEp.content.trim().length === 0) {
        setErrorMsg("该集内容为空，无法分析");
        return;
    }
    
    setAppState(AppState.ANALYZING);
    setErrorMsg(null);
    setProgress(0);
    setProgressStatus(`正在初始化 ${targetEp.title}...`);

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
        if (result && result.episodes) {
            const currentEpisodes = [...(result.episodes || [])];
            const newEpisodes = newData.episodes || [];
            const updatedEpisodes = [...currentEpisodes, ...newEpisodes];
            
            setResult({
                ...result,
                episodes: updatedEpisodes,
                scenes: updatedEpisodes.flatMap(e => e.scenes)
            });
        } else {
            setResult(newData);
        }
        
        setAppState(AppState.COMPLETE);

        const currentEpId = targetEp!.id;
        setEpisodes(prev => prev.map(ep => ep.id === currentEpId ? { ...ep, status: 'analyzed' as const, isExpanded: false, title: newData.episodes?.[0]?.title || ep.title } : ep));
      }, 500);

    } catch (err: any) {
      handleError(err);
      handleUpdateEpisode(targetEp.id, { status: 'draft' });
    } finally {
      abortControllerRef.current = null;
    }
  };

  // --- Storyboard Handlers ---
  const handleUpdateShot = (episodeIndex: number, sceneIndex: number, shotIndex: number, field: keyof Shot, value: any) => {
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

  const handleAddShot = (episodeIndex: number, sceneIndex: number, insertIndex?: number) => {
      if (!result || !result.episodes) return;
      const newEpisodes = [...result.episodes];
      const newScenes = [...newEpisodes[episodeIndex].scenes];
      const newShots = [...newScenes[sceneIndex].shots];
      
      const lastShotId = newShots.length > 0 ? parseInt(newShots[newShots.length - 1].id.replace(/\D/g, '')) : 0;
      const nextId = isNaN(lastShotId) ? `${newShots.length + 1}` : `${lastShotId + 1}`;

      const newShot: Shot = {
          id: nextId,
          shotSize: '中景',
          cameraAngle: '平视',
          visualDescription: '',
          environment: '',
          characters: '',
          action: '',
          dialogue: '',
          duration: '3s'
      };

      if (insertIndex !== undefined) {
          newShots.splice(insertIndex, 0, newShot);
      } else {
          newShots.push(newShot);
      }

      newScenes[sceneIndex] = { ...newScenes[sceneIndex], shots: newShots };
      newEpisodes[episodeIndex] = { ...newEpisodes[episodeIndex], scenes: newScenes };
      setResult({ ...result, episodes: newEpisodes, scenes: newEpisodes.flatMap(e => e.scenes) });
  };

  const handleDeleteShot = (episodeIndex: number, sceneIndex: number, shotIndex: number) => {
      if (!result || !result.episodes) return;
      const newEpisodes = [...result.episodes];
      const newScenes = [...newEpisodes[episodeIndex].scenes];
      const newShots = [...newScenes[sceneIndex].shots];
      newShots.splice(shotIndex, 1);
      newScenes[sceneIndex] = { ...newScenes[sceneIndex], shots: newShots };
      newEpisodes[episodeIndex] = { ...newEpisodes[episodeIndex], scenes: newScenes };
      setResult({ ...result, episodes: newEpisodes, scenes: newEpisodes.flatMap(e => e.scenes) });
  };

  const handleSaveEpisode = async (episodeId: string, scenes: any[]) => {
      // Logic to update the result state with the modified scenes for a specific episode
      if (!result || !result.episodes) return;
      const epIndex = result.episodes.findIndex(e => e.id === episodeId);
      if (epIndex === -1) return;

      const newEpisodes = [...result.episodes];
      newEpisodes[epIndex] = { ...newEpisodes[epIndex], scenes: scenes };
      setResult({ ...result, episodes: newEpisodes, scenes: newEpisodes.flatMap(e => e.scenes) });
      
      // Simulate network delay for effect
      await new Promise(resolve => setTimeout(resolve, 500));
  };

  // --- Asset Handlers ---
  const handleUpdateAssetImage = (type: 'character' | 'asset', index: number, files: FileList | File[]) => {
    // ... existing logic ...
    // For brevity, I'll copy the logic from App.tsx but adapted
    const fileArray = Array.from(files);
    fileArray.forEach(file => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const url = e.target?.result as string;
            const appendUrl = (data: AnalysisResult | null) => {
                if (!data) return null;
                const newData = { ...data };
                if (type === 'character') {
                    newData.characters = [...newData.characters];
                    const currentUrls = newData.characters[index].imageUrls || [];
                    if (currentUrls.length < 5) newData.characters[index] = { ...newData.characters[index], imageUrls: [...currentUrls, url] };
                } else {
                    newData.assets = [...newData.assets];
                    const currentUrls = newData.assets[index].imageUrls || [];
                    if (currentUrls.length < 5) newData.assets[index] = { ...newData.assets[index], imageUrls: [...currentUrls, url] };
                }
                return newData;
            };
            setGlobalAssets(prev => appendUrl(prev));
            setResult(prev => appendUrl(prev));
        };
        reader.readAsDataURL(file);
    });
  };
  
  // Need to implement other asset handlers (remove image, update text, etc.)
  // For now I'll stub them or copy if needed. 
  // IMPORTANT: The AssetPanel expects these props.
  const handleRemoveAssetImage = (type: 'character' | 'asset', index: number, imageIndex: number) => {
     // ... logic from App.tsx ...
     const updateData = (data: AnalysisResult | null) => {
      if (!data) return null;
      const newData = { ...data };
      if (type === 'character') {
        newData.characters = data.characters.map((char, i) => {
          if (i === index && char.imageUrls) {
             const newUrls = [...char.imageUrls];
             if (imageIndex >= 0 && imageIndex < newUrls.length) newUrls.splice(imageIndex, 1);
              return { ...char, imageUrls: newUrls };
          }
          return char;
        });
      } else {
        newData.assets = data.assets.map((asset, i) => {
           if (i === index && asset.imageUrls) {
              const newUrls = [...asset.imageUrls];
              if (imageIndex >= 0 && imageIndex < newUrls.length) newUrls.splice(imageIndex, 1);
              return { ...asset, imageUrls: newUrls };
           }
           return asset;
        });
      }
      return newData;
    };
    setGlobalAssets(prev => updateData(prev));
    setResult(prev => updateData(prev));
  };

  const handleUpdateAssetText = (type: 'character' | 'asset', index: number, field: any, value: string) => {
    const updateData = (data: AnalysisResult | null) => {
        if (!data) return null;
        const newData = { ...data };
        if (type === 'character') {
            newData.characters = [...newData.characters];
            newData.characters[index] = { ...newData.characters[index], [field]: value };
        } else {
            newData.assets = [...newData.assets];
            newData.assets[index] = { ...newData.assets[index], [field]: value };
        }
        return newData;
    };
    setGlobalAssets(prev => updateData(prev));
    setResult(prev => updateData(prev));
  };
  
  const handleAddCharacter = () => {
    const update = (data: AnalysisResult | null) => {
      if (!data) return null;
      return { ...data, characters: [...data.characters, { name: '新角色', visualSummary: '', traits: '' }] };
    };
    setGlobalAssets(prev => update(prev));
    setResult(prev => update(prev));
  };

  const handleAddAsset = () => {
    const update = (data: AnalysisResult | null) => {
      if (!data) return null;
      return { ...data, assets: [...data.assets, { name: '新资产', description: '', type: 'Prop' as const }] };
    };
    setGlobalAssets(prev => update(prev));
    setResult(prev => update(prev));
  };

  const handleDeleteCharacter = (index: number) => {
      // Direct delete for now without recycle bin in this refactor to save space
      const update = (data: AnalysisResult | null) => {
          if (!data) return null;
          const newChars = [...data.characters];
          newChars.splice(index, 1);
          return { ...data, characters: newChars };
      };
      setGlobalAssets(prev => update(prev));
      setResult(prev => update(prev));
  };

  const handleDeleteAsset = (index: number) => {
      const update = (data: AnalysisResult | null) => {
          if (!data) return null;
          const newAssets = [...data.assets];
          newAssets.splice(index, 1);
          return { ...data, assets: newAssets };
      };
      setGlobalAssets(prev => update(prev));
      setResult(prev => update(prev));
  };

  const handleExport = () => {
    if (!result) return;
    const headers = ['集数', '场号', '镜头编号', '景别', '运镜', '生图提示词(Prompt)', '环境', '人物与动作', '台词', '时长'];
    let rows: string[] = [];
    const eps = result.episodes && result.episodes.length > 0 ? result.episodes : [{ id: '1', title: '第1集', scenes: result.scenes }];
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
      case 'deepseek': return <div className="w-3.5 h-3.5 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.8)]" />;
      case 'openai': return <div className="w-3.5 h-3.5 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.8)]" />;
      case 'moonshot': return <Moon size={14} className="text-purple-400 drop-shadow-[0_0_8px_rgba(192,132,252,1)]" />;
      default: return <Cpu size={14} className="text-[#ccff00] drop-shadow-[0_0_8px_rgba(204,255,0,0.8)]" />;
    }
  }

  // --- RESIZING ---
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing.current) return;
      e.preventDefault();
      
      if (isResizing.current === 'left') {
        const newWidth = Math.max(250, Math.min(e.clientX - 32, 500)); 
        setLayout(prev => ({ ...prev, left: newWidth }));
      } else if (isResizing.current === 'right') {
        const newWidth = Math.max(250, Math.min(window.innerWidth - e.clientX - 32, 600)); 
        setLayout(prev => ({ ...prev, right: newWidth }));
      }
    };

    const handleMouseUp = () => {
      isResizing.current = null;
      document.body.style.cursor = 'default';
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, []);


  return (
    <div className="flex flex-col h-full">
        {/* HEADER */}
        <header className="flex items-center justify-between shrink-0 mb-4 px-2">
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-4">
                 <button onClick={onBack} className="p-2 hover:bg-white/10 rounded-xl transition-colors text-slate-400 hover:text-white group">
                    <ArrowLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                 </button>
                 <div className="w-10 h-10 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl flex items-center justify-center shadow-lg">
                     <Clapperboard className="text-[#ccff00]" size={20} />
                 </div>
                 <div>
                    <h1 className="text-2xl font-bold font-display tracking-tighter text-white drop-shadow-lg flex items-center gap-2">
                        {project.name}
                        <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded border border-white/10 text-slate-400 font-mono tracking-wide">{project.creator}</span>
                    </h1>
                 </div>
             </div>

             {/* VIEW TOGGLE */}
             <div className="bg-black/20 p-1 rounded-xl border border-white/5 flex items-center">
                <button 
                    onClick={() => setActiveView('storyboard')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeView === 'storyboard' ? 'bg-[#ccff00] text-black shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                    <Layers size={14} /> 分镜
                </button>
                <button 
                    onClick={() => setActiveView('assets')}
                    className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${activeView === 'assets' ? 'bg-[#d946ef] text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                >
                    <Sparkles size={14} /> 全局资产库
                </button>
             </div>
          </div>
          
          <div className="flex items-center gap-4 bg-black/40 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl">
              
              {/* NEW AUTO STORYBOARD BUTTON */}
              <button 
                  onClick={() => setIsUploadModalOpen(true)}
                  disabled={appState !== AppState.IDLE}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-[#ccff00]/10 text-[#ccff00] hover:bg-[#ccff00]/20 hover:text-[#ccff00] border border-[#ccff00]/20`}
              >
                  <Sparkles size={14} />
                  <span>自动生成分镜表</span>
              </button>
              <div className="w-px h-6 bg-white/10"></div>

              {globalAssets && result && (
                  <>
                  <button onClick={handleExport} className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-[#ccff00] hover:bg-white/5 transition-all uppercase">
                      <Download size={14} /> 导出 CSV
                  </button>
                  <div className="w-px h-6 bg-white/10"></div>
                  </>
              )}

              <div className="relative group">
                <div className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-white/5 rounded-xl transition-colors">
                  {getProviderIcon(getSelectedModel().provider)}
                  <select 
                    className="bg-transparent border-none outline-none appearance-none text-xs font-bold text-white cursor-pointer w-[120px] font-mono uppercase"
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    disabled={appState !== AppState.IDLE}
                  >
                    {MODELS.map(model => (
                      <option key={model.id} value={model.id} className="bg-[#0f0518] text-white">{model.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="text-slate-500" />
                </div>
              </div>

              <button onClick={() => setShowSettings(true)} className="p-2 rounded-xl hover:bg-white/10 text-slate-400 hover:text-white transition-colors">
                <Settings size={18} />
              </button>

              {appState === AppState.ANALYZING || appState === AppState.EXTRACTING_CONTEXT ? (
                <button onClick={handleStopAnalysis} className="px-6 py-2 bg-red-500/20 text-red-400 border border-red-500/30 rounded-xl text-xs font-bold uppercase hover:bg-red-500/30 transition-all flex items-center gap-2">
                  <Square size={12} fill="currentColor" /> 停止
                </button>
              ) : (
                <div className="w-2" />
              )}
          </div>
        </header>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 flex overflow-hidden min-h-0 relative select-none">
            <UploadScriptModal 
                isOpen={isUploadModalOpen} 
                onClose={() => setIsUploadModalOpen(false)} 
                onUpload={processContextFile} 
                progress={progress} 
                progressStatus={progressStatus} 
                isAnalyzing={appState === AppState.ANALYZING || appState === AppState.EXTRACTING_CONTEXT} 
            />

            <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} userKeys={userKeys} onSave={handleSaveKeys} />

            {/* View Switching */}
            {activeView === 'assets' ? (
                <div className="w-full h-full p-4">
                    <div className="w-full h-full bg-[#0f0518]/60 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative">
                        <AssetPanel 
                            data={result || globalAssets} 
                            onUpdateImage={handleUpdateAssetImage} 
                            onUpdateText={handleUpdateAssetText}
                            onRemoveImage={handleRemoveAssetImage}
                            onAddCharacter={handleAddCharacter}
                            onAddAsset={handleAddAsset}
                            onDeleteCharacter={handleDeleteCharacter}
                            onDeleteAsset={handleDeleteAsset}
                          />
                    </div>
                </div>
            ) : (
                <div className="flex w-full h-full gap-4">
                    {/* 1. LEFT PANEL: Script Editor */}
                    <div style={{ width: layout.left }} className="flex flex-col min-w-[250px] shrink-0 bg-[#0f0518]/60 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative transition-width duration-0">
                         <ScriptEditor 
                            episodes={episodes}
                            onUpdateEpisode={handleUpdateEpisode}
                            onExpandEpisode={handleExpandEpisode}
                            onAddEpisode={handleAddEpisode}
                            onAnalyzeEpisode={handleAnalyzeEpisode}
                            onDeleteEpisode={handleDeleteEpisode}
                            customInstructions={customInstructions} 
                            setCustomInstructions={setCustomInstructions} 
                            isAnalyzing={appState === AppState.ANALYZING || appState === AppState.EXTRACTING_CONTEXT} 
                            locked={false}
                        />
                    </div>

                    {/* RESIZER 1 */}
                    <div 
                      className="w-1 -ml-2.5 mr-[-2px] cursor-col-resize hover:bg-[#ccff00] active:bg-[#ccff00] z-20 transition-colors flex items-center justify-center opacity-0 hover:opacity-100"
                      onMouseDown={() => { isResizing.current = 'left'; document.body.style.cursor = 'col-resize'; }}
                    >
                        <div className="w-1 h-8 bg-white/50 rounded-full" />
                    </div>

                    {/* 2. MIDDLE PANEL: Storyboard */}
                    <div className="flex-1 min-w-0 bg-[#0f0518]/60 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden relative flex flex-col">
                        {/* SCOPED LOADER OVERLAY */}
                        {appState === AppState.ANALYZING && (
                          <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0f0518]/90 backdrop-blur-xl">
                              <div className="relative mb-8">
                                  <div className="absolute inset-0 bg-[#d946ef] blur-[100px] opacity-20"></div>
                                  <Sparkles size={64} className="text-[#d946ef] animate-pulse" />
                              </div>
                              <h2 className="text-4xl font-display font-bold text-white mb-2 tracking-tighter mix-blend-overlay">分镜生成中</h2>
                              <div className="w-64 h-2 bg-white/10 mt-6 relative overflow-hidden rounded-full">
                                  <div className="h-full bg-[#d946ef] transition-all duration-300 rounded-full shadow-[0_0_15px_#d946ef]" style={{ width: `${progress}%` }}></div>
                              </div>
                              <p className="font-mono text-[#d946ef] mt-4 text-xs tracking-widest">{progressStatus}</p>
                          </div>
                        )}
                        
                        <div className="px-4 py-2 border-b border-white/5 bg-black/20 text-xs font-bold text-slate-500 uppercase tracking-widest shrink-0">
                            分镜表 (STORYBOARD)
                        </div>
                        {result ? (
                            <div className="flex-1 p-4 overflow-hidden relative">
                                 <StoryboardTable 
                                    scenes={result.scenes} 
                                    episodes={result.episodes} 
                                    onUpdateShot={handleUpdateShot} 
                                    onAddShot={handleAddShot}
                                    onDeleteShot={handleDeleteShot}
                                    onInsertShot={handleAddShot}
                                    onSaveEpisode={handleSaveEpisode}
                                 />
                            </div>
                        ) : (
                            <div className="flex-1 flex items-center justify-center text-slate-600 font-mono text-xs">
                                 <p>请点击「自动生成分镜表」开始创作</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </main>
    </div>
  );
};
