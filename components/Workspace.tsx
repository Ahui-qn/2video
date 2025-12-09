/**
 * Workspace.tsx - 工作区主组件
 * 
 * 这是整个应用最复杂的组件，负责：
 * 1. 管理剧本编辑、AI分析、分镜表展示、资产库
 * 2. 协调实时协作（接收和广播数据变更）
 * 3. 处理AI分析流程（两阶段：资产提取 + 分镜生成）
 * 4. 管理用户交互（添加/编辑/删除镜头、场景、资产）
 * 
 * 关键设计决策：
 * - 使用防抖（1秒）减少协作广播频率
 * - 使用ref追踪远程更新，防止同步循环
 * - 支持离线编辑和断线重连
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScriptEditor } from './ScriptEditor';
import { StoryboardTable } from './StoryboardTable';
import { AssetPanel } from './AssetPanel';
import { UploadScriptModal } from './UploadScriptModal';
import { SettingsModal } from './SettingsModal';
import { analyzeScript, extractAssetsOnly } from '../services/geminiService';
import { readFileContent } from '../services/fileService';
import { AppState, AnalysisResult, Shot, ModelConfig, UserKeys, ScriptEpisode, CharacterProfile, AssetProfile, Project, HistoryRecord } from '../types';
import { Download, Clapperboard, Sparkles, Settings, ChevronDown, Cpu, Moon, Square, ArrowLeft, Layers, Image as ImageIcon, History as HistoryIcon, Trash2, Users, Shield, Wifi } from 'lucide-react';
import { useCollaboration, Collaborator, ProjectData } from './CollaborationContext';
import { TeamModal } from './TeamModal';
import { ManualShotModal } from './ManualShotModal';

interface WorkspaceProps {
  project: Project;
  onBack: () => void;
  onSaveProject: (project: Project) => void;
}

// 默认第一集的初始状态
const INITIAL_EPISODE: ScriptEpisode = {
  id: '1',
  title: '第 1 集',
  content: '',
  status: 'draft',
  isExpanded: true
};

// 支持的AI模型列表
const MODELS: ModelConfig[] = [
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', provider: 'google' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', provider: 'google' },
  { id: 'gemini-3-pro-preview', name: 'Gemini 3 Pro Preview', provider: 'google' },
  { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
  { id: 'moonshot-v1-8k', name: 'Kimi (Moonshot V1)', provider: 'moonshot' }, 
  { id: 'deepseek-chat', name: 'DeepSeek V3', provider: 'deepseek' },
];

export const Workspace: React.FC<WorkspaceProps> = ({ project, onSaveProject, onBack }) => {
  // 从协作上下文获取实时协作相关的状态和方法
  const { 
    role,              // 当前用户角色（admin/editor/viewer）
    activeUsers,       // 在线用户列表
    updateProject,     // 广播更新到其他用户
    socket,            // WebSocket连接
    isConnected,       // 连接状态
    isLoading: isCollabLoading,
    projectData: serverProjectData,  // 服务器返回的项目数据
    projectInfo,
    isRemoteUpdate,    // 标记：当前更新是否来自远程
    setIsRemoteUpdate,
    hasRemoteChanges,  // 是否有远程更新
    clearRemoteChanges,
    lastUpdateBy       // 最后更新者
  } = useCollaboration();
  
  const [showTeamModal, setShowTeamModal] = useState(false);
  const [showManualShotModal, setShowManualShotModal] = useState(false);

  // 当前视图：分镜表 or 资产库
  const [activeView, setActiveView] = useState<'storyboard' | 'assets'>('storyboard');

  /**
   * 核心状态
   * 
   * - appState: AI分析状态（空闲/提取资产/分析中/完成/错误）
   * - result: AI分析结果（包含分镜表、角色、资产）
   * - episodes: 剧集列表（用户输入的剧本）
   * - globalAssets: 全局资产库（从完整剧本提取）
   */
  const [appState, setAppState] = useState<AppState>(AppState.IDLE);
  const [result, setResult] = useState<AnalysisResult | null>(project.data);
  const [episodes, setEpisodes] = useState<ScriptEpisode[]>(project.episodes || [INITIAL_EPISODE]);
  const [globalAssets, setGlobalAssets] = useState<AnalysisResult | null>(project.data);
  
  const initializedFromServer = useRef(false);

  // AI分析配置
  const [customInstructions, setCustomInstructions] = useState('【硬性约束：单镜头<3s；每集镜头≈21；语速≈6字/秒】\n');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [selectedModelId, setSelectedModelId] = useState(MODELS[0].id);
  const [showSettings, setShowSettings] = useState(false);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [userKeys, setUserKeys] = useState<UserKeys>({});
  
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);

  // 进度条状态
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");

  // 用于取消AI请求的控制器
  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

  // 布局状态（左右面板宽度）
  const [layout, setLayout] = useState({ left: 320, right: 350 });
  const isResizing = useRef<'left' | 'right' | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * 从服务器数据初始化
   * 
   * 为什么总是更新？
   * - 确保被邀请的用户能获取最新数据
   * - 处理断线重连后的数据同步
   */
  useEffect(() => {
    if (serverProjectData) {
      console.log('Initializing from server data:', serverProjectData);
      initializedFromServer.current = true;
      
      if (serverProjectData.result) {
        setResult(serverProjectData.result);
      }
      
      if (serverProjectData.episodes && serverProjectData.episodes.length > 0) {
        setEpisodes(serverProjectData.episodes);
      }
      
      if (serverProjectData.globalAssets) {
        setGlobalAssets(serverProjectData.globalAssets);
      }
    }
  }, [serverProjectData]);

  // 使用ref追踪远程更新，避免竞态条件
  const isRemoteUpdateRef = useRef(false);

  /**
   * 监听远程更新
   * 
   * 当其他用户修改项目时，通过WebSocket接收更新
   * 设置isRemoteUpdate标记，防止再次广播造成循环
   */
  useEffect(() => {
    if (!socket) return;

    const handleRemoteUpdate = (data: any) => {
      console.log('Received remote update:', data);
      isRemoteUpdateRef.current = true;
      setIsRemoteUpdate(true);
      if (data.result) setResult(data.result);
      if (data.episodes) setEpisodes(data.episodes);
      if (data.globalAssets) setGlobalAssets(data.globalAssets);
      
      // 200ms后清除标记，确保状态更新完成
      setTimeout(() => {
        isRemoteUpdateRef.current = false;
        setIsRemoteUpdate(false);
      }, 200);
    };

    socket.on('project-updated', handleRemoteUpdate);
    return () => {
      socket.off('project-updated', handleRemoteUpdate);
    };
  }, [socket, setIsRemoteUpdate]);

  /**
   * 同步项目数据到服务器
   * 
   * 这是一个通用的同步函数，在任何组件保存时调用
   * 包括：分镜表保存、资产编辑保存、剧集内容保存等
   * 
   * 注意：必须传入最新的数据，不能依赖闭包中的旧值
   */
  const syncToServer = useCallback((newResult?: AnalysisResult | null, newEpisodes?: ScriptEpisode[]) => {
    if (role === 'viewer') {
      console.log('syncToServer: blocked - viewer role');
      return;
    }
    
    // 使用传入的参数，如果没有传入则使用当前状态
    const resultToSync = newResult !== undefined ? newResult : result;
    const episodesToSync = newEpisodes !== undefined ? newEpisodes : episodes;
    
    const dataToSync = {
      result: resultToSync,
      episodes: episodesToSync,
      globalAssets: resultToSync  // globalAssets 和 result 保持一致
    };
    
    console.log('syncToServer: Syncing to server:', {
      hasResult: !!dataToSync.result,
      resultEpisodes: dataToSync.result?.episodes?.length || 0,
      episodesCount: dataToSync.episodes?.length || 0,
      episodesData: dataToSync.episodes?.map(ep => ({ id: ep.id, title: ep.title, contentLength: ep.content?.length || 0 })),
      characters: dataToSync.result?.characters?.length || 0,
      assets: dataToSync.result?.assets?.length || 0
    });
    
    updateProject(dataToSync);
  }, [result, episodes, role, updateProject]);

  // Load Keys
  useEffect(() => {
    const savedKeys = localStorage.getItem('script2video_keys');
    if (savedKeys) {
      try { setUserKeys(JSON.parse(savedKeys)); } catch (e) { console.error("Failed to load keys"); }
    }
  }, []);

  // Save Project when important state changes (本地状态更新)
  // 注意：服务器同步现在通过 handleSaveEpisode 手动触发
  useEffect(() => {
    const updatedProject = {
      ...project,
      data: result,
      episodes: episodes,
      updatedAt: Date.now()
    };
    onSaveProject(updatedProject);
  }, [result, episodes]);

  // --- HELPERS ---
  const handleSaveKeys = (keys: UserKeys) => {
    setUserKeys(keys);
    localStorage.setItem('script2video_keys', JSON.stringify(keys));
  };

  const addHistory = (summary: string) => {
      const newRecord: HistoryRecord = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          summary,
          user: 'User' // Default user for now
      };
      setHistory(prev => {
          const newHistory = [newRecord, ...prev];
          if (newHistory.length > 50) return newHistory.slice(0, 50);
          return newHistory;
      });
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
        let newResult: AnalysisResult;
        if (!result) {
            newResult = {
                title: assets.title,
                synopsis: assets.synopsis,
                characters: assets.characters,
                assets: assets.assets,
                scenes: [],
                episodes: []
            };
            setResult(newResult);
        } else {
            // 合并资产到现有结果
            newResult = {
                ...result,
                characters: assets.characters,
                assets: assets.assets
            };
            setResult(newResult);
        }
        
        // 自动生成资产库后同步到服务器
        syncToServer(newResult);
        
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
      const newEpisodes = [...episodes.map(e => ({...e, isExpanded: false})), newEp];
      setEpisodes(newEpisodes);
      // 新增单集后同步到服务器
      syncToServer(undefined, newEpisodes);
  };

  const handleDeleteEpisode = (id: string) => {
      if (confirm("确定要删除这一集吗？")) {
         const newEpisodes = episodes.filter(e => e.id !== id);
         setEpisodes(newEpisodes);
         // 删除剧集后立即同步到服务器
         syncToServer(undefined, newEpisodes);
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
        let newResult: AnalysisResult;
        if (result && result.episodes) {
            const currentEpisodes = [...(result.episodes || [])];
            const newEpisodes = newData.episodes || [];
            const updatedEpisodes = [...currentEpisodes, ...newEpisodes];
            
            newResult = {
                ...result,
                episodes: updatedEpisodes,
                scenes: updatedEpisodes.flatMap(e => e.scenes)
            };
        } else {
            newResult = newData;
        }
        setResult(newResult);
        
        setAppState(AppState.COMPLETE);

        const currentEpId = targetEp!.id;
        const updatedEpisodes = episodes.map(ep => ep.id === currentEpId ? { ...ep, status: 'analyzed' as const, isExpanded: false, title: newData.episodes?.[0]?.title || ep.title } : ep);
        setEpisodes(updatedEpisodes);
        
        // AI分析完成后同步到服务器
        syncToServer(newResult, updatedEpisodes);
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
      const newResult = { ...result, episodes: newEpisodes, scenes: newEpisodes.flatMap(e => e.scenes) };
      setResult(newResult);
      // 新增分镜后同步到服务器
      syncToServer(newResult);
  };

  const handleDeleteShot = (episodeIndex: number, sceneIndex: number, shotIndex: number) => {
      if (!result || !result.episodes) return;
      const newEpisodes = [...result.episodes];
      const newScenes = [...newEpisodes[episodeIndex].scenes];
      const newShots = [...newScenes[sceneIndex].shots];
      newShots.splice(shotIndex, 1);
      newScenes[sceneIndex] = { ...newScenes[sceneIndex], shots: newShots };
      newEpisodes[episodeIndex] = { ...newEpisodes[episodeIndex], scenes: newScenes };
      const newResult = { ...result, episodes: newEpisodes, scenes: newEpisodes.flatMap(e => e.scenes) };
      setResult(newResult);
      // 删除镜头后立即同步到服务器
      syncToServer(newResult);
  };

  const handleSaveEpisode = async (episodeId: string, scenes: any[]) => {
      // Logic to update the result state with the modified scenes for a specific episode
      if (!result || !result.episodes) {
        console.log('handleSaveEpisode: No result or episodes to save');
        return;
      }
      const epIndex = result.episodes.findIndex(e => e.id === episodeId);
      if (epIndex === -1) {
        console.log('handleSaveEpisode: Episode not found:', episodeId);
        return;
      }

      const newEpisodes = [...result.episodes];
      newEpisodes[epIndex] = { ...newEpisodes[epIndex], scenes: scenes };
      const newResult = { ...result, episodes: newEpisodes, scenes: newEpisodes.flatMap(e => e.scenes) };
      setResult(newResult);
      setGlobalAssets(newResult);  // 同步更新 globalAssets
      
      // 立即同步到服务器
      console.log('handleSaveEpisode: Saving to server:', episodeId, 'scenes:', scenes.length);
      syncToServer(newResult, episodes);
      
      // 短暂延迟让UI显示保存状态
      await new Promise(resolve => setTimeout(resolve, 300));
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
    const emptyData: AnalysisResult = { title: '', synopsis: '', characters: [], assets: [], scenes: [], episodes: [] };
    const update = (data: AnalysisResult | null) => {
      const base = data || emptyData;
      return { ...base, characters: [...base.characters, { name: '新角色', visualSummary: '', traits: '' }] };
    };
    const newGlobalAssets = update(globalAssets);
    const newResult = update(result);
    setGlobalAssets(newGlobalAssets);
    setResult(newResult);
    // 新增角色后同步到服务器
    syncToServer(newResult);
  };

  const handleAddAsset = () => {
    const emptyData: AnalysisResult = { title: '', synopsis: '', characters: [], assets: [], scenes: [], episodes: [] };
    const update = (data: AnalysisResult | null) => {
      const base = data || emptyData;
      return { ...base, assets: [...base.assets, { name: '新资产', description: '', type: 'Prop' as const }] };
    };
    const newGlobalAssets = update(globalAssets);
    const newResult = update(result);
    setGlobalAssets(newGlobalAssets);
    setResult(newResult);
    // 新增资产后同步到服务器
    syncToServer(newResult);
  };

  const handleDeleteCharacter = (index: number) => {
      // Direct delete for now without recycle bin in this refactor to save space
      const update = (data: AnalysisResult | null) => {
          if (!data) return null;
          const newChars = [...data.characters];
          newChars.splice(index, 1);
          return { ...data, characters: newChars };
      };
      const newGlobalAssets = update(globalAssets);
      const newResult = update(result);
      setGlobalAssets(newGlobalAssets);
      setResult(newResult);
      // 删除后立即同步到服务器
      syncToServer(newResult);
  };

  const handleDeleteAsset = (index: number) => {
      const update = (data: AnalysisResult | null) => {
          if (!data) return null;
          const newAssets = [...data.assets];
          newAssets.splice(index, 1);
          return { ...data, assets: newAssets };
      };
      const newGlobalAssets = update(globalAssets);
      const newResult = update(result);
      setGlobalAssets(newGlobalAssets);
      setResult(newResult);
      // 删除后立即同步到服务器
      syncToServer(newResult);
  };

  // Handle manual shot addition
  const handleManualShotSubmit = (shot: Shot, sceneHeader: string, episodeId?: string) => {
    // Create new scene with the shot
    const newScene = {
      sceneId: `scene-${Date.now()}`,
      header: sceneHeader,
      shots: [{ ...shot, id: '1' }]
    };

    if (!result) {
      // No result yet - create new result with first episode
      const firstEpisode = episodes[0] || { id: '1', title: '第 1 集' };
      const newResult: AnalysisResult = {
        title: project.name,
        synopsis: '',
        characters: [],
        assets: [],
        scenes: [newScene],
        episodes: [{
          id: firstEpisode.id,
          title: firstEpisode.title,
          scenes: [newScene]
        }]
      };
      setResult(newResult);
      addHistory(`手动添加分镜: ${sceneHeader}`);
      // 同步到服务器
      syncToServer(newResult);
      return;
    }

    // Result exists - add to appropriate episode
    const newEpisodes = [...(result.episodes || [])];
    
    if (newEpisodes.length === 0) {
      // No episodes in result - create first one
      const firstEpisode = episodes[0] || { id: '1', title: '第 1 集' };
      newEpisodes.push({
        id: firstEpisode.id,
        title: firstEpisode.title,
        scenes: [newScene]
      });
    } else {
      // Find target episode or use first one
      let targetIndex = 0;
      if (episodeId) {
        const foundIndex = newEpisodes.findIndex(ep => ep.id === episodeId);
        if (foundIndex !== -1) targetIndex = foundIndex;
      }
      
      // Add scene to the episode
      const targetEpisode = { ...newEpisodes[targetIndex] };
      targetEpisode.scenes = [...targetEpisode.scenes, newScene];
      newEpisodes[targetIndex] = targetEpisode;
    }

    // Update result
    const newResult = {
      ...result,
      episodes: newEpisodes,
      scenes: newEpisodes.flatMap(ep => ep.scenes)
    };
    setResult(newResult);
    
    addHistory(`手动添加分镜: ${sceneHeader}`);
    // 同步到服务器
    syncToServer(newResult);
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

  // --- CLEANUP ON UNMOUNT ---
  useEffect(() => {
    return () => {
      // Clear all intervals and timeouts on unmount to prevent memory leaks
      if (progressIntervalRef.current) {
        clearInterval(progressIntervalRef.current);
        progressIntervalRef.current = null;
      }
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

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


  // Show loading state while collaboration is loading
  if (isCollabLoading) {
    return (
      <div className="flex flex-col h-full items-center justify-center">
        <div className="relative mb-8">
          <div className="absolute inset-0 bg-[#ccff00] blur-[100px] opacity-20"></div>
          <Clapperboard size={64} className="text-[#ccff00] animate-pulse" />
        </div>
        <h2 className="text-2xl font-display font-bold text-white mb-2">正在加载项目...</h2>
        <p className="text-slate-500 text-sm">连接协作服务器中</p>
      </div>
    );
  }

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
                        {projectInfo?.name || project.name}
                        <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded border border-white/10 text-slate-400 font-mono tracking-wide">{projectInfo?.creator || project.creator}</span>
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

             {/* ACTIVE USERS AVATARS */}
             <div className="flex items-center pl-4 gap-[-8px]">
                {activeUsers.slice(0, 3).map((u, i) => (
                    <div key={u.socketId || i} className="w-8 h-8 rounded-full bg-slate-700 border-2 border-[#0f0518] flex items-center justify-center text-[10px] font-bold text-white -ml-2 relative group cursor-help" title={u.name}>
                        {u.name.substring(0, 2).toUpperCase()}
                        <div className="absolute bottom-0 right-0 w-2 h-2 bg-green-500 rounded-full border border-[#0f0518]"></div>
                    </div>
                ))}
                {activeUsers.length > 3 && (
                    <div className="w-8 h-8 rounded-full bg-slate-800 border-2 border-[#0f0518] flex items-center justify-center text-[10px] font-bold text-slate-400 -ml-2">
                        +{activeUsers.length - 3}
                    </div>
                )}
                <button 
                    onClick={() => setShowTeamModal(true)}
                    className="ml-4 px-3 py-1.5 bg-white/5 hover:bg-white/10 rounded-lg border border-white/10 flex items-center gap-2 text-xs font-bold text-slate-300 transition-colors"
                >
                    <Users size={14} />
                    {activeUsers.length}
                </button>
             </div>
          </div>
          
          <div className="flex items-center gap-4 bg-black/40 backdrop-blur-xl p-2 rounded-2xl border border-white/10 shadow-2xl">
              {/* Connection Status */}
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.8)]' : 'bg-red-500'} mr-2`} title={isConnected ? "已连接协作服务" : "未连接"} />
              
              {/* 远程更新提示 - 有人修改时显示 */}
              {hasRemoteChanges && (
                <button
                  onClick={clearRemoteChanges}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold bg-orange-500/20 text-orange-400 border border-orange-500/30 animate-pulse hover:bg-orange-500/30 transition-all"
                  title="点击清除提示"
                >
                  <span className="w-2 h-2 rounded-full bg-orange-400"></span>
                  {lastUpdateBy ? `${lastUpdateBy} 更新了内容` : '有新更新'}
                </button>
              )}
              
              {/* NEW AUTO STORYBOARD BUTTON */}
              <button 
                  onClick={() => setIsUploadModalOpen(true)}
                  disabled={appState !== AppState.IDLE}
                  className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all bg-[#ccff00]/10 text-[#ccff00] hover:bg-[#ccff00]/20 hover:text-[#ccff00] border border-[#ccff00]/20`}
              >
                  <Sparkles size={14} />
                  <span>自动生成资产</span>
              </button>
              <div className="w-px h-6 bg-white/10"></div>

              {/* 手动保存按钮已移除 - 现在通过编辑单个分镜后点击保存来同步 */}

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

              <button onClick={() => setShowHistory(!showHistory)} className={`p-2 rounded-xl hover:bg-white/10 transition-colors ${showHistory ? 'text-[#ccff00] bg-white/10' : 'text-slate-400 hover:text-white'}`}>
                <HistoryIcon size={18} />
              </button>

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
            <TeamModal isOpen={showTeamModal} onClose={() => setShowTeamModal(false)} projectId={project.id} />
            <ManualShotModal 
              isOpen={showManualShotModal} 
              onClose={() => setShowManualShotModal(false)} 
              onSubmit={handleManualShotSubmit}
              episodes={result?.episodes}
            />

            {/* History Panel */}
            {showHistory && (
                <div className="absolute top-16 right-4 w-80 bg-[#0f0518]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 flex flex-col max-h-[80vh] animate-fade-in">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10 shrink-0">
                        <h3 className="text-sm font-bold text-white flex items-center gap-2">
                            <HistoryIcon size={14} className="text-[#ccff00]" />
                            修改记录
                        </h3>
                        <button onClick={() => setHistory([])} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1" title="清空记录">
                            <Trash2 size={12} /> 清空
                        </button>
                    </div>
                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-1">
                        {history.length === 0 ? (
                            <div className="text-center py-8 text-xs text-slate-500">暂无修改记录</div>
                        ) : (
                            history.map(record => (
                                <div key={record.id} className="p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-colors border border-white/5">
                                    <div className="flex justify-between items-start mb-1">
                                        <span className="text-[10px] font-bold text-[#ccff00] bg-[#ccff00]/10 px-1.5 py-0.5 rounded">{record.user}</span>
                                        <span className="text-[10px] text-slate-500 font-mono">{new Date(record.timestamp).toLocaleTimeString()}</span>
                                    </div>
                                    <p className="text-xs text-slate-300 leading-relaxed">{record.summary}</p>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            )}

            {/* View Switching */}
            <div className="relative flex-1 w-full h-full overflow-hidden">
                {/* Assets View */}
                <div 
                    className={`absolute inset-0 w-full h-full p-4 transition-all duration-200 ease-in-out ${activeView === 'assets' ? 'opacity-100 z-10 translate-x-0' : 'opacity-0 z-0 -translate-x-4 pointer-events-none'}`}
                >
                    <div className={`w-full h-full bg-[#0f0518]/60 backdrop-blur-2xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl relative ${role === 'viewer' ? 'pointer-events-none opacity-80' : ''}`}>
                        <AssetPanel 
                            data={result || globalAssets || { title: '', synopsis: '', characters: [], assets: [], scenes: [], episodes: [] }} 
                            onUpdateImage={handleUpdateAssetImage} 
                            onUpdateText={handleUpdateAssetText}
                            onRemoveImage={handleRemoveAssetImage}
                            onAddCharacter={handleAddCharacter}
                            onAddAsset={handleAddAsset}
                            onDeleteCharacter={handleDeleteCharacter}
                            onDeleteAsset={handleDeleteAsset}
                            onAddHistory={addHistory}
                            onSaveAsset={() => syncToServer()}
                          />
                    </div>
                </div>

                {/* Storyboard View */}
                <div 
                    className={`absolute inset-0 flex w-full h-full gap-4 transition-all duration-200 ease-in-out ${activeView === 'storyboard' ? 'opacity-100 z-10 translate-x-0' : 'opacity-0 z-0 translate-x-4 pointer-events-none'}`}
                >
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
                            locked={role === 'viewer'}
                            onAddHistory={addHistory}
                            onSaveEpisodeContent={(episodeId: string, content: string) => {
                              // 先更新本地状态，然后同步到服务器
                              // 注意：这里直接构建新的 episodes 数组并同步，不依赖 React 状态更新
                              const updatedEpisodes = episodes.map(ep => 
                                ep.id === episodeId ? { ...ep, content } : ep
                              );
                              // 同时更新本地状态
                              setEpisodes(updatedEpisodes);
                              // 立即同步到服务器
                              console.log('Saving episode content:', episodeId, 'content length:', content.length);
                              syncToServer(result, updatedEpisodes);
                            }}
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
                                    onUpdateShot={role !== 'viewer' ? handleUpdateShot : () => {}} 
                                    onAddShot={role !== 'viewer' ? handleAddShot : undefined}
                                    onDeleteShot={role !== 'viewer' ? handleDeleteShot : undefined}
                                    onInsertShot={role !== 'viewer' ? handleAddShot : undefined}
                                    onSaveEpisode={role !== 'viewer' ? handleSaveEpisode : undefined}
                                    onAddHistory={addHistory}
                                 />
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 font-mono text-xs gap-4">
                                 <p>请点击「自动生成资产」开始创作</p>
                                 <span className="opacity-50">- 或 -</span>
                                 <button 
                                    onClick={() => setShowManualShotModal(true)}
                                    disabled={role === 'viewer'}
                                    className="px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                                 >
                                    手动创建分镜
                                 </button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </main>
    </div>
  );
};
