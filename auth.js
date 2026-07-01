/* EE Lab · shared passphrase gate — deterrent only, not real security (client-side hash check). */
(function () {
  const GATE_CONFIG = {
    viewer: { hash: '69fc721e4ed41553e24dcdf5c0b3b6aab78f96a86e9a0b71d1df22d1bf0d4368', label: 'Dashboard' },
    admin: { hash: '9b0a00654d55e3fce4e78ecd7c03c7ea0c5acb453e4a853bf89187adc4568048', label: 'Report Builder' },
  };

  async function sha256Hex(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  window.eeGate = function (pageKey) {
    const cfg = GATE_CONFIG[pageKey];
    if (!cfg) { console.error('eeGate: unknown page key', pageKey); return; }
    const sessionKey = 'ee_auth_' + pageKey;
    if (sessionStorage.getItem(sessionKey) === 'ok') return;

    document.documentElement.style.visibility = 'hidden';

    const overlay = document.createElement('div');
    overlay.id = 'ee-gate-overlay';
    overlay.innerHTML = `
      <style>
        #ee-gate-overlay{position:fixed;inset:0;background:linear-gradient(160deg,#0C2D6B,#091f4d);
          display:flex;align-items:center;justify-content:center;z-index:99999;
          font-family:'Inter',system-ui,sans-serif}
        #ee-gate-box{background:#fff;border-radius:12px;padding:32px 30px;width:340px;max-width:90vw;
          box-shadow:0 20px 60px rgba(0,0,0,.35);text-align:center}
        #ee-gate-box .dot{width:10px;height:10px;border-radius:50%;background:#C8960C;margin:0 auto 10px}
        #ee-gate-box h2{font-size:16px;color:#0C2D6B;margin-bottom:4px;font-weight:700}
        #ee-gate-box p{font-size:11px;color:#6b7280;margin-bottom:18px}
        #ee-gate-box input{width:100%;padding:10px 12px;border:1.5px solid #dde3ef;border-radius:7px;
          font-size:14px;text-align:center;letter-spacing:1px;margin-bottom:12px;font-family:inherit;
          box-sizing:border-box}
        #ee-gate-box input:focus{outline:none;border-color:#0C2D6B}
        #ee-gate-box button{width:100%;padding:10px;border:none;border-radius:7px;background:#C8960C;
          color:#0C2D6B;font-weight:700;font-size:13px;cursor:pointer;transition:background .15s}
        #ee-gate-box button:hover{background:#f0b830}
        #ee-gate-box .err{color:#8b0000;font-size:11px;margin-top:10px;min-height:14px}
        #ee-gate-box.shake{animation:eeShake .35s}
        @keyframes eeShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-6px)}75%{transform:translateX(6px)}}
      </style>
      <div id="ee-gate-box">
        <div class="dot"></div>
        <h2>KLE-CTIE &middot; EE Lab</h2>
        <p>${cfg.label} &mdash; enter passphrase to continue</p>
        <input type="password" id="ee-gate-input" placeholder="Passphrase" autocomplete="off">
        <button id="ee-gate-submit">Unlock &rarr;</button>
        <div class="err" id="ee-gate-err"></div>
      </div>`;
    document.body.appendChild(overlay);
    document.documentElement.style.visibility = 'visible';

    const box = overlay.querySelector('#ee-gate-box');
    const input = overlay.querySelector('#ee-gate-input');
    const err = overlay.querySelector('#ee-gate-err');
    input.focus();

    async function tryUnlock() {
      const val = input.value;
      if (!val) return;
      const hex = await sha256Hex(val);
      if (hex === cfg.hash) {
        sessionStorage.setItem(sessionKey, 'ok');
        overlay.remove();
      } else {
        err.textContent = 'Incorrect passphrase';
        box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
        input.value = ''; input.focus();
      }
    }
    overlay.querySelector('#ee-gate-submit').addEventListener('click', tryUnlock);
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') tryUnlock(); });
  };
})();
