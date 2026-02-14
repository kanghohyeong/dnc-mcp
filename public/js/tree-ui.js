/**
 * 트리 UI 렌더러
 * 계층적 작업 구조를 디렉토리 탐색 UI처럼 표현
 */

/**
 * 재귀적 섹션 구조로 task 아이템 렌더링
 * @param {Object} task - 작업 객체
 * @param {number} depth - 트리 깊이
 * @returns {string} HTML 문자열
 */
function renderTaskItem(task, depth = 0) {
  const hasChildren = task.tasks && task.tasks.length > 0;

  let html = `
    <div class="task-item" data-depth="${depth}" data-testid="tree-item-${task.id}">
      <!-- Header: ID + Status -->
      <div class="task-header">
        <div class="task-id" data-testid="tree-item-title">${escapeHtml(task.id)}</div>
        <div class="status-badge status-${task.status}" data-testid="tree-item-status">${task.status}</div>
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
  `;

  // Subtasks 섹션 (자식이 있으면)
  if (hasChildren) {
    html += `
      <div class="section">
        <div class="section-label">Subtasks</div>
        <div class="task-children">
    `;

    for (const child of task.tasks) {
      html += renderTaskItem(child, depth + 1);  // 재귀 호출
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

// toggleTreeItem과 toggleDetails 함수는 재귀적 섹션 구조에서 제거됨
// (펼치기/접기 기능 없음)

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
