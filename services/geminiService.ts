
import { GoogleGenAI } from "@google/genai";

// Utility to convert File to base64 string
const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => {
      const base64String = (reader.result as string).split(',')[1];
      resolve(base64String);
    };
    reader.onerror = error => reject(error);
  });
};

export const generateColoringPage = async (
  photos: File[],
  description: string
): Promise<string> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  // Base instructions for the model - Reinforced for strict B&W and high stability
  const systemContext = `You are a professional coloring book artist. 
  
  CRITICAL RULE: STICK TO THE USER'S DESCRIPTION. 
  Do NOT add any themes, backgrounds, or costumes (like space, pirates, or forests) unless explicitly mentioned in the USER REQUEST.
  Your task is to take the user's specific scene and render it as a coloring page.
  
  OUTPUT RULES:
  1. COLOR: NO COLOR ALLOWED. Only pure black and white.
  2. STYLE: Clean, bold black outlines (line art). 
  3. NO SHADING: No shadows, no grays, no gradients, no textures. Just white background and black lines.
  4. SUBJECT: Wholesome and child-appropriate.
  5. COMPOSITION: Use provided @img references to map facial features of real people to the characters.
  6. QUALITY: High contrast, professional lines.
  7. NO TEXT: No letters or UI elements.`;

  const parts: any[] = [{ text: `${systemContext}\n\nUSER REQUEST: ${description}` }];
  
  for (let i = 0; i < photos.length; i++) {
    const base64Data = await fileToBase64(photos[i]);
    parts.push({ text: `Reference image for subject @img${i + 1}:` });
    parts.push({
      inlineData: {
        data: base64Data,
        mimeType: photos[i].type
      }
    });
  }

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: { parts },
      config: {
        imageConfig: {
          aspectRatio: "3:4"
        }
      }
    });

    if (!response.candidates || response.candidates.length === 0) {
      throw new Error("No candidates returned from AI");
    }

    for (const part of response.candidates[0].content.parts || []) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    
    throw new Error("No image data in response candidates");
  } catch (error) {
    console.error("Gemini Image Generation Error:", error);
    throw error;
  }
};
