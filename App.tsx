
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ScriptEditor } from './components/ScriptEditor';
import { StoryboardTable } from './components/StoryboardTable';
import { AssetPanel } from './components/AssetPanel';
import { SettingsModal } from './components/SettingsModal';
import { analyzeScript, smartSplitScript, mergeAnalysisResults } from './services/geminiService';
import { AppState, AnalysisResult, Shot, ModelConfig, UserKeys } from './types';
import { Play, Download, Clapperboard, Layers, AlertTriangle, Wand2, Sparkles, Layout, Settings, ChevronDown, Cpu, Zap, Box, Moon, Hash, Clock, Square, FileText, PanelRight, FolderPlus, ToggleLeft, ToggleRight, ArrowRight, CheckCircle2, Loader2 } from 'lucide-react';

// A long script (~3000 chars) split into 3 Episodes
const INITIAL_SCRIPT = `第1集：霓虹觉醒

内景。凯的公寓 - 黎明
房间里堆满了全息投影的旧设备和散落的电缆。
凯（20岁，机械手臂，神情疲惫）坐在工作台前，用螺丝刀调整着手臂上的伺服电机。
窗外，巨大的全息广告牌投射出粉色的光芒，照亮了他苍白的脸。

凯
（自言自语）
再坚持一次...只要再坚持一次同步。

凯按下手臂上的红色按钮。
伺服电机发出刺耳的啸叫声，火花四溅。凯痛苦地捂住手臂，倒吸一口凉气。

凯
该死。抑制剂失效了。

外景。第7区街道 - 早晨
酸雨淅淅沥沥地落下，打在行人的透明雨伞上。
街道两旁是高耸入云的摩天大楼，底部则是破败的贫民窟。
一辆浮空警车呼啸而过，蓝红色的警灯在积水的路面上反射出破碎的光影。
凯拉起兜帽，混入匆忙的人群中。

凯（内心OS）
如果那个黑市医生说的是真的，这只手臂的记忆核心里藏着我不该知道的秘密。

内景。老乔的维修店 - 白天
店内昏暗，空气中弥漫着机油和烧焦线路的味道。
老乔（60岁，半边脸是金属义体）正把玩着一个发光的芯片。

老乔
你确定要读这个？这可是军用级的加密。一旦触发，那帮公司狗五分钟内就会定位到这里。

凯
我没有选择，乔。我每晚都做同样的梦。梦里的大火，还有这个...
（凯指了指自己的机械臂）
它在呼唤我。

老乔叹了口气，将芯片插入读取器。
全息屏幕瞬间弹出一串红色的代码。

老乔
见鬼...这是“伊卡洛斯”计划的源代码。小子，你惹大麻烦了。

突然，店门被巨大的冲击力轰开。烟尘中，两个全副武装的“公司清扫者”走了进来。

清扫者A
目标确认。编号K-9。回收或者销毁。

凯猛地掀翻桌子，抓起一把等离子扳手。

凯
乔，快走！

第2集：地下逃亡

内景。地下废弃地铁站 - 连续
凯在黑暗的隧道中狂奔，呼吸急促。
身后传来沉重的机械脚步声和激光扫射的声音。
一道激光擦过他的脸颊，留下一道焦痕。

凯
（对着通讯器）
艾娃，你在吗？我需要路线图！快！

艾娃（画外音，电子合成音）
正在入侵城市监控网络...左转，跳进通风井。那是唯一的盲区。

凯毫不犹豫地撞向左侧锈迹斑斑的通风口栅栏。
他滚进狭窄的通道，身后传来巨大的爆炸声，入口被碎石封死。

内景。通风管道 - 昏暗
凯在管道中艰难爬行。老鼠受惊四散。
他的机械手臂开始剧烈震动，指示灯疯狂闪烁。

凯
（咬牙切齿）
别在这个时候掉链子...

突然，他的视野中出现了一段不属于他的记忆画面：
（闪回）
一个白色的实验室。
一个穿着白大褂的女人温柔地抚摸着他的头。
女人：凯，你是人类进化的钥匙。不要让他们夺走你的“心”。
（闪回结束）

凯猛地停下，大口喘气。汗水滴落在金属地板上。

凯
那个人...是谁？

内景。黑客据点“死角” - 夜晚
这是一个由废弃集装箱改造的秘密基地。
满墙的屏幕显示着城市的各个角落。
艾娃（全息投影形象，蓝发少女）看着浑身是伤的凯。

艾娃
你的心率超过180了。还有，那两个清扫者是“荒坂”公司的精英。他们不会停手的。

凯
他们想要这个芯片。乔说这是“伊卡洛斯”计划。

艾娃
（震惊）
伊卡洛斯？那个传说中能赋予AI真正“意识”的代码？天哪，凯，你到底是谁？

凯
我也想知道。但我得先活下去。

第3集：核心重启

外景。能源塔顶层 - 暴雨夜
狂风呼啸，暴雨如注。
凯站在城市最高点，面前是巨大的能源核心反应堆。
清扫者首领（全身重型装甲）拦在唯一的出口。

首领
把手伸出来，K-9。你只是个实验品。你没有灵魂。

凯看着自己的机械手，雨水顺着指尖滑落。
记忆的碎片在他脑海中重组。他终于看清了那个白大褂女人的脸——那是他的母亲。

凯
（眼神变得坚定）
我不是实验品。我有名字。

凯猛地将从老乔那里拿回的芯片插入了自己的手臂接口。
一股巨大的蓝色能量波从他体内爆发出来。
周围的雨水仿佛静止了一秒。

凯
我是... 凯！

他抬起手，一道耀眼的电磁脉冲（EMP）直接轰向首领。
首领的装甲瞬间瘫痪，冒出黑烟，重重地倒在地上。

内景。能源塔控制室 - 稍后
凯走进控制室，艾娃的全息影像出现在控制台上。

艾娃
你做到了...你激活了伊卡洛斯。现在，整个城市的网络都在你的掌控之中。

凯看着窗外灯火通明的城市。
他的机械手臂不再颤抖，而是散发着柔和的蓝光。

凯
这只是开始，艾娃。
我们要把真相还给这个世界。

（画面拉远，凯的背影在巨大的城市夜景中显得渺小而坚定）
（切黑）
`;

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
  
  // New State Logic for Chunking
  const [enableChunking, setEnableChunking] = useState(true);
  const [previewChunks, setPreviewChunks] = useState<string[]>([]); 
  const [chunkStatuses, setChunkStatuses] = useState<('idle' | 'loading' | 'done' | 'error')[]>([]);
  const [chunkResults, setChunkResults] = useState<(AnalysisResult | null)[]>([]);

  // Progress State
  const [progress, setProgress] = useState(0);
  const [progressStatus, setProgressStatus] = useState("");
  const [mobileView, setMobileView] = useState<'editor' | 'preview'>('editor');

  const abortControllerRef = useRef<AbortController | null>(null);
  const progressIntervalRef = useRef<number | null>(null);

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

  const handleNewProject = () => {
    if (window.confirm("确定要新建项目吗？当前的内容将会被清空。")) {
      setScript("");
      setResult(null);
      setAppState(AppState.IDLE);
      setPreviewChunks([]);
      setChunkStatuses([]);
      setChunkResults([]);
      setErrorMsg(null);
      setProgress(0);
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
    setErrorMsg("已取消分析");
    setProgress(0);
    setProgressStatus("");
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

  // STEP 1: PREPARE / SPLIT
  const handlePrepare = () => {
    if (!script.trim()) return;
    
    setMobileView('preview');
    setErrorMsg(null);
    setResult(null);

    // If Chunking Disabled, go straight to analyze
    if (!enableChunking) {
       handleAnalyzeFull();
       return;
    }

    // Split script
    const chunks = smartSplitScript(script);
    setPreviewChunks(chunks);
    setChunkStatuses(new Array(chunks.length).fill('idle'));
    setChunkResults(new Array(chunks.length).fill(null));
    setAppState(AppState.PREVIEW_CHUNKS);
  };

  // STEP 2A: ANALYZE ALL (Sequential)
  const handleAnalyzeFull = async () => {
    setAppState(AppState.ANALYZING);
    setErrorMsg(null);
    setProgress(0);
    setProgressStatus("正在初始化分析引擎...");
    
    const controller = new AbortController();
    abortControllerRef.current = controller;
    const currentModel = getSelectedModel();

    if (!checkKeys(currentModel)) return;

    try {
      startSimulatedProgress(0, 20, 2000);

      const data = await analyzeScript(
        script, 
        customInstructions, 
        currentModel.id, 
        currentModel.provider,
        userKeys,
        (prog, msg) => {
           if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
           setProgress(prog);
           setProgressStatus(msg);
           startSimulatedProgress(prog, Math.min(prog + 15, 99), 5000);
        },
        controller.signal,
        enableChunking // Pass toggle state
      );
      
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
      setProgress(100);
      setProgressStatus("分析完成！");
      setTimeout(() => {
        setResult(data);
        setAppState(AppState.COMPLETE);
      }, 500);

    } catch (err: any) {
      handleError(err);
    } finally {
      abortControllerRef.current = null;
    }
  };

  // STEP 2B: ANALYZE SINGLE CHUNK
  const handleAnalyzeChunk = async (index: number) => {
    const newStatuses = [...chunkStatuses];
    newStatuses[index] = 'loading';
    setChunkStatuses(newStatuses);

    const controller = new AbortController();
    abortControllerRef.current = controller; // Only supports one active request for now
    const currentModel = getSelectedModel();

    if (!checkKeys(currentModel)) {
      newStatuses[index] = 'idle';
      setChunkStatuses([...newStatuses]);
      return;
    }

    try {
      const chunkText = previewChunks[index];
      // Note: Single chunk analysis might miss context from previous chunks in this manual mode
      // unless we chain them. For now, we treat it as isolated or simplistic for manual review.
      
      const data = await analyzeScript(
        chunkText, 
        customInstructions, 
        currentModel.id, 
        currentModel.provider,
        userKeys,
        undefined,
        controller.signal,
        false // Do not split again
      );

      const updatedResults = [...chunkResults];
      updatedResults[index] = data;
      setChunkResults(updatedResults);

      const updatedStatuses = [...chunkStatuses];
      updatedStatuses[index] = 'done';
      setChunkStatuses(updatedStatuses);
      
    } catch (err: any) {
      console.error(err);
      const updatedStatuses = [...chunkStatuses];
      updatedStatuses[index] = 'error';
      setChunkStatuses(updatedStatuses);
    } finally {
      abortControllerRef.current = null;
    }
  };
  
  const handleMergeAll = () => {
    // Filter out nulls
    const validResults = chunkResults.filter(r => r !== null) as AnalysisResult[];
    if (validResults.length === 0) return;
    try {
      const merged = mergeAnalysisResults(validResults);
      setResult(merged);
      setAppState(AppState.COMPLETE);
    } catch (e) {
      alert("合并失败，无有效数据");
    }
  };

  const checkKeys = (model: ModelConfig) => {
    if (model.provider !== 'google') {
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
    }
    return true;
  };

  const handleError = (err: any) => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    if (err.name === 'AbortError' || err.message === '分析已取消') return;
    console.error(err);
    setErrorMsg(err.message || "分析失败，请检查网络设置或重试。");
    setAppState(AppState.ERROR);
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
    const headers = ['集数', '场号', '镜头编号', '景别', '运镜', '生图提示词(Prompt)', '环境', '人物与动作', '台词', '时长'];
    let rows: string[] = [];
    if (result.episodes && result.episodes.length > 0) {
      rows = result.episodes.flatMap(ep => ep.scenes.flatMap(scene => scene.shots.map(shot => 
        [`"${ep.title || ep.id}"`, `"${scene.header.replace(/"/g, '""')}"`, shot.id, shot.shotSize, shot.cameraAngle, `"${shot.visualDescription.replace(/"/g, '""')}"`, `"${shot.environment.replace(/"/g, '""')}"`, `"${(shot.characters + ' ' + shot.action).replace(/"/g, '""')}"`, `"${(shot.dialogue || '').replace(/"/g, '""')}"`, shot.duration].join(',')
      )));
    } else {
       rows = result.scenes.flatMap(scene => scene.shots.map(shot => 
        [`"第1集"`, `"${scene.header.replace(/"/g, '""')}"`, shot.id, shot.shotSize, shot.cameraAngle, `"${shot.visualDescription.replace(/"/g, '""')}"`, `"${shot.environment.replace(/"/g, '""')}"`, `"${(shot.characters + ' ' + shot.action).replace(/"/g, '""')}"`, `"${(shot.dialogue || '').replace(/"/g, '""')}"`, shot.duration].join(',')
      ));
    }
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

  // Stats Logic
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
    const items = result.episodes ? result.episodes.flatMap(e => e.scenes) : result.scenes;
    items.forEach(scene => {
      totalShots += scene.shots.length;
      totalDuration += scene.shots.reduce((acc, shot) => acc + parseDuration(shot.duration), 0);
    });
    return { totalShots, totalDuration };
  }, [result]);

  return (
    <div className="relative h-screen w-screen bg-[#0f172a] overflow-hidden text-slate-200 font-sans flex flex-col selection:bg-indigo-500/30 selection:text-white">
      <div className="fixed top-[-10%] left-[-10%] w-[60vw] h-[60vw] bg-indigo-900/20 rounded-full blur-[120px] pointer-events-none opacity-40 mix-blend-screen" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[60vw] h-[60vw] bg-blue-900/10 rounded-full blur-[120px] pointer-events-none opacity-40 mix-blend-screen" />
      <SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} userKeys={userKeys} onSave={handleSaveKeys} />

      <div className="flex flex-col h-full p-2 md:p-6 gap-3 md:gap-4 z-10 relative">
        {/* Header */}
        <header className="px-4 py-3 md:py-0 md:h-16 rounded-2xl bg-white/[0.03] backdrop-blur-xl border border-white/5 flex flex-col md:flex-row md:items-center justify-between shrink-0 shadow-sm gap-3 md:gap-0">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-br from-indigo-500 to-blue-600 p-2 rounded-lg shadow-lg shadow-indigo-500/20">
                 <Clapperboard className="text-white" size={18} />
              </div>
              <div className="flex flex-col">
                <h1 className="font-semibold text-lg tracking-tight text-white leading-none">Script2Video</h1>
                <span className="text-[10px] text-slate-400 font-medium tracking-wide mt-0.5">PRO PRODUCTION TOOL</span>
              </div>
            </div>
            {/* New Project Button (Mobile) */}
             <button onClick={handleNewProject} className="md:hidden p-2 text-slate-400 hover:text-white" title="新建项目">
                <FolderPlus size={18} />
             </button>
             <button onClick={() => setShowSettings(true)} className="md:hidden p-2 text-slate-400 hover:text-white">
               <Settings size={18} />
            </button>
          </div>
          
          <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 w-full md:w-auto">
            {appState === AppState.ERROR && (
              <div className="flex items-center gap-2 text-red-200 text-xs bg-red-500/20 px-3 py-2 rounded-lg border border-red-500/20">
                <AlertTriangle size={14} /> <span title={errorMsg || ""}>{errorMsg}</span>
              </div>
            )}
            
            <div className="flex items-center gap-2 w-full md:w-auto">
              {/* Chunking Toggle */}
              <button 
                onClick={() => setEnableChunking(!enableChunking)}
                className={`hidden md:flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium border transition-colors ${enableChunking ? 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' : 'bg-white/5 border-white/10 text-slate-500'}`}
                title="开启智能分块以处理长剧本"
              >
                {enableChunking ? <ToggleRight size={16} className="text-indigo-400" /> : <ToggleLeft size={16} />}
                <span>智能分块</span>
              </button>

               {/* New Project Button (Desktop) */}
               <button onClick={handleNewProject} className="hidden md:block p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400 transition-colors" title="新建项目">
                <FolderPlus size={16} />
              </button>

              <div className="relative group flex-1 md:flex-none">
                <div className="flex items-center gap-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 px-3 py-2 rounded-xl transition-all w-full md:min-w-[180px]">
                  {getProviderIcon(getSelectedModel().provider)}
                  <select 
                    className="bg-transparent border-none outline-none appearance-none text-xs font-medium text-slate-200 cursor-pointer w-full"
                    value={selectedModelId}
                    onChange={(e) => setSelectedModelId(e.target.value)}
                    disabled={appState === AppState.ANALYZING}
                  >
                    {MODELS.map(model => (
                      <option key={model.id} value={model.id} className="bg-[#1e293b]">{model.name}</option>
                    ))}
                  </select>
                  <ChevronDown size={12} className="text-slate-500 absolute right-3" />
                </div>
              </div>

              <button onClick={() => setShowSettings(true)} className="hidden md:block p-2.5 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 text-slate-400" title="设置">
                <Settings size={16} />
              </button>

              {appState === AppState.ANALYZING ? (
                <button onClick={handleStopAnalysis} className="flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-medium bg-red-500/10 text-red-300 border border-red-500/20">
                  <Square size={14} fill="currentColor" /> <span>停止</span>
                </button>
              ) : (
                <button
                  onClick={handlePrepare}
                  disabled={!script.trim()}
                  className={`flex-1 md:flex-none flex items-center justify-center gap-2 px-5 py-2 rounded-xl text-sm font-medium transition-all ${
                    !script.trim() ? 'bg-white/5 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-900/20'
                  }`}
                >
                  <Play size={16} fill="currentColor" /> <span>{enableChunking ? "解析剧本" : "直接生成"}</span>
                </button>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 flex flex-col md:flex-row gap-4 overflow-hidden min-h-0 relative">
          {/* Left Panel */}
          <div className={`w-full md:w-[38%] md:min-w-[320px] md:max-w-[500px] flex flex-col transition-all duration-300 absolute md:relative inset-0 ${mobileView === 'editor' ? 'z-20 translate-x-0 opacity-100' : 'z-0 -translate-x-full md:translate-x-0 opacity-0 md:opacity-100'}`}>
            <ScriptEditor script={script} setScript={setScript} customInstructions={customInstructions} setCustomInstructions={setCustomInstructions} isAnalyzing={appState === AppState.ANALYZING} />
          </div>

          {/* Right Panel */}
          <div className={`flex-1 flex flex-col min-w-0 bg-white/[0.02] backdrop-blur-xl border border-white/5 rounded-2xl shadow-2xl relative overflow-hidden transition-all duration-300 absolute md:relative inset-0 ${mobileView === 'preview' ? 'z-20 translate-x-0 opacity-100' : 'z-0 translate-x-full md:translate-x-0 opacity-0 md:opacity-100'}`}>
            
            {/* View: PREVIEW CHUNKS */}
            {appState === AppState.PREVIEW_CHUNKS && (
               <div className="flex flex-col h-full animate-fade-in">
                 <div className="px-6 py-4 border-b border-white/5 flex justify-between items-center bg-white/[0.01]">
                   <h3 className="text-white font-semibold flex items-center gap-2">
                     <Layers size={18} className="text-indigo-400"/> 剧本分块预览
                   </h3>
                   <div className="flex gap-2">
                     <button onClick={() => { setAppState(AppState.IDLE); setPreviewChunks([]); }} className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-white/5 hover:bg-white/5">返回</button>
                     <button onClick={handleAnalyzeFull} className="text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-500 shadow-lg shadow-indigo-900/20">全量生成 ({previewChunks.length}块)</button>
                   </div>
                 </div>
                 <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
                    <p className="text-xs text-slate-400">检测到长剧本，已智能切分为 {previewChunks.length} 个部分。您可以逐个分析或一键全量生成。</p>
                    {previewChunks.map((chunk, idx) => (
                      <div key={idx} className="bg-white/[0.03] border border-white/5 rounded-xl p-4 flex flex-col gap-3 group hover:border-indigo-500/30 transition-colors">
                        <div className="flex justify-between items-start">
                           <div className="flex items-center gap-2">
                              <span className="text-xs font-mono font-bold text-slate-500 bg-black/20 px-2 py-1 rounded">PART {idx + 1}</span>
                              <span className="text-xs text-slate-400">{chunk.length} 字符</span>
                              {chunkStatuses[idx] === 'done' && <CheckCircle2 size={14} className="text-emerald-400" />}
                              {chunkStatuses[idx] === 'error' && <AlertTriangle size={14} className="text-red-400" />}
                           </div>
                           <button 
                             onClick={() => handleAnalyzeChunk(idx)}
                             disabled={chunkStatuses[idx] === 'loading'}
                             className="text-[10px] bg-white/5 hover:bg-white/10 border border-white/5 px-2.5 py-1.5 rounded-lg text-slate-300 transition-colors flex items-center gap-1"
                           >
                             {chunkStatuses[idx] === 'loading' ? <Loader2 size={12} className="animate-spin"/> : <Play size={12}/>}
                             分析此块
                           </button>
                        </div>
                        <div className="text-[10px] text-slate-500 font-mono bg-black/20 p-2 rounded-lg line-clamp-3">
                          {chunk.slice(0, 150)}...
                        </div>
                        {chunkResults[idx] && (
                          <div className="text-xs text-emerald-400 flex items-center gap-1">
                             <CheckCircle2 size={12}/> 已生成 {chunkResults[idx]?.scenes.length} 个场景
                          </div>
                        )}
                      </div>
                    ))}
                    {chunkResults.some(r => r !== null) && (
                       <button onClick={handleMergeAll} className="w-full py-3 mt-4 bg-emerald-600/20 border border-emerald-500/30 text-emerald-400 rounded-xl hover:bg-emerald-600/30 transition-colors font-medium text-xs flex items-center justify-center gap-2">
                         <Layers size={14}/> 合并所有已完成的分块
                       </button>
                    )}
                 </div>
               </div>
            )}

            {/* View: RESULT or EMPTY */}
            {appState !== AppState.PREVIEW_CHUNKS && (
              <>
                <div className="h-14 border-b border-white/5 flex items-center justify-between px-4 md:px-6 bg-white/[0.01] shrink-0">
                  <div className="flex items-center gap-4 overflow-x-auto no-scrollbar">
                    <div className="flex items-center p-1 bg-black/20 rounded-lg border border-white/5 shrink-0">
                      <button onClick={() => setActiveTab('storyboard')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'storyboard' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                        <Layout size={14} /> 分镜表
                      </button>
                      <button onClick={() => setActiveTab('assets')} className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${activeTab === 'assets' ? 'bg-white/10 text-white' : 'text-slate-500 hover:text-slate-300'}`}>
                        <Layers size={14} /> 资产库
                      </button>
                    </div>
                    {result && (
                      <div className="hidden sm:flex items-center gap-3 animate-fade-in pl-2 border-l border-white/5 shrink-0">
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-xs text-indigo-300 font-mono"><Hash size={12} /><span>{stats.totalShots} 镜头</span></div>
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/5 text-xs text-blue-300 font-mono"><Clock size={12} /><span>{formatDuration(stats.totalDuration)}</span></div>
                      </div>
                    )}
                  </div>
                  {result && (
                    <button onClick={handleExport} className="flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-white px-3 py-1.5 rounded-lg hover:bg-white/5 transition-colors shrink-0">
                      <Download size={14} /> <span className="hidden sm:inline">导出 CSV</span>
                    </button>
                  )}
                </div>

                <div className="flex-1 overflow-hidden p-3 md:p-6 relative">
                  {appState === AppState.ANALYZING && (
                    <div className="absolute inset-0 bg-[#0f172a]/80 z-20 flex flex-col items-center justify-center backdrop-blur-sm animate-fade-in">
                      <div className="flex flex-col items-center p-8 text-center">
                          <div className="relative mb-6">
                            <div className="absolute inset-0 bg-indigo-500/30 blur-xl rounded-full animate-pulse"></div>
                            <Sparkles size={40} className="text-indigo-400 relative z-10 animate-bounce-slow" />
                          </div>
                          <h3 className="text-lg font-medium text-white mb-2">AI 正在构建视觉方案</h3>
                          <p className="text-slate-400 text-xs tracking-wide text-center max-w-[200px]">正在使用 {getSelectedModel().name} 解析剧本...</p>
                          <div className="w-64 h-1.5 bg-white/10 rounded-full mt-6 overflow-hidden relative">
                            <div className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}>
                              <div className="absolute inset-0 bg-white/30 animate-[shimmer_2s_infinite]" style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}></div>
                            </div>
                          </div>
                          <p className="text-[10px] text-slate-500 mt-3 font-mono">{progressStatus || "初始化中..."} ({Math.round(progress)}%)</p>
                      </div>
                    </div>
                  )}

                  {result ? (
                    activeTab === 'storyboard' ? <StoryboardTable scenes={result.scenes} onUpdateShot={handleUpdateShot} /> : <AssetPanel data={result} />
                  ) : (
                      <div className="flex flex-col items-center justify-center h-full text-slate-500/60 pb-10 px-4 text-center">
                        <div className="w-20 h-20 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center mb-6 shadow-xl transform -rotate-2">
                            <Clapperboard size={40} className="text-white/20" />
                        </div>
                        <h3 className="text-lg font-medium text-slate-300 mb-2">准备就绪</h3>
                        <p className="text-sm max-w-xs text-center text-slate-500 leading-relaxed">请在{mobileView === 'editor' ? '上方' : '"剧本"标签页'}输入内容，点击"解析剧本"查看分块。</p>
                      </div>
                  )}
                </div>
              </>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default App;
