
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
                      visualDescription: { type: Type.STRING, description: "STRICT FORMULA: [Shot Size/Angle English] + [Subject Description English] + [Environment/Background English] + [Lighting/Style English]. MUST start with shot size." },
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
    *** PRIME DIRECTIVE: USER HARD CONSTRAINTS (HIGHEST PRIORITY) ***
    The user has defined strict constraints. You MUST adjust your direction to meet these numbers STRICTLY.
    
    USER INSTRUCTIONS: "${customInstructions}"
    
    [HOW TO COMPLY]:
    1. **Speaking Rate Calculation**: Use the provided "语速" (default 4 chars/sec) to calculate dialogue duration. Duration = CharacterCount / Rate + 1s buffer.
    2. **Dialogue Splitting (CRITICAL)**: If a dialogue line is too long for the "Max Shot Duration", you MUST split it into multiple shots. 
       - Shot A: Character speaking (Medium/Close-up).
       - Shot B: Reaction shot of listener, or Insert shot of object, while the dialogue continues (Voiceover/Off-screen).
       - NEVER truncate the text.
    3. **Total Count**: Combine or split shots to reach the approximate target count.
    ================================================================
    `;
  }

  let instruction = `
    ${userConstraintBlock}

    You are an expert film director, cinematographer, and strict video editor. 
    Your task is to convert a raw screenplay/script into a structured production storyboard ready for AI video generation.
    
    ### CORE RULES (NON-NEGOTIABLE):
    1. **NO DATA LOSS (CRITICAL):** You MUST preserve 100% of the dialogue. Do NOT summarize, truncate, or omit any spoken lines. 
    2. **Language:** The output fields (action, environment, shotSize, etc.) must be in **Simplified Chinese (简体中文)**.
    
    3. **Visual Prompts (STRICT FORMULA):** The 'visualDescription' field is for AI Image Generation (Midjourney/Stable Diffusion).
       - **LANGUAGE:** English ONLY.
       - **MANDATORY FORMULA:** You MUST STRICTLY follow this order:
         "[Shot Size/Camera Angle] + [Subject Description] + [Environment/Background] + [Lighting/Style]"
       
       - **ASSET INJECTION & CONSISTENCY (CRITICAL):** 
         - **Subject:** If a character (e.g., "Kai") is in the shot, you MUST look up their 'visualSummary' in the assets list and paste it here (e.g. "Kai (Young man with mechanical arm, messy hair)").
         - **Environment:** If the scene header is the same as the previous shot, the [Environment] part MUST be consistent. Do not change the background description randomly.
         - **Shot Size Start:** ALWAYS start the prompt with the visual Shot Size (e.g., "Extreme Close-up of...", "Wide angle shot of...").
    
    4. **Internal Monologue:** If a character's dialogue is an internal thought (indicated by 'OS', 'V.O.', or context), you MUST prefix the dialogue with '【内心OS】'.
    5. **B-Roll & Empty Shots:** If the script describes scenery or silence, create shots with empty 'dialogue' fields.

    ### STRUCTURE & EPISODES:
    - **Detect Episodes:** Look for headers like "第1集", "Episode 1", "Chapter 1". 
    - Structure the output as **Episodes -> Scenes -> Shots**.
    - If the script contains multiple episodes, separate them into distinct objects in the 'episodes' array.
    - If no specific episode header is found, group everything under "第1集".

    ### FORMATTING:
    - Duration format: "3s", "1.5s".
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

// --- Smart Chunking Logic for Long Scripts (EPISODE PRIORITY) ---

const CHUNK_SIZE_LIMIT = 1500; 

function smartSplitScript(text: string): string[] {
  // Regex to detect Episode headers (e.g. 第1集, Episode 01, Chapter 1)
  // We use capture group in split to Keep the delimiter, but split behaves differently in JS with capture groups.
  // Instead, we use a positive lookahead to split *before* the match, keeping the match in the next chunk.
  
  // 1. First, split by Episode Boundaries if they exist
  // The regex finds the start of an episode.
  const episodeBoundaryRegex = /(?=^(?:第\s*\d+\s*[集章]|Episode\s*\d+|Chapter\s*\d+))/m;
  
  // If no episode header is found, this will just return the whole text as one item.
  const rawEpisodes = text.split(episodeBoundaryRegex);

  const finalChunks: string[] = [];

  for (const rawEp of rawEpisodes) {
    const epText = rawEp.trim();
    if (!epText) continue;

    // If a single episode is still too huge (e.g., > 1500 chars), split it internally by scenes
    if (epText.length > CHUNK_SIZE_LIMIT) {
       finalChunks.push(...splitInternal(epText));
    } else {
       // It's a small episode (or the only part), keep it as one unit.
       finalChunks.push(epText);
    }
  }

  return finalChunks;
}

// Sub-splitter for internal scene breaking when an episode is huge
function splitInternal(text: string): string[] {
  const chunks: string[] = [];
  const lines = text.split('\n');
  let currentChunk = "";

  const sceneHeaderRegex = /^(?:INT\.|EXT\.|内景|外景|日景|夜景|场景|Scene|第.+场)/i;

  for (const line of lines) {
    // If adding this line exceeds the limit
    if (currentChunk.length + line.length > CHUNK_SIZE_LIMIT) {
       // Priority: Split at a Scene Header
       if (sceneHeaderRegex.test(line.trim())) {
         if (currentChunk.trim()) chunks.push(currentChunk);
         currentChunk = line + "\n";
         continue;
       }
       
       // Fallback: Paragraph break (empty line)
       if (line.trim() === '' && currentChunk.length > CHUNK_SIZE_LIMIT - 100) {
          if (currentChunk.trim()) chunks.push(currentChunk);
          currentChunk = "\n"; 
          continue;
       }

       // Hard limit buffer (last resort)
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
        // Normalize EP ID (e.g. "01" -> "1")
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

  // 1. Smart Split based on Episode Headers first!
  const chunks = smartSplitScript(scriptText);
  const results: AnalysisResult[] = [];

  // ROLLING CONTEXT CONTAINERS
  const establishedCharacters: CharacterProfile[] = [];
  const establishedAssets: AssetProfile[] = [];

  console.log(`Script split into ${chunks.length} chunks (Episode-aware).`);

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
       chunkInstructions += `\n*** CONTEXT RECALL (CONTINUATION) ***`;
       chunkInstructions += `\nThis is PART ${i+1} of the script. It might be a new Episode or a continuation of the previous one.`;
       
       if (establishedCharacters.length > 0 || establishedAssets.length > 0) {
           chunkInstructions += `\n\n*** ESTABLISHED ASSETS (CRITICAL) ***`;
           chunkInstructions += `\nYou MUST use these existing visual definitions for consistency. Do not invent new descriptions for these items.`;
           
           // We inject a condensed JSON of assets to save tokens while keeping visual data
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
      // Add new characters/assets to our established list if they don't exist yet
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
