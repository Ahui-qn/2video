
import { AnalysisResult, UserKeys, LLMProvider, CharacterProfile, AssetProfile, Episode, Scene, Shot } from "../types";
import { GoogleGenAI } from "@google/genai";

// --- Helper: Clean and Parse JSON ---
function cleanAndParseJSON(text: string): AnalysisResult {
  let cleanText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '');

  const firstBrace = cleanText.indexOf('{');
  const lastBrace = cleanText.lastIndexOf('}');
  
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("No JSON object found in response.");
  }

  const jsonString = cleanText.substring(firstBrace, lastBrace + 1);

  try {
    const res = JSON.parse(jsonString);
    
    // Ensure lists exist
    if (!res.scenes) res.scenes = [];
    if (!res.episodes) res.episodes = [];
    
    return res as AnalysisResult;
  } catch (e) {
    console.error("JSON Parse Error. Raw string:", jsonString);
    throw new Error("Failed to parse the structured data. The model returned invalid JSON.");
  }
}

// Helper: Enforce Duration Constraints via Code
function enforceConstraints(result: AnalysisResult, customInstructions?: string): AnalysisResult {
  if (!customInstructions) return result;

  // 1. Parse constraints
  const rateMatch = customInstructions.match(/语速≈(\d+)字\/秒/);
  const wordsPerSecond = rateMatch ? parseInt(rateMatch[1]) : 6;

  // 2. Iterate and fix
  if (result.episodes) {
    result.episodes.forEach(ep => {
      ep.scenes.forEach(scene => {
        scene.shots.forEach(shot => {
          // Fix Duration based on Dialogue
          if (shot.dialogue && shot.dialogue.trim() !== "" && shot.dialogue !== "（无台词）") {
             const charCount = shot.dialogue.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, "").length; // Count effective chars
             const calculatedDuration = Math.max(1, Math.ceil(charCount / wordsPerSecond));
             shot.duration = `${calculatedDuration}s`;
          } else {
             // Default for action shots if missing
             if (!shot.duration || shot.duration === "0s") shot.duration = "2s";
          }
        });
      });
    });
  }
  return result;
}

// Retry helper
async function retry<T>(fn: () => Promise<T>, retries = 2, delay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('取消')) {
      throw error;
    }
    const msg = error.toString().toLowerCase();
    if (msg.includes("401") || msg.includes("403") || msg.includes("invalid key")) throw error;
    
    if (retries <= 0) throw error;
    
    console.warn(`API call failed, retrying... (${retries} left). Error: ${error.message}`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2);
  }
}

