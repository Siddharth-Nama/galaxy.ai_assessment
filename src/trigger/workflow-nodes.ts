import { task } from "@trigger.dev/sdk/v3";
import { GoogleGenerativeAI } from "@google/generative-ai";
export { cropImageTask, extractFrameTask } from "./ffmpeg-tasks";

// Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

// 1. Define the Input Payload Type strictly
interface AIJobPayload {
    prompt: string;
    systemPrompt?: string;
    imageUrls?: string[]; // Array of Base64 strings or URLs
    model?: string;       // e.g., "gemini-1.5-flash"
    temperature?: number;
}

export const aiGenerator = task({
    id: "generate-text",
    run: async (payload: AIJobPayload) => {
        // Default to 1.5-flash if model is missing or invalid
        const modelName = payload.model || "gemini-1.5-flash";

        console.log(`🤖 [Worker] Starting AI Task using model: ${modelName}`);
        console.log(`   - Prompt length: ${payload.prompt.length}`);
        console.log(`   - Images received: ${payload.imageUrls?.length || 0}`);

        const model = genAI.getGenerativeModel({ model: modelName });

        try {
            // Prepare Content Parts for Multimodal Input
            const parts: any[] = [];

            // Add System Prompt if exists (prepend to text)
            let fullText = payload.prompt;
            if (payload.systemPrompt) {
                fullText = `System Instructions: ${payload.systemPrompt}\n\nUser Request: ${payload.prompt}`;
            }
            parts.push({ text: fullText });

            // Add Images
            if (payload.imageUrls && payload.imageUrls.length > 0) {
                for (let i = 0; i < payload.imageUrls.length; i++) {
                    const url = payload.imageUrls[i];
                    console.log(`[Worker] Processing image[${i}]: "${url.substring(0, 50)}..."`);

                    // Handle Base64
                    if (url.startsWith("data:")) {
                        const base64Data = url.split(",")[1];
                        const mimeType = url.substring(url.indexOf(":") + 1, url.indexOf(";"));
                        console.log(`[Worker] image[${i}] → base64, mimeType: ${mimeType}, data length: ${base64Data?.length}`);
                        parts.push({ inlineData: { data: base64Data, mimeType } });
                    }
                    // Handle Remote URLs (fetch them)
                    else {
                        console.log(`[Worker] image[${i}] → remote URL, fetching...`);
                        const resp = await fetch(url);
                        if (!resp.ok) {
                            console.error(`[Worker] ❌ Failed to fetch image[${i}]: ${resp.status} ${resp.statusText}`);
                            throw new Error(`Failed to fetch image: ${resp.statusText}`);
                        }
                        // Use actual content-type from response instead of hardcoding image/jpeg
                        const mimeType = resp.headers.get("content-type") || "image/jpeg";
                        const buf = await resp.arrayBuffer();
                        const base64Data = Buffer.from(buf).toString("base64");
                        console.log(`[Worker] image[${i}] → fetched OK, mimeType: ${mimeType}, base64 length: ${base64Data.length}`);
                        parts.push({ inlineData: { data: base64Data, mimeType } });
                    }
                }
            }

            console.log(`[Worker] Sending ${parts.length} parts to Gemini (1 text + ${parts.length - 1} images)...`);

            // Execute Gemini
            const result = await model.generateContent(parts);
            const response = await result.response;
            const text = response.text();
            console.log(`[Worker] ✅ Gemini responded successfully. Response length: ${text.length}`);

            return {
                success: true,
                text: text,
            };

        } catch (error) {
            console.error(`[Worker] ❌ Gemini Failed:`, error);
            throw error; // Throwing allows Trigger.dev to show it as "Failed" in dashboard
        }
    },
});
