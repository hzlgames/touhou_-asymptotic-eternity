

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
    // Custom API Configuration
    const API_URL = "https://new.12ai.org";
    const MODEL = "gemini-2.5-flash-image";
    const API_KEY = process.env.API_KEY;

    if (!API_KEY) {
        throw new Error("API_KEY is missing in environment variables");
    }

    let prompt = "";
    let aspectRatio = "1:1";
    let needsBackgroundRemoval = false;

    // Prioritize visualPrompt if available
    const baseDesc = visualPrompt ? visualPrompt : `${name}. ${description}`;

    if (type === 'sprite') {
        // DETECT GRID REQUEST
        if (visualPrompt?.includes('GRID_3x3')) {
            prompt = `A pixel art sprite sheet of ${name}. 
            LAYOUT: 3x3 Grid.
            CONTENT: 
            - Top Row: Walking Forward (Front View) - 3 Frames.
            - Middle Row: Walking Side (Side View) - 3 Frames.
            - Bottom Row: Walking Away (Back View) - 3 Frames.
            STYLE: Retro 32-bit RPG style. Chibi anime.
            BACKGROUND: Solid Green (#00FF00).
            ${baseDesc}`;
            aspectRatio = "1:1";
        } else {
            prompt = `A high-quality pixel art sprite of ${baseDesc}. 
            Chibi anime style, full body, standing straight, facing forward, isolated.
            CRITICAL: The background MUST be a SOLID BRIGHT GREEN COLOR (Hex #00FF00). 
            Do not add shadows or ground effects. 
            Style: Retro 32-bit RPG style, clean outlines. Resolution: 256x256.`;
            aspectRatio = "1:1";
        }
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

    // Raw Fetch Implementation to support custom host and sk-xx keys
    const response = await fetch(
        `${API_URL}/v1beta/models/${MODEL}:generateContent?key=${API_KEY}`,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                    imageConfig: {
                        aspectRatio: aspectRatio,
                        imageSize: '1K',
                    },
                },
            }),
        }
    );

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`API Error ${response.status}: ${errorText}`);
    }

    const result = await response.json();
    let rawDataUrl: string | null = null;

    if (result.candidates?.[0]?.content?.parts) {
        for (const part of result.candidates[0].content.parts) {
            // Handle inlineData (Base64)
            if (part.inlineData && part.inlineData.data) {
                const base64String = part.inlineData.data;
                const mimeType = part.inlineData.mimeType || 'image/png';
                rawDataUrl = `data:${mimeType};base64,${base64String}`;
                break;
            }
            // Handle text response containing markdown image (fallback)
            if (part.text) {
                const match = part.text.match(/!\[image\]\(data:image\/[^;]+;base64,([A-Za-z0-9+/=]+)\)/);
                if (match && match[1]) {
                     rawDataUrl = `data:image/png;base64,${match[1]}`;
                     break;
                }
            }
        }
    }

    if (!rawDataUrl) {
        console.error("Full API Response:", result);
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
