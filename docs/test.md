# Operational Verification Protocol

## Overview
This document outlines the **Standard Operating Procedure (SOP)** for verifying the integrity and functionality of the **Weave** platform. All deployments must pass this checklist before being considered production-ready.

---

## 1. Environment Initialization

Ensure the runtime environment is correctly configured:

```bash
# Terminal 1: Application Server
npm run dev

# Terminal 2: Background Worker (Trigger.dev)
npx trigger.dev@latest dev
```

**Critical Validation**:
- [ ] `.env` contains valid `GEMINI_API_KEY`, `TRIGGER_SECRET_KEY`, and `DATABASE_URL`.
- [ ] Clerk Authentication keys are active.

---

## 2. Core Module verification

### 2.1 Authentication & Security (Clerk)
| ID | Test Scenario | Expected Outcome |
|----|---------------|------------------|
| **AUTH-01** | Unauthenticated Access | Redirection to Sign-In portal. |
| **AUTH-02** | User Isolation | Users can only view workflows they created. |
| **AUTH-03** | Session Persistence | Session remains active across page reloads. |

### 2.2 Interface Dynamics (React Flow)
| ID | Test Scenario | Expected Outcome |
|----|---------------|------------------|
| **UI-01** | Canvas Manipulation | Smooth panning and zooming (60fps). |
| **UI-02** | Node Instantiation | Drag-and-drop adds nodes correctly. |
| **UI-03** | Connection Validation | Invalid connections (e.g., Image -> Text) are visually rejected. |

---

## 3. Workflow Execution Engine

### 3.1 Node Logic & Processing
| Node Type | Verification Criteria |
|-----------|-----------------------|
| **Text Node** | Input text is correctly passed to downstream nodes. |
| **LLM Node** | Successfully invokes Gemini API and streams response. |
| **Crop Node** | Returns a valid URL for the cropped image asset. |
| **Video Node** | Uploads video to Transloadit and returns playback URL. |

### 3.2 Orchestration & Parallelism
- [ ] **Parallel Execution**: Create two independent branches. Run workflow. Verify both branches execute **concurrently**.
- [ ] **Convergence**: Create a merge node that waits for both branches. Verify it only runs after **both** inputs are satisfied.
- [ ] **State Feedback**: Verify nodes pulse/glow during the `RUNNING` state.

---

## 4. Advanced Integration Tests

### 4.1 Multi-Modal AI (Vision)
1.  Upload an image using the **Image Node**.
2.  Connect to **LLM Node**.
3.  Prompt: *"Describe this image"*.
4.  **Success Criteria**: LLM returns an accurate description of the visual content.

### 4.2 Error Handling & Resilience
1.  Disconnect an input from a required node.
2.  Run the workflow.
3.  **Success Criteria**: Node enters `FAILED` state with a descriptive error message; System does not crash.

---

## 5. Deployment Checklist
- [ ] **GitHub**: Repository pushed with clean history.
- [ ] **Vercel**: Production build succeeds.
- [ ] **Database**: Migrations applied (`prisma db push`).

---
© 2026 Developed by **Siddharth Nama**
