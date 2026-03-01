/**
 * analytics.js — Real data analytics from IndexedDB
 * Zero-states correctly when no sprints/tasks exist.
 * Call window.analyticsPage.refresh() after any sprint completes.
 */

class AnalyticsPage {
  constructor() {
    this.user = auth.getUser();
    this.sprints = [];
    this.stats = null;
    this.init();
  }

  async init() {
    if (!this.user) return;
    await db.init();
    this.updateHeader();
    await this.loadAll();
    this.buildHeatmap();
  }

  updateHeader() {
    const name = this.user.username || this.user.email || 'User';
    const av = document.getElementById('userAvatar');
    const un = document.getElementById('username');
    if (av) av.textContent = name.slice(0, 2).toUpperCase();
    if (un) un.textContent = name;
  }

  /* ── Main data load ──────────────────────────────── */
  async loadAll() {
    try {
      const uid = this.user.id || this.user.userId;

      // Load stats record
      this.stats = await db.getRecord('stats', uid).catch(() => null);

      // Load all sprints for this user
      this.sprints = await db.queryByIndex('sprints', 'userId', uid).catch(() => []);

      // Load today's tasks for EOD bar
      const tasks = await db.queryByIndex('tasks', 'userId', uid).catch(() => []);
      const today = new Date().toDateString();
      const todayT = tasks.filter(t => new Date(t.createdAt).toDateString() === today);
      const doneT = todayT.filter(t => t.status === 'completed').length;
      if (window.updateEodProgress) window.updateEodProgress(doneT, todayT.length);

      this.renderStats();
      this.renderRecentSprints();
      this.renderCategoryBreakdown();
      this.renderScoreChart();
    } catch (e) {
      console.error('analytics.loadAll:', e);
    }
  }

