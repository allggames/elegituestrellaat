// script.js
// Versión corregida y unificada: mantiene el splash (una sola vez), asignación de premios,
// bloqueo por día, sonido, stars, canvas y demás.

(function () {
  'use strict';

  /* ---------- Geometry: crea "d" para estrella de 5 puntas ---------- */
  function makeStarPath(cx, cy, spikes, outerR, innerR) {
    let rot = -Math.PI / 2;
    const step = Math.PI / spikes;
    let d = '';
    for (let i = 0; i < spikes; i++) {
      const xOuter = cx + Math.cos(rot) * outerR;
      const yOuter = cy + Math.sin(rot) * outerR;
      d += (i === 0 ? `M ${xOuter} ${yOuter} ` : `L ${xOuter} ${yOuter} `);
      rot += step;
      const xInner = cx + Math.cos(rot) * innerR;
      const yInner = cy + Math.sin(rot) * innerR;
      d += `L ${xInner} ${yInner} `;
      rot += step;
    }
    d += 'Z';
    return d;
  }

  /* ------------------ Splash loader (insert near top of script.js) ------------------ */
  (function splashInit() {
    // Config
    const STAR_COUNT = 46;        // cantidad de estrellas en pantalla
    const LOAD_MS = 1400;        // duración aproximada de "carga" (ms)

    // helper: crea estrellas emoji dentro de #splash-stars
    function createSplashStars() {
      const container = document.getElementById('splash-stars');
      if (!container) return;
      container.innerHTML = '';
      for (let i=0;i<STAR_COUNT;i++){
        const s = document.createElement('div');
        s.className = 'splash-star';
        s.textContent = '🌟';
        // posicion aleatoria
        s.style.left = (Math.random() * 100) + '%';
        s.style.top = (Math.random() * 100) + '%';
        // tamaño y duración aleatoria
        const size = 10 + Math.round(Math.random()*26); // px
        s.style.fontSize = size + 'px';
        const dur = 6 + Math.random()*8;
        s.style.animationDuration = dur.toFixed(2) + 's';
        s.style.opacity = (0.5 + Math.random()*0.6).toFixed(2);
        s.style.animationDelay = (Math.random()*2).toFixed(2) + 's';
        container.appendChild(s);
      }
    }

    // Mover #logo (si existe) hacia el footer #bottom-logo-container
    function placeBottomLogo() {
      const logo = document.getElementById('logo');
      const container = document.getElementById('bottom-logo-container');
      if (logo && container) {
        try {
          // mostrarse si estaba oculto por la clase
          logo.classList.remove('hide-until-bottom');
          logo.style.display = ''; // limpia inline style si existe
          container.appendChild(logo);
          container.setAttribute('aria-hidden','false');
        } catch(e) { /* ignore */ }
      }
    }

    // Simula progreso y luego oculta el splash
    function runLoaderThenHide() {
      const progress = document.getElementById('loading-progress');
      const splash = document.getElementById('splash');
      if (!progress || !splash) return;

      const start = performance.now();
      function tick(now) {
        const t = Math.min(1, (now - start) / LOAD_MS);
        const eased = (1 - Math.cos(Math.PI * t)) / 2; // ease in/out
        const percent = Math.round(eased * 100);
        progress.style.width = percent + '%';
        if (t < 1) requestAnimationFrame(tick);
        else {
          // pequeño delay para que se vea 100%
          setTimeout(()=> {
            // hide splash with fade
            splash.classList.add('hidden');
            // luego de ocultar, mover/mostrar el logo inferior
            placeBottomLogo();
          }, 280);
        }
      }
      requestAnimationFrame(tick);
    }

    // init on DOM ready
    document.addEventListener('DOMContentLoaded', () => {
      createSplashStars();
      window.addEventListener('resize', createSplashStars);
      // start loader after tiny delay so everything paints
      setTimeout(runLoaderThenHide, 160);
    });
  })();

  /* ------------------------------------------------------------------ */
  /*  ADICIONES para: asignación aleatoria de premios y bloqueo por día  */
  /* ------------------------------------------------------------------ */

  // storage keys
  const ASSIGN_KEY = 'stars.assignments';
  const SELECT_KEY = 'stars.selection';

  // helper: today's date key YYYY-MM-DD
  function todayKey() {
    return new Date().toISOString().slice(0,10);
  }

  // formatea ISO a una cadena legible local (dd/mm/aaaa hh:mm)
  function formatSavedAt(isoString) {
    try {
      const d = new Date(isoString);
      return d.toLocaleString([], { year: 'numeric', month: '2-digit', day: '2-digit', hour:'2-digit', minute:'2-digit' });
    } catch(e) {
      return isoString || '';
    }
  }

  // sample weighted without replacement (simple)
  function sampleWeightedNoReplace(sourceArr, k) {
    const pool = sourceArr.map(x => ({...x}));
    const out = [];
    for (let i=0;i<k;i++){
      const total = pool.reduce((s,x)=>s+(x.weight||1),0);
      let r = Math.random()*total;
      for (let j=0;j<pool.length;j++){
        r -= (pool[j].weight||1);
        if (r <= 0){
          out.push(pool.splice(j,1)[0]);
          break;
        }
      }
      if (pool.length === 0 && out.length < k) break;
    }
    return out;
  }

  // create or load today's assignments
  function loadOrCreateAssignments(count) {
    try {
      const raw = localStorage.getItem(ASSIGN_KEY);
      const today = todayKey();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.date === today && Array.isArray(parsed.assignments) && parsed.assignments.length === count) {
          return parsed.assignments;
        }
      }
    } catch(e){}
    const pool = (typeof prizes !== 'undefined' && Array.isArray(prizes) && prizes.length>0) ? prizes : [{label:'100%'},{label:'150%'},{label:'200%'}];
    const assigned = sampleWeightedNoReplace(pool, count);
    const payload = { date: todayKey(), assignments: assigned };
    localStorage.setItem(ASSIGN_KEY, JSON.stringify(payload));
    return assigned;
  }

  function loadSelection() {
    try {
      const raw = localStorage.getItem(SELECT_KEY);
      const today = todayKey();
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.date === today) return parsed; // {date,index,prize,savedAt}
      }
    } catch(e){}
    return null;
  }

  // guarda la selección y devuelve el payload (incluye savedAt)
  function saveSelection(index, prize) {
    const payload = { date: todayKey(), index, prize, savedAt: new Date().toISOString() };
    localStorage.setItem(SELECT_KEY, JSON.stringify(payload));
    return payload;
  }

  function disableAllStars() {
    document.querySelectorAll('.star').forEach(btn=>{
      btn.setAttribute('aria-disabled','true');
      btn.classList.add('disabled');
      btn.style.pointerEvents = 'none';
    });
  }

  /* ---------- UI & interactions (flip, prize, confetti) ---------- */
  // 1. Tomamos los premios de tu config.js universal
  const prizes = SITE_CONFIG.prizes; 
  
  // 2. Variable global que pediste
  let premioGanado = null; 
