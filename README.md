# Sprint League

Gamified productivity tracker with sprints, scoring, and squad accountability.

## Quick Start

```bash
node server.js
```

Then open **http://localhost:3000** in your browser.

> ⚠️ Must be served over HTTP — opening index.html directly as a file:// URL
> breaks IndexedDB (login/register will silently fail).

## Structure

```
sprint-league/
├── server.js          ← Dev server (Node built-ins only, no npm install needed)
├── index.html         ← Dashboard
├── tasks.html         ← Task manager + focus overlay
├── analytics.html     ← Heatmap, WPM trend, charts
├── friends.html       ← Squad / accountability
├── league.html        ← Leaderboard, duels, badges
│
├── css/               ← One CSS file per page + shared base
└── js/
    ├── auth-ui.js     ← React 18 auth modal (login + register)
    ├── app.js         ← Header, logout, nav
    ├── clock.js       ← Live clock
    ├── dashboard.js   ← Dashboard data
    ├── tasks.js       ← Task CRUD + sprint timer
    ├── analytics.js   ← Analytics data
    ├── friends.js     ← Squad data
    ├── league.js      ← Leaderboard data
    └── lib/
        ├── db.js      ← IndexedDB wrapper (v3)
        ├── auth.js    ← Register / login / logout
        └── utils.js   ← Helpers
```

## Auth Flow

1. On page load, `db.js` initialises IndexedDB (version 3)
2. `app.js` calls `db.init()`, then shows/hides `<main>` based on session
3. React mounts `AuthModal` into `#auth-root` — shows if not logged in
4. Register stores user + stats records in IndexedDB; saves session to localStorage
5. Login looks up user by email, verifies password hash, saves session
6. Logout clears localStorage session → page reloads → modal reappears