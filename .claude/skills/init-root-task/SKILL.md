---
name: init-root-task
description: Analyzes a primary goal (Root Task) and breaks it down into actionable sub-tasks to create a structured workflow. Use this tool to transform large, vague objectives into manageable step-by-step lists. It triggers when a user asks to "plan a project," "break down tasks," "create a roadmap for my goal," or "split this objective into steps."
---

# Init Root Task

## **DNC-Based Task Structuring & Execution Planning**

This skill integrates deeply with **DNC MCP (Model Context Protocol)** tools to decompose a primary objective into granular, executable tasks. By analyzing the existing codebase, it ensures that every plan is technically grounded and ready for implementation.

### **[Workflow & Execution Steps]**

* **Step 1: Contextual Information Gathering** Scans the codebase to identify and collect relevant components, dependencies, and logic. This ensures the proposed plan aligns with the current system architecture.

* **Step 2: Goal Clarification & Alignment** Refines the gathered information into a clear objective. This stage requires **user confirmation** to ensure the mission parameters are exactly what you intended before proceeding.

* **Step 3: DNC Task Initialization** Once the goal is confirmed, the skill utilizes the `dnc-init-job` tool to formalize the **Root Task** within the system and assign a unique tracking ID.

* **Step 4: Sub-task Decomposition & Structuring** Employs the `dnc-append-divided-job` tool to break the main goal into independent, manageable **Sub-tasks**. Each task is logically sequenced to create a streamlined path to completion.

