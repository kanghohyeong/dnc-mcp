---
name: conquer-tasks
description: Executes tasks according to the established plan. This skill is used to carry out the reviewed and finalized task structure without interruption. It triggers when a user says "conquer the tasks," "execute the plan," or "start working on the tasks."
---

# Conquer Tasks

## **Autonomous Task Execution & Progress Management**

This skill focuses on the seamless execution of a verified task roadmap. By leveraging **DNC MCP** tools, it transitions from planning to action, autonomously handling leaf tasks while keeping the task hierarchy's status updated in real-time.

### **[Workflow & Execution Steps]**

* **Step 1: Root Task Identification**
The system identifies the target **Root Task**. If the target is ambiguous, it uses the `dnc-list-root-jobs` tool to list active projects and **requests user confirmation** to ensure the correct plan is being executed.
* **Step 2: Plan & Review Verification**
The system utilizes the `dnc-get-job-relations` tool to synchronize with the current task plan and review outcomes, ensuring all tasks are ready for deployment.
* **Step 3: Execution Feasibility Check**
Before starting, the system validates the current state of the roadmap:
* **Already Completed:** If the Root Task is already marked as `done`, the system notifies the user and exits.
* **Pending Review:** If any tasks are still in `init` status, the system **requests further user review** and halts execution.
* **Pending Adjustments:** If tasks are in `modify`, `split`, or `delete` status, the system directs the user to run the **`adjust-tasks`** skill first.


* **Step 4: Sequential Leaf Task Execution**
The system begins executing **Leaf Tasks** (the smallest units of work) in their logical order:
* **Self-Planning:** For each leaf task, the agent undergoes an internal **planning phase** to determine the best technical approach before acting.
* **Autonomous Flow:** To ensure maximum efficiency, the system **minimizes user feedback** during this stage, relying on the pre-approved plan to work through the list independently.


* **Step 5: Dynamic Status Updates**
As work progresses, the system reflects real-time status changes using the `dnc-update-job` tool:
* **Individual Tasks:** Each task is updated to `in-progress` when started and `done` upon successful completion.
* **Hierarchical Updates:** The status of parent tasks and subtasks is updated accordingly to match the execution state of their children, ensuring the entire tree remains accurate.
