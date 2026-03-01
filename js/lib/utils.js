/**
 * utils.js — Shared utility functions
 */

const utils = (() => {

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function calculateScore(difficulty, bonusWpm = 0, completed = true) {
    if (!completed) return -50;
    const base     = { easy: 100, medium: 200, hard: 350 }[difficulty] || 150;
    const wpmBonus = Math.min(bonusWpm * 2, 200);
    return base + wpmBonus;
  }

  function showNotification(message, type = 'info', duration = 3800) {
    let container = document.getElementById('toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toast-container';
      document.body.appendChild(container);
    }

    const map = {
      info:    { cls: 'info',    title: 'INFO'    },
      success: { cls: 'success', title: 'SUCCESS' },
      error:   { cls: 'error',   title: 'ERROR'   },
      warning: { cls: 'warn',    title: 'WARNING' },
      warn:    { cls: 'warn',    title: 'WARNING' },
    };
    const t = map[type] || map.info;

    const toast = document.createElement('div');
    toast.className = `toast ${t.cls}`;
    toast.innerHTML = `<div class="toast-title">${t.title}</div>${message}`;
    toast.title     = 'Click to dismiss';
    container.appendChild(toast);

    let dismissed = false;
    const dismiss = () => {
      if (dismissed) return;
      dismissed = true;
      toast.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
      toast.style.opacity    = '0';
      toast.style.transform  = 'translateX(110%)';
      setTimeout(() => toast.remove(), 260);
    };

    toast.addEventListener('click', dismiss);
    setTimeout(dismiss, duration);
  }

  function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  }

  function formatDate(isoString) {
    const d = new Date(isoString);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  return { generateId, calculateScore, showNotification, formatTime, formatDate };
})();