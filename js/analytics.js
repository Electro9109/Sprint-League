/**
 * Analytics Page Logic
 */

class AnalyticsPage {
  constructor() {
    this.user = auth.getUser();
    this.init();
  }

  async init() {
    if (!this.user) return;

    this.updateHeader();
    await this.loadAnalytics();
  }

  updateHeader() {
    const userAvatar = document.getElementById('userAvatar');
    const username = document.getElementById('username');
    
    if (userAvatar) userAvatar.textContent = this.user.avatar || 'U';
    if (username) username.textContent = this.user.displayName || 'User';
  }

  async loadAnalytics() {
    try {
      const stats = await db.getRecord('stats', this.user.id);
      const sprints = await db.queryByIndex('sprints', 'userId', this.user.id);

      // Update stat cards
      if (stats) {
        const totalSprintsEl = document.getElementById('totalSprintsAna');
        const avgScoreEl = document.getElementById('avgScoreAna');
        const totalScoreEl = document.getElementById('totalScoreAna');
        const streakEl = document.getElementById('streakAna');

        if (totalSprintsEl) totalSprintsEl.textContent = stats.totalSprints || 0;
        if (avgScoreEl) avgScoreEl.textContent = stats.totalSprints > 0 ? Math.floor(stats.totalScore / stats.totalSprints) : 0;
        if (totalScoreEl) totalScoreEl.textContent = stats.totalScore || 0;
        if (streakEl) streakEl.textContent = stats.streak || 0;
      }

      // Render recent sprints
      const list = document.getElementById('recentSprintsList');
      if (list) {
        if (sprints.length === 0) {
          list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--muted);">No sprints yet</div>';
        } else {
          const recent = sprints.slice(-10).reverse();
          list.innerHTML = recent.map(sprint => this.renderSprint(sprint)).join('');
        }
      }
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  }

  renderSprint(sprint) {
    const date = new Date(sprint.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' });
    return `
      <div class="sprint-item">
        <div class="sprint-title">${sprint.taskName || 'Sprint'}</div>
        <div class="sprint-meta">
          <span class="task-tag tag-${sprint.category}">${sprint.category}</span>
          <span>${date}</span>
          <span style="color: var(--accent);">${sprint.score || 0} pts</span>
        </div>
      </div>
    `;
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new AnalyticsPage();
});
