"use server";

import prisma from "@/lib/prisma";
import { auth, currentUser } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";
import { tasks, runs } from "@trigger.dev/sdk/v3";
import type { SaveWorkflowParams } from "@/lib/types";
import { saveWorkflowSchema } from "@/lib/schemas";
import { z } from "zod";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");


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
            console.error("[runWorkflowAction] ❌ No userId — user is not authenticated");
            return { success: false, error: "Unauthorized" };
        }

        // Step 2: Validate ID
        const numericId = parseInt(workflowId);
        console.log(`[runWorkflowAction] Parsed numericId: ${numericId}`);
        if (isNaN(numericId)) {
            console.error(`[runWorkflowAction] ❌ Invalid Workflow ID: "${workflowId}" — NaN after parseInt`);
            return { success: false, error: "Invalid Workflow ID. Please save the file first." };
        }

        // Step 3: Create the PENDING run record in DB
        console.log(`[runWorkflowAction] Creating WorkflowRun DB record for workflowId: ${numericId}...`);
        const run = await prisma.workflowRun.create({
            data: {
                workflowId: numericId,
                status: "PENDING",
                triggerType: "MANUAL",
            },
        });
        console.log(`[runWorkflowAction] ✅ WorkflowRun created! run.id: "${run.id}"`);

        // Step 4: Trigger the orchestrator task
        console.log(`[runWorkflowAction] Triggering Trigger.dev task "workflow-orchestrator" with runId: "${run.id}"`);
        await tasks.trigger("workflow-orchestrator", { runId: run.id });
        console.log(`[runWorkflowAction] ✅ Trigger.dev task dispatched successfully`);

        return { success: true, runId: run.id };

    } catch (error) {
        console.error("[runWorkflowAction] ❌ CRITICAL FAILURE:", error);
        console.log("[runWorkflowAction] Error details:", JSON.stringify(error, Object.getOwnPropertyNames(error)));
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

            } else {
                // Use Trigger.dev for non-LLM nodes (crop-image, extract-frame)
                console.log(`[executeNodeAction] Task "${taskId}" triggered via Trigger.dev...`);
                const handle = await tasks.trigger(taskId, taskPayload);
                console.log(`[executeNodeAction] Handle:`, handle.id);

                const timeout = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error("Task timed out after 60s. Is `npx trigger.dev@latest dev` running?")), 60_000)
                );
                const completedRun = await Promise.race([
                    runs.poll(handle, { pollIntervalMs: 1000 }),
                    timeout,
                ]) as Awaited<ReturnType<typeof runs.poll>>;

                console.log(`[executeNodeAction] Poll complete. Status: ${completedRun.status}`);

                if (!completedRun.output || (completedRun.output as any).success === false) {
                    throw new Error((completedRun.output as any)?.error || "Task returned failure");
                }
                output = completedRun.output;
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