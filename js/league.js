/**
 * league.js — Real leaderboard from IndexedDB
 * Ranks all registered users by their totalScore
 */

class LeaguePage {
  constructor() {
    this.user = auth.getUser();
    this.init();
  }

  get uid() { return this.user?.userId || this.user?.id; }

  async init() {
    if (!this.user) return;
    this.updateHeader();
    await this.loadLeaderboard();
  }

  updateHeader() {
    const name = this.user.username || this.user.email || 'User';
    const av = document.getElementById('userAvatar');
    const un = document.getElementById('username');
    if (av) av.textContent = name.slice(0, 2).toUpperCase();
    if (un) un.textContent = name;
  }

  async loadLeaderboard() {
    try {
      const allUsers = await db.getAllRecords('users');

      // Load stats for each user
      const ranked = await Promise.all(allUsers.map(async u => {
        const uid   = u.userId || u.id;
        const stats = await db.getRecord('stats', uid).catch(() => null);
        return {
          uid,
          name:    u.username || u.email || 'Player',
          email:   u.email || '',
          score:   stats?.totalScore   || 0,
          sprints: stats?.totalSprints || 0,
          streak:  stats?.streak       || 0,
          isYou:   uid === this.uid,
        };
      }));

      // Sort by score descending
      ranked.sort((a, b) => b.score - a.score || b.sprints - a.sprints);

      // Update page stats
      const myRank = ranked.findIndex(u => u.isYou) + 1;
      const me     = ranked.find(u => u.isYou);

      const el = id => document.getElementById(id);
      if (el('userRank'))          el('userRank').textContent         = myRank > 0 ? `#${myRank}` : '#—';
      if (el('userLeagueScore'))   el('userLeagueScore').textContent  = me?.score.toLocaleString() || 0;
      if (el('userLeagueSprints')) el('userLeagueSprints').textContent = me?.sprints || 0;
      if (el('playerCount'))       el('playerCount').textContent      = allUsers.length;

      // Division label
      const division = this.getDivision(me?.score || 0);
      if (el('userDivision'))   el('userDivision').textContent  = division.name;
      if (el('divisionLabel'))  el('divisionLabel').textContent = division.name;
      if (el('divisionLabel'))  el('divisionLabel').style.color = division.color;

      // Render leaderboard
      const table = document.getElementById('leaderboardTable');
      if (!table) return;

      if (ranked.length === 0) {
        table.innerHTML = `<div class="empty-state">No players yet — register an account to appear here!</div>`;
        return;
      }

      const avatarColors = ['#34d399','#38bdf8','#fbbf24','#e8ff47','#a78bfa','#ff4d6d'];

      table.innerHTML = ranked.map((u, i) => {
        const rank    = i + 1;
        const color   = avatarColors[i % avatarColors.length];
        const initials = u.name.slice(0, 2).toUpperCase();
        const rowClass = u.isYou ? 'current-user'
          : rank === 1 ? 'top-1'
          : rank === 2 ? 'top-2'
          : rank === 3 ? 'top-3'
          : '';
        const rankIcon = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`;
        const div = this.getDivision(u.score);

        return `
          <div class="league-row ${rowClass}">
            <div class="rank-badge">${rankIcon}</div>
            <div class="league-user">
              <div class="league-avatar" style="background:${color};color:#000">${initials}</div>
              <div>
                <div class="league-username">${this._esc(u.name)}${u.isYou ? ' <span style="font-size:10px;color:var(--accent);font-family:var(--mono);font-weight:800">YOU</span>' : ''}</div>
                <div class="league-email" style="color:${div.color};font-size:9px;letter-spacing:1px;font-weight:700">${div.name}</div>
              </div>
            </div>
            <div class="league-score">${u.score.toLocaleString()}</div>
            <div class="league-sprints">${u.sprints} sprints</div>
          </div>`;
      }).join('');
    } catch (err) { console.error('loadLeaderboard:', err); }
  }

  getDivision(score) {
    if (score >= 5000)  return { name: 'Diamond', color: '#38bdf8' };
    if (score >= 2000)  return { name: 'Platinum', color: '#a78bfa' };
    if (score >= 1000)  return { name: 'Gold',     color: '#fbbf24' };
    if (score >= 400)   return { name: 'Silver',   color: '#a0a0b8' };
    return                     { name: 'Bronze',   color: '#cd7f32' };
  }

  _esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}

document.addEventListener('DOMContentLoaded', () => { new LeaguePage(); });