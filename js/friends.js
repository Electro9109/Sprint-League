/**
 * friends.js — Squad page
 * Reads all registered users from IndexedDB (shared local DB),
 * shows their task/sprint progress, EOD report, and group challenge.
 */

class FriendsPage {
  constructor() {
    this.user = auth.getUser();
    this.init();
  }

  get uid() { return this.user?.userId || this.user?.id; }

  async init() {
    if (!this.user) return;
    this.updateHeader();
    await this.loadSquad();
    await this.loadEODReport();
    await this.loadChallenge();
    this.startEodCountdown();
  }

  updateHeader() {
    const name = this.user.username || this.user.email || 'User';
    const av = document.getElementById('userAvatar');
    const un = document.getElementById('username');
    if (av) av.textContent = name.slice(0, 2).toUpperCase();
    if (un) un.textContent = name;
  }

  async loadSquad() {
    try {
      // Get all users from IndexedDB
      const allUsers = await db.getAllRecords('users');
      const list     = document.getElementById('squadList');
      if (!list) return;

      // Update stats
      const sc = document.getElementById('squadCount');
      if (sc) sc.textContent = allUsers.length;

      if (allUsers.length === 0) {
        list.innerHTML = `<div class="empty-state">No other users found. Invite friends to join!</div>`;
        return;
      }

      // Load stats for each user
      const userStats = await Promise.all(
        allUsers.map(async u => {
          const uid   = u.userId || u.id;
          const stats = await db.getRecord('stats', uid).catch(() => null);
          const tasks = await db.queryByIndex('tasks', 'userId', uid).catch(() => []);
          const todayTasks = tasks.filter(t => {
            const d = new Date(t.createdAt).toDateString();
            return d === new Date().toDateString();
          });
          const doneTasks  = todayTasks.filter(t => t.status === 'completed').length;
          return { ...u, stats, todayTotal: todayTasks.length, todayDone: doneTasks };
        })
      );

      // Update avg score stat
      const scores     = userStats.map(u => u.stats?.totalScore || 0);
      const avgScore   = scores.length > 0 ? Math.round(scores.reduce((a,b) => a+b, 0) / scores.length) : 0;
      const topScore   = Math.max(...scores, 0);
      const avg        = document.getElementById('avgSquadScore');
      const top        = document.getElementById('topSprintScore');
      if (avg) avg.textContent = avgScore;
      if (top) top.textContent = topScore;

      const avatarColors = ['#e8ff47','#47c8ff','#4dff91','#a78bfa','#ff4d6d','#fbbf24'];
      const isCurrentUser = u => (u.userId || u.id) === this.uid;

      list.innerHTML = userStats.map((u, i) => {
        const name       = u.username || u.email || 'User';
        const initials   = name.slice(0, 2).toUpperCase();
        const score      = u.stats?.totalScore || 0;
        const sprints    = u.stats?.totalSprints || 0;
        const pct        = u.todayTotal > 0 ? Math.round((u.todayDone / u.todayTotal) * 100) : 0;
        const color      = avatarColors[i % avatarColors.length];
        const you        = isCurrentUser(u);
        const statusText = you ? 'You' : sprints > 0 ? `${sprints} sprints` : 'No sprints yet';

        return `
          <div class="squad-card${you ? ' online' : ''}">
            <div class="squad-avatar" style="background:${color}">
              ${initials}
              <div class="squad-online-dot ${you ? 'online-dot' : 'offline-dot'}"></div>
            </div>
            <div class="squad-info">
              <div class="squad-name">${this._esc(name)}${you ? ' <span style="font-size:10px;color:var(--accent);font-weight:700">YOU</span>' : ''}</div>
              <div class="squad-meta">
                <span>${statusText}</span>
                ${u.todayTotal > 0 ? `<span style="color:var(--text2)">${u.todayDone}/${u.todayTotal} tasks today</span>` : ''}
              </div>
            </div>
            <div class="squad-score" style="${you ? 'text-shadow:0 0 12px rgba(232,255,71,0.4)' : ''}">
              ${score.toLocaleString()}
            </div>
          </div>`;
      }).join('');
    } catch (err) { console.error('loadSquad:', err); }
  }

  async loadEODReport() {
    try {
      const allUsers = await db.getAllRecords('users');
      const today    = new Date().toDateString();
      const report   = document.getElementById('eodReport');
      if (!report) return;

      const rows = await Promise.all(allUsers.map(async u => {
        const uid   = u.userId || u.id;
        const tasks = await db.queryByIndex('tasks', 'userId', uid).catch(() => []);
        const todayTasks = tasks.filter(t => new Date(t.createdAt).toDateString() === today);
        const done       = todayTasks.filter(t => t.status === 'completed').length;
        const total      = todayTasks.length;
        const name       = u.username || u.email.split('@')[0];
        const isYou      = (u.userId || u.id) === this.uid;
        const allDone    = total > 0 && done === total;
        const cls        = isYou ? 'you' : allDone ? 'success' : 'fail';
        const icon       = isYou ? '◎' : allDone ? '✓' : '✗';
        const style      = isYou ? 'color:var(--accent)' : allDone ? 'color:var(--success)' : 'color:var(--accent2)';
        return `<div style="font-family:var(--mono);font-size:13px;padding:8px 0;border-bottom:1px solid var(--border);display:flex;gap:12px;align-items:center">
          <span style="${style};font-weight:800;min-width:14px">${icon}</span>
          <span style="flex:1;color:var(--text)">${this._esc(name)}${isYou ? ' (you)' : ''}</span>
          <span style="color:var(--text2);font-size:11px">${done}/${total} tasks</span>
        </div>`;
      }));

      report.innerHTML = rows.join('') || `<div class="empty-state">No data yet</div>`;
    } catch (err) { console.error('loadEODReport:', err); }
  }

  async loadChallenge() {
    try {
      const allUsers = await db.getAllRecords('users');
      const today    = new Date().toDateString();
      let totalDone  = 0;
      const goal     = 20;

      await Promise.all(allUsers.map(async u => {
        const uid   = u.userId || u.id;
        const tasks = await db.queryByIndex('tasks', 'userId', uid).catch(() => []);
        totalDone += tasks.filter(t =>
          t.status === 'completed' &&
          new Date(t.completedAt || t.createdAt).toDateString() === today
        ).length;
      }));

      const pct  = Math.min(Math.round((totalDone / goal) * 100), 100);
      const bar  = document.getElementById('challengeBar');
      const prog = document.getElementById('challengeProgress');
      if (bar)  bar.style.width = pct + '%';
      if (prog) prog.textContent = `${totalDone} / ${goal} tasks`;
    } catch (err) { console.error('loadChallenge:', err); }
  }

  startEodCountdown() {
    const update = () => {
      const now     = new Date();
      const eod     = new Date();
      eod.setHours(18, 0, 0, 0);
      if (eod < now) eod.setDate(eod.getDate() + 1);
      const diff = Math.round((eod - now) / 1000);
      const h    = Math.floor(diff / 3600);
      const m    = Math.floor((diff % 3600) / 60);
      const el   = document.getElementById('eodTimeLeft');
      if (el) el.textContent = `${h}h ${m}m`;
    };
    update();
    setInterval(update, 60000);
  }

  _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}

document.addEventListener('DOMContentLoaded', () => { new FriendsPage(); });