/**
 * Tasks Page Logic
 */

class TasksPage {
  constructor() {
    this.user = auth.getUser();
    this.currentSprintTask = null;
    this.sprintTimer = null;
    this.sprintSeconds = 0;
    this.init();
  }

  async init() {
    if (!this.user) return;

    this.updateHeader();
    this.setupTaskForm();
    this.setupSprintControls();
    await this.loadTasks();
  }

  updateHeader() {
    const userAvatar = document.getElementById('userAvatar');
    const username = document.getElementById('username');
    
    if (userAvatar) userAvatar.textContent = this.user.avatar || 'U';
    if (username) username.textContent = this.user.displayName || 'User';
  }

  setupTaskForm() {
    const form = document.getElementById('taskForm');
    if (!form) return;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();

      const task = {
        id: utils.generateId(),
        userId: this.user.id,
        title: document.getElementById('taskTitle').value.trim(),
        category: document.getElementById('taskCategory').value,
        difficulty: document.getElementById('taskDifficulty').value,
        notes: document.getElementById('taskNotes').value,
        status: 'pending',
        createdAt: new Date().toISOString(),
        completedAt: null
      };

      try {
        await db.addRecord('tasks', task);
        form.reset();
        await this.loadTasks();
        utils.showNotification('Task created!', 'success');
      } catch (error) {
        console.error('Failed to create task:', error);
        utils.showNotification('Failed to create task', 'error');
      }
    });
  }

  async loadTasks() {
    try {
      const tasks = await db.queryByIndex('tasks', 'userId', this.user.id);
      const activeTasks = tasks.filter(t => t.status !== 'archived');

      // Update progress
      const completed = activeTasks.filter(t => t.status === 'completed').length;
      const total = activeTasks.length;
      const percent = total > 0 ? (completed / total) * 100 : 0;

      const progressText = document.getElementById('progressText');
      const progressPercent = document.getElementById('progressPercent');

      if (progressText) progressText.textContent = `${completed} of ${total} tasks completed`;
      if (progressPercent) progressPercent.textContent = Math.round(percent) + '%';

      // Render tasks
      const list = document.getElementById('tasksList');
      if (list) {
        if (activeTasks.length === 0) {
          list.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--muted);">No tasks yet</div>';
        } else {
          list.innerHTML = activeTasks.map((task, idx) => this.renderTask(task, idx)).join('');
          this.attachTaskListeners();
        }
      }
    } catch (error) {
      console.error('Failed to load tasks:', error);
    }
  }

  renderTask(task, idx) {
    const isCompleted = task.status === 'completed';
    return `
      <div class="task-item ${isCompleted ? 'completed' : ''}" data-task-id="${task.id}">
        <div class="task-check ${isCompleted ? 'done' : ''}" onclick="tasksPage.toggleTask('${task.id}')">
          ${isCompleted ? '✓' : ''}
        </div>
        <div class="task-content">
          <div class="task-title">${task.title}</div>
          <div class="task-meta">
            <span class="task-tag tag-${task.category}">${task.category}</span>
            <span class="task-difficulty ${task.difficulty}">${task.difficulty}</span>
          </div>
        </div>
        <div class="task-actions">
          ${!isCompleted ? `<button class="btn btn-sprint" onclick="tasksPage.startSprint('${task.id}', '${task.title}')">Start Sprint</button>` : ''}
          <button class="btn danger" onclick="tasksPage.deleteTask('${task.id}')">Delete</button>
        </div>
      </div>
    `;
  }

  attachTaskListeners() {
    // Listeners attached via onclick attributes
  }

  async toggleTask(taskId) {
    try {
      const task = await db.getRecord('tasks', taskId);
      task.status = task.status === 'completed' ? 'pending' : 'completed';
      task.completedAt = task.status === 'completed' ? new Date().toISOString() : null;
      await db.updateRecord('tasks', task);
      await this.loadTasks();
    } catch (error) {
      console.error('Failed to toggle task:', error);
    }
  }

  async deleteTask(taskId) {
    if (!confirm('Delete this task?')) return;
    try {
      await db.deleteRecord('tasks', taskId);
      await this.loadTasks();
    } catch (error) {
      console.error('Failed to delete task:', error);
    }
  }

  startSprint(taskId, taskTitle) {
    this.currentSprintTask = { id: taskId, title: taskTitle };
    this.sprintSeconds = 25 * 60; // 25 minute sprint
    this.showFocusOverlay();
    this.runSprintTimer();
  }

  showFocusOverlay() {
    const overlay = document.getElementById('focusOverlay');
    if (overlay) {
      overlay.classList.add('active');
      document.body.classList.add('in-focus');
      document.getElementById('focusTaskName').textContent = this.currentSprintTask.title;
      document.getElementById('focusTimer').textContent = '25:00';
      document.getElementById('focusWPM').textContent = '0';
      document.getElementById('focusScore').textContent = '0';
      document.getElementById('focusBar').style.width = '0%';
      
      // Prevent key presses from exiting focus mode
      document.addEventListener('keydown', this.focusKeyHandler.bind(this));
    }
  }

  focusKeyHandler(e) {
    // Prevent common browser shortcuts that might exit
    if (e.key === 'Escape' || (e.ctrlKey && e.key === 'w') || (e.metaKey && e.key === 'w')) {
      e.preventDefault();
    }
  }

  setFocusInactive() {
    const overlay = document.getElementById('focusOverlay');
    if (overlay) {
      overlay.classList.remove('active');
      document.body.classList.remove('in-focus');
      document.removeEventListener('keydown', this.focusKeyHandler.bind(this));
    }
  }

  runSprintTimer() {
    clearInterval(this.sprintTimer);
    this.sprintTimer = setInterval(() => {
      this.sprintSeconds--;
      const minutes = Math.floor(this.sprintSeconds / 60);
      const seconds = this.sprintSeconds % 60;
      const timerEl = document.getElementById('focusTimer');
      if (timerEl) {
        timerEl.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
      }

      const bar = document.getElementById('focusBar');
      const totalSeconds = 25 * 60;
      const percent = ((totalSeconds - this.sprintSeconds) / totalSeconds) * 100;
      if (bar) bar.style.width = percent + '%';

      if (this.sprintSeconds <= 0) {
        clearInterval(this.sprintTimer);
        this.completeSprint();
      }
    }, 1000);
  }

  async completeSprint() {
    try {
      // Update task status
      const task = await db.getRecord('tasks', this.currentSprintTask.id);
      task.status = 'completed';
      task.completedAt = new Date().toISOString();
      await db.updateRecord('tasks', task);

      // Create sprint record
      const sprint = {
        id: utils.generateId(),
        userId: this.user.id,
        taskId: task.id,
        taskName: task.title,
        category: task.category,
        difficulty: task.difficulty,
        status: 'completed',
        score: utils.calculateScore(task.difficulty, 0, true),
        createdAt: new Date().toISOString(),
        duration: 25 * 60
      };
      await db.addRecord('sprints', sprint);

      // Update stats
      const stats = await db.getRecord('stats', this.user.id);
      if (stats) {
        stats.totalSprints += 1;
        stats.totalScore += sprint.score;
        await db.updateRecord('stats', stats);
      }

      utils.showNotification('Sprint completed! +' + sprint.score + ' points', 'success');
      this.setFocusInactive();
      clearInterval(this.sprintTimer);
      await this.loadTasks();
    } catch (error) {
      console.error('Failed to complete sprint:', error);
    }
  }

  setupSprintControls() {
    const completeBtn = document.getElementById('focusCompleteBtn');
    const bailBtn = document.getElementById('focusBailBtn');
    const pauseBtn = document.getElementById('focusPauseBtn');

    if (completeBtn) {
      completeBtn.addEventListener('click', () => this.completeSprint());
    }

    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => {
        // Pause sprint (not yet implemented)
        utils.showNotification('Pause feature coming soon', 'info');
      });
    }

    if (bailBtn) {
      bailBtn.addEventListener('click', () => {
        const confirmed = confirm('Exit sprint? You will lose 50 points and this task will remain incomplete.');
        if (confirmed) {
          clearInterval(this.sprintTimer);
          
          // Deduct points and maintain task as pending
          try {
            this.setFocusInactive();
            utils.showNotification('Sprint exited. -50 points.', 'warning');
            this.loadTasks();
          } catch (error) {
            console.error('Failed to exit sprint:', error);
          }
        }
      });
    }
  }
}

// Make globally accessible
let tasksPage;

document.addEventListener('DOMContentLoaded', () => {
  tasksPage = new TasksPage();
});
