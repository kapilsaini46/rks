
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

  const systemInstruction = `You are an expert CBSE (Central Board of Secondary Education, India) school teacher and question paper setter. 
  Create strictly academic, curriculum-aligned questions for Class ${classNum} ${subject}.
  Topic: ${topic}.
  
  FORMATTING RULES (IMPORTANT):
  1. STRICTLY use LaTeX formatting for ALL mathematical expressions, equations, and symbols.
  2. Enclose all LaTeX in single dollar signs ($...$).
     - Correct: $x^2 + 2x + 1 = 0$
     - Incorrect: x^2 + 2x + 1 = 0
     - Correct: $H_2O$
     - Incorrect: H2O
  3. For fractions, use $\\frac{a}{b}$.
  4. For degrees, use $^\\circ$ (e.g. $30^\\circ$).
  5. Keep it readable and professional.
  
  Return ONLY valid JSON.`;

  let promptText = `Generate ${count} "${questionType}" questions.
  Marks per question: ${marks}.
  
  For MCQs, include 4 options and the correct answer.
  For "Match the Following" type questions:
  - Provide a list of 4-5 pairs in the 'matchPairs' field.
  - 'left' is Column A, 'right' is Column B.
  - Important: In the generated question, the right column should be shuffled/jumbled so it's a puzzle. 
  - Provide the correct answer key in the 'answer' field (e.g. A-3, B-1, C-4, D-2).
  
  For other types, provide a suggested answer key or marking scheme in the 'answer' field.
  
  ${styleContext?.text ? `\nSTYLE GUIDE & SCOPE:\n${styleContext.text}` : ''}

  Response Format:
  [
    {
      "text": "Question text or instruction (e.g. 'Match the following items:')",
      "options": ["Option A", "Option B"], // Only for MCQ
      "matchPairs": [
         { "left": "Item A", "right": "Item B (Shuffled)" },
         { "left": "Item C", "right": "Item D (Shuffled)" }
      ], // Only for Match Type
      "answer": "Correct answer string"
    }
  ]`;

  // Specific handling for Assertion-Reason to ensure standard options
  if (questionType === QuestionType.ASSERTION_REASON) {
    promptText += `\nFor Assertion-Reason questions, ensure the 'text' field follows this exact format:
      Assertion (A): [assertion statement]
      Reason (R): [reason statement]
      
      IMPORTANT: Do NOT use markdown bolding (e.g. **Assertion**) in the 'text' field. Keep it plain text.
      
      Also, you MUST populate the 'options' field with these exact 4 options:
      (A) Both Assertion (A) and Reason (R) are true and Reason (R) is the correct explanation of Assertion (A).
      (B) Both Assertion (A) and Reason (R) are true but Reason (R) is not the correct explanation of Assertion (A).
      (C) Assertion (A) is true but Reason (R) is false.
      (D) Assertion (A) is false but Reason (R) is true.`;
  }

  // Build the contents array
  const contents = [];

  // 1. Add Sample Question Paper (if exists)
  if (styleContext?.attachment) {
    contents.push({
      inlineData: {
        data: styleContext.attachment.data,
        mimeType: styleContext.attachment.mimeType
      }
    });
  }

  // 2. Add Syllabus/Blueprint (if exists) - AI will use this for scope
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
              answer: { type: Type.STRING }
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

    return parsedData.map((q: any) => ({
      id: generateId(),
      type: questionType as QuestionType,
      text: q.text,
      marks: marks,
      options: q.options || [],
      matchPairs: q.matchPairs || [],
      answer: q.answer,
      topic: topic
    }));

  } catch (error) {
    console.error("AI Generation Error", error);
    // If the error is network related, maybe fallback, but mostly just rethrow for UI to handle
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
        parts: [{ text: `Create a clear, educational, black and white line diagram for this question: ${promptText}` }]
      },
    });

    // Iterate to find image part
    if (response.candidates?.[0]?.content?.parts) {
      for (const part of response.candidates[0].content.parts) {
        if (part.inlineData) {
          return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
        }
      }
    }

    // Fallback if model returns text only or fails to generate image
    return `https://placehold.co/400x300?text=Diagram+Placeholder`;

  } catch (e) {
    console.error("Image gen failed", e);
    return `https://placehold.co/400x300?text=Image+Generation+Error`;
  }
}