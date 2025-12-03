
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { ScriptEditor } from './components/ScriptEditor';
import { StoryboardTable } from './components/StoryboardTable';
import { AssetPanel } from './components/AssetPanel';
import { SettingsModal } from './components/SettingsModal';
import { analyzeScript, extractAssetsOnly } from './services/geminiService';
import { readFileContent } from './services/fileService';
import { AppState, AnalysisResult, Shot, ModelConfig, UserKeys, ScriptEpisode, CharacterProfile, AssetProfile } from './types';
import { Play, Download, Clapperboard, Layers, AlertTriangle, Sparkles, Layout, Settings, ChevronDown, Cpu, Moon, Hash, Clock, Square, FolderPlus, BookOpen, UploadCloud, CheckCircle, Database } from 'lucide-react';

// --- 3D TILT CARD COMPONENT ---
interface TiltCardProps extends React.ComponentPropsWithoutRef<'div'> {
  disabled?: boolean;
}

const TiltCard = ({ children, className, disabled = false, style, ...props }: TiltCardProps) => {
  const ref = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState("perspective(1500px) rotateX(0deg) rotateY(0deg)");
  const [shine, setShine] = useState("50% 50%");
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    props.onMouseMove?.(e);
    if (disabled || !ref.current) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    
    // Calculate rotation (center based)
    // Reduced sensitivity/angle
    const x = (e.clientX - left - width / 2) / 150; 
    const y = (e.clientY - top - height / 2) / 150;
    
    setTransform(`perspective(1500px) rotateX(${-y}deg) rotateY(${x}deg) scale3d(1.005, 1.005, 1.005)`);
    
    // Shine effect calculation
    const shineX = ((e.clientX - left) / width) * 100;
    const shineY = ((e.clientY - top) / height) * 100;
    setShine(`${shineX}% ${shineY}%`);
    setOpacity(0.3); 
  };

  const handleMouseLeave = (e: React.MouseEvent<HTMLDivElement>) => {
    props.onMouseLeave?.(e);
    setTransform("perspective(1500px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)");
    setOpacity(0);
  };

  return (
    <div 
      ref={ref}
      {...props}
      onMouseMove={handleMouseMove} 
      onMouseLeave={handleMouseLeave}
      className={`transition-all duration-300 ease-out will-change-transform ${className || ''}`}
      style={{ ...style, transform, transformStyle: 'preserve-3d' }}
    >
      {/* Acrylic sheen overlay */}
      <div 
        className="absolute inset-0 z-50 pointer-events-none rounded-[inherit] transition-opacity duration-500"
        style={{
          opacity,
          background: `radial-gradient(circle at ${shine}, rgba(255,255,255,0.2), transparent 60%)`
        }}
      />
      {children}
    </div>
  );
};

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
  
  const [globalAssets, setGlobalAssets] = useState<AnalysisResult | null>(null);
  
  // DRAG STATE
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const dragCounter = useRef(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");
  const [mobileView, setMobileView] = useState<'editor' | 'preview'>('editor');

  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

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

  const handleUpdateEpisode = (id: string, updates: Partial<ScriptEpisode>) => {
      setEpisodes(prev => prev.map(ep => ep.id === id ? { ...ep, ...updates } : ep));
  };

  const handleExpandEpisode = (id: string) => {
      setEpisodes(prev => prev.map(ep => {
        if (ep.id === id) {
            return { ...ep, isExpanded: !ep.isExpanded };
        }
        return { ...ep, isExpanded: false };
      }));
  };

  const handleAddEpisode = () => {
      // Find max episode number to avoid duplicates
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
    if (episodes.length <= 1) {
        alert("至少保留一集");
        return;
    }
    if (window.confirm("确定要删除这一集吗？此操作不可撤销。")) {
        setEpisodes(prev => prev.filter(e => e.id !== id));
        if (result && result.episodes) {
             setResult(prev => prev ? ({
                 ...prev,
                 episodes: prev.episodes?.filter(e => e.id !== id)
             }) : null);
        }
    }
  };

  const processContextFile = useCallback(async (file: File) => {
    setAppState(AppState.EXTRACTING_CONTEXT);
    setErrorMsg(null);
    setProgress(0);
    setProgressStatus("正在读取文件...");
    
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
  }, [userKeys, customInstructions, selectedModelId, result, getSelectedModel]); // Dependencies for callback

  const handleUploadContext = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processContextFile(file);
  };

  // --- ROBUST GLOBAL DRAG & DROP HANDLERS ---
  useEffect(() => {
    // We use capture: true to ensure we get the event before any child stops propagation.
    // We use a counter ref to handle the flickering of enter/leave events when moving over children.
    
    const handleDragOver = (e: DragEvent) => {
       e.preventDefault(); 
       e.stopPropagation();
       // Explicitly enable copy to prevent forbidden cursor
       if (e.dataTransfer) {
           e.dataTransfer.dropEffect = 'copy';
       }
    };

    const handleDragEnter = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current += 1;
        
        // Only trigger drag state if we are in IDLE mode and dragging files
        if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
             if (appState === AppState.IDLE && !globalAssets) {
                setIsDraggingFile(true);
             }
        }
    };

    const handleDragLeave = (e: DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        dragCounter.current -= 1;
        
        if (dragCounter.current === 0) {
            setIsDraggingFile(false);
        }
    };

    const handleDrop = (e: DragEvent) => {
       e.preventDefault();
       e.stopPropagation();
       dragCounter.current = 0;
       setIsDraggingFile(false);
       
       // Fallback drop handler if the overlay didn't catch it
       if (appState === AppState.IDLE && !globalAssets && e.dataTransfer?.files?.length) {
           processContextFile(e.dataTransfer.files[0]);
       }
    };

    // Add listeners with capture: true to ensure priority
    window.addEventListener('dragover', handleDragOver, { capture: true });
    window.addEventListener('dragenter', handleDragEnter, { capture: true });
    window.addEventListener('dragleave', handleDragLeave, { capture: true });
    window.addEventListener('drop', handleDrop, { capture: true });

    return () => {
       window.removeEventListener('dragover', handleDragOver, { capture: true });
       window.removeEventListener('dragenter', handleDragEnter, { capture: true });
       window.removeEventListener('dragleave', handleDragLeave, { capture: true });
       window.removeEventListener('drop', handleDrop, { capture: true });
    };
  }, [globalAssets, appState, processContextFile]);


  // --- OVERLAY SPECIFIC HANDLERS ---
  // The overlay is an explicit drop target.
  const handleOverlayDrop = (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDraggingFile(false);
      dragCounter.current = 0;
      
      const file = e.dataTransfer.files?.[0];
      if (file) {
          processContextFile(file);
      }
  };

  // --- Image Upload Handler for Assets (Supports multiple) ---
  const handleUpdateAssetImage = (type: 'character' | 'asset', index: number, files: FileList | File[]) => {
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
                    if (currentUrls.length < 5) {
                        newData.characters[index] = { ...newData.characters[index], imageUrls: [...currentUrls, url] };
                    }
                } else {
                    newData.assets = [...newData.assets];
                    const currentUrls = newData.assets[index].imageUrls || [];
                     if (currentUrls.length < 5) {
                        newData.assets[index] = { ...newData.assets[index], imageUrls: [...currentUrls, url] };
                    }
                }
                return newData;
            };
            
            setGlobalAssets(prev => appendUrl(prev));
            setResult(prev => appendUrl(prev));
        };
        reader.readAsDataURL(file);
    });
  };

  const handleRemoveAssetImage = (type: 'character' | 'asset', index: number, imageIndex: number) => {
    const updateData = (data: AnalysisResult | null) => {
      if (!data) return null;
      // Use structured clone or deep spread to ensure immutability
      const newData = { ...data };
      
      if (type === 'character') {
        newData.characters = data.characters.map((char, i) => {
          if (i === index && char.imageUrls) {
             const newUrls = [...char.imageUrls];
             if (imageIndex >= 0 && imageIndex < newUrls.length) {
                 newUrls.splice(imageIndex, 1);
             }
             return { ...char, imageUrls: newUrls };
          }
          return char;
        });
      } else {
        newData.assets = data.assets.map((asset, i) => {
           if (i === index && asset.imageUrls) {
              const newUrls = [...asset.imageUrls];
              if (imageIndex >= 0 && imageIndex < newUrls.length) {
                 newUrls.splice(imageIndex, 1);
              }
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

  // --- Text Edit Handler for Assets ---
  const handleUpdateAssetText = (type: 'character' | 'asset', index: number, field: keyof CharacterProfile | keyof AssetProfile, value: string) => {
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


  const handleAnalyzeEpisode = async (episodeId?: string) => {
    let targetEp: ScriptEpisode | undefined;
    
    if (episodeId) {
        targetEp = episodes.find(e => e.id === episodeId);
    } else {
        // Fallback or find first draft
        targetEp = episodes.find(e => e.status === 'draft' && e.content.trim().length > 0);
    }

    if (!targetEp) return;
    if (targetEp.content.trim().length === 0) {
        setErrorMsg("该集内容为空，无法分析");
        return;
    }
    
    setAppState(AppState.ANALYZING);
    setMobileView('preview');
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
        
        setActiveTab('storyboard');
        setAppState(AppState.COMPLETE);

        const currentEpId = targetEp!.id;
        const nextId = (episodes.length + 1).toString();
        
        setEpisodes(prev => {
            // Mark current as analyzed
            const updated = prev.map(ep => ep.id === currentEpId ? { ...ep, status: 'analyzed' as const, isExpanded: false, title: newData.episodes?.[0]?.title || ep.title } : ep);
            
            // Auto-create next draft if not exists
            const nextExists = prev.some(e => e.id === nextId);
            if (!nextExists) {
                updated.push({
                    id: nextId,
                    title: `第 ${updated.length + 1} 集`,
                    content: '',
                    status: 'draft',
                    isExpanded: true
                });
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

  const nextDraftEpisode = episodes.find(e => e.status === 'draft' && e.content.trim().length > 0);

  return (
    <div className="relative h-screen w-screen overflow-hidden text-slate-200 font-sans flex flex-col selection:bg-[#d946ef] selection:text-white bg-transparent">
      {/* Liquid Mesh Background - Z:0 */}
      <div className="liquid-bg">
        <div className="liquid-blob blob-1"></div>
        <div className="liquid-blob blob-2"></div>
        <div className="liquid-blob blob-3"></div>
        <div className="liquid-blob blob-4"></div>
      </div>
      
      {/* GLOBAL DRAG OVERLAY - Z:100 */}
      {isDraggingFile && (
        <div 
          className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in"
          onDragOver={(e) => { 
             e.preventDefault(); 
             e.stopPropagation(); 
             if(e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
          }}
          onDrop={handleOverlayDrop}
        >
           <div className="p-10 border-2 border-dashed border-[#ccff00] rounded-3xl animate-bounce bg-[#ccff00]/10 pointer-events-none">
              <UploadCloud size={80} className="text-[#ccff00]" />
           </div>
           <h2 className="text-4xl font-display font-bold text-white mt-8 tracking-tight pointer-events-none">
             释放文件以初始化项目
           </h2>
           <p className="text-slate-400 mt-2 font-mono pointer-events-none">支持 .txt, .pdf, .docx, .md, .fountain</p>
        </div>
      )}

      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} userKeys={userKeys} onSave={handleSaveKeys} />

      {/* CONTENT - Z:10 */}
      <div 
         className="flex flex-col h-full p-4 md:p-8 gap-6 z-10 relative"
      >
        {/* HEADER */}
        <header className="flex flex-col md:flex-row md:items-center justify-between shrink-0 gap-4 md:gap-0">
          <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-black/40 backdrop-blur-xl border border-white/10 rounded-xl flex items-center justify-center shadow-lg transform rotate-3 hover:rotate-0 transition-transform duration-300">
                 <Clapperboard className="text-[#ccff00]" size={24} />
             </div>
             <div>
                <h1 className="text-4xl font-bold font-display tracking-tighter text-white drop-shadow-lg">SCRIPT<span className="text-[#ccff00]">2</span>VIDEO</h1>
                <p className="text-[10px] font-bold tracking-[0.3em] text-[#d946ef] uppercase mt-0.5">先锋影视制作工具</p>
             </div>
          </div>
          
          <div className="flex items-center gap-4 bg-black/40 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl">
              <input type="file" accept=".txt,.md,.fountain,.docx,.pdf" ref={fileInputRef} className="hidden" onChange={handleUploadContext} disabled={appState !== AppState.IDLE} />
              
              <button 
                onClick={() => fileInputRef.current?.click()}
                disabled={appState !== AppState.IDLE}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${globalAssets ? 'bg-[#ccff00] text-black shadow-[0_0_15px_#ccff00]' : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white'}`}
              >
                {globalAssets ? <CheckCircle size={14} /> : <BookOpen size={14} />}
                <span>{globalAssets ? "全局背景已激活" : "上传完整剧本"}</span>
              </button>

              <div className="w-px h-6 bg-white/10"></div>

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

        <main className="flex-1 flex gap-6 overflow-hidden min-h-0 relative">
          
          {/* EDITOR PANEL - HIDDEN INITIALLY */}
          <TiltCard 
              className={`flex flex-col absolute md:relative inset-0 transition-all duration-700 ease-[cubic-bezier(0.23,1,0.32,1)] ${
                  globalAssets 
                    ? 'w-full md:w-[400px] translate-x-0 opacity-100 z-20' 
                    : 'w-0 -translate-x-full opacity-0 pointer-events-none overflow-hidden invisible -z-10'
              }`}
          >
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
               locked={!globalAssets}
            />
          </TiltCard>

          {/* PREVIEW PANEL */}
          <TiltCard 
             className={`flex-1 flex flex-col min-w-0 bg-[#0f0518]/60 backdrop-blur-2xl border-t border-l border-white/10 border-r border-b border-black/50 rounded-3xl shadow-[20px_20px_60px_rgba(0,0,0,0.5)] relative overflow-hidden transition-all duration-500 ${isDraggingFile ? 'border-[#ccff00] shadow-[0_0_50px_rgba(204,255,0,0.1)]' : ''}`}
          >
             <div 
               className="h-full flex flex-col relative"
             >
                {/* Toolbar */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-white/5 bg-black/20 shrink-0">
                    <div className="flex gap-2">
                       <button onClick={() => setActiveTab('storyboard')} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === 'storyboard' ? 'bg-[#ccff00] text-black' : 'text-slate-500 hover:text-white'}`}>分镜表</button>
                       <button onClick={() => setActiveTab('assets')} className={`px-4 py-1.5 rounded-lg text-[10px] font-bold tracking-widest uppercase transition-all ${activeTab === 'assets' ? 'bg-[#d946ef] text-white' : 'text-slate-500 hover:text-white'}`}>资产库</button>
                    </div>
                    {result && (
                      <button onClick={handleExport} className="flex items-center gap-2 text-xs font-bold text-slate-400 hover:text-[#ccff00] transition-colors uppercase">
                          <Download size={14} /> 导出 CSV
                      </button>
                    )}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-hidden p-4 relative">
                   {/* Loader */}
                   {(appState === AppState.ANALYZING || appState === AppState.EXTRACTING_CONTEXT) && (
                      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-[#0f0518]/90 backdrop-blur-xl">
                          <div className="relative mb-8">
                             <div className="absolute inset-0 bg-[#ccff00] blur-[100px] opacity-20"></div>
                             {appState === AppState.EXTRACTING_CONTEXT ? <BookOpen size={64} className="text-[#ccff00] animate-pulse" /> : <Sparkles size={64} className="text-[#d946ef] animate-pulse" />}
                          </div>
                          <h2 className="text-5xl font-display font-bold text-white mb-2 tracking-tighter mix-blend-overlay">处理中</h2>
                          <div className="w-96 h-2 bg-white/10 mt-8 relative overflow-hidden">
                             <div className="h-full bg-[#ccff00] transition-all duration-300" style={{ width: `${progress}%` }}></div>
                          </div>
                          <p className="font-mono text-[#ccff00] mt-4 text-xs">{progressStatus}</p>
                      </div>
                   )}

                   {/* Empty State */}
                   {!result && !globalAssets && appState === AppState.IDLE && (
                      <div className="flex flex-col items-center justify-center h-full text-center animate-fade-in">
                          <div 
                             onClick={() => fileInputRef.current?.click()}
                             className="w-32 h-32 border border-white/10 bg-white/5 rounded-3xl flex items-center justify-center cursor-pointer hover:bg-white/10 hover:border-[#ccff00] hover:scale-105 transition-all duration-300 group shadow-2xl"
                          >
                             <UploadCloud size={48} className="text-slate-500 group-hover:text-[#ccff00] transition-colors" />
                          </div>
                          <h1 className="text-6xl font-display font-bold text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-500 mt-8 mb-4">初始化项目</h1>
                          <p className="text-slate-400 font-mono text-xs max-w-md uppercase tracking-wider">
                             上传完整剧本以生成全局资产库
                          </p>
                      </div>
                   )}

                   {/* Data View */}
                   {result && (
                      activeTab === 'storyboard' 
                        ? <StoryboardTable scenes={result.scenes} episodes={result.episodes} onUpdateShot={handleUpdateShot} /> 
                        : <AssetPanel 
                            data={result} 
                            onUpdateImage={handleUpdateAssetImage} 
                            onUpdateText={handleUpdateAssetText}
                            onRemoveImage={handleRemoveAssetImage}
                          />
                   )}
                </div>
             </div>
          </TiltCard>
        </main>
      </div>
    </div>
  );
};

export default App;
