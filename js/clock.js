/**
 * clock.js — Live Clock + EOD Banner updater
 */

const EOD_HOUR = 18; // 6 PM

function updateClock() {
  const now = new Date();

  // ── Live clock ──
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const timeEl = document.getElementById('liveTime');
  if (timeEl) timeEl.textContent = `${h}:${m}`;

  // ── Live date ──
  const days   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const dateEl = document.getElementById('liveDate');
  if (dateEl) {
    dateEl.textContent =
      `${days[now.getDay()]}, ${months[now.getMonth()]} ${String(now.getDate()).padStart(2,'0')}`;
  }

  // ── EOD countdown ──
  const eod = new Date(now);
  eod.setHours(EOD_HOUR, 0, 0, 0);
  if (now >= eod) eod.setDate(eod.getDate() + 1);

  const msLeft   = eod - now;
  const hoursLeft = Math.floor(msLeft / 3_600_000);
  const minsLeft  = Math.floor((msLeft % 3_600_000) / 60_000);
  const isWarning = hoursLeft < 2;

  // EOD banner elements (new IDs)
  const banner  = document.getElementById('eodBanner');
  const hEl     = document.getElementById('eodH');
  const mEl     = document.getElementById('eodM');
  const target  = document.getElementById('eodTarget');

  if (banner)  banner.classList.toggle('warning', isWarning);
  if (hEl)     hEl.textContent = hoursLeft;
  if (mEl)     mEl.textContent = String(minsLeft).padStart(2, '0');
  if (target)  target.textContent = `${String(EOD_HOUR).padStart(2,'0')}:00`;

  // Legacy banner-sub support (friends / analytics pages)
  const bannerSub = document.querySelector('.banner-sub');
  if (bannerSub) {
    bannerSub.textContent = `EOD: ${String(EOD_HOUR).padStart(2,'0')}:00 · ${hoursLeft}h ${minsLeft}m left`;
  }
}

// Expose for dashboard.js / tasks.js to call after loading tasks
window.updateEodProgress = function(completed, total) {
  const fillEl  = document.getElementById('eodFill');
  const labelEl = document.getElementById('eodTaskLabel');
  if (fillEl)  fillEl.style.width  = total > 0 ? ((completed / total) * 100) + '%' : '0%';
  if (labelEl) labelEl.textContent = `${completed} / ${total} done`;
};

updateClock();
setInterval(updateClock, 1000);