// System Instruction
const getSystemInstruction = (customInstructions?: string, isJsonMode = false, isAssetExtractionOnly = false) => {
  let userConstraintBlock = "";
  
  if (customInstructions && customInstructions.trim()) {
    userConstraintBlock = `
    *** 用户核心硬性约束 (CRITICAL) ***
    ${customInstructions}
    
    [特别强调]:
    1. **台词拆分 (Split Dialogue)**: 如果一句台词按照设定语速计算超过了 "单镜头上限"，你必须将这句台词拆分为多个镜头！
       - 镜头A: 说话人特写 (前半句)
       - 镜头B: 听话人反应镜头/过肩镜头 (后半句)
    2. **时长计算**: 请严格根据 "台词字数 / 语速" 估算 duration。
    `;
  }

  // --- MODE 1: GLOBAL ASSET EXTRACTION (The Bible) ---
  if (isAssetExtractionOnly) {
    return `
    你是一位资深电影美术指导和AI提示词专家。
    你的任务是通读整个剧本，建立一个【全局资产库】。

    ### 任务目标：
    1. **提取核心角色**：只提取主要角色。
    2. **提取固定场景 (Fixed Assets)**：识别剧中反复出现的关键场景（如“主角公寓”、“飞船驾驶舱”、“秘密基地”）。
    3. **生成画面描述 (Vital)**：
       - 对于每个场景/道具，生成一段详细的画面描述。
       - **语言**: 简体中文。
       - 包含：色调 (Lighting/Palette)、材质 (Material)、氛围 (Atmosphere)、建筑风格 (Style)。
       - **不要**包含人物动作，只描述静态环境。
    
    ### 输出格式 (JSON Only):
    {
      "title": "剧本标题",
      "synopsis": "简短梗概",
      "characters": [
        { "name": "角色名", "visualSummary": "外貌关键词 (中文)", "traits": "性格关键词" }
      ],
      "assets": [
         { 
           "name": "场景/物品名 (e.g. 凯的公寓)", 
           "description": "详细的画面描述 (中文) (e.g. 赛博朋克风格公寓，电线杂乱，窗外有全息广告，霓虹蓝粉色调，电影感打光)", 
           "type": "Location" | "Prop" 
         }
      ]
    }
    `;
  }

  // --- MODE 2: EPISODE STORYBOARD GENERATION ---
  let instruction = `
    ${userConstraintBlock}

    你是一位专家级导演。任务是将剧本片段转化为分镜表。
    
    ### 核心逻辑 (Context Aware):
    你将被提供一个【全局资产库】(Global Asset Library)。
    1. **识别固定资产**：每当你处理一个场景（Scene Header）时，检查它是否在【全局资产库】中。
    2. **强制引用**：如果场景存在于资产库中，**必须**提取该资产的 \`description\` 作为该镜头 \`visualDescription\` 的基础背景，并结合当前的剧情动作。
    3. **语言统一**：如果引用了英文的资产描述，请务必**翻译成中文**再放入分镜表。

    ### 制作规则:
    1. **数据零丢失**: 保留所有台词。
    2. **语言**: **严格使用简体中文**。所有输出字段（包括 visualDescription, action, environment, shotSize, cameraAngle）都必须是中文。
    3. **AI 画面提示词 (visualDescription)**:
       - **必须全中文**。
       - 格式: "[景别] + [主体动作] + [固定资产环境描述] + [光影]"
       - 即使是固定场景，也要根据剧情微调（例如：白天/夜晚，战损状态）。
       - 角色只写名字。
    
    4. **结构**: 输出必须包含 episodes 数组，即使只有一集。
  `;

  if (isJsonMode) {
    instruction += `
    \n### OUTPUT FORMAT
    JSON Only. No Markdown.
    Schema:
    {
      "episodes": [{
        "id": "string",
        "title": "string", // 必须填写，例如 "第1集"
        "scenes": [{
          "sceneId": "string",
          "header": "string",
          "shots": [{
            "id": "string",
            "shotSize": "string",
            "cameraAngle": "string",
            "visualDescription": "string",
            "environment": "string",
            "characters": "string",
            "action": "string",
            "dialogue": "string",
            "duration": "string"
          }]
        }]
      }]
    }
    `;
  }

  return instruction;
};

// --- Generic Call Helper ---
const performLLMCall = async (
  provider: LLMProvider,
  modelId: string,
  userKeys: UserKeys | undefined,
  systemPrompt: string,
  userPrompt: string,
  signal?: AbortSignal
) => {
  if (provider === 'google') {
    // Use @google/genai SDK
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    const response = await ai.models.generateContent({
      model: modelId,
      contents: userPrompt,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: 0.2,
      },
    });

    const textContent = response.text;
    if (!textContent) throw new Error("Google AI returned empty content.");
    return cleanAndParseJSON(textContent);
  } else {
    // Other providers
    let key = '';
    let baseUrl = undefined;
    switch(provider) {
      case 'deepseek': key = userKeys?.deepseek || ''; baseUrl = userKeys?.deepseekBaseUrl; break;
      case 'openai': key = userKeys?.openai || ''; break;
      case 'moonshot': key = userKeys?.moonshot || ''; break;
    }
    if (!key) throw new Error(`请配置 ${provider.toUpperCase()} API Key`);

    let url = baseUrl;
    if (!url) {
      if (provider === 'deepseek') url = 'https://api.deepseek.com/chat/completions';
      else if (provider === 'openai') url = 'https://api.openai.com/v1/chat/completions';
      else if (provider === 'moonshot') url = 'https://api.moonshot.cn/v1/chat/completions';
    } else {
      if (!url.endsWith('/chat/completions')) url = url.replace(/\/+$/, '') + '/chat/completions';
    }

    const payload: any = {
      model: modelId,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.2,
      max_tokens: 8000
    };
    if (provider !== 'deepseek' && provider !== 'moonshot') payload.response_format = { type: "json_object" };
    payload.messages[0].content += "\n\nENSURE OUTPUT IS RAW VALID JSON. NO MARKDOWN.";

    const response = await fetch(url!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(payload),
      signal
    });

    const responseText = await response.text();
    if (!response.ok) throw new Error(`${provider.toUpperCase()} API Error (${response.status})`);
    
    const data = JSON.parse(responseText);
    return cleanAndParseJSON(data.choices?.[0]?.message?.content);
  }
};


