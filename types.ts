/**
 * types.ts - 全局类型定义
 * 
 * 这个文件定义了整个应用的核心数据结构
 * 理解这些类型是理解整个应用架构的关键
 */

/**
 * Shot - 镜头（分镜表的最小单位）
 * 
 * 一个镜头包含：
 * - 拍摄参数：景别、机位、运镜
 * - 画面内容：环境、人物、动作
 * - 台词和时长
 * - visualDescription是给AI绘图工具的提示词
 */
export interface Shot {
  id: string;
  shotSize: string;           // 景别：特写、中景、全景等
  cameraAngle: string;        // 机位：平视、俯视、仰视等
  visualDescription: string;  // AI绘图提示词（最重要的字段）
  environment: string;        // 环境描述
  characters: string;         // 出现的角色
  action: string;             // 动作描述
  dialogue: string;           // 台词
  duration: string;           // 时长（如"3s"）
  imageUrls?: string[];       // 分镜图片（可选）
}

/**
 * Project - 项目
 * 
 * 一个项目可以包含多集剧本和对应的分镜表
 * 项目数据通过WebSocket实时同步到所有协作者
 */
export interface Project {
  id: string;
  name: string;
  creator: string;
  description: string;
  coverImage: string | null;
  createdAt: number;
  updatedAt: number;
  data: AnalysisResult | null;  // AI分析结果（分镜表、角色、资产）
  episodes: ScriptEpisode[];    // 用户输入的剧本
}

/**
 * Scene - 场景
 * 
 * 一个场景包含多个连续的镜头
 * 场景标题通常格式为：内景/外景 + 地点 + 时间（如"INT. 公寓 - 夜晚"）
 */
export interface Scene {
  sceneId: string;
  header: string;  // 场景标题
  shots: Shot[];   // 该场景的所有镜头
}

/**
 * Episode - 剧集（AI分析后的结构化数据）
 * 
 * 包含该集的所有场景和镜头
 */
export interface Episode {
  id: string;
  title: string;
  scenes: Scene[];
}

/**
 * ScriptEpisode - 剧集（用户输入的原始剧本）
 * 
 * 状态流转：draft -> analyzing -> analyzed -> completed
 */
export interface ScriptEpisode {
  id: string;
  title: string;
  content: string;  // 原始剧本文本
  status: 'draft' | 'analyzing' | 'analyzed' | 'completed';
  isExpanded: boolean;  // UI状态：是否展开编辑
}

/**
 * HistoryRecord - 操作历史记录
 */
export interface HistoryRecord {
  id: string;
  timestamp: number;
  summary: string;
  user: string;
}

/**
 * CharacterProfile - 角色档案
 * 
 * 用于保持角色在不同场景中的视觉一致性
 * visualSummary会被AI用于生成分镜图
 */
export interface CharacterProfile {
  name: string;
  visualSummary: string;  // 外貌特征（发型、服装等）
  traits: string;         // 性格特征
  imageUrls?: string[];   // 参考图片
}

/**
 * AssetProfile - 资产档案（场景/道具）
 * 
 * 固定资产库：记录剧中反复出现的场景和道具
 * 确保同一场景在不同集中的描述一致
 */
export interface AssetProfile {
  name: string;
  description: string;  // 详细的视觉描述
  type: 'Prop' | 'Location';  // 道具或场景
  imageUrls?: string[];
}

/**
 * AnalysisResult - AI分析结果
 * 
 * 这是AI处理剧本后返回的完整数据结构
 * 包含角色、资产、场景、分镜等所有信息
 */
export interface AnalysisResult {
  title: string;
  synopsis: string;
  characters: CharacterProfile[];
  assets: AssetProfile[];
  scenes: Scene[];
  episodes?: Episode[];
}

/**
 * AppState - 应用状态枚举
 * 
 * 用于追踪AI分析的进度
 */
export enum AppState {
  IDLE = 'IDLE',                              // 空闲
  EXTRACTING_CONTEXT = 'EXTRACTING_CONTEXT',  // 正在提取全局资产
  ANALYZING = 'ANALYZING',                    // 正在分析剧集
  COMPLETE = 'COMPLETE',                      // 完成
  ERROR = 'ERROR'                             // 错误
}

/**
 * LLMProvider - 支持的AI模型提供商
 */
export type LLMProvider = 'google' | 'deepseek' | 'openai' | 'moonshot';

/**
 * ModelConfig - AI模型配置
 */
export interface ModelConfig {
  id: string;
  name: string;
  provider: LLMProvider;
}

/**
 * UserKeys - 用户的API密钥配置
 * 
 * 支持用户使用自己的API密钥和代理地址
 */
export interface UserKeys {
  google?: string;
  googleBaseUrl?: string;
  deepseek?: string;
  deepseekBaseUrl?: string;
  openai?: string;
  moonshot?: string;
}
