# DnC MCP — Divide and Conquer MCP Server

![Node.js](https://img.shields.io/badge/node-%3E%3D16.0.0-brightgreen) ![TypeScript](https://img.shields.io/badge/language-TypeScript-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![MCP](https://img.shields.io/badge/protocol-MCP-purple)

An MCP (Model Context Protocol) server that applies the **Divide and Conquer paradigm** to AI-driven task management. Just like a D&C algorithm, you declare a complex goal, break it into smaller sub-tasks, review and adjust the plan, and then let the agent execute automatically.

---

## The Workflow

The DnC workflow is built around a structured loop: **Declare → Divide → Review → Adjust → Conquer**.

```
┌─────────────────────────────────────────────────────────┐
│                    DnC Workflow                          │
│                                                          │
│  1. User: "Plan this goal"                               │
│       ↓                                                  │
│  2. Agent: /init-root-task                               │
│     - Analyzes codebase                                  │
│     - Calls dnc_init_task + dnc_append_divided_task      │
│     - Builds task tree (L1/L2/L3 depth)                 │
│       ↓                                                  │
│  3. User: Review task plan (via Web UI)                  │
│     - Mark tasks as accept / modify / split / delete     │
│     - Add custom instructions per task                   │
│       ↓                                                  │
│  4. Agent: /adjust-tasks                                 │
│     - Reads review results                               │
│     - Applies modify / split / delete changes            │
│       ↓                                                  │
│  ◀── [Review ↔ Adjust loop repeats until plan is solid] ─┤
│       ↓                                                  │
│  5. User: "Conquer the tasks"                            │
│       ↓                                                  │
│  6. Agent: /conquer-tasks                                │
│     - Validates all tasks are past init status           │
│     - Executes leaf tasks sequentially                   │
│     - Updates status in real-time                        │
│       ↓                                                  │
│  7. Done ✓                                               │
└─────────────────────────────────────────────────────────┘
```

> The **Review ↔ Adjust loop** is the key quality gate. The agent will not proceed to execution until all tasks have been reviewed and confirmed.

---

## Web UI

When Claude connects to the DnC MCP server, a Web UI automatically starts and opens in your browser at `http://localhost:3331` (port auto-assigned).

The Web UI provides a Jira-style task management dashboard:

- **Task card dashboard** — Overview of all root tasks and their current status
- **Tree visualization** — Hierarchical view of parent/child task relationships
- **Batch status update** — Mark multiple tasks at once (accept, modify, split, delete, hold)
- **Color-coded status badges** — At-a-glance status for every task
- **Custom instructions input** — Add per-task instructions for the agent to follow during `/adjust-tasks`

The Web UI is the primary interface for the **Review** phase of the workflow.

---

## Skills — The Critical Integration

Skills are what bridge natural language commands ("plan this project", "conquer the tasks") to the underlying MCP tool calls. **Without skills installed, the workflow requires manual tool invocation.** The three skills below automate the entire DnC lifecycle.

### `/init-root-task`

**Trigger phrases:** "plan this goal", "break down tasks", "create a roadmap for my goal"

Analyzes the current codebase and transforms a vague goal into a structured, executable task tree.

**Execution steps:**
1. **Contextual scan** — Reads the codebase to understand architecture and dependencies
2. **Goal clarification** — Refines the objective and asks for user confirmation before proceeding
3. **Root task creation** — Calls `dnc_init_task` to register the root task
4. **Depth selection** — Prompts for decomposition depth:
   - **Level 1 (Direct):** 1–2 depth, flat high-level milestones
   - **Level 2 (Standard):** 3–4 depth, balanced nested tree
   - **Level 3 (Granular):** 5–7 depth, micro-unit tasks for maximum precision
5. **Recursive decomposition** — Calls `dnc_append_divided_task` recursively to build the full task hierarchy

---

### `/adjust-tasks`

**Trigger phrases:** "adjust tasks based on the review results", "update the plan", "modify tasks as discussed"

Reads the current review results from the Web UI and applies all changes to the task plan.

**Execution steps:**
1. Identifies the target root task (`dnc_list_root_tasks` if ambiguous)
2. Reads the current task structure and review statuses (`dnc_get_task_relations`)
3. Validates: halts if any tasks remain in `init` status (must be reviewed first)
4. Collects technical context; **custom instructions take the highest priority**
5. Applies changes based on status:
   - `modify` → updates goal/acceptance via `dnc_update_task`
   - `split` → decomposes into sub-tasks via `dnc_append_divided_task`
   - `delete` → removes from the tree via `dnc_delete_task`

---

### `/conquer-tasks`

**Trigger phrases:** "conquer the tasks", "execute the plan", "start working on the tasks"

Autonomously executes the finalized task plan from the first leaf task to the last.

**Execution steps:**
1. Identifies the target root task
2. Fetches the full task tree (`dnc_get_task_relations`)
3. **Feasibility check:**
   - Already `done` → notifies user, exits
   - Any `init` tasks remaining → requests further review, halts
   - Any `modify`/`split`/`delete` tasks → directs user to run `/adjust-tasks` first
4. Executes leaf tasks sequentially; each task goes through an internal planning phase before action
5. Updates status in real-time: `in-progress` → `done` as each task completes; parent tasks updated accordingly

---

## Installing Skills

Skills must be copied into the `.claude/skills/` directory of **the project where you want to use them**:

```bash
# From the interlock_mcp directory
cp -r .claude/skills/init-root-task  /your-project/.claude/skills/
cp -r .claude/skills/adjust-tasks    /your-project/.claude/skills/
cp -r .claude/skills/conquer-tasks   /your-project/.claude/skills/
```

After copying, the skills are available in Claude Code via `/init-root-task`, `/adjust-tasks`, and `/conquer-tasks`.

---

## MCP Tools Reference

| Tool | Description |
|------|-------------|
| `dnc_init_task` | Create a root task — the entry point for a new goal |
| `dnc_append_divided_task` | Add a child task under a parent node in the task tree |
| `dnc_update_task` | Update a task's goal, status, or acceptance criteria |
| `dnc_delete_task` | Delete a task (root = entire tree, child = node only) |
| `dnc_get_task_relations` | Retrieve the full task tree structure for a root task |
| `dnc_list_root_tasks` | List all root tasks currently registered |
| `get_kst_time` | Get the current time in KST (UTC+9) |

---

## Task Status Lifecycle

```
         ┌─────────────────────┐
         │        init         │  ← Task just created, awaiting review
         └──────────┬──────────┘
                    │  (user review)
         ┌──────────▼──────────┐
    ┌───▶│       accept        │  ← Approved, ready to execute
    │    └──────────┬──────────┘
    │               │
    │    ┌──────────▼──────────┐
    │    │     in-progress     │  ← Agent is currently working on it
    │    └──────────┬──────────┘
    │               │
    │    ┌──────────▼──────────┐
    │    │        done         │  ← Completed
    │    └─────────────────────┘
    │
    │    ┌─────────────────────┐
    │    │        hold         │  ← Paused, pending dependency or decision
    └────┤        modify       │  ← Needs goal/acceptance update → re-review
         │        split        │  ← Needs further decomposition → re-review
         │        delete       │  ← Marked for removal
         └─────────────────────┘
```

---

## Task Data Structure

Each task is stored as a JSON file in the `.dnc/` directory of your project:

```json
{
  "task_title": "implement-user-auth",
  "goal": "Implement JWT-based user authentication for the API",
  "acceptance": "All auth endpoints pass tests; tokens expire in 24h; refresh flow works",
  "status": "accept",
  "additionalInstructions": "Use RS256 algorithm, not HS256",
  "tasks": [
    {
      "task_title": "create-auth-middleware",
      "goal": "Create Express middleware to validate JWT tokens",
      "acceptance": "Middleware rejects invalid tokens with 401; attaches user to req.user",
      "status": "accept",
      "tasks": []
    },
    {
      "task_title": "implement-login-endpoint",
      "goal": "Implement POST /auth/login endpoint",
      "acceptance": "Returns access + refresh token on valid credentials; 401 on invalid",
      "status": "modify",
      "additionalInstructions": "Also return token expiry timestamp",
      "tasks": []
    }
  ]
}
```

---

## Installation & Setup

### Prerequisites

- Node.js >= 16.0.0
- [Claude Code](https://claude.ai/claude-code) CLI installed

### 1. Clone and build

```bash
git clone <repo-url>
cd interlock_mcp

npm install
npm run build
```

### 2. Register the MCP server with Claude Code

```bash
claude mcp add interlock_dev -- node /absolute/path/to/interlock_mcp/build/index.js
```

Verify the server is registered:

```bash
claude mcp list
```

### 3. Install skills into your project

```bash
cp -r /path/to/interlock_mcp/.claude/skills/* /your-project/.claude/skills/
```

### 4. Start using the workflow

Open Claude Code in your project directory and run:

```
/init-root-task
```

The Web UI will open automatically at `http://localhost:3331`.

---

## Development

### Build

```bash
npm run build       # Compile TypeScript + copy views
npm run watch       # Watch mode
```

### Code quality

```bash
npm run typecheck   # TypeScript type check
npm run lint        # ESLint
npm run lint:fix    # ESLint with auto-fix
npm run format      # Prettier format
npm run format:check
```

### Testing

```bash
npm run test              # Full test suite (Vitest + Playwright)
npm run test:unit         # Unit tests only
npm run test:integration  # Integration tests only
npm run test:e2e          # End-to-end tests
npm run test:coverage     # Coverage report (target: 80%+)
npm run test:watch        # Watch mode
```

### Inspect MCP tools interactively

```bash
npm run inspector
```

---

## License

MIT
