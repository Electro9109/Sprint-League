/**
 * tasks.js — Task CRUD + Sprint Focus Overlay
 * Fixed: userId field, renderTask CSS classes, elapsed timer, progress bar
 */

class TasksPage {
  constructor() {
    this.user        = auth.getUser();
    this.currentSprintTask = null;
    this.sprintTimer       = null;
    this.sprintSeconds     = 0;
    this.sprintTotalSecs   = 25 * 60;
    this.elapsedTimer      = null;
    this.elapsedSeconds    = 0;
    this.isPaused          = false;
    this.init();
  }

  get uid() {
    // auth stores user as { userId, username, email, ... }
    return this.user?.userId || this.user?.id;
  }

  async init() {
    if (!this.user) return;
    this.updateHeader();
    this.setupTaskForm();
    this.setupIntensityCards();
    this.setupSprintControls();
    await this.loadTasks();
  }

  updateHeader() {
    const av = document.getElementById('userAvatar');
    const un = document.getElementById('username');
    const name = this.user.username || this.user.displayName || this.user.email || 'User';
    if (av) av.textContent = name.slice(0, 2).toUpperCase();
    if (un) un.textContent = name;
  }

  setupTaskForm() {
    const form = document.getElementById('taskForm');
    if (!form) return;
    form.addEventListener('submit', async (ev) => {
      ev.preventDefault();
      const title = document.getElementById('taskTitle').value.trim();
      if (!title) return;

      const task = {
        id:         utils.generateId(),
        userId:     this.uid,
        title,
        category:   document.getElementById('taskCategory').value,
        difficulty: document.getElementById('taskDifficulty').value,
        notes:      document.getElementById('taskNotes')?.value?.trim() || '',
        status:     'pending',
        createdAt:  new Date().toISOString(),
        completedAt: null,
      };

      try {
        await db.addRecord('tasks', task);
        form.reset();
        await this.loadTasks();
        utils.showNotification('Task added! ✓', 'success');

        // Animate the new task item in
        const list = document.getElementById('tasksList');
        if (list && list.firstElementChild) {
          list.firstElementChild.style.animation = 'taskSlideIn 0.3s ease';
        }
      } catch (err) {
        console.error('Failed to create task:', err);
        utils.showNotification('Failed to create task', 'error');
      }
    });
  }

