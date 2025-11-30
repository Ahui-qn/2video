
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, UserKeys, LLMProvider, CharacterProfile, AssetProfile, Episode } from "../types";

// --- Schema Definition ---
const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING, description: "Suggested title of the script (in Chinese)" },
    synopsis: { type: Type.STRING, description: "A one-sentence summary (in Chinese)" },
    characters: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Character Name" },
          visualSummary: { type: Type.STRING, description: "Detailed physical appearance (hair, clothes, face) used for image generation prompts. (in Simplified Chinese)" },
          traits: { type: Type.STRING, description: "Character traits (in Chinese)" }
        },
        required: ["name", "visualSummary", "traits"]
      }
    },
    assets: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING },
          description: { type: Type.STRING, description: "Visual description of the prop or location (in Simplified Chinese)" },
          type: { type: Type.STRING, enum: ["Prop", "Location"] }
        },
        required: ["name", "description", "type"]
      }
    },
    episodes: {
      type: Type.ARRAY,
      description: "List of Episodes found in the script. If no episode header is found, create one default episode.",
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING, description: "Episode Number (e.g. '1')" },
          title: { type: Type.STRING, description: "Episode Title (e.g. '第1集')" },
          scenes: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                sceneId: { type: Type.STRING },
                header: { type: Type.STRING, description: "Scene header (e.g. 内景 卧室 - 白天)" },
                shots: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      shotSize: { type: Type.STRING, description: "e.g., 特写, 全景, 航拍 (in Chinese)" },
                      cameraAngle: { type: Type.STRING, description: "e.g., 仰视, 移动镜头 (in Chinese)" },
                      visualDescription: { type: Type.STRING, description: "STRICT FORMULA: [景别] + [主体] + [环境] + [光影]. MUST BE CHINESE." },
                      environment: { type: Type.STRING, description: "Brief environment context (in Chinese)" },
                      characters: { type: Type.STRING, description: "Characters present in shot (in Chinese)" },
                      action: { type: Type.STRING, description: "Specific action occurring (in Chinese)" },
                      dialogue: { type: Type.STRING, description: "VERBATIM dialogue. If it is an internal monologue (OS), start with 【内心OS】." },
                      duration: { type: Type.STRING, description: "Estimated duration (e.g. '3s')" }
                    },
                    required: ["id", "shotSize", "cameraAngle", "visualDescription", "environment", "characters", "action", "duration"]
                  }
                }
              },
              required: ["sceneId", "header", "shots"]
            }
          }
        },
        required: ["id", "title", "scenes"]
      }
    }
  },
  required: ["title", "characters", "episodes"]
};

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
    // Ensure scenes exist for UI compatibility (Flatten episodes from Schema structure)
    if (res.episodes && (!res.scenes || res.scenes.length === 0)) {
       res.scenes = res.episodes.flatMap((e: any) => e.scenes || []);
    }
    return res as AnalysisResult;
  } catch (e) {
    console.error("JSON Parse Error. Raw string:", jsonString);
    throw new Error("Failed to parse the structured data. The model returned invalid JSON.");
  }
}

// Retry helper
async function retry<T>(fn: () => Promise<T>, retries = 1, delay = 1000): Promise<T> {
  try {
    return await fn();
  } catch (error: any) {
    if (error.name === 'AbortError' || error.message?.includes('aborted') || error.message?.includes('取消')) {
      throw error;
    }
    const msg = error.toString().toLowerCase();
    if (msg.includes("401") || msg.includes("403") || msg.includes("key")) throw error;
    if (retries <= 0) throw error;
    console.warn(`API call failed, retrying... (${retries} left). Error: ${error.message}`);
    await new Promise(resolve => setTimeout(resolve, delay));
    return retry(fn, retries - 1, delay * 2);
  }
}

