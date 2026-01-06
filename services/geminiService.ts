
import { GoogleGenAI, Type } from "@google/genai";
import { Question, QuestionType } from "../types";
import { isMock } from "../firebaseConfig";

const getAI = () => {
  const apiKey = import.meta.env.VITE_GOOGLE_API_KEY;
  if (!apiKey) {
    console.error("VITE_GOOGLE_API_KEY is missing in environment variables.");
    throw new Error("API Key is missing. Please configure VITE_GOOGLE_API_KEY.");
  }
  return new GoogleGenAI({ apiKey });
};

// Robust ID generator fallback
const generateId = () => Date.now().toString(36) + Math.random().toString(36).substr(2, 5);

export const generateQuestionsWithAI = async (
  classNum: string,
  subject: string,
  topic: string,
  questionType: string,
  count: number,
  marks: number,
  styleContext?: {
    text: string,
    attachment?: { data: string, mimeType: string },
    syllabusAttachment?: { data: string, mimeType: string }
  }
): Promise<Question[]> => {

  if (isMock) {
    return Array(count).fill(0).map((_, i) => ({
      id: Date.now().toString() + i,
      type: questionType as QuestionType,
      text: `Mock Question ${i + 1} for ${topic} (${questionType})`,
      marks: marks,
      options: questionType === QuestionType.MCQ ? ["Option A", "Option B", "Option C", "Option D"] : [],
      matchPairs: questionType === QuestionType.MATCH ? [{ left: "A", right: "1" }, { left: "B", right: "2" }] : [],
      answer: "Mock Answer",
      topic: topic
    }));
  }

  const ai = getAI();

  const systemInstruction = `You are an expert CBSE (Central Board of Secondary Education, India) and NCERT curriculum specialist. 
  Your task is to create strictly academic, high-quality question papers that adhere to the latest CBSE guidelines.
  
  Target Audience: Class ${classNum} Students (${subject}).
  Topic: ${topic}.
  
  CORE PRINCIPLES:
  1. STRICT CURRICULUM ADHERENCE: All questions must be within the scope of NCERT textbooks for Class ${classNum}.
  2. ACADEMIC RIGOR: Questions should test conceptual understanding, application, and critical thinking, not just rote memory.
  3. DIAGRAMS: If a question requires a diagram (e.g., "Draw the human eye", "Circuit diagram", "Geometry construction"), you MUST provide a description for the diagram in the 'imagePrompt' field.
  
  FORMATTING RULES:
  1. STRICTLY use LaTeX for ALL math expressions, wrapped in $...$ (e.g., $x^2 + y^2 = r^2$).
  2. For chemical formulas, use standard text or LaTeX (e.g., $H_2SO_4$).
  3. Keep the language formal, clear, and unambiguous.

  Return ONLY valid JSON.`;

  let promptText = `Generate ${count} "${questionType}" questions.
  Marks per question: ${marks}.
  
  For MCQs: Include 4 distinct options and the correct answer.
  For Match the Following: Provide 4-5 pairs. The 'right' column in the question should be shuffled. Provide the key in 'answer'.
  For Assertion-Reason: Follow standard CBSE format (Two statements, 4 standard options).
  
  AUTOMATIC DIAGRAMS:
  If a question implies a visual element (e.g., "Identify the label...", "Draw the structure...", "Find area of figure..."), you MUST set the 'imagePrompt' field with a detailed description of the image needed.
  Example: "Line diagram of a human heart with main chambers labeled."
  
  ${styleContext?.text ? `\nREFERENCE CONTEXT:\n${styleContext.text}` : ''}

  Response Format:
  [
    {
      "text": "Question text...",
      "options": ["A", "B", "C", "D"], // For MCQ
      "matchPairs": [{ "left": "...", "right": "..." }], // For Match
      "answer": "Correct answer or marking scheme",
      "imagePrompt": "Optional description for AI image generator"
    }
  ]`;

  // Specific handling for Assertion-Reason to ensure standard options
  if (questionType === QuestionType.ASSERTION_REASON) {
    promptText += `\nFor Assertion-Reason questions, use this exact format for 'text':
      Assertion (A): ...
      Reason (R): ...
      
      And these exact options:
      (A) Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A).
      (B) Both Assertion (A) and Reason (R) are true but Reason (R) is not the correct explanation of Assertion (A).
      (C) Assertion (A) is true but Reason (R) is false.
      (D) Assertion (A) is false but Reason (R) is true.`;
  }

  // Build the contents array
  const contents = [];

  // 1. Add Sample Paper (Style Guide)
  if (styleContext?.attachment) {
    contents.push({
      inlineData: {
        data: styleContext.attachment.data,
        mimeType: styleContext.attachment.mimeType
      }
    });
  }

  // 2. Add Syllabus (Scope Guide)
  if (styleContext?.syllabusAttachment) {
    contents.push({
      inlineData: {
        data: styleContext.syllabusAttachment.data,
        mimeType: styleContext.syllabusAttachment.mimeType
      }
    });
  }

  // 3. Add the text prompt
  contents.push({ text: promptText });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: contents },
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              text: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              matchPairs: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    left: { type: Type.STRING },
                    right: { type: Type.STRING }
                  }
                }
              },
              answer: { type: Type.STRING },
              imagePrompt: { type: Type.STRING }
            },
            required: ["text", "answer"]
          }
        }
      }
    });

    const rawData = response.text;
    if (!rawData) throw new Error("Empty response from AI");

    let parsedData;
    try {
      parsedData = JSON.parse(rawData);
    } catch (e) {
      console.error("JSON Parse Error", rawData);
      throw new Error("Failed to parse AI response");
    }

    // Process questions and generate images if needed
    const processedQuestions = await Promise.all(parsedData.map(async (q: any) => {
      let imageUrl = undefined;
      let imageWidth = undefined;

      // Automatic Image Generation Trigger
      if (q.imagePrompt && q.imagePrompt.length > 5) {
        try {
          imageUrl = await generateImageForQuestion(q.imagePrompt);
          imageWidth = 50; // Default width percentage
        } catch (imgErr) {
          console.error("Auto image generation failed for:", q.imagePrompt);
        }
      }

      return {
        id: generateId(),
        type: questionType as QuestionType,
        text: q.text,
        marks: marks,
        options: q.options || [],
        matchPairs: q.matchPairs || [],
        answer: q.answer,
        topic: topic,
        imageUrl: imageUrl,
        imageWidth: imageWidth
      };
    }));

    return processedQuestions;

  } catch (error) {
    console.error("AI Generation Error", error);
    throw error;
  }
};

export const generateImageForQuestion = async (promptText: string): Promise<string> => {
  if (isMock) return `https://placehold.co/400x300?text=Mock+Diagram`;
  const ai = getAI();

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: {
        parts: [{ text: `Create a clear, high-contrast, educational black and white line diagram for a school question paper. Subject: ${promptText}. Do not include text in the image if possible, or keep it minimal.` }]
      },
    });

    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    return `https://placehold.co/400x300?text=Diagram+Placeholder`;

  } catch (e) {
    console.error("Image gen failed", e);
    // Return a visible placeholder so user knows it failed rather than crashing
    return `https://placehold.co/400x300?text=Image+Generation+Error`;
  }
}