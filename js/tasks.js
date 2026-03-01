/**
 * tasks.js — Task Page Logic
 * Instant render · toast feedback · sprint card · EOD bar
 */

class TasksPage {
  constructor() {
    this.user = auth.getUser();
    this.currentSprintTask = null;
    this.sprintTimer = null;
    this.sprintSeconds = 0;
    this.sprintTotal = 25 * 60;
    this.init();
  }

  async init() {
    if (!this.user) return;
    await db.init();
    this.updateHeader();
    this.setupForm();
    this.setupSprintControls();
    await this.loadTasks();
  }

  updateHeader() {
    const name = this.user.username || this.user.displayName || this.user.email || 'User';
    const avatarEl = document.getElementById('userAvatar');
    const userEl = document.getElementById('username');
    if (avatarEl) avatarEl.textContent = name.slice(0, 2).toUpperCase();
    if (userEl) userEl.textContent = name;
  }

  // ── FORM ─────────────────────────────────────────
  setupForm() {
    const form = document.getElementById('taskForm');
    const btn = document.getElementById('addTaskBtn');
    if (!form) return;

    form.addEventListener('submit', async e => {
      e.preventDefault();

      const titleInput = document.getElementById('taskTitle');
      const title = titleInput?.value?.trim();
      if (!title) {
        if (titleInput) {
          titleInput.style.borderColor = 'var(--red)';
          titleInput.focus();
          setTimeout(() => { titleInput.style.borderColor = ''; }, 1500);
        }
        return;
      }

      // Loading state
      if (btn) { btn.textContent = 'Adding…'; btn.classList.add('loading'); }

      const task = {
        id: utils.generateId(),
        userId: this.user.id || this.user.userId,
        title,
        category: document.getElementById('taskCategory')?.value || 'deep-work',
        difficulty: document.getElementById('taskDifficulty')?.value || 'medium',
        notes: document.getElementById('taskNotes')?.value || '',
        status: 'pending',
        createdAt: new Date().toISOString(),
        completedAt: null,
      };

      try {
        await db.addRecord('tasks', task);
        form.reset();

        // Flash the panel
        const panel = form.closest('.panel');
        if (panel) panel.classList.add('form-success');
        setTimeout(() => panel?.classList.remove('form-success'), 800);

        await this.loadTasks();

        // Animate the newly added item
        const first = document.querySelector('#tasksList .task-item');
        if (first) {
          first.classList.add('just-added');
          setTimeout(() => first.classList.remove('just-added'), 600);
        }

        utils.showNotification(`"${task.title}" added!`, 'success');
      } catch (err) {
        console.error('addTask:', err);
        utils.showNotification('Failed to add task — please try again', 'error');
      } finally {
        if (btn) { btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 2v10M2 7h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg> Add Task`; btn.classList.remove('loading'); }
      }
    });
  }

  // ── REFRESH BUTTON ───────────────────────────────
  async refreshTasks() {
    const btn = document.getElementById('refreshTasksBtn');
    if (btn) { btn.classList.add('spinning'); btn.disabled = true; }
    try {
      await this.loadTasks();
      utils.showNotification('Tasks refreshed ✓', 'success');
    } catch (e) {
      console.error('refreshTasks:', e);
      utils.showNotification('Refresh failed', 'error');
    } finally {
      if (btn) {
        setTimeout(() => { btn.classList.remove('spinning'); btn.disabled = false; }, 400);
      }
    }
  }

  // ── LOAD / RENDER ─────────────────────────────────
  async loadTasks() {
    try {
      const uid = this.user.id || this.user.userId;
      const tasks = await db.queryByIndex('tasks', 'userId', uid);
      const active = tasks.filter(t => t.status !== 'archived');
      const done = active.filter(t => t.status === 'completed').length;
      const total = active.length;
      const pct = total > 0 ? Math.round((done / total) * 100) : 0;

      // Progress
      const txtEl = document.getElementById('progressText');
      const pctEl = document.getElementById('progressPercent');
      const barEl = document.getElementById('progressBar');
      if (txtEl) txtEl.textContent = `${done} of ${total} tasks completed`;
      if (pctEl) pctEl.textContent = pct + '%';
      if (barEl) barEl.style.width = pct + '%';

      // EOD bar
      if (window.updateEodProgress) window.updateEodProgress(done, total);

      // List
      const list = document.getElementById('tasksList');
      if (!list) return;

      if (active.length === 0) {
        list.innerHTML = `
          <div class="empty-state">
            <span class="empty-icon">🎯</span>
            <span class="empty-text">No tasks yet.</span>
            <span class="empty-cta-text">Add one to get started!</span>
          </div>`;
        return;
      }

      const sorted = [...active].sort((a, b) =>
        a.status === b.status
          ? new Date(b.createdAt) - new Date(a.createdAt)
          : a.status === 'pending' ? -1 : 1
      );
      list.innerHTML = sorted.map((t, i) => this._renderTask(t, i)).join('');
    } catch (e) { console.error('loadTasks:', e); }
  }

  _renderTask(task, idx) {
    const done = task.status === 'completed';
    const delay = Math.min(idx * 35, 280);
    return `
      <div class="task-item ${done ? 'completed' : ''}"
           data-id="${task.id}" style="animation-delay:${delay}ms">
        <div class="task-check ${done ? 'done' : ''}"
             onclick="tasksPage.toggleTask('${task.id}')">
          ${done ? '✓' : ''}
        </div>
        <div class="task-content">
          <div class="task-title">${this._esc(task.title)}</div>
          <div class="task-meta">
            <span class="task-tag tag-${task.category}">${task.category.replace('-', ' ')}</span>
            <span class="task-difficulty ${task.difficulty}">${task.difficulty}</span>
            ${task.notes ? `<span class="task-tag" title="${this._esc(task.notes)}">note</span>` : ''}
          </div>
        </div>
        <div class="task-actions">
          ${!done
        ? `<button class="btn btn-sprint"
                onclick="tasksPage.startSprint('${task.id}','${this._esc(task.title).replace(/'/g, "&#39;")}')">
                ⚡ Sprint
               </button>`
        : ''}
          <button class="btn danger"
                  onclick="tasksPage.deleteTask('${task.id}')">✕</button>
        </div>
      </div>`;
  }

  _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // ── TOGGLE / DELETE ───────────────────────────────
  async toggleTask(id) {
    try {
      const task = await db.getRecord('tasks', id);
      task.status = task.status === 'completed' ? 'pending' : 'completed';
      task.completedAt = task.status === 'completed' ? new Date().toISOString() : null;
      await db.updateRecord('tasks', task);
      await this.loadTasks();
      if (task.status === 'completed') {
        utils.showNotification(`"${task.title}" complete! ✓`, 'success');
      }
    } catch (e) {
      console.error('toggleTask:', e);
      utils.showNotification('Failed to update task', 'error');
    }
  }

  async deleteTask(id) {
    let title = '';
    try { title = (await db.getRecord('tasks', id))?.title || 'Task'; } catch (_) { }
    if (!confirm(`Delete "${title}"?`)) return;
    try {
      await db.deleteRecord('tasks', id);
      await this.loadTasks();
      utils.showNotification(`"${title}" deleted`, 'warn');
    } catch (e) {
      console.error('deleteTask:', e);
      utils.showNotification('Failed to delete task', 'error');
    }
  }

  // ── SPRINT ────────────────────────────────────────
  startSprint(taskId, taskTitle) {
    this.currentSprintTask = { id: taskId, title: taskTitle };
    this.sprintSeconds = this.sprintTotal;
    this._showFocusOverlay();
    this._updateSprintCard(true, taskTitle);
    this._runTimer();
  }

  stopSprintFromWidget() {
    if (!confirm('Exit sprint? You will lose 50 points.')) return;
    clearInterval(this.sprintTimer);
    this._hideFocusOverlay();
    this._updateSprintCard(false);
    utils.showNotification('Sprint exited. −50 points.', 'warn');
    this.loadTasks();
  }

  _updateSprintCard(active, title = '') {
    const card = document.getElementById('sprintCard');
    const titleEl = document.getElementById('sprintCardTitle');
    const subEl = document.getElementById('sprintCardSub');
    const timerEl = document.getElementById('sprintCardTimer');
    const stopEl = document.getElementById('sprintCardStop');

    if (active) {
      card?.classList.add('active');
      if (titleEl) titleEl.textContent = title || 'Sprint active';
      if (subEl) subEl.textContent = '25-minute focus session in progress';
      if (timerEl) timerEl.style.display = 'block';
      if (stopEl) stopEl.style.display = 'inline-flex';
    } else {
      card?.classList.remove('active');
      if (titleEl) titleEl.textContent = 'No sprint active';
      if (subEl) subEl.textContent = 'Select a task below and hit Start Sprint';
      if (timerEl) { timerEl.style.display = 'none'; timerEl.textContent = '25:00'; }
      if (stopEl) stopEl.style.display = 'none';
    }
  }

  _showFocusOverlay() {
    const ov = document.getElementById('focusOverlay');
    if (!ov) return;
    ov.classList.add('active');
    document.body.classList.add('in-focus');
    document.getElementById('focusTaskName').textContent = this.currentSprintTask.title;
    document.getElementById('focusTimer').textContent = '25:00';
    document.getElementById('focusWPM').textContent = '0';
    document.getElementById('focusScore').textContent = '0';
    document.getElementById('focusBar').style.width = '0%';
    document.addEventListener('keydown', this._focusKey);
  }

  _hideFocusOverlay() {
    const ov = document.getElementById('focusOverlay');
    if (ov) { ov.classList.remove('active'); document.body.classList.remove('in-focus'); }
    document.removeEventListener('keydown', this._focusKey);
  }

  _focusKey(e) {
    if (e.key === 'Escape' || (e.ctrlKey && e.key === 'w') || (e.metaKey && e.key === 'w')) {
      e.preventDefault();
    }
  }

  _runTimer() {
    clearInterval(this.sprintTimer);
    this.sprintTimer = setInterval(() => {
      this.sprintSeconds--;
      const min = Math.floor(this.sprintSeconds / 60);
      const sec = this.sprintSeconds % 60;
      const str = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
      const pct = ((this.sprintTotal - this.sprintSeconds) / this.sprintTotal) * 100;

      // Focus overlay
      const timerEl = document.getElementById('focusTimer');
      const barEl = document.getElementById('focusBar');
      if (timerEl) timerEl.textContent = str;
      if (barEl) barEl.style.width = pct + '%';

      // Sprint card
      const cardTimer = document.getElementById('sprintCardTimer');
      if (cardTimer) cardTimer.textContent = str;

      // Score preview
      const scoreEl = document.getElementById('focusScore');
      if (scoreEl) {
        const base = { easy: 100, medium: 200, hard: 350 }[this.currentSprintTask?.difficulty] || 200;
        scoreEl.textContent = Math.round(base * pct / 100);
      }

      if (this.sprintSeconds <= 0) {
        clearInterval(this.sprintTimer);
        this._completeSprint();
      }
    }, 1000);
  }

  async _completeSprint() {
    try {
      const task = await db.getRecord('tasks', this.currentSprintTask.id);
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      await db.updateRecord('tasks', task);

      const sprint = {
        id: utils.generateId(),
        userId: this.user.id || this.user.userId,
        taskId: task.id,
        taskName: task.title,
        category: task.category,
        difficulty: task.difficulty,
        status: 'completed',
        score: utils.calculateScore(task.difficulty, 0, true),
        createdAt: new Date().toISOString(),
        duration: this.sprintTotal,
      };
      await db.addRecord('sprints', sprint);

      const stats = await db.getRecord('stats', this.user.id || this.user.userId).catch(() => null);
      if (stats) {
        stats.totalSprints = (stats.totalSprints || 0) + 1;
        stats.totalScore = (stats.totalScore || 0) + sprint.score;
        await db.updateRecord('stats', stats);
      }

      this._hideFocusOverlay();
      this._updateSprintCard(false);
      clearInterval(this.sprintTimer);
      await this.loadTasks();
      utils.showNotification(`Sprint complete! +${sprint.score} pts 🎉`, 'success', 5000);

      // Refresh sibling pages if open in same tab (single-page navigation)
      if (window.analyticsPage) window.analyticsPage.refresh();
      if (window.leaguePage) window.leaguePage.refresh();
      if (window.friendsPage) window.friendsPage.refresh();
    } catch (e) {
      console.error('completeSprint:', e);
      utils.showNotification('Error completing sprint', 'error');
    }
  }

  setupSprintControls() {
    document.getElementById('focusCompleteBtn')
      ?.addEventListener('click', () => this._completeSprint());

    document.getElementById('focusPauseBtn')
      ?.addEventListener('click', () => utils.showNotification('Pause coming soon', 'info'));

    document.getElementById('focusBailBtn')
      ?.addEventListener('click', () => {
        if (!confirm('Exit sprint? You will lose 50 points.')) return;
        clearInterval(this.sprintTimer);
        this._hideFocusOverlay();
        this._updateSprintCard(false);
        utils.showNotification('Sprint exited. −50 points.', 'warn');
        this.loadTasks();
      });
  }
}

let tasksPage;
document.addEventListener('DOMContentLoaded', () => { tasksPage = new TasksPage(); });