// 3. Tu función universal (VERSIÓN CAPTURA MANUAL)
window.claim = function() {
    // Abrimos la URL de Atenea SOLO con el parámetro para abrir el chat
    const url = `${SITE_CONFIG.chatUrl}/?open=true`; 
    window.location.href = url; 
};
  function weightedRandom(arr) {
    const total = arr.reduce((s, x) => s + (x.weight || 1), 0);
    let r = Math.random() * total;
    for (const item of arr) {
      r -= (item.weight || 1);
      if (r <= 0) return item;
    }
    return arr[arr.length - 1];
  }

  let locked = true;
  function wait(ms) { return new Promise(res => setTimeout(res, ms)); }

// showPrize ahora recibe optional savedAt y lo muestra en #prize-date
function showPrize(prize, savedAt) {
    premioGanado = prize; // <-- ACÁ GUARDAMOS EL PREMIO!
    
    const prizeText = document.getElementById('prize-text');
    const prizeDate = document.getElementById('prize-date');
    const modal = document.getElementById('result');
    const titleEl = document.getElementById('modal-title');
    
    if (titleEl) titleEl.textContent = '¡Ganaste!';
    if (prizeText) prizeText.textContent = prize.label;
    
    if (prizeDate) {
      if (savedAt) {
        prizeDate.textContent = 'Reclamado: ' + formatSavedAt(savedAt);
        prizeDate.setAttribute('aria-hidden','false');
      } else {
        prizeDate.textContent = '';
        prizeDate.setAttribute('aria-hidden','true');
      }
    }

    // Configurar el botón para CAPTURAR Y RECLAMAR
    const btnReclamar = document.getElementById('btn-reclamar');
    if (btnReclamar) {
        // Le ponemos el texto que pediste con un emoji de camarita para que se entienda fácil
        btnReclamar.textContent = "Capturá y tocá acá 📸"; 
        btnReclamar.onclick = window.claim;
    }

    // Mostrar el modal y tirar el confeti
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('show');
    }
    explodeConfetti();
}

  // showClaimed ahora espera el objeto selection {date,index,prize,savedAt}
  function showClaimed(selection) {
    const prize = selection && selection.prize ? selection.prize : { label: 'Premio reclamado' };
    const prizeText = document.getElementById('prize-text');
    const prizeDate = document.getElementById('prize-date');
    const modal = document.getElementById('result');
    const titleEl = document.getElementById('modal-title') || (modal && modal.querySelector('h2'));
    if (titleEl) titleEl.textContent = 'Ya reclamaste';
    if (prizeText) prizeText.textContent = prize.label;
    if (prizeDate) {
      if (selection && selection.savedAt) {
        prizeDate.textContent = 'Fecha: ' + formatSavedAt(selection.savedAt);
        prizeDate.setAttribute('aria-hidden','false');
      } else {
        prizeDate.textContent = '';
        prizeDate.setAttribute('aria-hidden','true');
      }
    }
    if (modal) {
      modal.classList.remove('hidden');
      modal.classList.add('show');
    }
  }

  function hidePrize() {
    const modal = document.getElementById('result');
    if (modal) modal.classList.remove('show');
    setTimeout(() => { if (modal) modal.classList.add('hidden'); }, 240);
    const confettiContainer = document.getElementById('confetti');
    if (confettiContainer) confettiContainer.innerHTML = '';
  }

  /* ---------- setupStars: asigna d y transforms a cada SVG de estrella ---------- */
  function setupStars() {
    const starEls = Array.from(document.querySelectorAll('.star'));
    if (!starEls.length) return;

    const cx = 60, cy = 60;
    const outer = 46, inner = 20;
    const d = makeStarPath(cx, cy, 5, outer, inner);

    starEls.forEach((btn, i) => {
      const svg = btn.querySelector('.star-svg');
      if (!svg) return;
      const halo = svg.querySelector('.halo');
      const body = svg.querySelector('.body');
      const rim = svg.querySelector('.rim');
      const white = svg.querySelector('.white-halo');

      if (halo) halo.setAttribute('d', d);
      if (body) body.setAttribute('d', d);
      if (rim) rim.setAttribute('d', d);

      if (i === 0 || i === 2) {
        if (body) body.setAttribute('transform', `translate(${cx} ${cy}) scale(1.5 1.5) translate(${-cx} ${-cy})`);
        if (rim)  rim.setAttribute('transform', `translate(${cx} ${cy}) scale(1 1) translate(${-cx} ${-cy})`);
        if (halo) halo.setAttribute('transform', `translate(${cx} ${cy}) scale(1.5) translate(${-cx} ${-cy})`);
      } else if (i === 1) {
        if (body) body.setAttribute('transform', `translate(${cx} ${cy}) scale(1.80 1.80) translate(${-cx} ${-cy})`);
        if (rim) rim.setAttribute('transform', `translate(${cx} ${cy}) scale(1.2 1.2) translate(${-cx} ${-cy})`);
        if (halo) halo.setAttribute('transform', `translate(${cx} ${cy}) scale(1.8) translate(${-cx} ${-cy})`);
      }

      if (white) {
        white.setAttribute('cx', '60');
        white.setAttribute('cy', '60');
        white.setAttribute('rx', '60');
        white.setAttribute('ry', '60');
        white.setAttribute('opacity', '0.12');
        white.style.filter = 'blur(6px)';
      }
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    setupStars();

    const starButtons = Array.from(document.querySelectorAll('.star'));
    const closeBtn = document.getElementById('close-btn');

    // Initialize sparkles for each star
    starButtons.forEach(btn => initSparksFor(btn));

    // --- NEW: load/create assignments and attach to buttons ---
    const assignments = loadOrCreateAssignments(starButtons.length);
    starButtons.forEach((btn, idx) => {
      const prize = assignments[idx] || { label: 'Sin premio' };
      btn.dataset.assignedPrize = JSON.stringify(prize);
    });

    // --- NEW: check if user already selected today ---
    const existing = loadSelection();
    if (existing) {
      locked = true;
      disableAllStars();
      const chosenBtn = starButtons[existing.index];
      if (chosenBtn) chosenBtn.classList.add('selected');
      showClaimed(existing); // pasamos el objeto entero para mostrar savedAt
    }

    // click handlers (flip + pop + prize)
    starButtons.forEach((btn, idx) => {
      btn.addEventListener('click', async () => {
        if (locked) return;
        locked = true;
        starButtons.forEach(s => s.classList.remove('selected','pop','flip'));
        btn.classList.add('selected');
        void btn.offsetWidth; // reflow
        btn.classList.add('pop','flip');

        // reproducir sonido inmediatamente (aprobado por el gesto del usuario)
        const audio = document.getElementById('claim-sound');
        if (audio) {
          try {
            audio.currentTime = 0;
            audio.volume = 0.9;
            const p = audio.play();
            if (p && p.catch) p.catch(()=>{});
          } catch(e) { console.warn('Audio play failed', e); }
        }

        // Use the assigned prize (persisted per day)
        let prize;
        try { prize = JSON.parse(btn.dataset.assignedPrize); } catch(e) { prize = weightedRandom(prizes); }

        await wait(760);

        // persist selection for today and get saved payload (with savedAt)
        const payload = saveSelection(idx, prize);

        // mostrar modal con la fecha guardada
        showPrize(prize, payload.savedAt);

        // disable further choices
        disableAllStars();
      });
    });

    if (closeBtn) {
      closeBtn.addEventListener('click', () => {
        hidePrize();
      });
    }

    // landing animation: quitar clase dropping y desbloquear después if not already selected
    setTimeout(() => {
      document.body.classList.remove('dropping');
      if (!loadSelection()) {
        setTimeout(() => { locked = false; }, 600);
      }
    }, 60);
  });

  /* ---------- confetti (emoji) ---------- */
  function explodeConfetti() {
    const confettiContainer = document.getElementById('confetti');
    if (!confettiContainer) return;
    confettiContainer.innerHTML = '';
    const emojis = ["✨","🎉","⭐️","💫","🎊"];
    const count = 26;
    for (let i = 0; i < count; i++) {
      const el = document.createElement('div');
      el.style.position = 'absolute';
      el.style.left = (42 + Math.random()*16) + '%';
      el.style.top = (40 + Math.random()*12) + '%';
      el.style.fontSize = (12 + Math.random()*28) + 'px';
      el.style.opacity = (0.6 + Math.random()*0.4);
      el.style.transform = `translateY(0) rotate(${Math.random()*360}deg)`;
      el.textContent = emojis[Math.floor(Math.random()*emojis.length)];
      confettiContainer.appendChild(el);
      const duration = 1100 + Math.random()*1400;
      el.animate([
        { transform: `translateY(0) rotate(${Math.random()*360}deg)`, opacity: 1 },
        { transform: `translateY(${80 + Math.random()*120}vh) rotate(${Math.random()*900 - 450}deg)`, opacity: 0.2 }
      ], { duration, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'forwards' });
      setTimeout(() => { try { el.remove(); } catch(e){} }, duration+220);
    }
  }

  /* ---------- sparkles per star element ---------- */
  function initSparksFor(starEl) {
    if (!starEl) return;
    const count = 3 + Math.floor(Math.random()*3);
    for (let i=0;i<count;i++){
      const sp = document.createElement('span');
      sp.className = 'spark';
      const lx = 24 + Math.random()*52;
      const ty = 14 + Math.random()*46;
      const size = 3 + Math.random()*8;
      const dur = (0.9 + Math.random()*1.6).toFixed(2) + 's';
      const delay = (Math.random()*1.8).toFixed(2) + 's';
      sp.style.left = lx + '%';
      sp.style.top = ty + '%';
      sp.style.width = size + 'px';
      sp.style.height = size + 'px';
      sp.style.setProperty('--dur', dur);
      sp.style.setProperty('--delay', delay);
      starEl.appendChild(sp);
    }
  }

  /* ---------- Canvas sky (twinkle) ---------- */
  const canvas = document.getElementById('sky');
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null;
  let skyStars = [], W=0, H=0;
  const DPR = Math.max(1, window.devicePixelRatio || 1);

  function resize() {
    if (!canvas || !ctx) return;
    W = canvas.width = Math.floor(window.innerWidth * DPR);
    H = canvas.height = Math.floor(window.innerHeight * DPR);
    canvas.style.width = window.innerWidth + 'px';
    canvas.style.height = window.innerHeight + 'px';
    initStars();
  }
  window.addEventListener('resize', resize);

  function initStars() {
    skyStars = [];
    const area = window.innerWidth * window.innerHeight;
    const count = Math.max(60, Math.floor(area / 16000));
    for (let i=0;i<count;i++){
      const x = Math.random() * W;
      const y = Math.random() * H * 0.95;
      const r = (Math.random() * 1.6 + 0.4) * DPR;
      const baseA = Math.random() * 0.6 + 0.3;
      const speed = Math.random() * 0.6 + 0.2;
      const amp = Math.random() * 0.22 + 0.06;
      const phase = Math.random() * Math.PI * 2;
      const hasSpark = Math.random() < 0.12;
      skyStars.push({x,y,r,baseA,speed,amp,phase,hasSpark,sparkTimer:0});
    }
  }

  let last = performance.now();
  function draw(now) {
    if (!ctx) return;
    const dt = (now - last) / 1000;
    last = now;
    const g = ctx.createLinearGradient(0,0,0,H);
    g.addColorStop(0, '#04101d'); g.addColorStop(0.5, '#07162a'); g.addColorStop(1, '#071a2d');
    ctx.fillStyle = g; ctx.fillRect(0,0,W,H);
    const vign = ctx.createRadialGradient(W/2, H*0.36, Math.min(W,H)*0.18, W/2, H/2, Math.max(W,H));
    vign.addColorStop(0,'rgba(20,30,50,0.02)'); vign.addColorStop(1,'rgba(0,0,0,0.28)');
    ctx.fillStyle = vign; ctx.fillRect(0,0,W,H);
    ctx.globalCompositeOperation = 'screen';
    for (let i=0;i<skyStars.length;i++){
      const s = skyStars[i];
      s.phase += dt * s.speed;
      let tw = s.baseA * (1 + Math.sin(s.phase) * s.amp);
      if (s.hasSpark && Math.random() < 0.006) { s.sparkTimer = 0.12 + Math.random() * 0.34; }
      if (s.sparkTimer > 0) { tw += 0.6 * Math.exp(-5 * (0.4 - s.sparkTimer)); s.sparkTimer -= dt; }
      const rad = s.r * (1 + Math.sin(s.phase) * 0.12);
      const grad = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, rad*4.5);
      grad.addColorStop(0, `rgba(255,255,255,${Math.min(1, 0.95 * tw)})`);
      grad.addColorStop(0.2, `rgba(255,245,200,${0.45 * tw})`);
      grad.addColorStop(0.6, `rgba(200,200,255,${0.06 * tw})`);
      grad.addColorStop(1, `rgba(0,0,0,0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(s.x - rad*4.5, s.y - rad*4.5, rad*9, rad*9);
      ctx.fillStyle = `rgba(255,255,255,${0.35 * tw})`;
      ctx.fillRect(Math.round(s.x), Math.round(s.y), Math.max(1, DPR), Math.max(1, DPR));
    }
    ctx.globalCompositeOperation = 'source-over';
    requestAnimationFrame(draw);
  }
  resize();
  requestAnimationFrame(draw);

})();