  /* ── Stat cards ──────────────────────────────────── */
  renderStats() {
    const total = this.sprints.length;
    const totScore = this.sprints.reduce((s, sp) => s + (sp.score || 0), 0);
    const avg = total > 0 ? Math.round(totScore / total) : 0;
    const streak = this.stats?.streak || 0;

    this._countUp('totalSprintsAna', total);
    this._countUp('avgScoreAna', avg);
    this._countUp('totalScoreAna', totScore);
    this._countUp('streakAna', streak);

    const sprintBadge = document.getElementById('sprintCountBadge');
    const avgBadge = document.getElementById('avgScoreBadge');
    if (sprintBadge) sprintBadge.textContent = `${total} total`;
    if (avgBadge) avgBadge.textContent = `Avg: ${avg} pts`;
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

  /* ── Recent sprints list ─────────────────────────── */
  renderRecentSprints() {
    const el = document.getElementById('recentSprintsList');
    if (!el) return;

    if (this.sprints.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">⚡</span>
          <span class="empty-text">No sprints yet.</span>
          <a href="tasks.html" class="empty-cta">Start your first sprint →</a>
        </div>`;
      return;
    }

    const recent = [...this.sprints]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 10);

    el.innerHTML = recent.map((s, i) => `
      <div class="sprint-item" style="animation-delay:${i * 35}ms">
        <div class="sprint-content">
          <div class="sprint-title">${this._esc(s.taskName || 'Sprint')}</div>
          <div class="sprint-meta">
            <span class="sprint-category">${(s.category || 'general').replace('-', ' ')}</span>
            <span class="task-difficulty ${s.difficulty || 'medium'}">${s.difficulty || 'medium'}</span>
            <span>${utils.formatDate(s.createdAt)}</span>
          </div>
        </div>
        <div class="sprint-score">+${s.score || 0}</div>
      </div>`).join('');
  }

  /* ── Category breakdown ──────────────────────────── */
  renderCategoryBreakdown() {
    const el = document.getElementById('categoryBreakdown');
    if (!el) return;

    if (this.sprints.length === 0) {
      el.innerHTML = `
        <div class="empty-state">
          <span class="empty-icon">📊</span>
          <span class="empty-text">Complete sprints to see breakdown.</span>
        </div>`;
      return;
    }

    const cats = {};
    this.sprints.forEach(s => {
      const c = s.category || 'general';
      cats[c] = (cats[c] || 0) + 1;
    });

    const max = Math.max(...Object.values(cats));
    const colors = {
      'deep-work': 'var(--yellow)',
      creative: 'var(--blue)',
      learning: 'var(--purple)',
      admin: 'var(--t-3)',
      meeting: 'var(--red)',
      general: 'var(--t-2)',
    };

    const sorted = Object.entries(cats).sort((a, b) => b[1] - a[1]);
    el.innerHTML = sorted.map(([cat, count], i) => `
      <div class="breakdown-row" style="animation-delay:${i * 50}ms">
        <span class="breakdown-label">${cat.replace('-', ' ')}</span>
        <div class="breakdown-bar-wrap">
          <div class="breakdown-bar"
               style="width:${(count / max) * 100}%;background:${colors[cat] || 'var(--t-2)'}"></div>
        </div>
        <span class="breakdown-count">${count} sprint${count !== 1 ? 's' : ''}</span>
      </div>`).join('');
  }

  /* ── Score trend chart ───────────────────────────── */
  renderScoreChart() {
    const chartEl = document.getElementById('scoreChart');
    const labelsEl = document.getElementById('scoreChartLabels');
    if (!chartEl) return;

    if (this.sprints.length === 0) {
      chartEl.innerHTML = '<div class="chart-empty">Complete sprints to see your score trend</div>';
      if (labelsEl) labelsEl.innerHTML = '';
      return;
    }

    const recent = [...this.sprints]
      .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt))
      .slice(-14);

    const maxScore = Math.max(...recent.map(s => s.score || 0), 1);
    const bestIdx = recent.reduce((bi, s, i) => s.score > recent[bi].score ? i : bi, 0);

    chartEl.innerHTML = recent.map((s, i) => {
      const pct = Math.max(((s.score || 0) / maxScore) * 100, 3);
      return `
        <div class="score-bar-wrap ${i === bestIdx ? 'best' : ''}"
             title="${s.score || 0} pts — ${utils.formatDate(s.createdAt)}">
          <div class="score-bar" style="height:${pct}%"></div>
        </div>`;
    }).join('');

    if (labelsEl) {
      labelsEl.innerHTML = recent.map(s =>
        `<span>${utils.formatDate(s.createdAt)}</span>`
      ).join('');
    }
  }

  /* ── Activity heatmap ────────────────────────────── */
  buildHeatmap() {
    const grid = document.getElementById('heatmapGrid');
    if (!grid) return;

    // Build a date→count map from real sprint data
    const dateCounts = {};
    this.sprints.forEach(s => {
      const d = new Date(s.createdAt).toDateString();
      dateCounts[d] = (dateCounts[d] || 0) + 1;
    });

    const today = new Date();
    const end = new Date(today);
    // Go back 364 days
    const start = new Date(today);
    start.setDate(start.getDate() - 363);

    // Pad to start of week (Sunday)
    while (start.getDay() !== 0) start.setDate(start.getDate() - 1);

    const cells = [];
    const cur = new Date(start);
    let activeDays = 0;

    while (cur <= end) {
      const key = cur.toDateString();
      const count = dateCounts[key] || 0;
      if (count > 0) activeDays++;
      const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
      const label = cur.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      cells.push(`<div class="heat-cell heat-${level}" title="${label}: ${count} sprint${count !== 1 ? 's' : ''}"></div>`);
      cur.setDate(cur.getDate() + 1);
    }

    grid.innerHTML = cells.join('');

    const badge = document.getElementById('activeDaysBadge');
    if (badge) badge.textContent = `${activeDays} active day${activeDays !== 1 ? 's' : ''}`;
  }

  /* ── Refresh (called after sprint completes) ─────── */
  async refresh() {
    await this.loadAll();
    this.buildHeatmap();
  }

  _esc(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;')
      .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.analyticsPage = new AnalyticsPage();
});