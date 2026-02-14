/**
 * Toast Message Component
 * 간단한 토스트 메시지 표시
 */

window.Toast = (function () {
  /**
   * 토스트 메시지 표시
   * @param {string} message - 표시할 메시지
   * @param {string} type - 'success' | 'error' | 'info'
   * @param {number} duration - 표시 시간 (밀리초)
   */
  function show(message, type = 'info', duration = 3000) {
    // 토스트 컨테이너 생성 또는 가져오기
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }

    // 토스트 요소 생성
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;

    // 컨테이너에 추가
    container.appendChild(toast);

    // 애니메이션을 위해 약간 지연 후 show 클래스 추가
    setTimeout(() => {
      toast.classList.add('toast-show');
    }, 10);

    // 지정된 시간 후 제거
    setTimeout(() => {
      toast.classList.remove('toast-show');
      setTimeout(() => {
        container.removeChild(toast);
      }, 300); // 페이드아웃 애니메이션 시간
    }, duration);
  }

  /**
   * 성공 메시지
   */
  function success(message, duration) {
    show(message, 'success', duration);
  }

  /**
   * 에러 메시지
   */
  function error(message, duration) {
    show(message, 'error', duration);
  }

  /**
   * 정보 메시지
   */
  function info(message, duration) {
    show(message, 'info', duration);
  }

  return {
    show,
    success,
    error,
    info,
  };
})();