  setupIntensityCards() {
    document.querySelectorAll('.intensity-card').forEach(card => {
      card.addEventListener('click', () => {
        document.querySelectorAll('.intensity-card').forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
    });
  }

  async loadTasks() {
    try {
      const tasks      = await db.queryByIndex('tasks', 'userId', this.uid);
      const active     = tasks.filter(t => t.status !== 'archived');
      const completed  = active.filter(t => t.status === 'completed').length;
      const total      = active.length;
      const pct        = total > 0 ? Math.round((completed / total) * 100) : 0;

      const progressText    = document.getElementById('progressText');
      const progressPercent = document.getElementById('progressPercent');
      const progressBar     = document.getElementById('progressBar');

      if (progressText)    progressText.textContent    = `${completed} of ${total} tasks completed`;
      if (progressPercent) progressPercent.textContent = pct + '%';
      if (progressBar)     progressBar.style.width     = pct + '%';

      const list = document.getElementById('tasksList');
      if (!list) return;

      if (active.length === 0) {
        list.innerHTML = `<div class="empty-state">No tasks yet. Add one above to get started! 🚀</div>`;
        return;
      }

      // Sort: pending first, then completed
      const sorted = [...active].sort((a, b) => {
        if (a.status === b.status) return new Date(b.createdAt) - new Date(a.createdAt);
        return a.status === 'pending' ? -1 : 1;
      });

      list.innerHTML = sorted.map(t => this.renderTask(t)).join('');
    } catch (err) {
      console.error('loadTasks:', err);
    }
  }

  renderTask(task) {
    const done = task.status === 'completed';
    const catColors = {
      'deep-work': 'var(--accent)',
      'creative':  'var(--accent3)',
      'learning':  'var(--accent4)',
      'meeting':   'var(--accent2)',
      'admin':     'var(--text2)',
    };
    const color     = catColors[task.category] || 'var(--text2)';
    const date      = task.completedAt
      ? `<span style="color:var(--success);font-size:10px">✓ done</span>`
      : `<span>${utils.formatDate(task.createdAt)}</span>`;

    return `
    <div class="task-row ${done ? 'completed' : ''}" data-id="${task.id}" style="animation: taskSlideIn 0.3s ease both">
      <div class="task-row-check ${done ? 'done' : ''}" onclick="tasksPage.toggleTask('${task.id}')">
        ${done ? '✓' : ''}
      </div>
      <div class="task-row-content">
        <div class="task-row-title">${this._escape(task.title)}</div>
        <div class="task-row-meta">
          <span class="task-row-tag ${task.category}" style="border-color:${color};color:${color}">
            ${task.category.replace('-',' ')}
          </span>
          <span class="task-row-diff ${task.difficulty}">${task.difficulty}</span>
          ${task.notes ? `<span style="font-size:11px;color:var(--muted)">· ${this._escape(task.notes)}</span>` : ''}
          ${date}
        </div>
      </div>
      <div class="task-row-actions">
        ${!done ? `<button class="btn-sprint" onclick="tasksPage.startSprint('${task.id}', '${this._escape(task.title)}')">⚡ Sprint</button>` : ''}
        <button class="btn-delete" onclick="tasksPage.deleteTask('${task.id}')">✕</button>
      </div>
    </div>`;
  }

  _escape(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async toggleTask(taskId) {
    try {
      const task = await db.getRecord('tasks', taskId);
      task.status      = task.status === 'completed' ? 'pending' : 'completed';
      task.completedAt = task.status === 'completed' ? new Date().toISOString() : null;
      await db.updateRecord('tasks', task);
      await this.loadTasks();
    } catch (err) {
      console.error('toggleTask:', err);
    }
  }

  async deleteTask(taskId) {
    if (!confirm('Delete this task?')) return;
    try {
      await db.deleteRecord('tasks', taskId);
      await this.loadTasks();
    } catch (err) {
      console.error('deleteTask:', err);
    }
  }

  // ── SPRINT ──────────────────────────────────────────────────

  startSprint(taskId, taskTitle) {
    this.currentSprintTask  = { id: taskId, title: taskTitle };
    this.sprintTotalSecs    = 25 * 60;
    this.sprintSeconds      = this.sprintTotalSecs;
    this.elapsedSeconds     = 0;
    this.isPaused           = false;
    this.showFocusOverlay();
    this.runSprintTimer();
  }

  showFocusOverlay() {
    const overlay = document.getElementById('focusOverlay');
    if (!overlay) return;
    overlay.classList.add('active');
    document.body.classList.add('in-focus');

    // Populate
    const nameEl  = document.getElementById('focusTaskName');
    const timeEl  = document.getElementById('focusTimer');
    const wpmEl   = document.getElementById('focusWPM');
    const scoreEl = document.getElementById('focusScore');
    const pctEl   = document.getElementById('focusPct');
    const barEl   = document.getElementById('focusBar');

    if (nameEl)  nameEl.textContent  = this.currentSprintTask.title;
    if (timeEl)  timeEl.textContent  = '25:00';
    if (wpmEl)   wpmEl.textContent   = '00:00';
    if (scoreEl) scoreEl.textContent = '+0';
    if (pctEl)   pctEl.textContent   = '0%';
    if (barEl)   barEl.style.width   = '0%';

    this._boundKeyHandler = this.focusKeyHandler.bind(this);
    document.addEventListener('keydown', this._boundKeyHandler);
  }

  focusKeyHandler(ev) {
    if (ev.key === 'Escape' || (ev.ctrlKey && ev.key === 'w') || (ev.metaKey && ev.key === 'w')) {
      ev.preventDefault();
    }
  }

  setFocusInactive() {
    const overlay = document.getElementById('focusOverlay');
    if (overlay) {
      overlay.classList.remove('active');
      document.body.classList.remove('in-focus');
    }
    if (this._boundKeyHandler) {
      document.removeEventListener('keydown', this._boundKeyHandler);
    }
  }

  runSprintTimer() {
    clearInterval(this.sprintTimer);
    clearInterval(this.elapsedTimer);

    // Elapsed counter
    this.elapsedTimer = setInterval(() => {
      if (this.isPaused) return;
      this.elapsedSeconds++;
      const wpmEl = document.getElementById('focusWPM');
      if (wpmEl) wpmEl.textContent = utils.formatTime(this.elapsedSeconds);
    }, 1000);

    // Countdown
    this.sprintTimer = setInterval(() => {
      if (this.isPaused) return;
      this.sprintSeconds--;

      const timerEl  = document.getElementById('focusTimer');
      const barEl    = document.getElementById('focusBar');
      const pctEl    = document.getElementById('focusPct');
      const scoreEl  = document.getElementById('focusScore');

      if (timerEl) {
        timerEl.textContent = utils.formatTime(this.sprintSeconds);
        // Warning pulse when < 2min
        if (this.sprintSeconds < 120) timerEl.classList.add('warning');
        else timerEl.classList.remove('warning');
      }

      const pct = ((this.sprintTotalSecs - this.sprintSeconds) / this.sprintTotalSecs) * 100;
      if (barEl)   barEl.style.width   = pct.toFixed(1) + '%';
      if (pctEl)   pctEl.textContent   = Math.round(pct) + '%';

      // Live score preview
      const partialScore = Math.round(utils.calculateScore('medium', 0, true) * (pct / 100));
      if (scoreEl) scoreEl.textContent = '+' + partialScore;

      if (this.sprintSeconds <= 0) {
        clearInterval(this.sprintTimer);
        clearInterval(this.elapsedTimer);
        this.completeSprint();
      }
    }, 1000);
  }

  async completeSprint() {
    try {
      const task = await db.getRecord('tasks', this.currentSprintTask.id);
      if (!task) throw new Error('Task not found');

      task.status      = 'completed';
      task.completedAt = new Date().toISOString();
      await db.updateRecord('tasks', task);

      const score = utils.calculateScore(task.difficulty, 0, true);

      const sprint = {
        id:         utils.generateId(),
        userId:     this.uid,
        taskId:     task.id,
        taskName:   task.title,
        category:   task.category,
        difficulty: task.difficulty,
        status:     'completed',
        score,
        createdAt:  new Date().toISOString(),
        duration:   this.sprintTotalSecs - this.sprintSeconds,
      };
      await db.addRecord('sprints', sprint);

      // Update stats — use this.uid, not this.user.id
      let stats = await db.getRecord('stats', this.uid);
      if (!stats) {
        stats = { userId: this.uid, totalSprints: 0, totalScore: 0, streak: 0 };
      }
      stats.totalSprints = (stats.totalSprints || 0) + 1;
      stats.totalScore   = (stats.totalScore   || 0) + score;
      stats.lastSprintAt = new Date().toISOString();
      await db.updateRecord('stats', stats);

      utils.showNotification(`Sprint complete! +${score} pts 🎉`, 'success');
      this.setFocusInactive();
      clearInterval(this.sprintTimer);
      clearInterval(this.elapsedTimer);
      await this.loadTasks();
    } catch (err) {
      console.error('completeSprint:', err);
      utils.showNotification('Error saving sprint', 'error');
    }
  }

  setupSprintControls() {
    document.getElementById('focusCompleteBtn')?.addEventListener('click', () => {
      clearInterval(this.sprintTimer);
      clearInterval(this.elapsedTimer);
      this.completeSprint();
    });

    document.getElementById('focusPauseBtn')?.addEventListener('click', () => {
      this.isPaused = !this.isPaused;
      const btn = document.getElementById('focusPauseBtn');
      if (btn) btn.textContent = this.isPaused ? '▶ Resume' : '⏸ Pause';
    });

    document.getElementById('focusBailBtn')?.addEventListener('click', () => {
      if (!confirm('Bail on this sprint? You\'ll lose 50 points.')) return;
      clearInterval(this.sprintTimer);
      clearInterval(this.elapsedTimer);
      this.setFocusInactive();
      utils.showNotification('Sprint abandoned. −50 pts 😬', 'warning');
    });
  }
}

/* ── Slide-in keyframe (injected once) ── */
(function injectTaskAnim() {
  if (document.getElementById('task-anim-style')) return;
  const s = document.createElement('style');
  s.id = 'task-anim-style';
  s.textContent = `@keyframes taskSlideIn { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }`;
  document.head.appendChild(s);
})();

let tasksPage;
document.addEventListener('DOMContentLoaded', () => { tasksPage = new TasksPage(); });