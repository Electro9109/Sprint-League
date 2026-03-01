/**
 * auth-ui.js  —  React 18 Auth Modal
 *
 * Uses React.createElement (no build/Babel needed).
 * Mounts into <div id="auth-root"></div>.
 * Relies on window.db and window.auth being already loaded.
 */

/* global React, ReactDOM */

(function () {
  const { useState, useEffect, useCallback } = React;
  const e = React.createElement;

  // ─── helpers ─────────────────────────────────────────────────────

  function cx(...a) { return a.filter(Boolean).join(' '); }

  // ─── Field ───────────────────────────────────────────────────────

  function Field({ label, id, type = 'text', placeholder, value, onChange, error, autoFocus }) {
    return e('div', { className: 'ag-field' },
      e('label', { htmlFor: id, className: 'ag-label' }, label),
      e('input', {
        id, type, placeholder, value,
        autoFocus: !!autoFocus,
        autoComplete: type === 'password' ? 'current-password' : 'off',
        className: cx('ag-input', error && 'ag-input--err'),
        onChange: ev => onChange(ev.target.value),
      }),
      error ? e('span', { className: 'ag-field-err' }, '⚠ ' + error) : null
    );
  }

  // ─── SelectField ─────────────────────────────────────────────────

  function SelectField({ label, id, value, onChange, options }) {
    return e('div', { className: 'ag-field' },
      e('label', { htmlFor: id, className: 'ag-label' }, label),
      e('select', {
        id, value,
        className: 'ag-select',
        onChange: ev => onChange(ev.target.value),
      }, options.map(o => e('option', { key: o.v, value: o.v }, o.l)))
    );
  }

  // ─── PasswordStrength ────────────────────────────────────────────

  function PasswordStrength({ pw }) {
    if (!pw) return null;
    const score = [
      pw.length >= 8,
      /[A-Z]/.test(pw),
      /\d/.test(pw),
      /[^A-Za-z0-9]/.test(pw),
    ].filter(Boolean).length;

    const colors = ['', '#ff4747', '#ffc847', '#47c8ff', '#4dff91'];
    const labels = ['', 'Weak', 'Fair', 'Good', 'Strong'];

    return e('div', { className: 'ag-pw' },
      e('div', { className: 'ag-pw-bars' },
        [1, 2, 3, 4].map(i =>
          e('div', {
            key: i,
            className: 'ag-pw-bar',
            style: { background: score >= i ? colors[score] : 'var(--border)' },
          })
        )
      ),
      score > 0
        ? e('span', { className: 'ag-pw-lbl', style: { color: colors[score] } }, labels[score])
        : null
    );
  }

  // ─── FormError ───────────────────────────────────────────────────

  function FormError({ msg }) {
    if (!msg) return null;
    return e('div', { className: 'ag-form-err', role: 'alert' }, '⚠ ' + msg);
  }

  // ─── SubmitBtn ───────────────────────────────────────────────────

  function SubmitBtn({ loading, label }) {
    return e('button', {
      type: 'submit',
      disabled: loading,
      className: cx('ag-btn', loading && 'ag-btn--loading'),
    },
      loading ? e('span', { className: 'ag-spinner' }) : label
    );
  }

  // ─── LoginForm ───────────────────────────────────────────────────

  function LoginForm({ onDone, onSwitch }) {
    const [email,   setEmail]   = useState('');
    const [pw,      setPw]      = useState('');
    const [errs,    setErrs]    = useState({});
    const [formErr, setFormErr] = useState('');
    const [loading, setLoading] = useState(false);

    function validate() {
      const v = {};
      if (!email.trim())                     v.email = 'Required';
      else if (!/\S+@\S+\.\S+/.test(email))  v.email = 'Enter a valid email';
      if (!pw)                               v.pw    = 'Required';
      setErrs(v);
      return !Object.keys(v).length;
    }

    async function onSubmit(ev) {
      ev.preventDefault();
      setFormErr('');
      if (!validate()) return;
      setLoading(true);
      try {
        await window.auth.login(email.trim(), pw);
        onDone();
      } catch (err) {
        setFormErr(err.message);
      } finally {
        setLoading(false);
      }
    }

    return e('form', { onSubmit, noValidate: true, className: 'ag-form' },
      e(Field, {
        label: 'Email', id: 'li-email', type: 'email', placeholder: 'you@example.com',
        value: email, autoFocus: true, error: errs.email,
        onChange: v => { setEmail(v); setErrs(p => ({ ...p, email: '' })); },
      }),
      e(Field, {
        label: 'Password', id: 'li-pw', type: 'password', placeholder: '••••••',
        value: pw, error: errs.pw,
        onChange: v => { setPw(v); setErrs(p => ({ ...p, pw: '' })); },
      }),
      e(FormError, { msg: formErr }),
      e(SubmitBtn, { loading, label: 'Sign In' }),
      e('p', { className: 'ag-switch' },
        "Don't have an account? ",
        e('button', { type: 'button', className: 'ag-link', onClick: onSwitch }, 'Register →')
      )
    );
  }

  // ─── RegisterForm ────────────────────────────────────────────────

  const GENDERS = [
    { v: '',       l: 'Prefer not to say' },
    { v: 'male',   l: 'Male' },
    { v: 'female', l: 'Female' },
    { v: 'other',  l: 'Other' },
  ];

  function RegisterForm({ onDone, onSwitch }) {
    const [f,       setF]       = useState({ username: '', email: '', pw: '', age: '', gender: '' });
    const [errs,    setErrs]    = useState({});
    const [formErr, setFormErr] = useState('');
    const [loading, setLoading] = useState(false);

    const set = k => v => {
      setF(prev => ({ ...prev, [k]: v }));
      setErrs(prev => ({ ...prev, [k]: '' }));
    };

    function validate() {
      const v = {};
      if (!f.username.trim())                  v.username = 'Required';
      else if (f.username.trim().length < 3)   v.username = 'Min 3 characters';
      else if (/\s/.test(f.username))          v.username = 'No spaces allowed';

      if (!f.email.trim())                     v.email = 'Required';
      else if (!/\S+@\S+\.\S+/.test(f.email)) v.email = 'Enter a valid email';

      if (!f.pw)                               v.pw = 'Required';
      else if (f.pw.length < 6)               v.pw = 'Minimum 6 characters';

      if (f.age && (isNaN(+f.age) || +f.age < 10 || +f.age > 99))
        v.age = 'Enter age 10–99';

      setErrs(v);
      return !Object.keys(v).length;
    }

    async function onSubmit(ev) {
      ev.preventDefault();
      setFormErr('');
      if (!validate()) return;
      setLoading(true);
      try {
        await window.auth.register(
          f.email.trim(), f.pw,
          f.username.trim(),
          f.age    || null,
          f.gender || null
        );
        onDone();
      } catch (err) {
        setFormErr(err.message);
      } finally {
        setLoading(false);
      }
    }

    return e('form', { onSubmit, noValidate: true, className: 'ag-form' },
      e(Field, {
        label: 'Username', id: 're-usr', placeholder: 'your_handle',
        value: f.username, autoFocus: true, error: errs.username,
        onChange: set('username'),
      }),
      e(Field, {
        label: 'Email', id: 're-email', type: 'email', placeholder: 'you@example.com',
        value: f.email, error: errs.email,
        onChange: set('email'),
      }),
      e('div', null,
        e(Field, {
          label: 'Password', id: 're-pw', type: 'password', placeholder: 'Min 6 characters',
          value: f.pw, error: errs.pw,
          onChange: set('pw'),
        }),
        e(PasswordStrength, { pw: f.pw })
      ),
      e('div', { className: 'ag-row2' },
        e(Field, {
          label: 'Age (optional)', id: 're-age', type: 'number', placeholder: '--',
          value: f.age, error: errs.age,
          onChange: set('age'),
        }),
        e(SelectField, {
          label: 'Gender (optional)', id: 're-gender',
          value: f.gender, options: GENDERS,
          onChange: set('gender'),
        })
      ),
      e(FormError, { msg: formErr }),
      e(SubmitBtn, { loading, label: 'Create Account' }),
      e('p', { className: 'ag-switch' },
        'Already have an account? ',
        e('button', { type: 'button', className: 'ag-link', onClick: onSwitch }, 'Sign in →')
      )
    );
  }

  // ─── AuthModal ───────────────────────────────────────────────────

  function AuthModal() {
    const [view,    setView]    = useState('login');
    const [visible, setVisible] = useState(false);

    useEffect(() => {
      // db.init() already called by app.js — just check login state
      // Poll briefly in case app.js hasn't run yet
      let attempts = 0;
      const tid = setInterval(() => {
        attempts++;
        if (window.db && window.auth) {
          clearInterval(tid);
          const loggedIn = window.auth.isLoggedIn();
          setVisible(!loggedIn);
          const main = document.querySelector('main.page');
          if (main) main.style.display = loggedIn ? 'block' : 'none';
        }
        if (attempts > 40) clearInterval(tid); // 2s timeout
      }, 50);
      return () => clearInterval(tid);
    }, []);

    const onDone = useCallback(() => {
      setVisible(false);
      location.reload();
    }, []);

    if (!visible) return null;

    return e('div', { className: 'ag-overlay', role: 'dialog', 'aria-modal': 'true' },
      e('div', { className: 'ag-card' },

        e('div', { className: 'ag-logo' },
          'Sprint', e('span', null, 'League')
        ),
        e('p', { className: 'ag-tagline' }, '// gamify your productivity'),

        e('div', { className: 'ag-tabs' },
          e('button', {
            type: 'button',
            className: cx('ag-tab', view === 'login' && 'ag-tab--on'),
            onClick: () => setView('login'),
          }, 'Sign In'),
          e('button', {
            type: 'button',
            className: cx('ag-tab', view === 'register' && 'ag-tab--on'),
            onClick: () => setView('register'),
          }, 'Register')
        ),

        e('div', { className: 'ag-body' },
          view === 'login'
            ? e(LoginForm,    { onDone, onSwitch: () => setView('register') })
            : e(RegisterForm, { onDone, onSwitch: () => setView('login') })
        )
      )
    );
  }

  // ─── Mount using React 18 createRoot ─────────────────────────────

  function mount() {
    const container = document.getElementById('auth-root');
    if (!container) {
      console.error('[auth-ui] #auth-root element not found in DOM');
      return;
    }
    // React 18: createRoot instead of ReactDOM.render
    const root = ReactDOM.createRoot(container);
    root.render(e(AuthModal));
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', mount)
    : mount();

})();