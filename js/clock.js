/**
 * Live Clock Module
 * Updates time and date in real-time
 */

const EOD_HOUR = 18; // 6 PM end of day

function updateClock() {
  const now = new Date();
  
  // Format current time HH:MM
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const timeString = `${hours}:${minutes}`;
  
  // Format date (e.g., "Tue, Feb 24")
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const dayName = days[now.getDay()];
  const monthName = months[now.getMonth()];
  const date = now.getDate();
  const dateString = `${dayName}, ${monthName} ${date}`;
  
  // Update live clock display
  const timeEl = document.getElementById('liveTime');
  if (timeEl) timeEl.textContent = timeString;
  
  // Update live date display
  const dateEl = document.getElementById('liveDate');
  if (dateEl) dateEl.textContent = dateString;
  
  // Calculate EOD countdown
  const endOfDay = new Date(now);
  endOfDay.setHours(EOD_HOUR, 0, 0, 0);
  
  if (now >= endOfDay) {
    endOfDay.setDate(endOfDay.getDate() + 1);
  }
  
  const timeLeft = endOfDay - now;
  const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
  
  // Update banner if it exists
  const bannerSub = document.querySelector('.banner-sub');
  if (bannerSub) {
    bannerSub.textContent = `EOD: ${String(EOD_HOUR).padStart(2, '0')}:00 · ${hoursLeft}h ${minutesLeft}m left`;
  }
}

// Update immediately on page load
updateClock();

// Update every second
setInterval(updateClock, 1000);
