/**
 * Tree UI renderer
 * Displays hierarchical task structure as a directory-explorer-style UI
 */

/**
 * Status option list
 */
const STATUS_OPTIONS = [
  { value: 'init', label: 'init' },
  { value: 'accept', label: 'accept' },
  { value: 'in-progress', label: 'in-progress' },
  { value: 'done', label: 'done' },
  { value: 'delete', label: 'delete' },
  { value: 'hold', label: 'hold' },
  { value: 'split', label: 'split' },
  { value: 'modify', label: 'modify' }
];

/**
 * Renders a task item as a recursive section structure
 * @param {Object} task - Task object
 * @param {number} depth - Tree depth
 * @param {string} rootTaskId - Root task ID
 * @returns {string} HTML string
 */
function renderTaskItem(task, depth = 0, rootTaskId = null) {
  const hasChildren = task.tasks && task.tasks.length > 0;
  const actualRootTaskId = rootTaskId || task.id;

  const isLocked = task.status === 'in-progress' || task.status === 'done';
  const disabledAttr = isLocked ? ' disabled' : '';

  const SELECTABLE_STATUSES = ['accept', 'delete', 'hold', 'split', 'modify'];

  // 라디오 버튼 그룹 생성
  const radioButtons = SELECTABLE_STATUSES.map(status => {
    const checkedAttr = task.status === status ? ' checked' : '';
    return `
      <label class="status-radio-label${isLocked ? ' locked' : ''}">
        <input
          type="radio"
          class="status-radio"
          data-testid="status-radio-${task.id}-${status}"
          data-task-id="${task.id}"
          data-root-task-id="${actualRootTaskId}"
          data-original-status="${task.status}"
          name="status-${task.id}"
          value="${status}"${checkedAttr}${disabledAttr}>
        <span>${status}</span>
      </label>`;
  }).join('');

  const additionalInstructionsValue = task.additionalInstructions || '';

  let html = `
    <div class="task-item" data-depth="${depth}" data-testid="tree-item-${task.id}">
      <!-- Header: ID + Status -->
      <div class="task-header">
        <div class="task-id" data-testid="tree-item-title">${escapeHtml(task.id)}</div>
        <div class="status-control">
          <span class="current-status-badge status-badge-${task.status}" data-testid="current-status-${task.id}">${task.status}</span>
          <div class="status-radio-group${isLocked ? ' locked' : ''}" data-testid="status-radio-group-${task.id}">
            ${radioButtons}
          </div>
        </div>
      </div>

      <!-- Goal 섹션 -->
      <div class="section">
        <div class="section-label">Goal</div>
        <div class="section-content" data-testid="tree-item-description">
          ${escapeHtml(task.goal)}
        </div>
      </div>

      <!-- Acceptance Criteria 섹션 -->
      <div class="section">
        <div class="section-label">Acceptance Criteria</div>
        <div class="section-content">
          ${escapeHtml(task.acceptance || '')}
        </div>
      </div>

      <!-- Custom Instructions section -->
      <div class="section">
        <div class="section-label">Custom Instructions</div>
        <textarea
          class="additional-instructions-textarea"
          data-testid="additional-instructions-${task.id}"
          data-task-id="${task.id}"
          data-root-task-id="${actualRootTaskId}"
          data-original-value="${escapeHtml(additionalInstructionsValue)}"
          placeholder="Enter custom instructions for this task..."
          rows="3"${disabledAttr}>${escapeHtml(additionalInstructionsValue)}</textarea>
      </div>
  `;

  // Subtasks 섹션 (자식이 있으면)
  if (hasChildren) {
    html += `
      <div class="section">
        <div class="subtasks-header" onclick="toggleSubtasks(this)">
          <div class="section-label">Subtasks</div>
          <button class="subtasks-toggle-btn" aria-label="toggle subtasks">▼</button>
        </div>
        <div class="task-children">
    `;

    for (const child of task.tasks) {
      html += renderTaskItem(child, depth + 1, actualRootTaskId);  // 재귀 호출
    }

    html += `
        </div>
      </div>
    `;
  }

  html += '</div>';
  return html;
}

// Alias renderTreeItem to renderTaskItem for backward compatibility
function renderTreeItem(task, depth = 0) {
  return renderTaskItem(task, depth);
}

/**
 * Toggles the subtasks section collapsed/expanded
 * @param {HTMLElement} headerEl - The clicked .subtasks-header element
 */
function toggleSubtasks(headerEl) {
  const section = headerEl.closest('.section');
  const children = section.querySelector('.task-children');
  const btn = headerEl.querySelector('.subtasks-toggle-btn');

  if (children.classList.contains('collapsed')) {
    children.classList.remove('collapsed');
    btn.classList.remove('collapsed');
    btn.textContent = '▼';
  } else {
    children.classList.add('collapsed');
    btn.classList.add('collapsed');
    btn.textContent = '▶';
  }
}

/**
 * Escapes HTML special characters
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// expandAll and collapseAll removed in recursive section structure
// (all items are always visible)

/**
 * Initializes the tree
 * @param {string} containerId - Container element ID
 * @param {Object} rootTask - Root task object
 */
function initializeTree(containerId, rootTask) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with id "${containerId}" not found`);
    return;
  }

  container.innerHTML = renderTreeItem(rootTask, 0);
}
