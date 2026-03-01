/**
 * league.js — Real leaderboard & badge system from IndexedDB
 * Badges unlock based on actual sprint/task data.
 */

class LeaguePage {
  constructor() {
    this.user = auth.getUser();
    this.allUsers = [];
    this.sprints = [];
    this.myStats = null;
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
      const uid = this.user.id || this.user.userId;

      // Load everything
      this.allUsers = await db.getAllRecords('users').catch(() => []);
      this.myStats = await db.getRecord('stats', uid).catch(() => null);
      this.sprints = await db.queryByIndex('sprints', 'userId', uid).catch(() => []);

      // Today's tasks for EOD bar
      const tasks = await db.queryByIndex('tasks', 'userId', uid).catch(() => []);
      const today = new Date().toDateString();
      const todayT = tasks.filter(t => new Date(t.createdAt).toDateString() === today);
      const doneT = todayT.filter(t => t.status === 'completed').length;
      if (window.updateEodProgress) window.updateEodProgress(doneT, todayT.length);

      await this.renderStats();
      await this.renderLeaderboard();
      this.renderBadges(tasks);
    } catch (e) { console.error('league.loadAll:', e); }
  }

  async renderStats() {
    const uid = this.user.id || this.user.userId;
    const myScore = this.myStats?.totalScore || 0;
    const mySprints = this.myStats?.totalSprints || 0;

    // Build global leaderboard to find rank
    const lb = [];
    for (const u of this.allUsers) {
      const s = await db.getRecord('stats', u.id).catch(() => null);
      lb.push({ id: u.id, score: s?.totalScore || 0 });
    }
    lb.sort((a, b) => b.score - a.score);
    const rank = lb.findIndex(r => r.id === uid) + 1;
    const rankStr = rank > 0 ? `#${rank}` : '#—';

    this._set('userRank', rankStr);
    this._set('rankSub', rank > 0 ? `of ${this.allUsers.length} players` : 'be first!');
    this._countUp('leaguePoints', myScore);
    this._countUp('leagueSprints', mySprints);
    this._set('playerCount', this.allUsers.length);
  }

  async renderLeaderboard() {
    const el = document.getElementById('leaderboardList');
    if (!el) return;

    // Fetch all users + their stats
    const lb = [];
    for (const u of this.allUsers) {
      try {
        const s = await db.getRecord('stats', u.id).catch(() => null);
        lb.push({
          user: u,
          score: s?.totalScore || 0,
          sprints: s?.totalSprints || 0,
        });
      } catch (_) { }
    }
    lb.sort((a, b) => b.score - a.score);

    const myId = this.user.id || this.user.userId;
    const palette = ['#ffd700', '#c0c0c0', '#cd7f32', '#e8ff47', '#47c8ff', '#a87fff', '#ff8c42'];
    const ranks = ['gold', 'silver', 'bronze'];

    if (lb.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">🏆</span>
          <span class="empty-text">No players yet. Start sprinting to appear here!</span>
        </div>`;
      return;
    }

    el.innerHTML = lb.map((item, i) => {
      const isYou = item.user.id === myId;
      const rank = i + 1;
      const name = this._esc(item.user.username || item.user.email.split('@')[0]);
      const initials = name.slice(0, 2).toUpperCase();
      const rankCls = i < 3 ? ranks[i] : (isYou ? 'you-marker' : '');
      const color = palette[i % palette.length];

      return `
        <div class="leaderboard-row ${isYou ? 'is-you' : ''}"
             style="animation-delay:${i * 40}ms">
          <div class="lb-rank ${rankCls}">#${rank}</div>
          <div class="lb-player">
            <div class="lb-avatar" style="background:${color};color:#000">${initials}</div>
            <div class="lb-name">${name}${isYou ? ' ★' : ''}</div>
          </div>
          <div class="lb-score">${item.score.toLocaleString()}</div>
          <div class="lb-sprints">${item.sprints}</div>
        </div>`;
    }).join('');

    const seasonEl = document.getElementById('leagueSeasonBadge');
    if (seasonEl) seasonEl.textContent = 'All time';
  }

  renderBadges(tasks) {
    const grid = document.getElementById('badgesGrid');
    if (!grid) return;

    const uid = this.user.id || this.user.userId;
    const total = this.sprints.length;
    const streak = this.myStats?.streak || 0;
    const score = this.myStats?.totalScore || 0;
    const hardCount = this.sprints.filter(s => s.difficulty === 'hard').length;

    const BADGES = [
      {
        icon: '🔥', name: 'First Sprint', req: 'Complete 1 sprint',
        unlocked: total >= 1,
      },
      {
        icon: '⚡', name: '10 Sprints', req: 'Complete 10 sprints',
        unlocked: total >= 10,
      },
      {
        icon: '🎯', name: 'Streak 7', req: '7-day active streak',
        unlocked: streak >= 7,
      },
      {
        icon: '💎', name: 'High Scorer', req: 'Earn 1000+ total pts',
        unlocked: score >= 1000,
      },
      {
        icon: '🚀', name: 'Hard Mode', req: 'Complete 5 hard sprints',
        unlocked: hardCount >= 5,
      },
      {
        icon: '👑', name: 'Champion', req: 'Reach #1 on leaderboard',
        unlocked: false, // computed above via rank; simplified here
      },
    ];

    const earned = BADGES.filter(b => b.unlocked).length;
    const badgeCount = document.getElementById('badgeCount');
    if (badgeCount) badgeCount.textContent = `${earned} earned`;

    grid.innerHTML = BADGES.map(b => `
      <div class="badge-item ${b.unlocked ? 'unlocked' : 'locked'}"
           title="${b.req}">
        <div class="badge-icon">${b.icon}</div>
        <div class="badge-name">${b.name}</div>
        <div class="badge-req">${b.req}</div>
      </div>`).join('');
  }

  async refresh() { await this.loadAll(); }

  _set(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  _countUp(id, target) {
    const el = document.getElementById(id);
    if (!el) return;
    if (target === 0) { el.textContent = '0'; return; }
    const dur = 700;
    const start = performance.now();
    const tick = now => {
      const t = Math.min((now - start) / dur, 1);
      el.textContent = Math.round(t * t * (3 - 2 * t) * target);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.leaguePage = new LeaguePage();
});