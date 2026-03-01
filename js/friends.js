/**
 * friends.js — Real squad data from IndexedDB
 * Shows all registered users, EOD report, challenge progress.
 */

class FriendsPage {
  constructor() {
    this.user = auth.getUser();
    this.allUsers = [];
    this.init();
  }

  async init() {
    if (!this.user) return;
    await db.init();
    this.updateHeader();
    await this.loadAll();
  }

  updateHeader() {
    const name = this.user.username || this.user.email || 'User';
    const av = document.getElementById('userAvatar');
    const un = document.getElementById('username');
    if (av) av.textContent = name.slice(0, 2).toUpperCase();
    if (un) un.textContent = name;
  }

  async loadAll() {
    try {
      // Load all users
      this.allUsers = await db.getAllRecords('users').catch(() => []);

      // Load today's tasks for EOD bar
      const uid = this.user.id || this.user.userId;
      const tasks = await db.queryByIndex('tasks', 'userId', uid).catch(() => []);
      const today = new Date().toDateString();
      const todayT = tasks.filter(t => new Date(t.createdAt).toDateString() === today);
      const doneT = todayT.filter(t => t.status === 'completed').length;
      if (window.updateEodProgress) window.updateEodProgress(doneT, todayT.length);

      await this.renderSquadStats();
      await this.renderSquadList();
      await this.renderEodReport();
      await this.renderChallenge();
    } catch (e) { console.error('friends.loadAll:', e); }
  }

  async renderSquadStats() {
    const uid = this.user.id || this.user.userId;

    // Squad count = all registered users
    const squadCountEl = document.getElementById('squadCount');
    if (squadCountEl) squadCountEl.textContent = this.allUsers.length;

    // Aggregate sprints across all users
    let totalScore = 0, sprintCount = 0, weekBest = 0;
    const week = Date.now() - 7 * 86_400_000;

    for (const u of this.allUsers) {
      try {
        const sprints = await db.queryByIndex('sprints', 'userId', u.id);
        sprints.forEach(s => {
          totalScore += s.score || 0;
          sprintCount++;
          if (new Date(s.createdAt) > week) weekBest = Math.max(weekBest, s.score || 0);
        });
      } catch (_) { }
    }

    const avg = sprintCount > 0 ? Math.round(totalScore / sprintCount) : 0;

    const avgEl = document.getElementById('avgSquadScore');
    const topEl = document.getElementById('topSprintScore');
    if (avgEl) avgEl.textContent = avg;
    if (topEl) topEl.textContent = weekBest;

    const onlineEl = document.getElementById('squadOnline');
    if (onlineEl) onlineEl.textContent = `${this.allUsers.length} total`;
  }

  async renderSquadList() {
    const el = document.getElementById('friendsList');
    if (!el) return;

    if (this.allUsers.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">👥</span>
          <span class="empty-text">No other users yet. Invite your squad!</span>
        </div>`;
      return;
    }

    // Load scores for each user
    const withScores = [];
    for (const u of this.allUsers) {
      try {
        const sprints = await db.queryByIndex('sprints', 'userId', u.id);
        const score = sprints.reduce((s, sp) => s + (sp.score || 0), 0);
        const sprintCnt = sprints.length;
        withScores.push({ ...u, score, sprintCnt });
      } catch (_) {
        withScores.push({ ...u, score: 0, sprintCnt: 0 });
      }
    }

    // Sort by score descending
    withScores.sort((a, b) => b.score - a.score);

    const myId = this.user.id || this.user.userId;
    const palette = ['#e8ff47', '#47c8ff', '#a87fff', '#ff8c42', '#4dff91', '#ff4d4d'];

    el.innerHTML = withScores.map((u, i) => {
      const isYou = u.id === myId;
      const initials = (u.username || u.email || 'U').slice(0, 2).toUpperCase();
      const color = palette[i % palette.length];
      return `
        <div class="squad-row" style="animation-delay:${i * 40}ms">
          <div class="squad-avatar ${isYou ? 'you' : ''}" style="background:${isYou ? '' : color};color:#000">
            ${initials}
          </div>
          <div class="squad-info">
            <div class="squad-name">
              ${this._esc(u.username || u.email.split('@')[0])}
              ${isYou ? '<span class="you-tag">YOU</span>' : ''}
            </div>
            <div class="squad-meta">${u.sprintCnt} sprint${u.sprintCnt !== 1 ? 's' : ''} completed</div>
          </div>
          <div class="squad-score">${u.score} pts</div>
        </div>`;
    }).join('');
  }

  async renderEodReport() {
    const el = document.getElementById('eodReport');
    if (!el) return;

    if (this.allUsers.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📋</span>
          <span class="empty-text">Complete tasks to see your EOD report.</span>
        </div>`;
      return;
    }

    const today = new Date().toDateString();
    const myId = this.user.id || this.user.userId;
    const rows = [];

    for (const u of this.allUsers) {
      try {
        const tasks = await db.queryByIndex('tasks', 'userId', u.id);
        const todayT = tasks.filter(t => new Date(t.createdAt).toDateString() === today);
        const doneT = todayT.filter(t => t.status === 'completed').length;
        const totalT = todayT.length;
        const isYou = u.id === myId;
        const name = this._esc(u.username || u.email.split('@')[0]);
        const status = totalT === 0
          ? 'pending'
          : doneT === totalT ? 'win' : 'pending';
        const label = totalT === 0
          ? 'No tasks added'
          : `${doneT} / ${totalT} done`;

        rows.push({ name, status, label, isYou, score: doneT * 100 });
      } catch (_) { }
    }

    rows.sort((a, b) => b.score - a.score);

    el.innerHTML = rows.map((r, i) => `
      <div class="eod-report-row" style="animation-delay:${i * 40}ms">
        <span class="eod-name">${r.name}${r.isYou ? ' (you)' : ''}</span>
        <span class="eod-status-${r.isYou ? 'you' : r.status === 'win' ? 'win' : 'pending'}">
          ${r.label}
        </span>
      </div>`).join('');

    const footerEl = document.getElementById('eodReportFooter');
    if (footerEl) footerEl.textContent =
      `${rows.filter(r => r.status === 'win').length} / ${rows.length} members hit their goals today`;
  }

  async renderChallenge() {
    // Count today's completed tasks across all users
    const today = new Date().toDateString();
    let doneAll = 0;
    const target = 20;

    for (const u of this.allUsers) {
      try {
        const tasks = await db.queryByIndex('tasks', 'userId', u.id);
        doneAll += tasks.filter(t =>
          new Date(t.createdAt).toDateString() === today && t.status === 'completed'
        ).length;
      } catch (_) { }
    }

    doneAll = Math.min(doneAll, target);
    const pct = Math.round((doneAll / target) * 100);

    const progEl = document.getElementById('challengeProgress');
    const fillEl = document.getElementById('challengeFill');
    if (progEl) progEl.textContent = `${doneAll} / ${target} tasks`;
    if (fillEl) fillEl.style.width = pct + '%';
  }

  async refresh() { await this.loadAll(); }

  _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.friendsPage = new FriendsPage();
});