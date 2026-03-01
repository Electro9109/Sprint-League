/**
 * utils.js — Shared utility functions
 */

const utils = (() => {

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  /**
   * Calculate sprint score based on difficulty and bail status
   */
  function calculateScore(difficulty, bonusWpm = 0, completed = true) {
    if (!completed) return -50;
    const base = { easy: 100, medium: 200, hard: 350 }[difficulty] || 150;
    const wpmBonus = Math.min(bonusWpm * 2, 200);
    return base + wpmBonus;
  }

  /**
   * Show a toast notification
   * @param {string} message
   * @param {'info'|'success'|'error'|'warning'} type
   * @param {number} duration ms
   */
  function showNotification(message, type = 'info', duration = 3500) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const typeMap = { info: 'info', success: 'success', error: 'error', warning: 'warn' };
    const cssClass = typeMap[type] || 'info';
    const titleMap = { info: 'INFO', success: 'SUCCESS', error: 'ERROR', warning: 'WARNING' };

    const toast = document.createElement('div');
    toast.className = `toast ${cssClass}`;
    toast.innerHTML = `<div class="toast-title">${titleMap[type] || 'INFO'}</div>${message}`;

    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(120%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  }

  /**
   * Format seconds to MM:SS
   */
  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  /**
   * Format a date as "Feb 24"
   */
  function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return { generateId, calculateScore, showNotification, formatTime, formatDate };
})();