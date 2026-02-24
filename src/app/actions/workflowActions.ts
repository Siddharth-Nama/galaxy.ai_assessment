"use server";

import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { tasks, runs } from "@trigger.dev/sdk/v3";
import type { SaveWorkflowParams } from "@/lib/types";
import { saveWorkflowSchema } from "@/lib/schemas";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";
import sharp from "sharp";
import ffmpegPath from "ffmpeg-static";
import { exec } from "child_process";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { promisify } from "util";

const execAsync = promisify(exec);
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

// ---- Inline Crop Image (sharp — no Trigger.dev needed) ----
async function cropImageInline(
    imageUrl: string,
    xPercent: number,
    yPercent: number,
    widthPercent: number,
    heightPercent: number
): Promise<string> {
    console.log(`[cropImageInline] Fetching image: ${imageUrl.substring(0, 80)}`);
    const resp = await fetch(imageUrl);
    if (!resp.ok) throw new Error(`Failed to fetch image: ${resp.statusText}`);
    const buffer = Buffer.from(await resp.arrayBuffer());

    const img = sharp(buffer);
    const meta = await img.metadata();
    const W = meta.width || 100;
    const H = meta.height || 100;

    const left   = Math.round(W * xPercent / 100);
    const top    = Math.round(H * yPercent / 100);
    const width  = Math.round(W * widthPercent / 100);
    const height = Math.round(H * heightPercent / 100);

    console.log(`[cropImageInline] Cropping ${W}x${H} → left:${left} top:${top} w:${width} h:${height}`);
    const cropped = await img.extract({ left, top, width, height }).png().toBuffer();
    const base64 = cropped.toString("base64");
    console.log(`[cropImageInline] ✅ Done. Output base64 length: ${base64.length}`);
    return `data:image/png;base64,${base64}`;
}

// ---- Inline Extract Frame (ffmpeg-static — no Trigger.dev needed) ----
async function extractFrameInline(videoUrl: string, timestamp: number): Promise<string> {
    console.log(`[extractFrameInline] Extracting frame at ${timestamp}s from: ${videoUrl.substring(0, 80)}`);
    const tmpDir = os.tmpdir();
    const outputPath = path.join(tmpDir, `frame-${Date.now()}.jpg`);
    const bin = ffmpegPath || "ffmpeg";

    await execAsync(`"${bin}" -y -ss ${timestamp} -i "${videoUrl}" -frames:v 1 -q:v 2 "${outputPath}"`);
    const buf = await fs.readFile(outputPath);
    const base64 = buf.toString("base64");
    await fs.unlink(outputPath).catch(() => {});
    console.log(`[extractFrameInline] ✅ Done. Output base64 length: ${base64.length}`);
    return `data:image/jpeg;base64,${base64}`;
}


// Helper to ensure User exists in our DB before acting
async function ensureUserExists(userId: string) {
    const dbUser = await prisma.user.findUnique({
        where: { id: userId },
    });

    if (!dbUser) {
        const clerkUser = await currentUser();
        if (!clerkUser) throw new Error("User not found in Clerk");

        await prisma.user.create({
            data: {
                id: userId,
                email: clerkUser.emailAddresses[0].emailAddress,
                firstName: clerkUser.firstName,
                lastName: clerkUser.lastName,
            },
        });
    }
}

