# Low-Level Design (LLD)

## 1. Data Schema Design (PostgreSQL)

The database schema is designed for **referential integrity** and **scalability**, leveraging PostgreSQL's advanced features.

### Core Tables

#### `users`
-   **Primary Key**: `id` (Managed by Clerk Auth)
-   **Purpose**: Stores minimal user profile data, synced from Clerk webhooks.
-   **Indexes**: `email` (Unique) for rapid lookups.

#### `workflows`
-   **Primary Key**: `id` (Serial Integer)
-   **Foreign Key**: `user_id` -> `users(id)` (ON DELETE CASCADE)
-   **Purpose**: Stores the JSON representation of the React Flow graph.
-   **Note**: The JSON `data` column is treated as an opaque blob by the DB but strictly typed in the application layer via Zod schemas.

#### `workflow_runs`
-   **Primary Key**: `id` (UUID) - Ensures globally unique identifiers for distributed tracing.
-   **Foreign Key**: `workflow_id` -> `workflows(id)`
-   **Status Enum**: `PENDING` | `RUNNING` | `COMPLETED` | `FAILED`
-   **Purpose**: Represents a single instance of a workflow execution. It tracks the overall lifecycle and duration.

#### `node_executions`
-   **Primary Key**: `id` (UUID)
-   **Foreign Key**: `run_id` -> `workflow_runs(id)`
-   **Purpose**: Granular tracking of individual node operations. Stores input/output payloads as JSONB for flexibility across different node types (LLM, Image, Text).

## 2. Type System Strategy (TypeScript)

We employ a **Shared Type Definition** strategy to ensure consistency between the Frontend, Backend, and Database.

### Node Interface Definitions
Each node type implements a strict interface to guarantee runtime safety:

-   **`LLMNodeData`**: Defines the structure for AI interactions, including `model` selection, `systemPrompt`, and `userMessage`.
-   **`ImageNodeData`**: Handles image references, either via URL or Base64, with strict status tracking (`idle` -> `loading` -> `success`).
-   **`CropNodeData`**: Stores normalized coordinate data (percentages) to ensure crop operations are resolution-independent.

### Zod Schemas
Runtime validation is enforced using **Zod**. Every API endpoint validates incoming requests against these schemas before processing:
```typescript
export const CreateWorkflowSchema = z.object({
  name: z.string().min(1),
  nodes: z.array(NodeSchema),
  edges: z.array(EdgeSchema),
});
```

## 3. Serverless Task Implementation (Trigger.dev)

### The Orchestrator Pattern
Instead of a monolithic "worker loop," we use an event-driven orchestrator:
1.  **Trigger**: Receives `run_id`.
2.  **Hydrate**: Fetches workflow graph from DB.
3.  **Topological Sort**: Determines the execution order based on dependencies.
4.  **Parallel Dispatch**: Identifies nodes that can run simultaneously and dispatches them as separate sub-tasks.
5.  **Aggregation**: Waits for results and updates the `node_executions` table.

### Task Isolation
Each critical operation is wrapped in a dedicated Trigger.dev task:
-   **`llm-execution`**: Wraps the Google Gemini API call with retry logic and rate limiting handling.
-   **`image-processing`**: Handles CPU-intensive tasks like cropping and resizing, offloading them from the main server.

## 4. State Management Architecture

### Client-Side Store (Zustand)
-   **Atomic Updates**: State changes are granular. Moving a node only updates its position, not the entire graph.
-   **Selectors**: Components subscribe only to the specific slice of state they need, minimizing re-renders.

### Server-Side Actions
-   **Direct DB Access**: Server Actions bypass the traditional API layer for high-frequency operations like saving node positions, reducing latency.

---
© 2026 Developed by **Siddharth Nama**
