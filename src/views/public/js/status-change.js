/**
 * Status Change Manager
 * 상태 변경사항 및 추가 지침 변경사항을 추적하고 일괄 업데이트를 처리합니다.
 */

// 전역 객체로 노출하여 명시적 초기화 가능
window.StatusChangeManager = (function () {
  // 상태 변경사항 추적 Map: taskId -> { rootTaskId, newStatus, originalStatus }
  const statusChanges = new Map();

  // 추가 지침 변경사항 추적 Map: taskId -> { rootTaskId, newValue, originalValue }
  const instructionChanges = new Map();

  // Submit 버튼
  let submitButton = null;

  // 초기화 완료 여부
  let initialized = false;

  /**
   * 변경사항이 있는지 여부
   */
  function hasChanges() {
    return statusChanges.size > 0 || instructionChanges.size > 0;
  }

  /**
   * 상태 변경 처리 (radio 버튼)
   */
  function handleStatusChange(event) {
    const radio = event.target;
    const taskId = radio.dataset.taskId;
    const rootTaskId = radio.dataset.rootTaskId;
    const originalStatus = radio.dataset.originalStatus;
    const newStatus = radio.value;

    if (newStatus === originalStatus) {
      statusChanges.delete(taskId);
    } else {
      statusChanges.set(taskId, {
        rootTaskId,
        newStatus,
        originalStatus,
      });
    }

    updateSubmitButton();
  }

  /**
   * 추가 지침 변경 처리
   */
  function handleInstructionChange(event) {
    const textarea = event.target;
    const taskId = textarea.dataset.taskId;
    const rootTaskId = textarea.dataset.rootTaskId;
    const originalValue = textarea.dataset.originalValue;
    const newValue = textarea.value;

    if (newValue === originalValue) {
      instructionChanges.delete(taskId);
    } else {
      instructionChanges.set(taskId, {
        rootTaskId,
        newValue,
        originalValue,
      });
    }

    updateSubmitButton();
  }

  /**
   * Submit 버튼 상태 업데이트
   */
  function updateSubmitButton() {
    if (submitButton) {
      submitButton.disabled = !hasChanges();
    }
  }

  /**
   * Submit 처리
   */
  async function handleSubmit() {
    if (!hasChanges()) {
      return;
    }

    // taskId별로 updates 통합
    const updatesMap = new Map();

    statusChanges.forEach((change, taskId) => {
      updatesMap.set(taskId, {
        taskId,
        rootTaskId: change.rootTaskId,
        status: change.newStatus,
      });
    });

    instructionChanges.forEach((change, taskId) => {
      if (updatesMap.has(taskId)) {
        updatesMap.get(taskId).additionalInstructions = change.newValue;
      } else {
        updatesMap.set(taskId, {
          taskId,
          rootTaskId: change.rootTaskId,
          additionalInstructions: change.newValue,
        });
      }
    });

    const updates = Array.from(updatesMap.values());

    try {
      submitButton.disabled = true;
      submitButton.textContent = '저장 중...';

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

      // 성공한 항목들의 original 값 업데이트
      result.results.forEach((r) => {
        if (r.success) {
          // 해당 taskId의 모든 radio 버튼의 data-original-status 업데이트
          const radios = document.querySelectorAll(
            `.status-radio[data-task-id="${r.taskId}"]`
          );
          const checkedRadio = document.querySelector(
            `.status-radio[data-task-id="${r.taskId}"]:checked`
          );
          const newStatus = checkedRadio ? checkedRadio.value : null;
          if (newStatus) {
            radios.forEach((radio) => {
              radio.dataset.originalStatus = newStatus;
            });
          }

          const textarea = document.querySelector(
            `.additional-instructions-textarea[data-task-id="${r.taskId}"]`
          );
          if (textarea) {
            textarea.dataset.originalValue = textarea.value;
          }
        }
      });

      statusChanges.clear();
      instructionChanges.clear();
      updateSubmitButton();

      submitButton.textContent = '변경사항 저장';

      if (window.Toast) {
        window.Toast.success('변경사항이 성공적으로 저장되었습니다');
      }
    } catch (error) {
      console.error('Failed to update tasks:', error);
      submitButton.textContent = '변경사항 저장';
      submitButton.disabled = false;

      if (window.Toast) {
        window.Toast.error('저장에 실패했습니다. 다시 시도해주세요.');
      } else {
        alert('저장에 실패했습니다. 다시 시도해주세요.');
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

    // 모든 status radio에 change 이벤트 리스너 추가
    const radios = document.querySelectorAll('.status-radio');
    if (radios.length === 0) {
      console.warn('No status radios found');
    }

    radios.forEach((radio) => {
      radio.addEventListener('change', handleStatusChange);
    });

    // 모든 추가 지침 textarea에 input 이벤트 리스너 추가
    const textareas = document.querySelectorAll('.additional-instructions-textarea');
    textareas.forEach((textarea) => {
      textarea.addEventListener('input', handleInstructionChange);
    });

    // Submit 버튼 클릭 이벤트
    submitButton.addEventListener('click', handleSubmit);

    initialized = true;
    console.log(
      'StatusChangeManager initialized with',
      radios.length,
      'radios,',
      textareas.length,
      'textareas'
    );
  }

  // Public API
  return {
    init: init,
  };
})();