// --- 1. Extract Assets Only (Step 1) ---
export const extractAssetsOnly = async (
  fullScript: string,
  customInstructions: string,
  modelId: string,
  provider: LLMProvider,
  userKeys?: UserKeys,
  signal?: AbortSignal
): Promise<AnalysisResult> => {
  const systemPrompt = getSystemInstruction(customInstructions, true, true);
  const userPrompt = `
  [任务]: 分析完整剧本。提取角色和固定资产（场景/道具）。为每个资产生成高质量的**中文**画面描述。
  
  [SCRIPT START]
  ${fullScript}
  [SCRIPT END]
  `;

  return await retry(() => performLLMCall(provider, modelId, userKeys, systemPrompt, userPrompt, signal));
};

// --- 2. Analyze Single Episode (Step 2) ---
export const analyzeScript = async (
  episodeScript: string, 
  customInstructions?: string, 
  modelId: string = "gemini-2.5-flash", 
  provider: LLMProvider = 'google', 
  userKeys?: UserKeys,
  onProgress?: (progress: number, message: string) => void,
  signal?: AbortSignal,
  precomputedAssets?: AnalysisResult,
): Promise<AnalysisResult> => {

  // Global Asset Context Injection
  let globalAssetContext = "";
  if (precomputedAssets) {
     globalAssetContext = `
     ================================================================
     *** 全局资产库 (GLOBAL ASSET LIBRARY) ***
     
     [核心角色]: 
     ${JSON.stringify(precomputedAssets.characters.map(c => c.name))}

     [固定场景与道具 (请使用这些描述)]: 
     ${JSON.stringify(precomputedAssets.assets)}
     
     指令: 
     检查每个场景标题。如果匹配此列表中的【场景】，
     你必须提取对应的 description 作为该镜头 visualDescription 的基础背景，并结合当前的剧情动作。
     注意：如果 description 是英文，请务必翻译成中文。
     ================================================================
     `;
  }

  const systemPrompt = getSystemInstruction(customInstructions || "", true, false);
  const userPrompt = `
  ${globalAssetContext}

  分析这集剧本并生成分镜表。输出必须是中文。
  注意：如果这集的内容有明确的“第X集”标识，请务必更新 Episode Title。
  
  [EPISODE SCRIPT START]
  ${episodeScript}
  [EPISODE SCRIPT END]
  `;

  if (onProgress) onProgress(20, "正在分析剧情与资产匹配...");
  
  let result = await retry(() => performLLMCall(provider, modelId, userKeys, systemPrompt, userPrompt, signal));
  
  // Post-Processing: Force duration constraints
  if (onProgress) onProgress(90, "正在校准镜头时长...");
  result = enforceConstraints(result, customInstructions);

  if (onProgress) onProgress(100, "完成");
  
  return {
    title: precomputedAssets?.title || result.title || "分镜分析",
    synopsis: precomputedAssets?.synopsis || result.synopsis,
    characters: precomputedAssets?.characters || result.characters,
    assets: precomputedAssets?.assets || result.assets,
    episodes: result.episodes || [],
    scenes: result.episodes?.flatMap(e => e.scenes) || result.scenes || []
  };
};

export const getDeepSeekBalance = async (apiKey: string, customBaseUrl?: string) => {
  let rootUrl = "https://api.deepseek.com";
  if (customBaseUrl) rootUrl = customBaseUrl.replace(/\/chat\/completions\/?$/, '').replace(/\/+$/, '');
  try {
    const response = await fetch(`${rootUrl}/user/balance`, {
      method: 'GET',
      headers: { 'Accept': 'application/json', 'Authorization': `Bearer ${apiKey}` }
    });
    if (!response.ok) throw new Error(`Status ${response.status}`);
    const data = await response.json();
    if (data.balance_infos && data.balance_infos.length > 0) {
      const cny = data.balance_infos.find((b: any) => b.currency === "CNY");
      return cny ? `¥${cny.total_balance}` : "可用";
    }
    return "余额信息不可用";
  } catch (e) {
    const valid = await validateKey('deepseek', apiKey, customBaseUrl);
    return valid ? "Key 有效" : "Key 无效";
  }
};

export const validateKey = async (provider: LLMProvider, apiKey: string, baseUrl?: string) => {
  if (provider === 'google') return true; 
  let url = baseUrl;
  if (!url) {
    if (provider === 'deepseek') url = 'https://api.deepseek.com';
    if (provider === 'openai') url = 'https://api.openai.com/v1';
    if (provider === 'moonshot') url = 'https://api.moonshot.cn/v1';
  } else {
     url = url.replace(/\/chat\/completions\/?$/, '').replace(/\/+$/, '');
  }
  const modelsUrl = `${url}/models`;
  try {
    const response = await fetch(modelsUrl, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    return response.ok;
  } catch (e) {
    return false;
  }
};

export function smartSplitScript(text: string): string[] {
  return [text];
}
export function mergeAnalysisResults(results: AnalysisResult[]): AnalysisResult {
    return results[0]; 
}