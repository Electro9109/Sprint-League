/**
 * Dashboard Page Logic
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
    // Show username (from new auth) with fallback chain
    const displayName = this.user.username || this.user.displayName || this.user.email || 'User';

    const avatarEl   = document.getElementById('userAvatar');
    const usernameEl = document.getElementById('username');
    if (avatarEl)   avatarEl.textContent   = displayName.slice(0, 2).toUpperCase();
    if (usernameEl) usernameEl.textContent  = displayName;

    // Personalise the page welcome title
    const titleEl = document.querySelector('.page-title');
    if (titleEl) {
      // Keep the <small> tag, update main text
      const small = titleEl.querySelector('small');
      titleEl.innerHTML = '';
      if (small) titleEl.appendChild(small);
      titleEl.appendChild(document.createTextNode('Hey, ' + displayName));
    }
  }

  async loadTodaysTasks() {
    try {
      const tasks     = await db.queryByIndex('tasks', 'userId', this.user.userId);
      const today     = new Date().toDateString();
      const todays    = tasks.filter(t => new Date(t.createdAt).toDateString() === today && t.status !== 'archived');
      const completed = todays.filter(t => t.status === 'completed').length;

      const todayCount    = document.getElementById('todayCount');
      const todayProgress = document.getElementById('todayProgress');
      if (todayCount)    todayCount.textContent    = todays.length;
      if (todayProgress) todayProgress.textContent = `${completed} completed`;

      const list = document.getElementById('todayTasksList');
      if (list) {
        list.innerHTML = todays.length === 0
          ? '<div style="padding:20px;text-align:center;color:var(--muted)">No tasks today. <a href="tasks.html" style="color:var(--accent)">Add one →</a></div>'
          : todays.map(t => this.renderTaskItem(t)).join('');
      }
    } catch (err) { console.error('loadTodaysTasks:', err); }
  }

  renderTaskItem(task) {
    const colorMap = {
      'deep-work': 'var(--accent)',
      'admin':     'var(--muted)',
      'creative':  'var(--accent3)',
      'learning':  '#9b59b6',
      'meeting':   'var(--accent2)'
    };
    const color = colorMap[task.category] || 'var(--accent3)';
    const done  = task.status === 'completed';
    return `
      <div class="task-item ${done ? 'completed' : ''}">
        <div class="task-check ${done ? 'done' : ''}">${done ? '✓' : ''}</div>
        <div class="task-content">
          <div class="task-title">${task.title}</div>
          <div class="task-meta">
            <span class="task-tag" style="border-color:${color};color:${color}">${task.category}</span>
            <span class="task-difficulty ${task.difficulty}">${task.difficulty}</span>
          </div>
        </div>
      </div>`;
  }

  async loadStats() {
    try {
      const stats = await db.getRecord('stats', this.user.userId);
      if (!stats) return;
      const el = id => document.getElementById(id);
      if (el('sprintScore'))  el('sprintScore').textContent  = stats.totalScore   || 0;
      if (el('streakCount'))  el('streakCount').textContent  = stats.streak       || 0;
      if (el('totalSprints')) el('totalSprints').textContent = stats.totalSprints || 0;
      if (el('avgScore'))     el('avgScore').textContent     =
        stats.totalSprints > 0 ? Math.floor(stats.totalScore / stats.totalSprints) + ' avg' : '0 avg';
    } catch (err) { console.error('loadStats:', err); }
  }

  async loadRecentSprints() {
    try {
      const sprints = await db.queryByIndex('sprints', 'userId', this.user.userId);
      const recent  = sprints.slice(-5).reverse();
      const list    = document.getElementById('sprintList');
      if (!list) return;
      list.innerHTML = recent.length === 0
        ? '<div style="padding:20px;text-align:center;color:var(--muted)">No sprints yet. <a href="tasks.html" style="color:var(--accent)">Start one →</a></div>'
        : recent.map(s => this.renderSprintItem(s)).join('');
    } catch (err) { console.error('loadRecentSprints:', err); }
  }

  renderSprintItem(sprint) {
    const date = new Date(sprint.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    return `
      <div class="sprint-item">
        <div class="sprint-content">
          <div class="sprint-name">${sprint.taskName || 'Sprint'}</div>
          <div class="sprint-meta">
            <span class="sprint-category">${sprint.category || 'task'}</span>
            <span>${date}</span>
          </div>
        </div>
        <div class="sprint-score">${sprint.score || 0}</div>
      </div>`;
  }
}

document.addEventListener('DOMContentLoaded', () => { new Dashboard(); });