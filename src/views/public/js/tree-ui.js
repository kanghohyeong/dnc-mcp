/**
 * 트리 UI 렌더러
 * 계층적 작업 구조를 디렉토리 탐색 UI처럼 표현
 */

/**
 * 상태 옵션 목록
 */
const STATUS_OPTIONS = [
  { value: 'init', label: 'init' },
  { value: 'accept', label: 'accept' },
  { value: 'in-progress', label: 'in-progress' },
  { value: 'done', label: 'done' },
  { value: 'delete', label: 'delete' },
  { value: 'hold', label: 'hold' },
  { value: 'split', label: 'split' }
];

/**
 * 재귀적 섹션 구조로 task 아이템 렌더링
 * @param {Object} task - 작업 객체
 * @param {number} depth - 트리 깊이
 * @param {string} rootTaskId - Root task ID
 * @returns {string} HTML 문자열
 */
function renderTaskItem(task, depth = 0, rootTaskId = null) {
  const hasChildren = task.tasks && task.tasks.length > 0;
  const actualRootTaskId = rootTaskId || task.id;

  // 상태 드롭다운 옵션 생성
  const statusOptions = STATUS_OPTIONS.map(option =>
    `<option value="${option.value}" ${task.status === option.value ? 'selected' : ''}>${option.label}</option>`
  ).join('');

  const additionalInstructionsValue = task.additionalInstructions || '';

  let html = `
    <div class="task-item" data-depth="${depth}" data-testid="tree-item-${task.id}">
      <!-- Header: ID + Status -->
      <div class="task-header">
        <div class="task-id" data-testid="tree-item-title">${escapeHtml(task.id)}</div>
        <select
          class="status-dropdown"
          data-testid="status-dropdown-${task.id}"
          data-task-id="${task.id}"
          data-root-task-id="${actualRootTaskId}"
          data-original-status="${task.status}">
          ${statusOptions}
        </select>
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

      <!-- 추가 지침 섹션 -->
      <div class="section">
        <div class="section-label">추가 지침</div>
        <textarea
          class="additional-instructions-textarea"
          data-testid="additional-instructions-${task.id}"
          data-task-id="${task.id}"
          data-root-task-id="${actualRootTaskId}"
          data-original-value="${escapeHtml(additionalInstructionsValue)}"
          placeholder="이 task에 대한 추가 지침을 입력하세요..."
          rows="3">${escapeHtml(additionalInstructionsValue)}</textarea>
      </div>
  `;

  // Subtasks 섹션 (자식이 있으면)
  if (hasChildren) {
    html += `
      <div class="section">
        <div class="subtasks-header" onclick="toggleSubtasks(this)">
          <div class="section-label">Subtasks</div>
          <button class="subtasks-toggle-btn" aria-label="subtasks 토글">▼</button>
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

// 하위 호환성을 위해 renderTreeItem을 renderTaskItem으로 aliasing
function renderTreeItem(task, depth = 0) {
  return renderTaskItem(task, depth);
}

/**
 * Subtasks 섹션 접기/펼치기 토글
 * @param {HTMLElement} headerEl - 클릭된 .subtasks-header 요소
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
 * HTML 이스케이프
 * @param {string} text - 이스케이프할 텍스트
 * @returns {string} 이스케이프된 텍스트
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// expandAll과 collapseAll 함수는 재귀적 섹션 구조에서 제거됨
// (모든 항목이 항상 표시됨)

/**
 * 트리 초기화
 * @param {string} containerId - 컨테이너 ID
 * @param {Object} rootTask - 루트 작업 객체
 */
function initializeTree(containerId, rootTask) {
  const container = document.getElementById(containerId);
  if (!container) {
    console.error(`Container with id "${containerId}" not found`);
    return;
  }

  container.innerHTML = renderTreeItem(rootTask, 0);
}
