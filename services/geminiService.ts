
import { GoogleGenAI } from "@google/genai";
import { AssetType, AssetResult } from "./assetStorage";
import { removeBackground } from "../utils/imageProcessing";

// Returns the AssetResult object containing the URL.
// Note: This service now ONLY generates. It does not check local storage. 
// Local checks are done in App.tsx before calling this.
export const getOrGenerateAsset = async (
  id: string,
  name: string,
  description: string,
  type: AssetType,
  visualPrompt?: string
): Promise<AssetResult | null> => {
    
  console.log(`[Gemini] Generating ${name} (${type})...`);
  
  try {
    // Ensure API Key is ready
    if ((window as any).aistudio) {
        const hasKey = await (window as any).aistudio.hasSelectedApiKey();
        if (!hasKey) {
            await (window as any).aistudio.openSelectKey();
        }
    }

    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const model = 'gemini-3-pro-image-preview';
    
    let prompt = "";
    let aspectRatio = "1:1";
    let needsBackgroundRemoval = false;

    // Prioritize visualPrompt if available
    const baseDesc = visualPrompt ? visualPrompt : `${name}. ${description}`;

    if (type === 'sprite') {
        prompt = `A high-quality pixel art sprite of ${baseDesc}. 
        Chibi anime style, full body, standing straight, facing forward, isolated.
        CRITICAL: The background MUST be a SOLID BRIGHT GREEN COLOR (Hex #00FF00). 
        Do not add shadows or ground effects. 
        Style: Retro 32-bit RPG style, clean outlines. Resolution: 256x256.`;
        aspectRatio = "1:1";
        needsBackgroundRemoval = true;
    } else if (type === 'portrait') {
        prompt = `A high-quality anime character portrait (Tachie) of ${baseDesc}.
        Waist-up or knee-up view. Beautiful detailed anime art style, fantasy illustration.
        CRITICAL: The background MUST be a SOLID BRIGHT GREEN COLOR (Hex #00FF00).
        Lighting: Soft cinematic lighting.`;
        aspectRatio = "9:16"; 
        needsBackgroundRemoval = true;
    } else if (type === 'background') {
        prompt = `A beautiful fantasy landscape background for a game. Theme: ${baseDesc}. 
        Style: High quality anime background art, Makoto Shinkai style, detailed, atmospheric.
        No characters in the scene.`;
        aspectRatio = "3:4"; 
        needsBackgroundRemoval = false; 
    }

    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [{ text: prompt }],
      },
      config: {
        imageConfig: {
          aspectRatio: aspectRatio,
          imageSize: '1K',
        },
      },
    });

    let rawDataUrl: string | null = null;
    if (response.candidates?.[0]?.content?.parts) {
        for (const part of response.candidates[0].content.parts) {
            if (part.inlineData && part.inlineData.data) {
                const base64String = part.inlineData.data;
                const mimeType = part.inlineData.mimeType || 'image/png';
                rawDataUrl = `data:${mimeType};base64,${base64String}`;
                break;
            }
        }
    }

    if (!rawDataUrl) {
        throw new Error("No image data returned from API");
    }

    // 3. Post-Processing
    let finalDataUrl = rawDataUrl;
    if (needsBackgroundRemoval) {
        finalDataUrl = await removeBackground(rawDataUrl);
    }

    // Return as 'isLocal: false' so the UI knows it's new
    return { url: finalDataUrl, isLocal: false };

  } catch (error) {
    console.error(`Generation failed for ${name} (${type}):`, error);
    return null;
  }
};