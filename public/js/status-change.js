/**
 * Status Change Manager
 * 상태 변경사항을 추적하고 일괄 업데이트를 처리합니다.
 */

// 전역 객체로 노출하여 명시적 초기화 가능
window.StatusChangeManager = (function () {
  // 변경사항을 추적하는 Map: taskId -> { rootTaskId, newStatus, originalStatus }
  const changes = new Map();

  // Submit 버튼
  let submitButton = null;

  // 초기화 완료 여부
  let initialized = false;

  /**
   * 상태 변경 처리
   */
  function handleStatusChange(event) {
    const dropdown = event.target;
    const taskId = dropdown.dataset.taskId;
    const rootTaskId = dropdown.dataset.rootTaskId;
    const originalStatus = dropdown.dataset.originalStatus;
    const newStatus = dropdown.value;

    // 원래 상태로 돌아갔으면 변경사항에서 제거
    if (newStatus === originalStatus) {
      changes.delete(taskId);
    } else {
      // 변경사항 추가
      changes.set(taskId, {
        rootTaskId,
        newStatus,
        originalStatus,
      });
    }

    // Submit 버튼 활성화/비활성화
    updateSubmitButton();
  }

  /**
   * Submit 버튼 상태 업데이트
   */
  function updateSubmitButton() {
    if (submitButton) {
      submitButton.disabled = changes.size === 0;
    }
  }

  /**
   * Submit 처리
   */
  async function handleSubmit() {
    if (changes.size === 0) {
      return;
    }

    // 변경사항을 API 요청 형식으로 변환
    const updates = Array.from(changes.entries()).map(([taskId, change]) => ({
      taskId,
      rootTaskId: change.rootTaskId,
      status: change.newStatus,
    }));

    try {
      // Submit 버튼 비활성화 및 로딩 표시
      submitButton.disabled = true;
      submitButton.textContent = '저장 중...';

      // API 호출
      const response = await fetch('/api/tasks/batch-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ updates }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      // 성공한 항목들의 original status 업데이트
      result.results.forEach((r) => {
        if (r.success) {
          const dropdown = document.querySelector(
            `.status-dropdown[data-task-id="${r.taskId}"]`
          );
          if (dropdown) {
            // original status를 새로운 값으로 업데이트
            dropdown.dataset.originalStatus = dropdown.value;
          }
        }
      });

      // 변경사항 초기화
      changes.clear();
      updateSubmitButton();

      // 버튼 텍스트 복원
      submitButton.textContent = '변경사항 저장';

      // 성공 메시지 표시
      if (window.Toast) {
        window.Toast.success('상태가 성공적으로 업데이트되었습니다');
      }
    } catch (error) {
      console.error('Failed to update statuses:', error);
      submitButton.textContent = '변경사항 저장';
      submitButton.disabled = false;

      // 에러 메시지 표시
      if (window.Toast) {
        window.Toast.error('상태 업데이트에 실패했습니다. 다시 시도해주세요.');
      } else {
        alert('상태 업데이트에 실패했습니다. 다시 시도해주세요.');
      }
    }
  }

  /**
   * 명시적 초기화 함수 (외부에서 호출)
   */
  function init() {
    if (initialized) {
      console.warn('StatusChangeManager already initialized');
      return;
    }

    submitButton = document.getElementById('submitStatusChanges');

    if (!submitButton) {
      console.error('Submit button not found');
      return;
    }

    // 모든 status dropdown에 change 이벤트 리스너 추가
    const dropdowns = document.querySelectorAll('.status-dropdown');
    if (dropdowns.length === 0) {
      console.error('No status dropdowns found');
      return;
    }

    dropdowns.forEach((dropdown) => {
      dropdown.addEventListener('change', handleStatusChange);
    });

    // Submit 버튼 클릭 이벤트
    submitButton.addEventListener('click', handleSubmit);

    initialized = true;
    console.log('StatusChangeManager initialized with', dropdowns.length, 'dropdowns');
  }

  // Public API
  return {
    init: init,
  };
})();
