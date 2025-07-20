   const firebaseConfig = {
      apiKey: "AIzaSyDVxECc2rX62S1o01SB0P9NUo4mq-2yTg8",
      authDomain: "comaster-fd3fe.firebaseapp.com",
      projectId: "comaster-fd3fe",
      storageBucket: "comaster-fd3fe.firebasestorage.app",
      messagingSenderId: "815599578812",
      appId: "1:815599578812:web:7dfd825d1d22a72d902ab9",
      databaseURL: "https://comaster-fd3fe-default-rtdb.firebaseio.com/"
    };

    firebase.initializeApp(firebaseConfig);
    const db = firebase.database();

    const usernameInput = document.getElementById('username');
    const mainUI = document.getElementById('mainUI');
    const fallbackCopyBtn = document.getElementById('fallbackCopyBtn');
    const dropdown = document.getElementById('deviceDropdown');
    const dropdownBtn = document.getElementById('dropdownBtn');
    const toast = document.getElementById('toast');

    let selectedDevice = "";

    const localUser = localStorage.getItem('username');
    if (localUser) login(localUser);

    function toggleDropdown() {
      dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
    }

    document.addEventListener('click', (e) => {
      if (!e.target.closest('.dropdown')) {
        dropdown.style.display = 'none';
      }
    });

    function showToast(msg) {
      toast.textContent = msg;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 3000);
    }

    async function login(name = null) {
      const username = name || usernameInput.value.trim();
      if (!username) return showToast("Enter a name");
      localStorage.setItem('username', username);
      usernameInput.style.display = 'none';
      document.querySelector('button').style.display = 'none';
      mainUI.style.display = 'flex';

      db.ref(`devices/${username}`).set({ lastSeen: Date.now(), clipboard: "" });
      syncDevices();
      listenClipboard();
    }

    function syncDevices() {
      dropdown.innerHTML = '';
      for (let i = 0; i < 4; i++) {
        const skel = document.createElement('div');
        skel.className = 'skeleton device';
        dropdown.appendChild(skel);
      }

      db.ref("devices").on("value", snapshot => {
        const devices = snapshot.val();
        dropdown.innerHTML = "";
        for (let name in devices) {
          if (name !== localStorage.getItem('username')) {
            const item = document.createElement('div');
            item.className = 'dropdown-item';
            const status = document.createElement('span');
            status.className = 'status-indicator ' + (Date.now() - devices[name].lastSeen < 30000 ? 'online' : 'offline');
            item.textContent = name;
            item.appendChild(status);
            item.onclick = () => {
              selectedDevice = name;
              dropdownBtn.textContent = `To: ${name}`;
              dropdown.style.display = 'none';
            }
            dropdown.appendChild(item);
          }
        }
      });
    }

    async function sendText() {
      const text = document.getElementById('textInput').value;
      if (!selectedDevice || !text) return showToast("Missing info");
      await db.ref(`devices/${selectedDevice}/clipboard`).set(text);
      showToast(`Sent to ${selectedDevice}`);
    }

    function listenClipboard() {
      const myName = localStorage.getItem('username');
      db.ref(`devices/${myName}/clipboard`).on("value", snapshot => {
        const value = snapshot.val();
        if (value) {
          if (document.hasFocus()) {
            updateClipboard(value);
          } else {
            window.addEventListener("focus", function onFocus() {
              updateClipboard(value);
              window.removeEventListener("focus", onFocus);
            });
          }
        }
      });
    }

    function updateClipboard(value) {
      if (!navigator.clipboard || typeof navigator.clipboard.writeText !== 'function') {
        console.warn("Clipboard API not available");
        fallbackCopyBtn.style.display = 'block';
        fallbackCopyBtn.setAttribute('data-text', value);
        return;
      }

      navigator.clipboard.writeText(value).then(() => {
        if (Notification.permission === "granted") {
          navigator.serviceWorker.getRegistration().then(reg => {
            if (reg) {
              reg.showNotification("📋 Clipboard Synced", {
                body: `Copied: "${value}"`,
                icon: "icons/icon-192.png",
                badge: "icons/icon-192.png",
                vibrate: [100, 50, 100],
                tag: 'clipboard-sync',
                data: { url: "/" }
              });
            }
          });
        }
        db.ref(`devices/${localStorage.getItem('username')}/clipboard`).set("");
      }).catch(err => {
        console.error("Clipboard write failed:", err);
        fallbackCopyBtn.style.display = 'block';
        fallbackCopyBtn.setAttribute('data-text', value);
      });
    }

    function manualCopy() {
      const text = fallbackCopyBtn.getAttribute('data-text');
      const tempInput = document.createElement('textarea');
      tempInput.value = text;
      document.body.appendChild(tempInput);
      tempInput.select();
      document.execCommand("copy");
      document.body.removeChild(tempInput);
      showToast("Copied manually to clipboard.");
      fallbackCopyBtn.style.display = 'none';
      db.ref(`devices/${localStorage.getItem('username')}/clipboard`).set("");
    }

    if (Notification.permission !== "granted") {
      Notification.requestPermission();
    }

    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').then(reg => {
          console.log('✅ Service Worker registered:', reg.scope);
        }).catch(err => {
          console.error('❌ Service Worker registration failed:', err);
        });
      });
    }

    function checkConnection() {
      const overlay = document.getElementById('offlineOverlay');
      function updateStatus() {
        overlay.style.display = navigator.onLine ? 'none' : 'flex';
      }
      window.addEventListener('online', updateStatus);
      window.addEventListener('offline', updateStatus);
      updateStatus();
    }
    checkConnection();

    navigator.serviceWorker.ready.then(reg => {
      if ('sync' in reg) {
        reg.sync.register("clipboard-sync");
      }
    });

    function fallbackClipboardSync(text) {
      const open = indexedDB.open("ClipboardSync", 1);
      open.onupgradeneeded = () => open.result.createObjectStore("clipboard-buffer");
      open.onsuccess = () => {
        const db = open.result;
        const tx = db.transaction("clipboard-buffer", "readwrite");
        const store = tx.objectStore("clipboard-buffer");
        store.put(text, "pending");
      };
    }
