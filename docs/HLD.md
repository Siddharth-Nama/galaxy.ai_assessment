# High-Level Design (HLD)

## System Architecture & Philosophy
**Weave** is architected as a **distributed, event-driven system** designed for high reliability and scalability. The core philosophy centers on **Strict Separation of Concerns**:

1.  **The Interactive Layer (Frontend)**: A lightweight, responsive React Client that handles user intent, visualization, and state management.
2.  **The Orchestration Layer (Backend)**: A robust, serverless backend powered by **Trigger.dev** that manages the complex lifecycle of AI workflows, ensuring no long-running processes block the main thread.
3.  **The Data Layer (Persistence)**: A strictly typed PostgreSQL database accessed via Prisma, serving as the single source of truth.

## Architecture Diagram

```ascii
┌─────────────────────────────────────────────────────────────────────┐
│                           CLIENT (Browser)                          │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │   React Flow │  │   Zustand    │  │      Clerk Auth          │   │
│  │   Canvas     │  │   Store      │  │      Components          │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────────┐
│                         NEXT.JS SERVER                              │
├─────────────────────────────────────────────────────────────────────┤
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────────┐   │
│  │  API Routes  │  │  Server      │  │     Clerk Middleware     │   │
│  │  /api/*      │  │  Actions     │  │     (Protected Routes)   │   │
│  └──────────────┘  └──────────────┘  └──────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────┘
                                │
                                ▼
                    ┌──────────────────────────┐
                    │      TRIGGER.DEV         │
                    │   (Serverless Workers)   │
                    ├──────────────────────────┤
                    │  • Orchestrator Process  │
                    │  • LLM Execution Task    │
                    │  • Image Processing Task │
                    └──────────────────────────┘
                                │
                    ┌───────────┴───────────┐
                    ▼                       ▼
┌──────────────────────────────────────┐  ┌──────────────────────────┐
│           POSTGRESQL                 │  │     EXTERNAL SERVICES    │
│         (via Prisma)                 │  │ (Gemini AI, Transloadit) │
└──────────────────────────────────────┘  └──────────────────────────┘
```

## Core Components Breakdown

### 1. Frontend Layer: The "Command Center"
-   **React Flow Canvas**: The heart of the user interface. It provides an infinite, interactive canvas for visually constructing complex logic.
-   **Zustand Store**: Implements a centralized, client-side state machine that tracks node configurations, edge connections, and execution status in real-time.
-   **Optimistic UI**: The interface updates instantly for user actions (drag, drop, connection), while background synchronization handling ensures data consistency.

### 2. Backend Layer: API & Security
-   **Next.js App Router**: Utilizing Server Components for efficient initial loads and SEO, while keeping the interactive canvas client-side.
-   **Secure API Routes**: All endpoints are protected via **Clerk Middleware**, ensuring only authenticated requests can trigger workflows or access data.
-   **Zod Validation**: A strict validation layer ensures that all incoming data conforms to the expected schema before it ever reaches the database or execution engine.

### 3. Execution Layer: The Engine
-   **Trigger.dev Orchestrator**: This is the "brain" of the operation. It analyzes the Directed Acyclic Graph (DAG) of the workflow, determines dependencies, and schedules tasks.
-   **Serverless Scalability**: Each node execution (LLM call, Image Crop) runs as an isolated serverless function, allowing the system to handle massive parallel loads without degrading performance.
-   **Fault Tolerance**: Automatic retries and error handling are built into the execution layer, ensuring transient failures don't crash entire workflows.

## Data Flow Strategy

1.  **Drafting**: User interacts with the Canvas. Changes are locally cached in Zustand and debounced-synced to the DB.
2.  **Triggering**: When "Run" is clicked, a `WorkflowRun` event is dispatched to the API.
3.  **Orchestration**: The API hands off the `run_id` to Trigger.dev. The client immediately receives a "Pending" status and begins polling (or listening via webhooks) for updates.
4.  **Execution**: Trigger.dev spins up workers. Parallel branches execute simultaneously.
5.  **Completion**: Results are written to `NodeExecution` records in PostgreSQL. The frontend reflects these changes via live status indicators (glowing nodes).

---
© 2026 Developed by **Siddharth Nama**
