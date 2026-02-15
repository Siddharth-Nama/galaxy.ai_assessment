# Weave - Visual AI Workflow Builder
Live Application: [Click Here to Open App](https://siddharthgalxyassignment.vercel.app/)  
Repository: [GitHub](https://github.com/Siddharth-Nama/flytbase-assessment) (Note: Replace with actual repo if different)

## Overview
Welcome to my submission for the Galaxy.AI Assessment. I have engineered **Weave**, a high-performance **Visual AI Workflow Builder** that transforms complex LLM operations into intuitive, drag-and-drop flowcharts.

This project goes beyond a basic CRUD application—it is a full-featured **AI Orchestration Platform**. It integrates an infinite canvas (React Flow), multi-modal AI processing (Google Gemini), and serverless background execution (Trigger.dev) to simulate a professional enterprise automation environment. I built this to handle the "power user" workflow of designing, executing, and monitoring complex AI tasks with an emphasis on **Architectural Purity** and **Real-time Feedback**.

## Tech Stack
- **Frontend**: **Next.js 16 (App Router)** for a reliable, high-speed UI with Server Components.
- **Visual Canvas**: **React Flow** for interactive node-based workflow planning.
- **AI Engine**: **Google Gemini API** for multi-modal (text, image, video) processing.
- **Background Jobs**: **Trigger.dev** for serverless, reliable, and long-running task execution.
- **Styling**: **Tailwind CSS** for a modern, responsive, and maintainable design system.
- **Database**: **PostgreSQL** (via Neon/Supabase) with **Prisma ORM** for type-safe data access.
- **State Management**: **Zustand** for performant, client-side state handling.
- **Authentication**: **Clerk** for secure user management.

## Why This Project Stands Out?

### Architectural Purity: Strict Separation of Concerns
The system is designed with a clear boundary between the visual interface and the execution logic. The frontend handles the canvas state and user interactions, while **Trigger.dev** handles the heavy lifting of AI processing in the background. This ensures the UI remains responsive even during complex, long-running AI tasks.

### "Command Center" UI
Unlike generic dashboards, Weave offers a **Tactical Workspace**:
- **Infinite Canvas**: Drag, drop, and connect nodes to build complex logic.
- **Real-time Status**: Nodes glow and pulse to indicate execution state (Waiting, Running, Completed, Failed).
- **History Tracking**: every execution is logged, allowing users to audit and debug their workflows.

### Advanced AI Integration
- **Multi-Modal Support**: The system isn't limited to text. It handles **Images** and **Video** inputs, processing them via Gemini's vision capabilities.
- **Server-Side Validation**: All inputs are validated with **Zod** schemas before execution, ensuring data integrity.

### Implementation Details

#### Core Features
- **Visual Workflow Builder**:
  - Drag-and-drop interface for 6+ node types (LLM, Text, Image, Video, Crop, Extract).
  - Dynamic connection validation.
- **Execution Engine**:
  - **Parallel Execution**: Independent branches run concurrently.
  - **Resiliency**: Trigger.dev ensures tasks are retried on failure.
- **Media Processing**:
  - Integration with **FFmpeg** for video frame extraction and manipulation.
  - Secure file uploads via **Transloadit**.

#### Technical Highlights
- **Optimized Rendering**: Strategic use of `React.memo` and `useCallback` to prevent unnecessary re-renders on the canvas.
- **Type Safety**: End-to-end TypeScript coverage from the database (Prisma) to the frontend components.

## Candidate Profile: Siddharth Nama
> "I don't just write code; I build solutions that scale."

Hello! I'm **Siddharth Nama**, a passionate Software Engineer Intern from Kota, India. I thrive on solving complex backend challenges and crafting seamless user experiences. My journey involves:

- Spearheading "Suvidha Manch" at the Haryana Government (C4GT), where I helped digitize 25,000+ roads.
- Optimizing performance at Mercato Agency, creating systems that handle 10,000+ users with ease.
- Driving innovation with AI-powered platforms like Scripty and AiProgress.
- Leading teams and delivering results under pressure, from managing election portals to restocking systems.

I am fit for this role because I combine strong technical fundamentals (Django, React, Systems Design) with an ownership mindset. I treat every assignment like a production release—focusing on edge cases, maintainability, and user impact. I am ready to bring this energy and precision to the team!

**Let's Connect:**
- [LinkedIn](https://www.linkedin.com/in/siddharth-nama)
- [GitHub](https://github.com/Siddharth-Nama)
- **Phone**: +91-8000694996

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
