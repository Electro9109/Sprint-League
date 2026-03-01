/**
 * League Page Logic
 */

class LeaguePage {
  constructor() {
    this.user = auth.getUser();
    this.init();
  }

  async init() {
    if (!this.user) return;

    this.updateHeader();
    await this.loadLeaderboard();
  }

  updateHeader() {
    const userAvatar = document.getElementById('userAvatar');
    const username = document.getElementById('username');
    
    if (userAvatar) userAvatar.textContent = this.user.avatar || 'U';
    if (username) username.textContent = this.user.displayName || 'User';
  }

  async loadLeaderboard() {
    try {
      // Get all users and their stats
      const allUsers = await db.getAllRecords('users');
      const leaderboard = [];

      for (const user of allUsers) {
        const stats = await db.getRecord('stats', user.id);
        leaderboard.push({
          user,
          stats: stats || { totalScore: 0, totalSprints: 0 }
        });
      }

      // Sort by score
      leaderboard.sort((a, b) => (b.stats.totalScore || 0) - (a.stats.totalScore || 0));

      // Find user rank
      const userRank = leaderboard.findIndex(l => l.user.id === this.user.id) + 1;
      const userStats = await db.getRecord('stats', this.user.id);

      // Update stats
      const userRankEl = document.getElementById('userRank');
      const leaguePointsEl = document.getElementById('leaguePoints');
      const winRateEl = document.getElementById('winRate');

      if (userRankEl) userRankEl.textContent = '#' + userRank;
      if (leaguePointsEl) leaguePointsEl.textContent = userStats?.totalScore || 0;
      if (winRateEl && userStats?.totalSprints > 0) {
        const tasks = await db.queryByIndex('tasks', 'userId', this.user.id);
        const completed = tasks.filter(t => t.status === 'completed').length;
        const rate = tasks.length > 0 ? Math.round((completed / tasks.length) * 100) : 0;
        winRateEl.textContent = rate + '%';
      }

      // Render leaderboard
      const table = document.getElementById('leaderboardTableEl');
      if (table) {
        if (leaderboard.length === 0) {
          table.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--muted);">No users yet</div>';
        } else {
          let html = `
            <div class="leaderboard-header">
              <div>Rank</div>
              <div>User</div>
              <div>Score</div>
              <div>Sprints</div>
            </div>
          `;
          html += leaderboard.map((item, idx) => this.renderRow(item, idx + 1)).join('');
          table.innerHTML = html;
        }
      }
    } catch (error) {
      console.error('Failed to load leaderboard:', error);
    }
  }

  renderRow(item, rank) {
    const isUser = item.user.id === this.user.id;
    return `
      <div class="leaderboard-row ${isUser ? 'current-user' : ''}">
        <div class="rank-col ${rank <= 3 ? 'top' : ''}">#${rank}</div>
        <div class="name-col">${item.user.displayName || item.user.email}</div>
        <div class="score-col">${item.stats.totalScore || 0}</div>
        <div class="streak-col">${item.stats.totalSprints || 0}</div>
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new LeaguePage();
});
