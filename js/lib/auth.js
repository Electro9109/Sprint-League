const auth = (() => {
  const SESSION_KEY = 'sl_session';

  function _id() {
    return 'u_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
  }

  function _hash(pw) {
    // djb2 — demo only, not for production
    let h = 5381;
    for (let i = 0; i < pw.length; i++) h = (Math.imul(h, 33) ^ pw.charCodeAt(i)) >>> 0;
    return 'h' + h.toString(36);
  }

  async function register(email, password, username, age, gender) {
    if (!email || !password || !username)
      throw new Error('Email, password and username are required');

    const emailClean = email.toLowerCase().trim();
    const userClean  = username.trim();

    const all = await db.getAllRecords('users');
    if (all.find(u => u.email === emailClean))
      throw new Error('An account with that email already exists');
    if (all.find(u => u.username && u.username.toLowerCase() === userClean.toLowerCase()))
      throw new Error('That username is already taken');

    const id   = _id();
    const user = {
      id,
      email:        emailClean,
      username:     userClean,
      age:          age  ? parseInt(age,  10) : null,
      gender:       gender || null,
      passwordHash: _hash(password),
      avatar:       userClean.slice(0, 2).toUpperCase(),
      createdAt:    new Date().toISOString(),
    };

    await db.addRecord('users', user);
    await db.addRecord('stats', {
      id,
      totalScore:     0,
      totalSprints:   0,
      streak:         0,
      lastActiveDate: new Date().toDateString(),
    });

    _save(user);
    return user;
  }

  async function login(email, password) {
    const emailClean = email.toLowerCase().trim();
    const all  = await db.getAllRecords('users');
    const user = all.find(u => u.email === emailClean);

    if (!user)                             throw new Error('No account found with that email');
    if (user.passwordHash !== _hash(password)) throw new Error('Incorrect password');

    _save(user);
    return user;
  }

  function _save(user) {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      userId:   user.id,
      email:    user.email,
      username: user.username,
      avatar:   user.avatar,
      age:      user.age,
      gender:   user.gender,
    }));
  }

  function logout()     { localStorage.removeItem(SESSION_KEY); }
  function isLoggedIn() { return !!localStorage.getItem(SESSION_KEY); }
  function getUser()    {
    try { return JSON.parse(localStorage.getItem(SESSION_KEY)); }
    catch { return null; }
  }

  const api = { register, login, logout, isLoggedIn, getUser };
  window.auth = api;
  return api;
})();