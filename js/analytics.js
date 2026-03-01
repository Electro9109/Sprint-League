/**
 * analytics.js — Reads real data from IndexedDB
 * Computes: stats, recent sprints, category breakdown, heatmap
 */

class AnalyticsPage {
  constructor() {
    this.user = auth.getUser();
    this.init();
  }

  get uid() { return this.user?.userId || this.user?.id; }

  async init() {
    if (!this.user) return;
    this.updateHeader();
    await this.loadStats();
    await this.loadRecentSprints();
    await this.loadCategoryBreakdown();
    await this.buildHeatmap();
  }

  updateHeader() {
    const name = this.user.username || this.user.email || 'User';
    const av = document.getElementById('userAvatar');
    const un = document.getElementById('username');
    if (av) av.textContent = name.slice(0, 2).toUpperCase();
    if (un) un.textContent = name;
  }

  async loadStats() {
    try {
      const stats = await db.getRecord('stats', this.uid);
      const el = id => document.getElementById(id);

      if (stats) {
        if (el('totalSprintsAna')) el('totalSprintsAna').textContent = stats.totalSprints || 0;
        if (el('totalScoreAna'))   el('totalScoreAna').textContent   = stats.totalScore   || 0;
        if (el('streakAna'))       el('streakAna').textContent       = stats.streak        || 0;
        const avg = stats.totalSprints > 0
          ? Math.round(stats.totalScore / stats.totalSprints)
          : 0;
        if (el('avgScoreAna')) el('avgScoreAna').textContent = avg;
      }
    } catch (err) { console.error('analytics loadStats:', err); }
  }

  async loadRecentSprints() {
    try {
      const sprints = await db.queryByIndex('sprints', 'userId', this.uid);
      const recent  = [...sprints].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 8);
      const list    = document.getElementById('recentSprintsList');
      if (!list) return;

      if (recent.length === 0) {
        list.innerHTML = `<div class="empty-state">No sprints yet. Complete some sprints to see analytics!</div>`;
        return;
      }

      list.innerHTML = recent.map(s => {
        const date  = utils.formatDate(s.createdAt);
        const mins  = s.duration ? Math.round(s.duration / 60) : 25;
        const catColors = {
          'deep-work': 'var(--accent)',
          'creative':  'var(--accent3)',
          'learning':  'var(--accent4)',
          'meeting':   'var(--accent2)',
          'admin':     'var(--text2)',
        };
        const color = catColors[s.category] || 'var(--text2)';
        return `
          <div class="sprint-item">
            <div class="sprint-content">
              <div class="sprint-name">${this._esc(s.taskName || 'Sprint')}</div>
              <div class="sprint-meta">
                <span class="sprint-category" style="border-color:${color}20;color:${color}">${s.category || 'task'}</span>
                <span>${date}</span>
                <span>${mins}m</span>
                <span class="sprint-category" style="border-color:transparent;color:var(--muted)">${s.difficulty}</span>
              </div>
            </div>
            <div class="sprint-score">${s.score || 0}</div>
          </div>`;
      }).join('');
    } catch (err) { console.error('analytics loadRecentSprints:', err); }
  }

  async loadCategoryBreakdown() {
    try {
      const sprints = await db.queryByIndex('sprints', 'userId', this.uid);
      if (sprints.length === 0) return;

      // Aggregate by category
      const totals = {};
      sprints.forEach(s => {
        const cat = s.category || 'other';
        totals[cat] = (totals[cat] || 0) + (s.score || 0);
      });

      const maxScore = Math.max(...Object.values(totals), 1);
      const catColors = {
        'deep-work': 'var(--accent)',
        'creative':  'var(--accent3)',
        'learning':  'var(--accent4)',
        'meeting':   'var(--accent2)',
        'admin':     'var(--text2)',
        'other':     'var(--muted)',
      };

      const chart = document.getElementById('categoryChart');
      if (!chart) return;

      const sorted = Object.entries(totals).sort(([,a],[,b]) => b - a);
      chart.innerHTML = sorted.map(([cat, score]) => {
        const pct   = Math.round((score / maxScore) * 100);
        const color = catColors[cat] || 'var(--accent)';
        return `
          <div class="score-bar-item">
            <div class="score-bar-label">${cat.replace('-',' ')}</div>
            <div class="score-bar-track">
              <div class="score-bar-fill" style="width:${pct}%;background:${color}"></div>
            </div>
            <div class="score-bar-val" style="color:${color}">${score}</div>
          </div>`;
      }).join('');
    } catch (err) { console.error('analytics loadCategoryBreakdown:', err); }
  }

  async buildHeatmap() {
    try {
      const sprints = await db.queryByIndex('sprints', 'userId', this.uid);

      // Map date string → count
      const dateCounts = {};
      sprints.forEach(s => {
        const d = new Date(s.createdAt).toDateString();
        dateCounts[d] = (dateCounts[d] || 0) + 1;
      });

      const grid = document.getElementById('heatmapGrid');
      if (!grid) return;

      // Build last 364 days
      const today = new Date();
      today.setHours(0,0,0,0);
      let html = '';

      for (let i = 363; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key   = d.toDateString();
        const count = dateCounts[key] || 0;
        const level = count === 0 ? 0 : count === 1 ? 1 : count <= 3 ? 2 : count <= 5 ? 3 : 4;
        html += `<div class="heat-cell heat-${level}" title="${key}: ${count} sprint${count !== 1 ? 's' : ''}"></div>`;
      }

      grid.innerHTML = html;
    } catch (err) { console.error('analytics buildHeatmap:', err); }
  }

  _esc(s) {
    return String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }
}

document.addEventListener('DOMContentLoaded', () => { new AnalyticsPage(); });