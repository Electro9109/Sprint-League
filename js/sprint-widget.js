/**
 * sprint-widget.js — Floating Sprint Mode Widget
 * Accessible from Dashboard and Tasks pages.
 * Uses React 18 (no build step).
 */

/* global React, ReactDOM, db, auth, utils */

(function () {
  const { useState, useEffect, useRef, useCallback } = React;
  const e = React.createElement;

  const DURATIONS = [
    { mins: 15, label: '15', sub: 'quick' },
    { mins: 25, label: '25', sub: 'focus' },
    { mins: 45, label: '45', sub: 'deep' },
    { mins: 60, label: '60', sub: 'flow' },
  ];

  function SprintWidget() {
    const [open, setOpen]                 = useState(false);
    const [tasks, setTasks]               = useState([]);
    const [selectedTask, setSelectedTask] = useState('');
    const [duration, setDuration]         = useState(25);
    const [intensity, setIntensity]       = useState('soft');
    const [active, setActive]             = useState(false);
    const [secondsLeft, setSecondsLeft]   = useState(0);
    const [totalSeconds, setTotalSeconds] = useState(0);
    const intervalRef = useRef(null);
    const user = auth.getUser();

    // Load pending tasks
    const loadTasks = useCallback(async () => {
      if (!user) return;
      try {
        const all = await db.queryByIndex('tasks', 'userId', user.userId || user.id);
        const pending = all.filter(t => t.status === 'pending');
        setTasks(pending);
        if (pending.length > 0 && !selectedTask) {
          setSelectedTask(pending[0].id);
        }
      } catch (err) {
        console.error('[SprintWidget] loadTasks:', err);
      }
    }, [user, selectedTask]);

    useEffect(() => {
      if (open) loadTasks();
    }, [open]);

    // Tick
    useEffect(() => {
      if (active && secondsLeft > 0) {
        intervalRef.current = setInterval(() => {
          setSecondsLeft(s => {
            if (s <= 1) {
              clearInterval(intervalRef.current);
              handleComplete(true);
              return 0;
            }
            return s - 1;
          });
        }, 1000);
      }
      return () => clearInterval(intervalRef.current);
    }, [active]);

    function formatTime(s) {
      const m = Math.floor(s / 60);
      const sec = s % 60;
      return `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
    }

    async function handleLaunch() {
      if (!selectedTask) {
        utils.showNotification('Pick a task to sprint on!', 'warning');
        return;
      }
      const secs = duration * 60;
      setSecondsLeft(secs);
      setTotalSeconds(secs);
      setActive(true);

      // Update global indicator
      showGlobalIndicator(secs);

      utils.showNotification(`⚡ Sprint started! ${duration} min — let's go!`, 'success');
    }

    async function handleComplete(auto = false) {
      clearInterval(intervalRef.current);
      setActive(false);
      hideGlobalIndicator();

      const task = tasks.find(t => t.id === selectedTask);
      if (!task) return;

      try {
        // Mark task complete
        const taskRecord = await db.getRecord('tasks', task.id);
        taskRecord.status = 'completed';
        taskRecord.completedAt = new Date().toISOString();
        await db.updateRecord('tasks', taskRecord);

        // Create sprint record
        const sprint = {
          id: utils.generateId(),
          userId: user.userId || user.id,
          taskId: task.id,
          taskName: task.title,
          category: task.category,
          difficulty: task.difficulty,
          status: 'completed',
          score: utils.calculateScore(task.difficulty, 0, true),
          duration: duration * 60,
          intensity,
          createdAt: new Date().toISOString(),
        };
        await db.addRecord('sprints', sprint);

        // Update stats
        const stats = await db.getRecord('stats', user.userId || user.id);
        if (stats) {
          stats.totalSprints = (stats.totalSprints || 0) + 1;
          stats.totalScore   = (stats.totalScore || 0) + sprint.score;
          await db.updateRecord('stats', stats);
        }

        // Celebration!
        triggerCelebration();
        utils.showNotification(`🎉 Sprint done! +${sprint.score} pts`, 'success');
        await loadTasks();
        setSelectedTask('');
      } catch (err) {
        console.error('[SprintWidget] complete:', err);
      }
    }

    function handleBail() {
      if (!confirm('Bail on this sprint? You\'ll lose 50 points.')) return;
      clearInterval(intervalRef.current);
      setActive(false);
      hideGlobalIndicator();
      utils.showNotification('Sprint abandoned. −50 pts 😬', 'warning');
    }

    const pct = totalSeconds > 0 ? ((totalSeconds - secondsLeft) / totalSeconds) * 100 : 0;

    // Global indicator sync
    useEffect(() => {
      if (active) {
        const ind = document.getElementById('sprint-indicator');
        if (ind) {
          ind.classList.add('visible');
          const timeEl = ind.querySelector('.smi-time');
          if (timeEl) timeEl.textContent = formatTime(secondsLeft);
        }
      }
    }, [secondsLeft, active]);

    return e(React.Fragment, null,
      // ── Trigger button ──
      e('button', {
        className: 'sprint-widget-trigger',
        onClick: () => setOpen(o => !o),
        title: 'Sprint Mode',
        style: open ? { background: 'linear-gradient(135deg, #c8e000, #9ab000)', animation: 'none' } : {}
      },
        e('span', { className: 'trigger-label' }, 'Sprint Mode'),
        e('span', { className: 'trigger-icon' }, open ? '✕' : '⚡')
      ),

      // ── Panel ──
      e('div', { className: `sprint-widget-panel ${open ? 'open' : ''}` },

        // Header
        e('div', { className: 'swp-header' },
          e('div', null,
            e('div', { className: 'swp-title' },
              e('span', { className: 'swp-title-icon' }, '⚡'),
              'Sprint Mode'
            ),
            e('div', { className: 'swp-subtitle' }, active ? 'Session active' : 'Configure & launch')
          ),
          e('button', { className: 'swp-close', onClick: () => setOpen(false) }, '✕')
        ),

        active
          // ── Active sprint view ──
          ? e('div', null,
              e('div', { className: 'swp-active-sprint' },
                e('div', { className: 'swp-active-task' },
                  '⚡ ', tasks.find(t => t.id === selectedTask)?.title || 'Sprint'
                ),
                e('div', {
                  className: `swp-active-timer${secondsLeft < 120 ? ' warning' : ''}`,
                }, formatTime(secondsLeft)),
                e('div', { className: 'swp-active-progress' },
                  e('div', { className: 'swp-active-progress-fill', style: { width: pct + '%' } })
                ),
                e('div', { className: 'swp-active-actions' },
                  e('button', { className: 'swp-btn-complete', onClick: () => handleComplete(false) }, '✓ Done!'),
                  e('button', { className: 'swp-btn-bail', onClick: handleBail }, '✗ Bail')
                )
              )
            )

          // ── Configure view ──
          : e('div', { className: 'swp-body' },
              // Duration
              e('div', { className: 'swp-section-label' }, 'Duration'),
              e('div', { className: 'swp-duration-grid' },
                DURATIONS.map(d =>
                  e('button', {
                    key: d.mins,
                    className: `swp-duration-btn${duration === d.mins ? ' active' : ''}`,
                    onClick: () => setDuration(d.mins),
                  },
                    e('div', null, d.label),
                    e('div', { className: 'swp-duration-label' }, 'min')
                  )
                )
              ),

              // Task
              e('div', { className: 'swp-task-select-wrap' },
                e('div', { className: 'swp-section-label' }, 'Task'),
                tasks.length === 0
                  ? e('div', {
                      style: {
                        fontFamily: 'var(--mono)',
                        fontSize: '12px',
                        color: 'var(--muted)',
                        padding: '10px 0',
                      }
                    }, 'No pending tasks — add some first!')
                  : e('select', {
                      className: 'swp-task-select',
                      value: selectedTask,
                      onChange: ev => setSelectedTask(ev.target.value),
                    },
                      tasks.map(t =>
                        e('option', { key: t.id, value: t.id },
                          `${t.title} (${t.difficulty})`
                        )
                      )
                    )
              ),

              // Intensity
              e('div', { className: 'swp-section-label' }, 'Intensity'),
              e('div', { className: 'swp-intensity-row' },
                ['soft','medium','hard'].map(lvl =>
                  e('button', {
                    key: lvl,
                    className: `swp-intensity-btn${intensity === lvl ? ` active ${lvl}` : ''}`,
                    onClick: () => setIntensity(lvl),
                  }, lvl)
                )
              ),

              // Launch
              e('button', {
                className: 'swp-launch-btn',
                onClick: handleLaunch,
                disabled: !selectedTask || tasks.length === 0,
              },
                e('span', null, '⚡'),
                `Launch ${duration}min Sprint`
              )
            )
      )
    );
  }

  function showGlobalIndicator(secs) {
    const ind = document.getElementById('sprint-indicator');
    if (ind) {
      ind.classList.add('visible');
      const timeEl = ind.querySelector('.smi-time');
      if (timeEl) timeEl.textContent = utils.formatTime(secs);
    }
  }

  function hideGlobalIndicator() {
    const ind = document.getElementById('sprint-indicator');
    if (ind) ind.classList.remove('visible');
  }

  function triggerCelebration() {
    const colors = ['#e8ff47', '#34d399', '#38bdf8', '#a78bfa', '#ff4d6d'];
    for (let i = 0; i < 30; i++) {
      const p = document.createElement('div');
      p.className = 'celebration-particle';
      const angle = (Math.random() * 360 * Math.PI) / 180;
      const dist  = 60 + Math.random() * 160;
      p.style.cssText = `
        left: ${50 + Math.random() * 20 - 10}vw;
        top:  ${50 + Math.random() * 20 - 10}vh;
        background: ${colors[Math.floor(Math.random() * colors.length)]};
        --tx: ${Math.cos(angle) * dist}px;
        --ty: ${Math.sin(angle) * dist}px;
        animation-delay: ${Math.random() * 0.3}s;
        animation-duration: ${0.6 + Math.random() * 0.4}s;
        width: ${4 + Math.random() * 8}px;
        height: ${4 + Math.random() * 8}px;
        border-radius: ${Math.random() > 0.5 ? '50%' : '0'};
      `;
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 1200);
    }
  }

  // Mount
  const root = document.getElementById('sprint-widget-root');
  if (root) {
    ReactDOM.createRoot(root).render(e(SprintWidget));
  }
})();