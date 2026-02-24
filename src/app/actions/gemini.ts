"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export async function generateContent(
    model: string,
    prompt: string,
    imageUrls: string[] = []
) {
    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            console.error("❌ GEMINI_API_KEY is missing in .env!");
            throw new Error("Google Gemini API key not found");
        }
        console.log("✅ Gemini API Key found. Model:", model);
        console.log(`[gemini] imageUrls received: ${imageUrls.length}`);

        const geminiModel = genAI.getGenerativeModel({ model });

        if (imageUrls.length > 0) {
            const imageParts = await Promise.all(imageUrls.map(async (imageUrl, idx) => {
                console.log(`[gemini] Processing image[${idx}]: starts with "${imageUrl.substring(0, 30)}..."`);

                // Case 1: base64 data URI
                if (imageUrl.startsWith("data:")) {
                    const base64Data = imageUrl.split(',')[1];
                    const mimeMatch = imageUrl.match(/data:(.*?);base64/);
                    const mimeType = mimeMatch ? mimeMatch[1] : "image/png";
                    console.log(`[gemini] image[${idx}] → base64, mimeType: ${mimeType}, data length: ${base64Data?.length}`);
                    return { inlineData: { data: base64Data, mimeType } };
                }

                // Case 2: Remote URL — fetch and convert to base64
                console.log(`[gemini] image[${idx}] → remote URL, fetching...`);
                const resp = await fetch(imageUrl);
                if (!resp.ok) {
                    console.error(`[gemini] ❌ Failed to fetch image[${idx}]: ${resp.status} ${resp.statusText}`);
                    throw new Error(`Failed to fetch image: ${resp.statusText}`);
                }
                const contentType = resp.headers.get("content-type") || "image/jpeg";
                const buf = await resp.arrayBuffer();
                const base64Data = Buffer.from(buf).toString("base64");
                console.log(`[gemini] image[${idx}] → fetched OK, mimeType: ${contentType}, base64 length: ${base64Data.length}`);
                return { inlineData: { data: base64Data, mimeType: contentType } };
            }));

            console.log(`[gemini] Sending ${imageParts.length} image(s) + text to Gemini...`);
            const parts = [{ text: prompt }, ...imageParts];
            const result = await geminiModel.generateContent(parts);
            const response = await result.response;
            console.log("[gemini] ✅ Response received (with images)");
            return { success: true, text: response.text() };
        } else {
            console.log("[gemini] Sending text-only prompt to Gemini...");
            const result = await geminiModel.generateContent(prompt);
            const response = await result.response;
            console.log("[gemini] ✅ Response received (text-only)");
            return { success: true, text: response.text() };
        }
    } catch (error: unknown) {
        console.error("Gemini API Error:", error);
        console.log("❌ Full error object:", error);

        const errorMessage = error instanceof Error ? error.message : "Unknown error occurred during generation";
        console.log("❌ Returning error message to client:", errorMessage);

        return {
            success: false,
            error: errorMessage,
        };
    }
}
