# Weave - Visual AI Workflow Builder
**Live Application:** [Click Here to Open App](https://siddharthgalxyassignment.vercel.app/)

## Overview
Welcome to my submission for the **Galaxy.AI Assessment**. I have engineered **Weave**, a high-performance **Visual AI Workflow Builder** that transforms complex LLM operations into intuitive, drag-and-drop flowcharts.

This project is a **pixel-perfect, full-featured AI Orchestration Platform**. It integrates an infinite canvas (React Flow), multi-modal AI processing (Google Gemini), and serverless background execution (Trigger.dev) to simulate a professional enterprise automation environment. I built this to not just meet, but **exceed** the assignment requirements, focusing on **Architectural Purity**, **Type Safety**, and **Real-time Feedback**.

---

## ✅ Requirement Satisfaction Matrix
I have rigorously implemented **100% of the assignment requirements**. Below is the detailed breakdown of how each specification was met:

### 1. Core Interface & UX
-   **Pixel-Perfect UI**: The design mirrors the reference architecture with exact spacing, typography, and layout.
-   **Infinite Canvas**: Implemented using **React Flow** with a custom dot grid pattern, mini-map, and smooth pan/zoom controls.
-   **Sidebar Navigation**:
    -   **Left Sidebar**: Contains the 6 required node types in a "Quick Access" panel.
    -   **Right Sidebar**: A collapsible **Workflow History** panel tracking every execution.

### 2. Node Types (All 6 implemented)
1.  **Text Node**: Input text area with dynamic output handles.
2.  **Upload Image Node**: Integrated with **Transloadit** for secure storage; provides image URL outputs.
3.  **Upload Video Node**: Integrated with **Transloadit**; allows video preview and URL output.
4.  **LLM Node (Gemini)**:
    -   Fully functional model selector (Gemini 1.5 Flash/Pro).
    -   Accepts multi-modal inputs (Text + Images).
    -   **System Prompts**: Supports optional system instruction inputs.
5.  **Crop Image Node**: Powered by **FFmpeg** via Trigger.dev to physically crop images based on percentage coordinates.
6.  **Extract Frame Node**: Powered by **FFmpeg** via Trigger.dev to extract specific frames from video streams.

### 3. Execution Engine (Trigger.dev)
-   **Zero-Blocking Architecture**: **Every single node execution** (LLM, Crop, Extract) runs as an isolated serverless task on **Trigger.dev**, ensuring the UI never freezes.
-   **Parallel Execution**: The orchestrator allows independent branches of the DAG (Directed Acyclic Graph) to execute **simultaneously**.
-   **Real-Time Feedback**: Nodes exhibit a **Pulsating Glow Effect** (Yellow border + shadow) specifically when they are in the `RUNNING` state.

### 4. Data & State Management
-   **Database**: **PostgreSQL** (via Prisma ORM) stores all Workflows, Runs, and Node Executions.
-   **History Persistence**: Full execution history is saved, allowing users to inspect past runs and individual node outputs (success/failure status, duration, and data).
-   **JSON Export**: Workflows can be exported as JSON files for portability.

### 5. Authentication & Security
-   **Clerk Auth**: Full integration with protected routes. Users can only access workflows they created.

---

## Tech Stack
-   **Frontend**: **Next.js 16 (App Router)** for a reliable, high-speed UI with Server Components.
-   **Visual Canvas**: **React Flow** for interactive node-based workflow planning.
-   **AI Engine**: **Google Gemini API** for multi-modal (text, image, video) processing.
-   **Background Jobs**: **Trigger.dev** for serverless, reliable, and long-running task execution.
-   **Media Processing**: **FFmpeg** (Crop/Extract) & **Transloadit** (Uploads).
-   **Styling**: **Tailwind CSS** for a modern, responsive design system.
-   **State**: **Zustand** for performant, client-side state management.

---

## Why This Project Stands Out?

### Architectural Purity: Strict Separation of Concerns
The system is designed with a clear boundary between the visual interface and the execution logic. The frontend handles the canvas state and user interactions, while **Trigger.dev** handles the heavy lifting of AI processing in the background.

### "Command Center" UI
Unlike generic dashboards, Weave offers a **Tactical Workspace**:
-   **Visual Feedback**: Nodes glow and pulse to indicate execution state (Waiting, Running, Completed, Failed).
-   **Deep Observability**: Every execution is logged, allowing users to audit and debug their workflows with node-level granularity.

---

## Candidate Profile: Siddharth Nama
> "I don't just write code; I build solutions that scale."

Hello! I'm **Siddharth Nama**, a passionate Software Engineer Intern from Kota, India. I thrive on solving complex backend challenges and crafting seamless user experiences. My journey involves:

-   Spearheading "Suvidha Manch" at the Haryana Government (C4GT), where I helped digitize 25,000+ roads.
-   Optimizing performance at Mercato Agency, creating systems that handle 10,000+ users with ease.
-   Driving innovation with AI-powered platforms like Scripty and AiProgress.
-   Leading teams and delivering results under pressure, from managing election portals to restocking systems.

I am fit for this role because I combine strong technical fundamentals (Django, React, Systems Design) with an ownership mindset. I treat every assignment like a production release—focusing on edge cases, maintainability, and user impact. I am ready to bring this energy and precision to the team!

**Let's Connect:**
-   [LinkedIn](https://www.linkedin.com/in/siddharth-nama)
-   [GitHub](https://github.com/Siddharth-Nama)
-   **Phone**: +91-8000694996

---

## Setup Instructions

### Backend & Frontend Setup
This project uses a unified Next.js repository structure.

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/Siddharth-Nama/weavy-clone.git
    cd weavy-clone
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Configure Environment:**
    Copy `.env.example` to `.env` and fill in your API keys (Clerk, Database, Gemini, Trigger.dev).
    ```bash
    cp .env.example .env
    ```

4.  **Initialize Database:**
    ```bash
    npx prisma db push
    ```

5.  **Run Development Server:**
    ```bash
    npm run dev
    ```

6.  **Start Background Worker:**
    In a separate terminal:
    ```bash
    npm run trigger:dev
    ```

---
© 2026 Developed by **Siddharth Nama**
