/**
 * dashboard.js — Dashboard Page Logic
 */

class Dashboard {
  constructor() {
    this.user = auth.getUser();
    this.init();
  }

  async init() {
    if (!this.user) return;
    this.updateHeader();
    await this.loadTodaysTasks();
    await this.loadStats();
    await this.loadRecentSprints();
  }

  updateHeader() {
    const name = this.user.username || this.user.displayName || this.user.email || 'User';
    const first = name.split(' ')[0];

    const avatarEl = document.getElementById('userAvatar');
    const userEl   = document.getElementById('username');
    if (avatarEl) avatarEl.textContent = name.slice(0, 2).toUpperCase();
    if (userEl)   userEl.textContent   = name;

    const titleEl = document.getElementById('pageTitle');
    if (titleEl) titleEl.textContent = `Hey, ${first}`;
  }

  async loadTodaysTasks() {
    try {
      const uid      = this.user.userId || this.user.id;
      const tasks    = await db.queryByIndex('tasks', 'userId', uid);
      const today    = new Date().toDateString();
      const todays   = tasks.filter(t =>
        new Date(t.createdAt).toDateString() === today && t.status !== 'archived'
      );
      const done     = todays.filter(t => t.status === 'completed').length;

      // Stat card
      const countEl = document.getElementById('todayCount');
      const progEl  = document.getElementById('todayProgress');
      if (countEl) countEl.textContent = todays.length;
      if (progEl)  progEl.textContent  = `${done} of ${todays.length} completed`;

      // EOD bar
      if (window.updateEodProgress) window.updateEodProgress(done, todays.length);

      // Task list
      const list = document.getElementById('todayTasksList');
      if (!list) return;

      if (todays.length === 0) {
        list.innerHTML = `
          <div class="empty-state">
            <span class="empty-icon">📋</span>
            <span class="empty-text">No tasks today.</span>
            <a href="tasks.html" class="empty-cta">Add one →</a>
          </div>`;
        return;
      }

      const sorted = [...todays].sort((a, b) =>
        a.status === b.status ? 0 : a.status === 'pending' ? -1 : 1
      );
      list.innerHTML = sorted.map((t, i) => this._taskItem(t, i)).join('');
    } catch (e) { console.error('loadTodaysTasks:', e); }
  }

  _taskItem(task, idx) {
    const done = task.status === 'completed';
    return `
      <div class="task-item ${done ? 'completed' : ''}"
           style="animation-delay:${Math.min(idx * 40, 200)}ms">
        <div class="task-check ${done ? 'done' : ''}">${done ? '✓' : ''}</div>
        <div class="task-content">
          <div class="task-title">${this._esc(task.title)}</div>
          <div class="task-meta">
            <span class="task-tag tag-${task.category}">${task.category.replace('-',' ')}</span>
            <span class="task-difficulty ${task.difficulty}">${task.difficulty}</span>
          </div>
        </div>
      </div>`;
  }

  async loadStats() {
    try {
      const uid    = this.user.userId || this.user.id;
      const stats  = await db.getRecord('stats', uid).catch(() => null);
      const all    = await db.queryByIndex('sprints', 'userId', uid).catch(() => []);
      const week   = Date.now() - 7 * 86_400_000;
      const recent = all.filter(s => new Date(s.createdAt) > week);
      const wScore = recent.reduce((s, sp) => s + (sp.score || 0), 0);
      const avg    = all.length
        ? Math.round(all.reduce((s, sp) => s + (sp.score || 0), 0) / all.length)
        : 0;

      this._countUp('sprintScore',  wScore);
      this._countUp('streakCount',  stats?.streak || 0);
      this._countUp('totalSprints', all.length);

      const metaEl = document.getElementById('sprintMeta');
      const avgEl  = document.getElementById('avgScore');
      if (metaEl) metaEl.textContent = 'Last 7 days';
      if (avgEl)  avgEl.textContent  = `${avg} avg score`;
    } catch (e) { console.error('loadStats:', e); }
  }

  _countUp(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    const dur   = 700;
    const start = performance.now();
    const tick  = now => {
      const t = Math.min((now - start) / dur, 1);
      el.textContent = Math.round(t * t * (3 - 2 * t) * target);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  async loadRecentSprints() {
    try {
      const uid = this.user.userId || this.user.id;
      const all = await db.queryByIndex('sprints', 'userId', uid).catch(() => []);
      const top = all.sort((a, b) =>
        new Date(b.createdAt) - new Date(a.createdAt)
      ).slice(0, 6);

      const list = document.getElementById('sprintList');
      if (!list) return;

      if (top.length === 0) {
        list.innerHTML = `
          <div class="empty-state">
            <span class="empty-icon">⚡</span>
            <span class="empty-text">No sprints yet.</span>
            <a href="tasks.html" class="empty-cta">Start one →</a>
          </div>`;
        return;
      }

      list.innerHTML = top.map((s, i) => `
        <div class="sprint-item" style="animation-delay:${i * 45}ms">
          <div class="sprint-content">
            <div class="sprint-title">${this._esc(s.taskName || 'Sprint')}</div>
            <div class="sprint-meta">
              <span class="sprint-category">${(s.category || '').replace('-',' ')}</span>
              <span>${s.difficulty || ''}</span>
              <span>${utils.formatDate(s.createdAt)}</span>
            </div>
          </div>
          <div class="sprint-score">+${s.score || 0}</div>
        </div>`).join('');
    } catch (e) { console.error('loadRecentSprints:', e); }
  }

  _esc(str) {
    return String(str)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;')
      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
}

document.addEventListener('DOMContentLoaded', () => { new Dashboard(); });