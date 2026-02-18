---
name: adjust-tasks
description: Adjusts task goals, acceptance criteria, and granularity levels. This skill is used to reflect the user's reviewed feedback into the task plan. It triggers when a user says "adjust tasks based on the review results," "update the plan according to the review," or "modify tasks as discussed."
---

# Adjust Tasks

## **Review-Driven Task Refinement & Plan Optimization**

This skill synchronizes the execution plan with the user's feedback and review outcomes. By utilizing **DNC MCP (Model Context Protocol)** tools, it ensures that the task hierarchy, goals, and breakdown levels are accurately updated to align with the user's latest strategic decisions.

### **[Workflow & Execution Steps]**

* **Step 1: Root Task Identification**
The system identifies the target **Root Task**. If the target is ambiguous, it utilizes the `dnc-list-root-tasks` tool to retrieve a list of active projects and **requests user confirmation** to ensure adjustments are applied to the correct workflow.
* **Step 2: Task Plan & Review Verification**
The system calls the `dnc-get-task-relations` tool to examine the current task structure alongside the user's review results. This step maps specific feedback to the corresponding task IDs within the hierarchy.
* **Step 3: Status-Based Adjustment Validation**
The system evaluates the status of each task to determine whether modifications are required:
  * **Incomplete Reviews**: If tasks remain in an `init` state, the system **requests further review** from the user before proceeding, as final directions are not yet clear.
  * **Stable Tasks:** Tasks in `accept`, `hold`, `in-process`, or `done` status do not require adjustments and remain unchanged.
  * **Actionable Tasks:** Tasks in `modify`, `split`, or `delete` status are identified as requiring active adjustment based on the review.

* **Step 4: Information Gathering for Refinement**
The system collects all necessary details and technical context required for the adjustments. Crucially, if **'Custom Instructions'** have been provided by the user, the system prioritizes these instructions as the primary guide for the refinement process.
* **Step 5: Execution of Structural Adjustments**
The system performs the actual modifications using specific DNC tools based on the task status:
  * **Task Modification (`modify`):** For tasks in the `modify` state, the system applies updates to goals or acceptance criteria according to the Custom Instructions using the `dnc-update-task` tool.
  * **Task Decomposition (`split`):** For tasks marked as `split`, the system breaks them down into more granular sub-tasks using the `dnc-append-divided-task` tool.
  * **Task Removal (`delete`):** For tasks marked for removal, the system deletes them from the plan using the `dnc-delete-task` tool.