// System Instruction
const getSystemInstruction = (customInstructions?: string, isJsonMode = false) => {
  let userConstraintBlock = "";
  
  if (customInstructions && customInstructions.trim()) {
    userConstraintBlock = `
    ================================================================
    *** 用户最高优先级指令 (PRIME DIRECTIVE) ***
    用户定义了硬性约束，你必须数学级精确地遵守这些数值。
    
    用户指令: "${customInstructions}"
    
    [执行指南]:
    1. **语速计算**: 使用提供的 "语速" (默认 4字/秒) 来计算时长。 时长 = 字数 / 语速 + 1秒缓冲。
    2. **台词拆分 (关键)**: 如果某句台词过长导致单镜时长超标，你必须将其拆分为多个镜头。
       - 镜头A: 说话人画面 (特写/中景)。
       - 镜头B: 听话人反应镜头，或物体空镜头，此时台词作为画外音继续。
       - 严禁删减台词，必须逐字保留。
    3. **总数控制**: 通过合并或拆分镜头来逼近目标总数。
    ================================================================
    `;
  }

  let instruction = `
    ${userConstraintBlock}

    你是一位专家级电影导演、摄影指导和剪辑师。
    你的任务是将原始剧本转换为结构化的制作分镜表，直接用于 AI 视频生成。
    
    ### 核心规则 (不可协商):
    1. **数据零丢失 (CRITICAL):** 你必须 100% 保留所有对话。严禁总结、截断或省略任何口语台词。
    2. **语言:** 所有输出字段（动作、环境、景别等）必须是 **简体中文**。
    
    3. **AI 画面提示词 (visualDescription):** 
       - **语言:** 必须使用 **简体中文** (Simplified Chinese)。
       - **强制公式:** 你必须严格遵守以下顺序：
         "[景别/镜头角度] + [主体描述] + [环境/背景] + [光影/风格]"
       
       - **资产注入与一致性 (关键):** 
         - **主体:** 如果镜头中出现角色（例如“凯”），你必须查找资产表中的 'visualSummary' 并填入此处（例如“凯（20岁男子，机械手臂，凌乱短发）”）。不要每次都重新发明外貌。
         - **环境:** 如果场景头与上一镜相同，[环境] 部分必须保持一致。
         - **起手式:** 永远以景别开头（例如“特写镜头，...”、“广角镜头，...”）。
         - **示例:** "中景镜头，凯（20岁男子，机械手臂），正在大口吃面，赛博朋克拉面店背景，窗外霓虹雨，电影感布光，青橙色调。"
    
    4. **内心独白:** 如果台词是内心想法（标注为 OS, V.O. 或心声），必须在台词前加 '【内心OS】'。
    5. **空镜头:** 如果剧本描述了风景或沉默，请创建 'dialogue' 为空的镜头。

    ### 结构与集数:
    - **检测集数:** 寻找 "第1集", "Episode 1", "Chapter 1" 等标题。
    - 输出结构为 **Episodes -> Scenes -> Shots**。
    - 如果剧本包含多集，请将其分开。如果未发现集数标题，默认归入 "第1集"。

    ### 格式:
    - 时长格式: "3s", "1.5s"。
  `;

  if (isJsonMode) {
    instruction += `
    \n### OUTPUT FORMAT
    You must output ONLY valid JSON. 
    Do not include markdown formatting like \`\`\`json.
    The JSON structure must match this schema exactly:
    {
      "title": "string",
      "synopsis": "string",
      "characters": [{ "name": "string", "visualSummary": "string", "traits": "string" }],
      "assets": [{ "name": "string", "description": "string", "type": "Prop" | "Location" }],
      "episodes": [{
        "id": "string",
        "title": "string",
        "scenes": [{
          "sceneId": "string",
          "header": "string",
          "shots": [{
            "id": "string",
            "shotSize": "string",
            "cameraAngle": "string",
            "visualDescription": "string (CHINESE ONLY: [景别]+[主体]+[环境]+[光影])",
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

// --- Google Provider (REST API ONLY) ---

const callGoogleRawFetch = async (
  text: string,
  apiKey: string,
  modelId: string,
  customInstructions?: string,
  baseUrl?: string,
  signal?: AbortSignal
) => {
  let rootUrl = baseUrl || "https://generativelanguage.googleapis.com";
  rootUrl = rootUrl.replace(/\/+$/, '');
  
  if (rootUrl.endsWith('/models')) rootUrl = rootUrl.replace('/models', '');
  if (rootUrl.endsWith('/v1beta')) rootUrl = rootUrl.replace('/v1beta', '');

  const url = `${rootUrl}/v1beta/models/${modelId}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [{
      role: 'user',
      parts: [{ text }]
    }],
    systemInstruction: {
      parts: [{ text: getSystemInstruction(customInstructions, true) }]
    },
    generationConfig: {
      responseMimeType: "application/json",
      temperature: 0.2
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal
  });

  if (!response.ok) {
    const errText = await response.text();
    if (response.status === 404) throw new Error("404 Model Not Found. Check your Proxy URL or Model ID.");
    if (response.status === 429) throw new Error("429 Quota Exceeded.");
    throw new Error(`Google API Error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const textContent = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!textContent) throw new Error("Google AI returned empty content.");
  return cleanAndParseJSON(textContent);
};


const callGoogle = async (
  text: string, 
  customInstructions?: string, 
  modelId: string = "gemini-2.5-flash", 
  userKeys?: UserKeys,
  signal?: AbortSignal
) => {
  const apiKey = userKeys?.google || process.env.API_KEY;
  if (!apiKey) throw new Error("Google API Key not found.");
  return callGoogleRawFetch(text, apiKey, modelId, customInstructions, userKeys?.googleBaseUrl, signal);
};

// --- Open Compatible Provider ---
const callOpenAICompatible = async (
  provider: LLMProvider,
  apiKey: string,
  text: string,
  modelId: string,
  customInstructions?: string,
  baseUrl?: string,
  signal?: AbortSignal
) => {
  let url = baseUrl;
  
  if (!url) {
    if (provider === 'deepseek') url = 'https://api.deepseek.com/chat/completions';
    else if (provider === 'openai') url = 'https://api.openai.com/v1/chat/completions';
    else if (provider === 'moonshot') url = 'https://api.moonshot.cn/v1/chat/completions';
  } else {
    if (!url.endsWith('/chat/completions')) url = url.replace(/\/+$/, '') + '/chat/completions';
  }
  
  const systemPrompt = getSystemInstruction(customInstructions, true);
  const isDeepSeek = provider === 'deepseek';
  const isKimi = provider === 'moonshot';
  
  const payload: any = {
    model: modelId,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text }
    ],
    temperature: 0.2,
    max_tokens: 8000
  };

  if (!isDeepSeek && !isKimi) {
    payload.response_format = { type: "json_object" };
  }
  
  payload.messages[0].content += "\n\nENSURE OUTPUT IS RAW VALID JSON. NO MARKDOWN.";
  
  const response = await fetch(url!, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify(payload),
    signal
  });

  const responseText = await response.text();

  if (!response.ok) {
    if (response.status === 401) throw new Error(`${provider.toUpperCase()} 认证失败`);
    if (response.status === 429) throw new Error(`${provider.toUpperCase()} 额度不足`);
    throw new Error(`${provider.toUpperCase()} API Error (${response.status})`);
  }

  let data;
  try {
    data = JSON.parse(responseText);
  } catch (e) {
     throw new Error("Failed to parse API response JSON.");
  }

  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("AI returned empty message content.");
  
  return cleanAndParseJSON(content);
};

// --- Smart Chunking Logic for Long Scripts (EPISODE PRIORITY + LOGGING) ---

const CHUNK_SIZE_LIMIT = 1500; 

function smartSplitScript(text: string): string[] {
  console.log(`[SmartSplit] 开始切分剧本。总字数: ${text.length}`);
  
  // 1. Split by Episode Boundaries
  const episodeBoundaryRegex = /(?=^(?:第\s*\d+\s*[集章]|Episode\s*\d+|Chapter\s*\d+))/m;
  const rawEpisodes = text.split(episodeBoundaryRegex);

  const finalChunks: string[] = [];

  rawEpisodes.forEach((rawEp, index) => {
    const epText = rawEp.trim();
    if (!epText) return;

    console.log(`[SmartSplit] 处理第 ${index + 1} 个集块，长度: ${epText.length}`);

    // If a single episode is still too huge, split it internally
    if (epText.length > CHUNK_SIZE_LIMIT) {
       console.log(`[SmartSplit] -> 集块过长 (> ${CHUNK_SIZE_LIMIT})，执行内部场景切分...`);
       const internalChunks = splitInternal(epText);
       console.log(`[SmartSplit] -> 内部切分为 ${internalChunks.length} 个小块。`);
       finalChunks.push(...internalChunks);
    } else {
       console.log(`[SmartSplit] -> 集块长度合适，保留为单块。`);
       finalChunks.push(epText);
    }
  });

  console.log(`[SmartSplit] 切分完成。总计 ${finalChunks.length} 个请求块。`);
  return finalChunks;
}

// Sub-splitter for internal scene breaking
function splitInternal(text: string): string[] {
  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = "";

  const sceneHeaderRegex = /^(?:INT\.|EXT\.|内景|外景|日景|夜景|场景|Scene|第.+场)/i;

  for (const line of lines) {
    if (currentChunk.length + line.length > CHUNK_SIZE_LIMIT) {
       // Priority: Split at a Scene Header
       if (sceneHeaderRegex.test(line.trim())) {
         if (currentChunk.trim()) chunks.push(currentChunk);
         currentChunk = line + "\n";
         continue;
       }
       
       // Fallback: Paragraph break
       if (line.trim() === '' && currentChunk.length > CHUNK_SIZE_LIMIT - 100) {
          if (currentChunk.trim()) chunks.push(currentChunk);
          currentChunk = "\n"; 
          continue;
       }

       // Hard limit
       if (currentChunk.length > CHUNK_SIZE_LIMIT + 200) {
          if (currentChunk.trim()) chunks.push(currentChunk);
          currentChunk = line + "\n";
          continue;
       }
    }
    currentChunk += line + "\n";
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk);
  }

  return chunks;
}

function mergeAnalysisResults(results: AnalysisResult[]): AnalysisResult {
  if (results.length === 0) throw new Error("No results to merge");
  
  const merged: AnalysisResult = {
    title: results[0].title,
    synopsis: results[0].synopsis,
    characters: [],
    assets: [],
    scenes: [],
    episodes: []
  };

  const charMap = new Map<string, CharacterProfile>();
  const assetMap = new Map<string, AssetProfile>();
  const epMap = new Map<string, Episode>();

  results.forEach(res => {
    // Merge Episodes
    if (res.episodes) {
      res.episodes.forEach(ep => {
        const epId = ep.id.replace(/\D/g, '') || ep.id; 
        
        if (epMap.has(epId)) {
          const existingEp = epMap.get(epId)!;
          existingEp.scenes.push(...ep.scenes);
        } else {
          epMap.set(epId, ep);
          if (merged.episodes) merged.episodes.push(ep);
        }
      });
    }

    if (res.characters) {
      res.characters.forEach(c => {
        if (!charMap.has(c.name)) charMap.set(c.name, c);
      });
    }

    if (res.assets) {
      res.assets.forEach(a => {
        if (!assetMap.has(a.name)) assetMap.set(a.name, a);
      });
    }
  });

  merged.characters = Array.from(charMap.values());
  merged.assets = Array.from(assetMap.values());

  // Flatten final scenes for UI compatibility
  if (merged.episodes) {
    merged.scenes = merged.episodes.flatMap(e => e.scenes);
  }

  return merged;
}

// ... (Utils for balance check remain same)
export const getDeepSeekBalance = async (apiKey: string, customBaseUrl?: string) => {
  let rootUrl = "https://api.deepseek.com";
  if (customBaseUrl) {
    rootUrl = customBaseUrl.replace(/\/chat\/completions\/?$/, '').replace(/\/+$/, '');
  }
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

// --- Main Export ---
export const analyzeScript = async (
  scriptText: string, 
  customInstructions?: string, 
  modelId: string = "gemini-2.5-flash", 
  provider: LLMProvider = 'google', 
  userKeys?: UserKeys,
  onProgress?: (progress: number, message: string) => void,
  signal?: AbortSignal
): Promise<AnalysisResult> => {

  const chunks = smartSplitScript(scriptText);
  const results: AnalysisResult[] = [];

  // ROLLING CONTEXT CONTAINERS
  const establishedCharacters: CharacterProfile[] = [];
  const establishedAssets: AssetProfile[] = [];

  for (let i = 0; i < chunks.length; i++) {
    if (signal?.aborted) throw new Error("分析已取消");
    
    const baseProgress = Math.round(((i) / chunks.length) * 100);
    
    if (onProgress) {
        onProgress(baseProgress, `正在分析第 ${i + 1} / ${chunks.length} 部分...`);
    }
    
    // --- BUILD DYNAMIC PROMPT FOR CHUNK ---
    let chunkInstructions = customInstructions || "";
    
    // Inject Rolling Context (Assets found so far)
    if (i > 0) {
       chunkInstructions += `\n\n================================================`;
       chunkInstructions += `\n*** 上下文回忆 (CONTEXT RECALL) ***`;
       chunkInstructions += `\n这是剧本的第 ${i+1} 部分。它可能是新的一集，或者是上一集的继续。`;
       
       if (establishedCharacters.length > 0 || establishedAssets.length > 0) {
           chunkInstructions += `\n\n*** 已确立的资产 (关键) ***`;
           chunkInstructions += `\n你必须复用以下已有的视觉定义，确保人物和场景外观一致。不要发明新的描述。`;
           
           const contextData = {
               existingCharacters: establishedCharacters.map(c => ({ name: c.name, visualSummary: c.visualSummary })),
               existingLocationsAndProps: establishedAssets.map(a => ({ name: a.name, description: a.description }))
           };
           chunkInstructions += `\n${JSON.stringify(contextData, null, 2)}`;
       }
       chunkInstructions += `\n================================================\n`;
    }

    const makeRequest = async () => {
      // Prompt injection: Explicitly tell model to focus on THIS chunk
      const scopedText = `Analyze THIS specific part of the script only. Do not hallucinate previous or future parts.\n\n[SCRIPT PART START]\n${chunks[i]}\n[SCRIPT PART END]`;

      if (provider === 'google') {
        return await callGoogle(scopedText, chunkInstructions, modelId, userKeys, signal);
      } else {
        let key = '';
        let baseUrl = undefined;
        
        switch(provider) {
          case 'deepseek': 
            key = userKeys?.deepseek || ''; 
            baseUrl = userKeys?.deepseekBaseUrl; 
            break;
          case 'openai': key = userKeys?.openai || ''; break;
          case 'moonshot': key = userKeys?.moonshot || ''; break;
        }
        
        if (!key) throw new Error(`请配置 ${provider.toUpperCase()} API Key`);
        
        return await callOpenAICompatible(provider, key, scopedText, modelId, chunkInstructions, baseUrl, signal);
      }
    };

    try {
      const result = await retry(makeRequest);
      results.push(result);

      // --- UPDATE ROLLING CONTEXT ---
      if (result.characters) {
          result.characters.forEach(newChar => {
              if (!establishedCharacters.find(c => c.name === newChar.name)) {
                  establishedCharacters.push(newChar);
              }
          });
      }
      if (result.assets) {
          result.assets.forEach(newAsset => {
              if (!establishedAssets.find(a => a.name === newAsset.name)) {
                  establishedAssets.push(newAsset);
              }
          });
      }
      
      if (onProgress) {
         onProgress(Math.round(((i + 1) / chunks.length) * 100), `完成第 ${i + 1} 部分，整理中...`);
      }

      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 800)); 
      }

    } catch (error: any) {
       if (error.name === 'AbortError' || error.message?.includes('取消') || error.message?.includes('aborted')) {
          throw error;
       }
       console.error(`Error processing chunk ${i + 1}:`, error);
       throw error;
    }
  }

  if (onProgress) onProgress(100, "正在合并最终结果...");
  return mergeAnalysisResults(results);
};
