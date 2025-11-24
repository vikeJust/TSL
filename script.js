// script.js - shared by admin.html and index.html
// Assumes firebase (compat) is loaded and 'db' is available globally from firebase.database()

// Utility: format milliseconds to HH:MM:SS
function formatMS(ms){
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msPart = Math.floor(ms % 100);

  return (
    String(m).padStart(2, '0') + ":" +
    String(s).padStart(2, '0') + ":" +
    String(msPart).padStart(2, '0')
  );
}
const timerDisplay = document.getElementById('timerDisplay');
const driverListEl = document.getElementById('driverList');
const dbStateEl = document.getElementById('dbState');
const statusEl = document.getElementById('status');

let localInterval = null;

// Database refs
const timerRef = db.ref('timer');
const driversRef = db.ref('drivers');

// Timer listener
timerRef.on('value', snapshot => {
  const data = snapshot.val() || { running:false, startTime:0, elapsed:0 };
  if(statusEl) statusEl.innerText = data.running ? 'Running' : 'Stopped';
  if(data.running){
    if(localInterval) clearInterval(localInterval);
    localInterval = setInterval(()=>{
      const now = Date.now();
      const diff = (data.elapsed || 0) + (now - (data.startTime || now));
      if(timerDisplay) timerDisplay.innerText = formatMS(diff);
    }, 1);
  } else {
    if(localInterval){ clearInterval(localInterval); localInterval = null; }
    if(timerDisplay) timerDisplay.innerText = formatMS(data.elapsed || 0);
  }
  if(dbStateEl) dbStateEl.innerText = JSON.stringify(data, null, 2);
}, err => {
  if(statusEl) statusEl.innerText = 'Error';
  console.error('Timer listener error', err);
});

// Drivers listener
driversRef.on('value', snapshot => {
  const data = snapshot.val() || {};
  renderDriverList(data);
}, err => console.error('Drivers listener error', err));

function renderDriverList(drivers){
  if(!driverListEl) return;
  driverListEl.innerHTML = '';
  const keys = Object.keys(drivers);
  if(keys.length === 0){
    driverListEl.innerHTML = '<div class="small">No drivers yet</div>';
    return;
  }
  keys.sort();
  keys.forEach(key=>{
    const d = drivers[key];
    const el = document.createElement('div');
    el.className = 'driver';
    el.innerHTML = `
      <div class="meta">
        <div>
          <div style="font-weight:700">${escapeHtml(d.name || 'Unnamed')}</div>
          <div class="small">${escapeHtml(d.team || '')} • ${escapeHtml(d.car || '')}</div>
        </div>
      </div>
      <div class="right">
        ${isAdminUI() ? `<button class="btn secondary" data-id="${key}" data-action="del">Delete</button>` : ''}
      </div>
    `;
    driverListEl.appendChild(el);
  });

  if(isAdminUI()){
    const dels = driverListEl.querySelectorAll('button[data-action="del"]');
    dels.forEach(b=>{
      b.addEventListener('click', e=>{
        const id = b.getAttribute('data-id');
        if(confirm('Delete this driver?')) driversRef.child(id).remove();
      });
    });
  }
}

function isAdminUI(){
  return !!document.getElementById('addDriverBtn');
}

// Admin bindings
if(isAdminUI()){
 document.getElementById('startBtn').addEventListener('click', () => {
  let countdown = 5;

  // Show countdown on timer
  if (timerDisplay) timerDisplay.innerText = `Starting in ${countdown}...`;

  const countdownInterval = setInterval(() => {
    countdown--;
    if (countdown > 0) {
      timerDisplay.innerText = `Starting in ${countdown}...`;
    } else {
      clearInterval(countdownInterval);

      // Start real timer only after countdown finishes
      timerRef.once("value").then(snap => {
        const data = snap.val() || { elapsed: 0 };
        timerRef.set({
          running: true,
          startTime: Date.now(),
          elapsed: data.elapsed || 0
        });
      });
    }
  }, 1000);
});
  document.getElementById('stopBtn').addEventListener('click', ()=>{
    timerRef.once('value').then(snap=>{
      const data = snap.val();
      if(!data) return;
      const newElapsed = (data.elapsed || 0) + (Date.now() - (data.startTime || Date.now()));
      timerRef.set({ running:false, startTime:0, elapsed: newElapsed });
    });
  });

  document.getElementById('resetBtn').addEventListener('click', ()=>{
    if(!confirm('Reset timer to 00:00:00?')) return;
    timerRef.set({ running:false, startTime:0, elapsed:0 });
  });

  // Add driver
  document.getElementById('addDriverBtn').addEventListener('click', ()=>{
    const name = document.getElementById('driverName').value.trim();
    const car = document.getElementById('driverCar').value.trim();
    const team = document.getElementById('driverTeam').value.trim();
    if(!name){ alert('Enter driver name'); return; }
    const newRef = driversRef.push();
    newRef.set({ name, car, team, createdAt: Date.now() });
    document.getElementById('driverName').value = '';
    document.getElementById('driverCar').value = '';
    document.getElementById('driverTeam').value = '';
  });

  document.getElementById('exportBtn').addEventListener('click', ()=>{
    driversRef.once('value').then(snap=>{
      const data = snap.val() || {};
      const blob = new Blob([JSON.stringify(data, null, 2)], {type:'application/json'});
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = 'drivers.json'; a.click();
      URL.revokeObjectURL(url);
    });
  });

  document.getElementById('clearDriversBtn').addEventListener('click', ()=>{
    if(confirm('Remove ALL drivers?')) driversRef.set(null);
  });

  // Logout buttons
  const logoutBtns = document.querySelectorAll('#logoutBtn');
  logoutBtns.forEach(b=> b.addEventListener('click', ()=>{
    sessionStorage.removeItem('race_role');
    window.location.href = '/login.html';
  }));
} else {
  // Viewer logout
  const vLogout = document.getElementById('logoutBtn');
  if(vLogout){
    vLogout.addEventListener('click', ()=>{
      sessionStorage.removeItem('race_role');
      window.location.href = '/login.html';
    });
  }
}

// Helper
function escapeHtml(s){
  return String(s || '').replace(/[&<>"']/g, function(m){ return ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]); });
}
