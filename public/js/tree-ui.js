/**
 * 트리 UI 렌더러
 * 계층적 작업 구조를 디렉토리 탐색 UI처럼 표현
 */

/**
 * 트리 아이템을 렌더링
 * @param {Object} task - 작업 객체
 * @param {number} depth - 트리 깊이
 * @returns {string} HTML 문자열
 */
function renderTreeItem(task, depth = 0) {
  const hasChildren = task.tasks && task.tasks.length > 0;
  const toggleClass = hasChildren ? '' : 'no-children';
  const childrenId = `children-${task.id}`;
  const detailsId = `details-${task.id}`;
  const detailsContentId = `details-content-${task.id}`;

  let html = `
    <div class="tree-item" data-depth="${depth}" data-testid="tree-item-${task.id}">
      <div class="tree-item-header" onclick="toggleTreeItem('${task.id}')">
        <span class="tree-toggle ${toggleClass}" id="toggle-${task.id}">▶</span>
        <div class="tree-item-content">
          <span class="tree-item-title" data-testid="tree-item-title">${escapeHtml(task.id)}</span>
          <span class="tree-item-status status-${task.status}" data-testid="tree-item-status">${task.status}</span>
        </div>
      </div>
      <div class="tree-item-description" data-testid="tree-item-description">
        ${escapeHtml(task.goal)}
      </div>
  `;

  // 상세 정보 (Acceptance Criteria)
  if (task.acceptanceHtml) {
    html += `
      <div class="tree-item-details" id="${detailsId}">
        <div class="tree-item-details-header" onclick="toggleDetails('${task.id}')">
          <span class="tree-item-details-title">Acceptance Criteria</span>
          <span class="tree-item-details-toggle" id="details-toggle-${task.id}">▼</span>
        </div>
        <div class="tree-item-details-content" id="${detailsContentId}">
          ${task.acceptanceHtml}
        </div>
      </div>
    `;
  }

  // 자식 작업들
  if (hasChildren) {
    html += `<div class="tree-children" id="${childrenId}">`;
    for (const child of task.tasks) {
      html += renderTreeItem(child, depth + 1);
    }
    html += '</div>';
  }

  html += '</div>';
  return html;
}

/**
 * 트리 아이템 펼치기/접기
 * @param {string} taskId - 작업 ID
 */
function toggleTreeItem(taskId) {
  const toggle = document.getElementById(`toggle-${taskId}`);
  const children = document.getElementById(`children-${taskId}`);
  const details = document.getElementById(`details-${taskId}`);
  const treeItem = document.querySelector(`[data-testid="tree-item-${taskId}"]`);

  if (!toggle || toggle.classList.contains('no-children')) {
    return;
  }

  if (children) {
    const isExpanded = children.classList.contains('expanded');

    if (isExpanded) {
      children.classList.remove('expanded');
      toggle.classList.remove('expanded');
      if (treeItem) {
        treeItem.classList.remove('expanded');
      }
      if (details) {
        details.style.display = 'none';
      }
    } else {
      children.classList.add('expanded');
      toggle.classList.add('expanded');
      if (treeItem) {
        treeItem.classList.add('expanded');
      }
      if (details) {
        details.style.display = 'block';
      }
    }
  }
}

/**
 * 상세 정보 표시/숨기기
 * @param {string} taskId - 작업 ID
 */
function toggleDetails(taskId) {
  const content = document.getElementById(`details-content-${taskId}`);
  const toggleIcon = document.getElementById(`details-toggle-${taskId}`);

  if (!content || !toggleIcon) {
    return;
  }

  const isVisible = content.classList.contains('visible');

  if (isVisible) {
    content.classList.remove('visible');
    toggleIcon.classList.remove('expanded');
  } else {
    content.classList.add('visible');
    toggleIcon.classList.add('expanded');
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

/**
 * 모든 트리 아이템 펼치기
 */
function expandAll() {
  const allToggles = document.querySelectorAll('.tree-toggle:not(.no-children)');
  allToggles.forEach(toggle => {
    const taskId = toggle.id.replace('toggle-', '');
    const children = document.getElementById(`children-${taskId}`);
    const details = document.getElementById(`details-${taskId}`);
    const treeItem = document.querySelector(`[data-testid="tree-item-${taskId}"]`);

    if (children && !children.classList.contains('expanded')) {
      children.classList.add('expanded');
      toggle.classList.add('expanded');
      if (treeItem) {
        treeItem.classList.add('expanded');
      }
      if (details) {
        details.style.display = 'block';
      }
    }
  });
}

/**
 * 모든 트리 아이템 접기
 */
function collapseAll() {
  const allToggles = document.querySelectorAll('.tree-toggle:not(.no-children)');
  allToggles.forEach(toggle => {
    const taskId = toggle.id.replace('toggle-', '');
    const children = document.getElementById(`children-${taskId}`);
    const details = document.getElementById(`details-${taskId}`);
    const treeItem = document.querySelector(`[data-testid="tree-item-${taskId}"]`);

    if (children && children.classList.contains('expanded')) {
      children.classList.remove('expanded');
      toggle.classList.remove('expanded');
      if (treeItem) {
        treeItem.classList.remove('expanded');
      }
      if (details) {
        details.style.display = 'none';
      }
    }
  });
}

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
