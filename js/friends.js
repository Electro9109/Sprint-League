class FriendsPage {
  constructor() {
    this.user = null;
    this.friends = [];
    this.allUsers = [];
    this.init();
  }

  async init() {
    try {
      // Check authentication
      if (!auth.isLoggedIn()) {
        return;
      }

      this.user = auth.getUser();
      await this.loadUsers();
      await this.loadFriends();
      this.renderSquadStats();
      this.renderFriendsList();
    } catch (error) {
      console.error('Friends page init error:', error);
      utils.showNotification('Error loading friends', 'error');
    }
  }

  async loadUsers() {
    try {
      this.allUsers = await db.getAllRecords('users');
    } catch (error) {
      console.error('Error loading users:', error);
      this.allUsers = [];
    }
  }

  async loadFriends() {
    try {
      // Get all user records
      const allUsers = await db.getAllRecords('users');
      
      // Filter out current user
      this.friends = allUsers.filter(u => u.id !== this.user.id);
    } catch (error) {
      console.error('Error loading friends:', error);
      this.friends = [];
    }
  }

  async renderSquadStats() {
    try {
      // Squad count
      const squadCountEl = document.getElementById('squadCount');
      if (squadCountEl) {
        squadCountEl.textContent = this.allUsers.length.toString();
      }

      // Calculate average score across all users
      let totalScore = 0;
      let sprintCount = 0;

      for (const user of this.allUsers) {
        try {
          const userSprints = await db.queryByIndex('sprints', 'userId', user.id);
          sprintCount += userSprints.length;
          userSprints.forEach(sprint => {
            totalScore += sprint.score || 0;
          });
        } catch (e) {
          console.warn(`Could not load sprints for ${user.id}`);
        }
      }

      const avgScore = sprintCount > 0 ? Math.round(totalScore / sprintCount) : 0;
      const avgScoreEl = document.getElementById('avgSquadScore');
      if (avgScoreEl) {
        avgScoreEl.textContent = avgScore.toString();
      }

      // Active count (stub - would track active session time)
      const activeCountEl = document.getElementById('activeCount');
      if (activeCountEl) {
        activeCountEl.textContent = '0'; // Placeholder: could track active sprints
      }
    } catch (error) {
      console.error('Error rendering squad stats:', error);
    }
  }

  renderFriendsList() {
    const friendsListEl = document.getElementById('friendsList');
    if (!friendsListEl) return;

    if (this.friends.length === 0) {
      friendsListEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--muted);">No other users in system yet</div>';
      return;
    }

    // Calculate scores for each friend
    const friendsWithScores = this.friends.map(friend => ({
      ...friend,
      totalScore: 0,
      sprintCount: 0
    }));

    // Load all friend data and scores
    friendsListEl.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--muted);">Loading friends...</div>';

    this.loadFriendScores().then(friendsData => {
      friendsListEl.innerHTML = friendsData
        .sort((a, b) => b.totalScore - a.totalScore)
        .map(friend => this.renderFriendItem(friend))
        .join('');
    });
  }

  async loadFriendScores() {
    const friendsWithData = [];

    for (const friend of this.friends) {
      try {
        const sprints = await db.queryByIndex('sprints', 'userId', friend.id);
        const totalScore = sprints.reduce((sum, sprint) => sum + (sprint.score || 0), 0);
        
        friendsWithData.push({
          ...friend,
          totalScore,
          sprintCount: sprints.length
        });
      } catch (e) {
        friendsWithData.push({
          ...friend,
          totalScore: 0,
          sprintCount: 0
        });
      }
    }

    return friendsWithData;
  }

  renderFriendItem(friend) {
    const initials = friend.email.substring(0, 2).toUpperCase();
    const isCurrentUser = friend.id === this.user?.id;
    
    return `
      <div class="friend-item panel" style="padding: 16px; margin-bottom: 12px; border: 1px solid var(--border); border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="avatar" style="width: 40px; height: 40px; font-size: 14px;">${initials}</div>
          <div>
            <div style="font-weight: 500; margin-bottom: 2px;">${friend.email.split('@')[0]}</div>
            <div style="font-size: 12px; color: var(--muted);">${friend.sprintCount} sprints • ${friend.totalScore} points</div>
          </div>
        </div>
        <button class="btn-small" onclick="friendsPage.addFriend('${friend.id}')" style="font-size: 12px;">
          ${isCurrentUser ? 'You' : 'Follow'}
        </button>
      </div>
    `;
  }

  async addFriend(friendId) {
    // Stub: Would add friend to user's friend list
    utils.showNotification('Friend added!', 'success');
  }
}

// Initialize friends page when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    window.friendsPage = new FriendsPage();
  });
} else {
  window.friendsPage = new FriendsPage();
}
