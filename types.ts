
export interface Shot {
  id: string;
  shotSize: string; // e.g., Close-up, Wide
  cameraAngle: string; // e.g., Low angle, Tracking
  visualDescription: string; // The Prompt
  environment: string;
  characters: string; // Who is in the shot
  action: string;
  dialogue: string;
  duration: string; // e.g., "3s"
  imageUrls?: string[]; // For storyboard images
}

export interface Project {
  id: string;
  name: string;
  creator: string;
  description: string;
  coverImage: string | null;
  createdAt: number;
  updatedAt: number;
  data: AnalysisResult | null; // Persist the analysis result with the project
  episodes: ScriptEpisode[]; // Persist episodes
}

export interface Scene {
  sceneId: string;
  header: string; // e.g., EXT. STREET - NIGHT
  shots: Shot[];
}

export interface Episode {
  id: string;
  title: string;
  scenes: Scene[];
}

export interface ScriptEpisode {
  id: string;
  title: string;
  content: string;
  status: 'draft' | 'analyzing' | 'analyzed' | 'completed';
  isExpanded: boolean;
}

export interface HistoryRecord {
  id: string;
  timestamp: number;
  summary: string;
  user: string;
}

export interface CharacterProfile {
  name: string;
  visualSummary: string; // For consistency (hair, clothes)
  traits: string;
  imageUrls?: string[]; // Changed from single imageUrl to array
}

export interface AssetProfile {
  name: string;
  description: string;
  type: 'Prop' | 'Location';
  imageUrls?: string[]; // Changed from single imageUrl to array
}

export interface AnalysisResult {
  title: string;
  synopsis: string;
  characters: CharacterProfile[];
  assets: AssetProfile[];
  scenes: Scene[];
  episodes?: Episode[];
}

export enum AppState {
  IDLE = 'IDLE',
  EXTRACTING_CONTEXT = 'EXTRACTING_CONTEXT', // New: Extracting from full script
  ANALYZING = 'ANALYZING', // Analyzing the specific episode
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR'
}

export type LLMProvider = 'google' | 'deepseek' | 'openai' | 'moonshot';

export interface ModelConfig {
  id: string;
  name: string;
  provider: LLMProvider;
}

export interface UserKeys {
  google?: string;         // Custom Google Key
  googleBaseUrl?: string;  // Custom Google Proxy URL
  deepseek?: string;
  deepseekBaseUrl?: string;
  openai?: string; // For GPT-4o
  moonshot?: string; // For Kimi
}