// ------------------------------------------------------------------
// SAVE ACTION
// ------------------------------------------------------------------
export async function saveWorkflowAction(params: SaveWorkflowParams) {
    console.log(`[saveWorkflowAction] 🟡 Called with id: "${params.id}", name: "${params.name}", nodes: ${params.nodes?.length}, edges: ${params.edges?.length}`);
    try {
        const user = await currentUser();
        console.log(`[saveWorkflowAction] Clerk currentUser: ${user?.id ?? "null"}`);
        if (!user) {
            console.error("[saveWorkflowAction] ❌ No user — Unauthorized");
            return { success: false, error: "Unauthorized" };
        }

        // Validate Input using Zod
        const result = saveWorkflowSchema.safeParse(params);
        if (!result.success) {
            console.error("[saveWorkflowAction] ❌ Zod validation failed:", result.error.format());
            const firstError = result.error.issues[0];
            return { success: false, error: "Invalid workflow data: " + firstError.message };
        }
        console.log("[saveWorkflowAction] ✅ Zod validation passed");

        const { id, name, nodes, edges } = result.data;

        console.log(`[saveWorkflowAction] Ensuring user "${user.id}" exists in DB...`);
        await ensureUserExists(user.id);
        console.log(`[saveWorkflowAction] ✅ ensureUserExists done`);

        const workflowData = { nodes, edges };

        if (id) {
            // UPDATE Existing
            const numericId = typeof id === "string" ? parseInt(id) : id;
            console.log(`[saveWorkflowAction] Updating Workflow ID: ${numericId}`);
            if (!numericId) return { success: false, error: "Invalid Workflow ID" };

            const workflow = await prisma.workflow.update({
                where: { id: numericId, userId: user.id },
                data: { name, data: workflowData as any },
            });
            console.log(`[saveWorkflowAction] ✅ Updated! workflow.id: ${workflow.id}`);

            revalidatePath("/workflows");
            return { success: true, id: workflow.id.toString() };
        } else {
            // CREATE New
            console.log(`[saveWorkflowAction] Creating new workflow for user: ${user.id}`);

            const workflow = await prisma.workflow.create({
                data: { name, data: workflowData as any, userId: user.id },
            });
            console.log(`[saveWorkflowAction] ✅ Created! workflow.id: ${workflow.id}`);

            revalidatePath("/workflows");
            return { success: true, id: workflow.id.toString() };
        }
    } catch (error) {
        console.error("[saveWorkflowAction] ❌ Database Error:", error);
        console.log("[saveWorkflowAction] Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
        return { success: false, error: "Failed to save workflow." };
    }
}

// ------------------------------------------------------------------
// LOAD ACTION
// ------------------------------------------------------------------
export async function loadWorkflowAction(id: string) {
    try {
        const { userId } = await auth();
        if (!userId) return { success: false, error: "Unauthorized" };

        const workflow = await prisma.workflow.findUnique({
            where: {
                id: parseInt(id),
                userId: userId,
            },
        });

        if (!workflow) return { success: false, error: "Workflow not found" };

        // Define a type for workflow data if not already defined
        type WorkflowData = {
            nodes: unknown[];
            edges: unknown[];
        };

        return {
            success: true,
            data: workflow.data as WorkflowData,
            name: workflow.name,
        };
    } catch (error) {
        console.error("Load Error:", error);
        return { success: false, error: "Failed to load workflow." };
    }
}

// ------------------------------------------------------------------
// GET ALL ACTION
// ------------------------------------------------------------------
export async function getAllWorkflowsAction() {
    try {
        const { userId } = await auth();
        console.log(`[getAllWorkflowsAction] Fetching workflows for User: ${userId}`);

        if (!userId) {
            console.error("[getAllWorkflowsAction] No User ID found (Unauthorized)");
            return { success: false, error: "Unauthorized", workflows: [] };
        }

        const workflows = await prisma.workflow.findMany({
            where: { userId },
            orderBy: { updatedAt: "desc" },
            select: {
                id: true,
                name: true,
                updatedAt: true,
                createdAt: true,
            },
        });

        console.log(`[getAllWorkflowsAction] Found ${workflows.length} workflows`);

        interface WorkflowSummary {
            id: string;
            name: string;
            created_at: string;
            updated_at: string;
        }

        interface PrismaWorkflow {
            id: number;
            name: string;
            createdAt: Date;
            updatedAt: Date;
        }

        const formattedWorkflows: WorkflowSummary[] = (workflows as PrismaWorkflow[]).map((wf: PrismaWorkflow) => ({
            id: wf.id.toString(),
            name: wf.name,
            created_at: wf.createdAt.toISOString(),
            updated_at: wf.updatedAt.toISOString(),
        }));

        return { success: true, workflows: formattedWorkflows };
    } catch (error) {
        console.error("Fetch Workflows Error:", error);
        return { success: false, error: "Failed to fetch workflows.", workflows: [] };
    }
}

// ------------------------------------------------------------------
// DELETE ACTION
// ------------------------------------------------------------------
export async function deleteWorkflowAction(id: string) {
    try {
        const { userId } = await auth();
        if (!userId) return { success: false, error: "Unauthorized" };

        await prisma.workflow.delete({
            where: {
                id: parseInt(id),
                userId: userId,
            },
        });

        revalidatePath("/workflows");
        return { success: true };
    } catch (error) {
        console.error("Delete Error:", error);
        return { success: false, error: "Failed to delete workflow." };
    }
}

// ------------------------------------------------------------------
// RUN ACTION (Trigger.dev)
// ------------------------------------------------------------------
export async function runWorkflowAction(workflowId: string) {
    console.log(`[runWorkflowAction] 🟡 Called with workflowId: "${workflowId}"`);

    try {
        // Step 1: Authenticate
        const { userId } = await auth();
        console.log(`[runWorkflowAction] Auth userId: ${userId}`);
        if (!userId) {
            return { success: false, error: "Unauthorized" };
        }

        // Step 2: Validate ID
        const numericId = parseInt(workflowId);
        console.log(`[runWorkflowAction] Parsed numericId: ${numericId}`);
        if (isNaN(numericId)) {
            return { success: false, error: "Invalid Workflow ID. Please save the file first." };
        }

        // Step 3: Load workflow from DB
        const workflow = await prisma.workflow.findUnique({
            where: { id: numericId, userId },
        });
        if (!workflow) return { success: false, error: "Workflow not found." };

        const graph = workflow.data as any;
        const nodes: any[] = graph.nodes || [];
        const edges: any[] = graph.edges || [];
        console.log(`[runWorkflowAction] Loaded workflow. Nodes: ${nodes.length}, Edges: ${edges.length}`);

        // Step 4: Create run record
        const run = await prisma.workflowRun.create({
            data: { workflowId: numericId, status: "RUNNING", triggerType: "MANUAL", startedAt: new Date() },
        });
        console.log(`[runWorkflowAction] ✅ WorkflowRun created! run.id: "${run.id}"`);

        // Step 5: Topological sort → execution layers
        const inDegree = new Map<string, number>();
        const adj = new Map<string, string[]>();
        nodes.forEach((n) => { inDegree.set(n.id, 0); adj.set(n.id, []); });
        edges.forEach((e) => {
            if (adj.has(e.source) && adj.has(e.target)) {
                adj.get(e.source)!.push(e.target);
                inDegree.set(e.target, (inDegree.get(e.target) || 0) + 1);
            }
        });
        const layers: any[][] = [];
        let queue = [...inDegree.entries()].filter(([, d]) => d === 0).map(([id]) => id);
        while (queue.length > 0) {
            const currentIds = [...queue];
            queue = [];
            layers.push(currentIds.map(id => nodes.find(n => n.id === id)).filter(Boolean));
            for (const id of currentIds) {
                for (const neighbor of adj.get(id) || []) {
                    inDegree.set(neighbor, (inDegree.get(neighbor) || 0) - 1);
                    if (inDegree.get(neighbor) === 0) queue.push(neighbor);
                }
            }
        }
        console.log(`[runWorkflowAction] Execution layers: ${layers.length}`);

        // Step 6: Execute layer by layer
        const context: Record<string, { text?: string; imageUrls?: string[]; videoUrl?: string }> = {};
        const PASSIVE_TYPES = new Set(["textNode", "imageNode", "videoNode"]);

        try {
            for (const [i, layer] of layers.entries()) {
                console.log(`[runWorkflowAction] Layer ${i + 1}: ${layer.length} nodes`);

                // Phase A: Passive nodes — run synchronously first so context is ready for active nodes
                for (const node of layer) {
                    if (node.type === "textNode") {
                        context[node.id] = { text: node.data.text };
                    } else if (node.type === "imageNode") {
                        const url = node.data.file?.url || node.data.image;
                        if (url) context[node.id] = { imageUrls: [url] };
                    } else if (node.type === "videoNode") {
                        const url = node.data.file?.url;
                        if (url) context[node.id] = { videoUrl: url };
                    }
                }

                // Phase B: Active nodes — run in parallel (context is already populated)
                const activeNodes = layer.filter((n: any) => !PASSIVE_TYPES.has(n.type));
                await Promise.all(activeNodes.map(async (node: any) => {

                    const execRecord = await prisma.nodeExecution.create({
                        data: { runId: run.id, nodeId: node.id, nodeType: node.type, status: "RUNNING", startedAt: new Date(), inputData: node.data }
                    });

                    try {
                        if (node.type === "llmNode") {
                            // Gather inputs from context
                            const incomingEdges = edges.filter((e: any) => e.target === node.id);
                            let systemText = "";
                            let userText = node.data.prompt || "Analyze this.";
                            const imageUrls: string[] = [];

                            for (const edge of incomingEdges) {
                                const src = context[edge.source];
                                if (!src) continue;
                                if (src.text) {
                                    if (edge.targetHandle === "system-prompt") systemText += src.text;
                                    else userText = src.text;
                                }
                                if (src.imageUrls) imageUrls.push(...src.imageUrls);
                            }

                            // Build parts and call Gemini directly
                            const modelName = node.data.model || "gemini-1.5-flash";
                            console.log(`[runWorkflowAction] LLM node ${node.id}: model=${modelName}, images=${imageUrls.length}`);
                            const geminiModel = genAI.getGenerativeModel({ model: modelName });
                            const parts: any[] = [];
                            let fullText = systemText ? `System: ${systemText}\n\nUser: ${userText}` : userText;
                            parts.push({ text: fullText });

                            for (const url of imageUrls) {
                                if (url.startsWith("data:")) {
                                    const base64Data = url.split(",")[1];
                                    const mimeType = url.substring(url.indexOf(":") + 1, url.indexOf(";"));
                                    parts.push({ inlineData: { data: base64Data, mimeType } });
                                } else {
                                    const resp = await fetch(url);
                                    const mimeType = resp.headers.get("content-type") || "image/jpeg";
                                    const buf = await resp.arrayBuffer();
                                    parts.push({ inlineData: { data: Buffer.from(buf).toString("base64"), mimeType } });
                                }
                            }

                            const result = await geminiModel.generateContent(parts);
                            const text = result.response.text();
                            console.log(`[runWorkflowAction] ✅ LLM node ${node.id} done. Response length: ${text.length}`);

                            context[node.id] = { text };
                            await prisma.nodeExecution.update({
                                where: { id: execRecord.id },
                                data: { status: "SUCCESS", finishedAt: new Date(), outputData: { text } }
                            });
                        } else if (node.type === "cropImageNode") {
                            const incomingEdges = edges.filter((e: any) => e.target === node.id);
                            let imageUrl = node.data.imageUrl;
                            for (const edge of incomingEdges) {
                                const src = context[edge.source];
                                if (src?.imageUrls?.[0]) { imageUrl = src.imageUrls[0]; break; }
                            }
                            if (!imageUrl) throw new Error("cropImageNode: no input image URL");
                            console.log(`[runWorkflowAction] cropImageNode ${node.id}: cropping...`);
                            const dataUrl = await cropImageInline(
                                imageUrl,
                                node.data.xPercent ?? 0,
                                node.data.yPercent ?? 0,
                                node.data.widthPercent ?? 100,
                                node.data.heightPercent ?? 100
                            );
                            context[node.id] = { imageUrls: [dataUrl] };
                            await prisma.nodeExecution.update({
                                where: { id: execRecord.id },
                                data: { status: "SUCCESS", finishedAt: new Date(), outputData: { url: dataUrl } }
                            });
                            console.log(`[runWorkflowAction] ✅ cropImageNode ${node.id} done`);

                        } else if (node.type === "extractFrameNode") {
                            const incomingEdges = edges.filter((e: any) => e.target === node.id);
                            let videoUrl = node.data.videoUrl;
                            for (const edge of incomingEdges) {
                                const src = context[edge.source];
                                if (src?.videoUrl) { videoUrl = src.videoUrl; break; }
                            }
                            if (!videoUrl) throw new Error("extractFrameNode: no input video URL");
                            console.log(`[runWorkflowAction] extractFrameNode ${node.id}: extracting frame...`);
                            const dataUrl = await extractFrameInline(videoUrl, node.data.timestamp ?? 0);
                            context[node.id] = { imageUrls: [dataUrl] };
                            await prisma.nodeExecution.update({
                                where: { id: execRecord.id },
                                data: { status: "SUCCESS", finishedAt: new Date(), outputData: { url: dataUrl } }
                            });
                            console.log(`[runWorkflowAction] ✅ extractFrameNode ${node.id} done`);

                        } else {
                            console.warn(`[runWorkflowAction] ⚠️ Unknown node type "${node.type}" — skipping`);
                            await prisma.nodeExecution.update({
                                where: { id: execRecord.id },
                                data: { status: "FAILED", finishedAt: new Date(), error: `Unknown node type: ${node.type}` }
                            });
                        }
                    } catch (nodeError: any) {
                        console.error(`[runWorkflowAction] ❌ Node ${node.id} failed:`, nodeError);
                        await prisma.nodeExecution.update({
                            where: { id: execRecord.id },
                            data: { status: "FAILED", finishedAt: new Date(), error: nodeError.message }
                        });
                        throw nodeError;
                    }
                }));
            }

            // All layers done
            await prisma.workflowRun.update({
                where: { id: run.id },
                data: { status: "COMPLETED", finishedAt: new Date() }
            });
            console.log(`[runWorkflowAction] ✅ Workflow run COMPLETED`);

        } catch (runError: any) {
            console.error(`[runWorkflowAction] ❌ Workflow run FAILED:`, runError);
            await prisma.workflowRun.update({
                where: { id: run.id },
                data: { status: "FAILED", finishedAt: new Date() }
            });
        }

        revalidatePath(`/workflows/${numericId}`);
        return { success: true, runId: run.id };

    } catch (error) {
        console.error("[runWorkflowAction] ❌ CRITICAL FAILURE:", error);
        return { success: false, error: "Failed to run workflow. Check server logs." };
    }
}


// ------------------------------------------------------------------
// EXECUTE SINGLE NODE ACTION (Trigger.dev)
// ------------------------------------------------------------------
export async function executeNodeAction(nodeType: string, data: any) {
    // Basic Input Validation for Node Execution
    if (!nodeType || !data) {
        return { success: false, error: "Invalid input: Missing nodeType or data" };
    }

    // Optional: Add specific schemas for node types here if needed
    // For now, we ensure basic structure is valid JSON
    try {
        JSON.stringify(data);
    } catch (e) {
        return { success: false, error: "Invalid data: Not JSON serializable" };
    }

    try {
        const user = await currentUser();
        if (!user) return { success: false, error: "Unauthorized" };
        const userId = user.id; // Define userId from the currentUser

        const workflowId = data.workflowId ? parseInt(data.workflowId) : null;
        if (!workflowId) {
            return { success: false, error: "Please save the workflow before running nodes." };
        }

        // 1. Create a "Single Node" Run Record
        const run = await prisma.workflowRun.create({
            data: {
                workflowId: workflowId,
                status: "RUNNING",
                triggerType: "SINGLE_NODE",
            }
        });

        // 2. Create the Node Execution Record
        const nodeExecution = await prisma.nodeExecution.create({
            data: {
                runId: run.id,
                nodeId: data.id || "unknown-node",
                nodeType: nodeType,
                status: "RUNNING",
                inputData: data,
                startedAt: new Date(),
            }
        });

        let taskPayload: any;
        let taskId: string;

        switch (nodeType) {
            case "llmNode":
                taskId = "generate-text";
                taskPayload = {
                    model: data.model,
                    prompt: data.prompt,
                    systemPrompt: data.systemPrompt,
                    imageUrls: data.imageUrls
                };
                break;

            case "cropImageNode":
                taskId = "crop-image";
                taskPayload = {
                    imageUrl: data.imageUrl,
                    x: data.xPercent,
                    y: data.yPercent,
                    width: data.widthPercent,
                    height: data.heightPercent
                };
                break;

            case "extractFrameNode":
                taskId = "extract-frame";
                taskPayload = {
                    videoUrl: data.videoUrl,
                    timestamp: data.timestamp
                };
                break;

            default:
                throw new Error("Unknown node type");
        }

        try {
            let output: any;

            if (nodeType === "llmNode") {
                // ✅ Call Gemini directly (no Trigger.dev worker needed)
                console.log(`[executeNodeAction] llmNode: calling Gemini directly. model=${taskPayload.model}`);
                const modelName = taskPayload.model || "gemini-1.5-flash";
                const geminiModel = genAI.getGenerativeModel({ model: modelName });

                const parts: any[] = [];

                let fullText = taskPayload.prompt || "";
                if (taskPayload.systemPrompt) {
                    fullText = `System Instructions: ${taskPayload.systemPrompt}\n\nUser Request: ${taskPayload.prompt}`;
                }
                parts.push({ text: fullText });

                if (taskPayload.imageUrls && taskPayload.imageUrls.length > 0) {
                    console.log(`[executeNodeAction] Processing ${taskPayload.imageUrls.length} image(s)...`);
                    for (const url of taskPayload.imageUrls) {
                        if (url.startsWith("data:")) {
                            const base64Data = url.split(",")[1];
                            const mimeType = url.substring(url.indexOf(":") + 1, url.indexOf(";"));
                            parts.push({ inlineData: { data: base64Data, mimeType } });
                        } else {
                            const resp = await fetch(url);
                            const mimeType = resp.headers.get("content-type") || "image/jpeg";
                            const buf = await resp.arrayBuffer();
                            parts.push({ inlineData: { data: Buffer.from(buf).toString("base64"), mimeType } });
                        }
                    }
                }

                const result = await geminiModel.generateContent(parts);
                const text = result.response.text();
                console.log(`[executeNodeAction] ✅ Gemini responded. Length: ${text.length}`);
                output = { success: true, text };

            } else if (nodeType === "cropImageNode") {
                // ✅ Call sharp directly (no Trigger.dev worker needed)
                console.log(`[executeNodeAction] cropImageNode: cropping inline...`);
                const dataUrl = await cropImageInline(
                    taskPayload.imageUrl,
                    taskPayload.x ?? 0,
                    taskPayload.y ?? 0,
                    taskPayload.width ?? 100,
                    taskPayload.height ?? 100
                );
                console.log(`[executeNodeAction] ✅ cropImageNode done`);
                output = { success: true, url: dataUrl };

            } else if (nodeType === "extractFrameNode") {
                // ✅ Call ffmpeg-static directly (no Trigger.dev worker needed)
                console.log(`[executeNodeAction] extractFrameNode: extracting frame inline...`);
                const dataUrl = await extractFrameInline(taskPayload.videoUrl, taskPayload.timestamp ?? 0);
                console.log(`[executeNodeAction] ✅ extractFrameNode done`);
                output = { success: true, url: dataUrl };

            } else {
                throw new Error(`Unknown node type: ${nodeType}`);
            }

            // Record success in DB
            await prisma.nodeExecution.update({
                where: { id: nodeExecution.id },
                data: { status: "SUCCESS", finishedAt: new Date(), outputData: output }
            });
            await prisma.workflowRun.update({
                where: { id: run.id },
                data: { status: "COMPLETED", finishedAt: new Date() }
            });

            revalidatePath(`/workflows/${workflowId}`);
            return { success: true, output };

        } catch (taskError: any) {
            console.error("[executeNodeAction] Task Execution Failed:", taskError);
            const errorMessage = taskError.message || "Unknown error";

            await prisma.nodeExecution.update({
                where: { id: nodeExecution.id },
                data: { status: "FAILED", finishedAt: new Date(), error: errorMessage }
            });
            await prisma.workflowRun.update({
                where: { id: run.id },
                data: { status: "FAILED", finishedAt: new Date() }
            });

            revalidatePath(`/workflows/${workflowId}`);
            return { success: false, error: errorMessage };
        }

    } catch (error) {
        console.error("Execute Node Error:", error);
        return { success: false, error: "Failed to execute node." };
    }
}