// ============================================================
//  GLOBAL SETUP
// ============================================================

// Timer display + UI references
const timerDisplay = document.getElementById("timerDisplay");
const driverListEl = document.getElementById("driverList");
const statusEl = document.getElementById("status");

// Firebase DB references
const timerRef = db.ref("timer");
const driversRef = db.ref("drivers");

// Local timer update interval
let localInterval = null;


// ============================================================
//  TIME FORMAT: MM:SS:MS
// ============================================================

function formatMS(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const msPart = Math.floor(ms % 100);
  
  return (
    String(m).padStart(2, "0") + ":" +
    String(s).padStart(2, "0") + ":" +
    String(msPart).padStart(2, "0")
  );
}


// ============================================================
//  REALTIME TIMER LISTENER (Admin + Viewer)
// ============================================================

timerRef.on(
  "value",
  snapshot => {
    const data = snapshot.val() || {
      running: false,
      startTime: 0,
      elapsed: 0
    };

    if (statusEl) statusEl.innerText = data.running ? "Running" : "Stopped";

    if (data.running) {
      if (localInterval) clearInterval(localInterval);

      localInterval = setInterval(() => {
        db.ref(".info/serverTimeOffset").once("value").then(offSnap => {
          const offset = offSnap.val() || 0;
          const serverNow = Date.now() + offset;

          const diff = data.elapsed + (serverNow - data.startTime);
          if (timerDisplay) timerDisplay.innerText = formatMS(diff);
        });
      }, 1);
    } else {
      if (localInterval) {
        clearInterval(localInterval);
        localInterval = null;
      }

      if (timerDisplay) timerDisplay.innerText = formatMS(data.elapsed || 0);
    }
  },
  err => console.error("Timer listener error:", err)
);


// ============================================================
//  DRIVER LISTENER (Admin + Viewer)
// ============================================================

driversRef.on(
  "value",
  snapshot => {
    const data = snapshot.val() || {};
    renderDriverList(data);
  },
  err => console.error("Drivers listener error:", err)
);

function renderDriverList(drivers) {
  if (!driverListEl) return;

  driverListEl.innerHTML = "";

  const keys = Object.keys(drivers);
  if (keys.length === 0) {
    driverListEl.innerHTML = `<div class="small">No drivers yet</div>`;
    return;
  }

  keys.forEach(key => {
    const d = drivers[key];

    const row = document.createElement("div");
    row.className = "driver";

    row.innerHTML = `
      <div class="meta">
        <div>
          <div style="font-weight:700">${escapeHtml(d.name)}</div>
          <div class="small">Car ${escapeHtml(d.car)} • ${escapeHtml(d.team)}</div>
        </div>
      </div>
      <div class="right">
        ${isAdminUI() ? `<button class="btn danger" data-id="${key}" data-del>Delete</button>` : ""}
      </div>
    `;

    driverListEl.appendChild(row);
  });

  // Delete buttons appear only in admin mode
  if (isAdminUI()) {
    driverListEl.querySelectorAll("[data-del]").forEach(btn => {
      btn.onclick = () => {
        const id = btn.getAttribute("data-id");
        if (confirm("Delete this driver?")) {
          driversRef.child(id).remove();
        }
      };
    });
  }
}


// ============================================================
//  HELPER
// ============================================================

function escapeHtml(s) {
  return String(s || "").replace(/[&<>"']/g, m => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
  ));
}

function isAdminUI() {
  return document.getElementById("addDriverBtn") !== null;
}


// ============================================================
//  ADMIN CONTROLS (RUN ONLY ON admin.html)
// ============================================================

if (isAdminUI()) {

  // Start (with countdown)
  document.getElementById("startBtn").onclick = () => {
    let countdown = 5;
    timerDisplay.innerText = `Starting in ${countdown}...`;

    const countdownInterval = setInterval(() => {
      countdown--;
      if (countdown > 0) {
        timerDisplay.innerText = `Starting in ${countdown}...`;
      } else {
        clearInterval(countdownInterval);

        timerRef.once("value").then(snap => {
          const data = snap.val() || { elapsed: 0 };

          timerRef.set({
            running: true,
            startTime: firebase.database.ServerValue.TIMESTAMP,
            elapsed: data.elapsed
          });
        });
      }
    }, 1000);
  };

  // Stop
  document.getElementById("stopBtn").onclick = () => {
    timerRef.once("value").then(snap => {
      const data = snap.val();
      if (!data) return;

      const stopTime = Date.now();
      const newElapsed = data.elapsed + (stopTime - data.startTime);

      timerRef.set({
        running: false,
        startTime: 0,
        elapsed: newElapsed
      });
    });
  };

  // Reset
  document.getElementById("resetBtn").onclick = () => {
    if (confirm("Reset timer?")) {
      timerRef.set({
        running: false,
        startTime: 0,
        elapsed: 0
      });
    }
  };

  // Add driver
  document.getElementById("addDriverBtn").onclick = () => {
    const name = document.getElementById("driverName").value.trim();
    const car = document.getElementById("driverCar").value.trim();
    const team = document.getElementById("driverTeam").value.trim();

    if (!name || !car || !team) {
      alert("Fill all driver fields.");
      return;
    }

    driversRef.push({
      name,
      car,
      team,
      createdAt: Date.now()
    });

    document.getElementById("driverName").value = "";
    document.getElementById("driverCar").value = "";
    document.getElementById("driverTeam").value = "";
  };

  // Clear all drivers
  document.getElementById("clearDriversBtn").onclick = () => {
    if (confirm("Delete ALL drivers?")) {
      driversRef.remove();
    }
  };
}


// ============================================================
//  UNIVERSAL LOGOUT (Admin + Viewer)
// ============================================================

document.addEventListener("DOMContentLoaded", () => {
  const logoutBtn = document.getElementById("logoutBtn");
  if (logoutBtn) {
    logoutBtn.onclick = () => {
      sessionStorage.removeItem("race_role");
      window.location.href = "login.html";
    };
  }
});

