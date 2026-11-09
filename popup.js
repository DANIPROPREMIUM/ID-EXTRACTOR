// ============================================================
// ID EXTRACTOR v13.8 — Popup
// Fix: al cerrar la pestaña del acortador, vuelve al menú principal.
// Sin efecto typewriter: la ID aparece directamente.
// Historial: 10 últimas extracciones.
// Fix: Apple TV con texto oscuro legible sobre fondo claro.
// Fix: auto-copia silenciosa en modo directo; el mensaje solo
//      aparece al pulsar COPIAR ID.
// ============================================================

let enProceso = false;
let ultimoId = null;
let ultimaPlataforma = null;
let confettiInt = null;
let canvasC = null;
let ctxC = null;
let parts = [];
let placeholderInt = null;
let placeholderIdx = 0;
let mensajeCopiadoTimeout = null;
let atencionInterval = null;
let ocultarEscenaTimeout = null;
let timeoutProceso = null;
let autoExtraerActivo = false;
let ultimoLinkProcesado = null;
let esModoDirecto = false;

const PREFIJOS = [
  'https://paste.myst.rs/',
  'https://shortxlinks.in/',
  'https://shortxlinks.com/'
];

const PLACEHOLDERS = [
  'https://shortxlinks.in/...',
  'https://shortxlinks.com/...',
  'https://paste.myst.rs/...'
];

const PLATAFORMAS = {
  netflix:     { nombre: 'Netflix',     color: '#E50914', rgb: '229, 9, 20' },
  crunchyroll: { nombre: 'Crunchyroll', color: '#F47521', rgb: '244, 117, 33' },
  prime:       { nombre: 'Prime Video', color: '#00A8E1', rgb: '0, 168, 225' },
  paramount:   { nombre: 'Paramount+',  color: '#0066FF', rgb: '0, 102, 255' },
  viki:        { nombre: 'Rakuten Viki',color: '#9B59B6', rgb: '155, 89, 182' },
  atresplayer: { nombre: 'AtresPlayer', color: '#FF0000', rgb: '255, 0, 0' },
  hbomax:      { nombre: 'HBO Max',     color: '#6432F9', rgb: '100, 50, 249' },
  // ✅ Apple TV: texto oscuro para que se lea sobre fondo claro
  appletv:     { nombre: 'Apple TV',    color: '#1a1a1a', rgb: '26, 26, 26' },
  hidive:      { nombre: 'HiDive',      color: '#00AEEF', rgb: '0, 174, 239' },
  disney:      { nombre: 'Disney+',     color: '#113CCF', rgb: '17, 60, 207' },
  plus:        { nombre: 'Premium+',    color: '#00ff88', rgb: '0, 255, 136' }
};

// ============================================================
// UTILIDADES
// ============================================================
function detectarPlataformaDeId(id) {
  if (!id) return null;
  const t = id.toLowerCase();
  if (t.includes('premium_id:netflix') || t.includes('netflix_session')) return 'netflix';
  if (t.includes('premium_id:crunchyroll') || t.includes('crunchyroll_session')) return 'crunchyroll';
  if (t.includes('premium_id:prime') || t.includes('session_paste')) return 'prime';
  if (t.includes('premium_id:viki')) return 'viki';
  if (t.includes('premium_id:atresplayer')) return 'atresplayer';
  if (t.includes('premium_id:paramount')) return 'paramount';
  if (t.includes('premium_id:hbomax') || t.includes('premium_id:max')) return 'hbomax';
  if (t.includes('premium_id:appletv')) return 'appletv';
  if (t.includes('premium_id:hidive')) return 'hidive';
  if (t.includes('premium_id:disney')) return 'disney';
  if (t.includes('premium_id:premium') || t.includes('premium_id:plus')) return 'plus';
  const m = t.match(/premium_id:([a-z]+)/);
  if (m && PLATAFORMAS[m[1]]) return m[1];
  return null;
}

function obtenerColorPlataforma(plataforma) {
  if (!plataforma || !PLATAFORMAS[plataforma]) {
    return { color: '#00ff88', rgb: '0, 255, 136', nombre: 'ID' };
  }
  return PLATAFORMAS[plataforma];
}

function esValido(url) {
  if (!url) return false;
  const u = url.trim();
  if (!u) return false;
  if (!PREFIJOS.some(p => u.startsWith(p))) return false;
  const resto = u.replace(/^https?:\/\/[^/]+\//i, '');
  return resto.length >= 3;
}

function esPasteDirecto(url) {
  return url && url.trim().startsWith('https://paste.myst.rs/');
}

// ============================================================
// TEMA
// ============================================================
async function cargarTema() {
  try {
    const { tema } = await chrome.storage.local.get('tema');
    if (tema === 'claro') {
      document.body.classList.add('tema-claro');
      const t = document.getElementById('themeToggle');
      if (t) t.textContent = '☀️';
    } else {
      document.body.classList.remove('tema-claro');
      const t = document.getElementById('themeToggle');
      if (t) t.textContent = '🌙';
    }
  } catch (e) {}
}

async function toggleTema() {
  const esClaro = document.body.classList.toggle('tema-claro');
  const t = document.getElementById('themeToggle');
  if (t) t.textContent = esClaro ? '☀️' : '🌙';
  try {
    await chrome.storage.local.set({ tema: esClaro ? 'claro' : 'oscuro' });
  } catch (e) {}
}

// ============================================================
// PUNTO + CLEAR
// ============================================================
function setDot(valid, hasText) {
  const dot = document.getElementById('dot');
  dot.classList.toggle('valid', !!valid);
  const input = document.getElementById('link');
  input.classList.remove('valid', 'invalid');
  if (hasText) input.classList.add(valid ? 'valid' : 'invalid');
}

function toggleClearBtn() {
  const input = document.getElementById('link');
  const btn = document.getElementById('clearBtn');
  if (input.value.trim().length > 0) btn.classList.add('visible');
  else btn.classList.remove('visible');
}

// ============================================================
// AUTO-EXTRACCIÓN
// ============================================================
async function cargarAutoExtraer() {
  try {
    const { autoExtraer } = await chrome.storage.local.get('autoExtraer');
    autoExtraerActivo = !!autoExtraer;
    const toggle = document.getElementById('autoToggle');
    if (autoExtraerActivo) toggle.classList.add('active');
    else toggle.classList.remove('active');
  } catch (e) {}
}

async function toggleAutoExtraer() {
  autoExtraerActivo = !autoExtraerActivo;
  const toggle = document.getElementById('autoToggle');
  if (autoExtraerActivo) toggle.classList.add('active');
  else toggle.classList.remove('active');
  try { await chrome.storage.local.set({ autoExtraer: autoExtraerActivo }); } catch (e) {}
}

// ============================================================
// PLACEHOLDER
// ============================================================
function iniciarPlaceholderRotativo() {
  const input = document.getElementById('link');
  if (!input) return;
  placeholderIdx = 0;
  input.placeholder = PLACEHOLDERS[placeholderIdx];
  if (placeholderInt) clearInterval(placeholderInt);
  placeholderInt = setInterval(() => {
    if (input.value.trim().length > 0) return;
    input.placeholder = '';
    setTimeout(() => {
      placeholderIdx = (placeholderIdx + 1) % PLACEHOLDERS.length;
      input.placeholder = PLACEHOLDERS[placeholderIdx];
    }, 300);
  }, 3000);
}

function detenerPlaceholderRotativo() {
  if (placeholderInt) {
    clearInterval(placeholderInt);
    placeholderInt = null;
  }
}

// ============================================================
// PROGRESO
// ============================================================
function showProgress(show) {
  document.getElementById('progress').classList.toggle('show', show);
  if (!show) ocultarAvisoPestana();
}

function showProgressDirecta(show, txt) {
  const el = document.getElementById('progressDirecta');
  if (show) {
    if (txt) document.getElementById('directaTxt').textContent = txt;
    el.classList.add('show');
  } else {
    el.classList.remove('show');
  }
}

function hideInputField(hide) {
  document.getElementById('field').classList.toggle('hidden', hide);
  if (hide) document.getElementById('historial').classList.remove('show');
}

function setPct(pct) {
  const p = Math.max(0, Math.min(100, pct || 0));
  const n = document.getElementById('pctNum');
  const s = document.getElementById('pctSym');
  n.textContent = Math.round(p);
  const full = p >= 100;
  n.classList.toggle('full', full);
  s.classList.toggle('full', full);
}

function setStage(txt) {
  document.getElementById('stageTxt').textContent = txt || '';
}

function mostrarAvisoPestana() {
  document.getElementById('warnTab').classList.add('show');
}

function ocultarAvisoPestana() {
  document.getElementById('warnTab').classList.remove('show');
}

function setGenie(show) {
  const g = document.getElementById('genie');
  const sm = document.getElementById('smoke');
  if (show) {
    g.classList.remove('visible');
    sm.classList.remove('active');
    void g.offsetWidth;
    void sm.offsetWidth;
    setTimeout(() => sm.classList.add('active'), 150);
    setTimeout(() => g.classList.add('visible'), 400);
  } else {
    g.classList.remove('visible');
    sm.classList.remove('active');
  }
}

function ocultarEscena() {
  const progress = document.getElementById('progress');
  if (!progress) return;
  progress.style.transition = 'opacity 0.6s ease, transform 0.6s ease';
  progress.style.opacity = '0';
  progress.style.transform = 'scale(0.9)';
  setTimeout(() => {
    progress.classList.remove('show');
    progress.style.opacity = '';
    progress.style.transform = '';
    progress.style.transition = '';
  }, 650);
  setGenie(false);
}

function ocultarTodosLosProgresos() {
  const progress = document.getElementById('progress');
  if (progress) {
    progress.classList.remove('show');
    progress.style.opacity = '';
    progress.style.transform = '';
    progress.style.transition = '';
  }
  const progressDirecta = document.getElementById('progressDirecta');
  if (progressDirecta) {
    progressDirecta.classList.remove('show');
  }
  setGenie(false);
  ocultarAvisoPestana();
}

// ============================================================
// BADGE PLATAFORMA
// ============================================================
function mostrarBadgePlataforma(plataforma) {
  const badge = document.getElementById('platBadge');
  const name = document.getElementById('platBadgeName');

  if (!plataforma || !PLATAFORMAS[plataforma]) {
    badge.classList.remove('show');
    return;
  }

  const p = PLATAFORMAS[plataforma];
  badge.classList.add('show');
  name.textContent = p.nombre.toUpperCase();
  badge.style.color = p.color;

  // ✅ Apple TV: fondo blanco sólido para contraste
  if (plataforma === 'appletv') {
    badge.style.background = 'rgba(255, 255, 255, 0.95)';
    badge.style.border = '1px solid rgba(26, 26, 26, 0.4)';
  } else {
    badge.style.background = `rgba(${p.rgb}, 0.12)`;
    badge.style.border = `1px solid rgba(${p.rgb}, 0.35)`;
  }
}

// ============================================================
// HISTORIAL
// ============================================================
async function cargarHistorial() {
  try {
    const { historialIds } = await chrome.storage.local.get('historialIds');
    const hist = Array.isArray(historialIds) ? historialIds : [];
    renderHistorial(hist);
  } catch (e) { renderHistorial([]); }
}

function renderHistorial(hist) {
  const cont = document.getElementById('histList');
  const caja = document.getElementById('historial');
  cont.innerHTML = '';

  if (!hist || hist.length === 0) {
    caja.classList.remove('show');
    return;
  }

  if (!enProceso &&
      !document.getElementById('ok').classList.contains('show') &&
      !document.getElementById('err').classList.contains('show')) {
    caja.classList.add('show');
  }

  hist.forEach((item, index) => {
    const p = item.servicio ? PLATAFORMAS[item.servicio] : null;
    const el = document.createElement('div');
    el.className = 'hist-item';
    el.title = 'Copiar esta ID';

    const nombrePlat = p ? p.nombre.toUpperCase() : 'ID';
    const colorPlat = p ? p.color : '#00ff88';

    // ✅ Apple TV: badge blanco con texto oscuro
    const esAppleTV = item.servicio === 'appletv';
    const badgeStyle = esAppleTV
      ? 'background:#ffffff;color:#1a1a1a;border:1px solid rgba(26,26,26,0.3);'
      : `background:${colorPlat};color:#fff;`;

    el.innerHTML = `
      <span class="hist-badge" style="${badgeStyle}">${nombrePlat}</span>
      <span class="hist-id">${(item.id || '').substring(0, 30)}...</span>
      <span class="hist-copy">📋</span>
      <button class="hist-delete" type="button" title="Borrar del historial">✕</button>
    `;

    el.addEventListener('click', async (ev) => {
      if (ev.target.classList.contains('hist-delete')) return;
      try {
        await navigator.clipboard.writeText(item.id);
        const icon = el.querySelector('.hist-copy');
        icon.textContent = '✓';
        setTimeout(() => { icon.textContent = '📋'; }, 1200);
      } catch (e) {}
    });

    const delBtn = el.querySelector('.hist-delete');
    delBtn.addEventListener('click', async (ev) => {
      ev.stopPropagation();
      ev.preventDefault();
      await borrarItemHistorial(index);
    });

    cont.appendChild(el);
  });
}

async function borrarItemHistorial(index) {
  try {
    const { historialIds } = await chrome.storage.local.get('historialIds');
    const hist = Array.isArray(historialIds) ? historialIds : [];
    const histFinal = hist.filter((_, i) => i !== index);

    await chrome.storage.local.set({ historialIds: histFinal });

    const items = document.querySelectorAll('.hist-item');
    const item = items[index];
    if (item) {
      item.style.transition = 'all 0.3s ease';
      item.style.transform = 'translateX(-100%)';
      item.style.opacity = '0';
      item.style.marginBottom = '-40px';
    }

    setTimeout(() => { renderHistorial(histFinal); }, 300);
  } catch (e) {
    renderHistorial([]);
  }
}

async function borrarHistorial() {
  try {
    await chrome.storage.local.set({ historialIds: [] });
    await cargarHistorial();
  } catch (e) {}
}

// ============================================================
// RESET
// ============================================================
function cancelarTimeouts() {
  if (ocultarEscenaTimeout) { clearTimeout(ocultarEscenaTimeout); ocultarEscenaTimeout = null; }
  if (timeoutProceso) { clearTimeout(timeoutProceso); timeoutProceso = null; }
}

function cancelarAtencion() {
  if (atencionInterval) { clearInterval(atencionInterval); atencionInterval = null; }
}

function reset() {
  cancelarTimeouts();
  cancelarAtencion();
  document.getElementById('ok').classList.remove('show');
  document.getElementById('err').classList.remove('show');
  showProgress(false);
  showProgressDirecta(false);
  hideInputField(false);
  setGenie(false);
  setPct(0);
  setStage('');
  ocultarAvisoPestana();
  ocultarMensajeCopiado();
  ultimoId = null;
  ultimaPlataforma = null;
  esModoDirecto = false;
  document.getElementById('platBadge').classList.remove('show');
  document.getElementById('idValue').textContent = '';

  const btn = document.getElementById('btn');
  btn.disabled = false;
  btn.textContent = 'EXTRAER ID';

  const copyBtn = document.getElementById('copyIdBtn');
  if (copyBtn) {
    copyBtn.classList.remove('copied');
    const iconEl = copyBtn.querySelector('.copy-icon');
    if (iconEl) iconEl.textContent = '📋';
    copyBtn.style.transform = 'scale(1)';
  }
  resetColorPlataforma();

  iniciarPlaceholderRotativo();
  stopConfetti();
  cargarHistorial();
}

// ============================================================
// COLORES
// ============================================================
function aplicarColorPlataforma(plataforma) {
  const p = obtenerColorPlataforma(plataforma);
  const btn = document.getElementById('copyIdBtn');
  const panel = document.querySelector('.id-panel');

  // ✅ Apple TV: fondo claro + texto oscuro para que se lea
  const esAppleTV = plataforma === 'appletv';

  if (btn) {
    if (esAppleTV) {
      btn.style.background = 'rgba(255, 255, 255, 0.92)';
      btn.style.borderColor = 'rgba(26, 26, 26, 0.55)';
    } else {
      btn.style.background = `rgba(${p.rgb}, 0.14)`;
      btn.style.borderColor = `rgba(${p.rgb}, 0.65)`;
    }
    btn.style.borderWidth = '2px';
    btn.style.color = p.color;
    btn.dataset.color = p.color;
    btn.dataset.rgb = p.rgb;
    btn.style.fontSize = '13px';
    btn.style.fontWeight = '900';
    btn.style.letterSpacing = '1.5px';
    btn.style.padding = '14px 12px';

    const textEl = document.getElementById('copyIdText');
    if (textEl && p.nombre && p.nombre !== 'ID') {
      textEl.textContent = `COPIAR ID · ${p.nombre.toUpperCase()}`;
    } else if (textEl) {
      textEl.textContent = 'COPIAR ID';
    }

    // ✅ Apple TV: borde oscuro; resto: borde blanco
    const borde = esAppleTV
      ? `
        0 0 1px #000,
        0 0 1px #000,
        0 0 2px #000,
        0 0 2px #000,
        0 0 3px #000,
        0 0 3px #000,
        1px 0 0 #000,
        -1px 0 0 #000,
        0 1px 0 #000,
        0 -1px 0 #000,
        0 0 8px rgba(255, 255, 255, 0.9),
        0 1px 3px rgba(255, 255, 255, 1)
      `
      : `
        0 0 1px #fff,
        0 0 1px #fff,
        0 0 2px #fff,
        0 0 2px #fff,
        0 0 3px #fff,
        0 0 3px #fff,
        1px 0 0 #fff,
        -1px 0 0 #fff,
        0 1px 0 #fff,
        0 -1px 0 #fff,
        0 0 8px rgba(${p.rgb}, 0.9),
        0 1px 3px rgba(0, 0, 0, 1)
      `;
    btn.style.textShadow = borde;

    if (textEl) {
      textEl.style.textShadow = borde;
      textEl.style.fontWeight = '900';
      textEl.style.fontSize = '13px';
      textEl.style.letterSpacing = '1.5px';
    }

    const iconEl = btn.querySelector('.copy-icon');
    if (iconEl) {
      iconEl.style.fontSize = '15px';
      iconEl.style.filter = esAppleTV
        ? 'drop-shadow(0 0 2px #000) drop-shadow(0 0 3px #000)'
        : 'drop-shadow(0 0 2px #fff) drop-shadow(0 0 3px #fff)';
    }
  }

  if (panel) {
    panel.style.borderColor = esAppleTV
      ? 'rgba(26, 26, 26, 0.35)'
      : `rgba(${p.rgb}, 0.35)`;
  }

  let styleEl = document.getElementById('platform-style');
  if (!styleEl) {
    styleEl = document.createElement('style');
    styleEl.id = 'platform-style';
    document.head.appendChild(styleEl);
  }

  if (esAppleTV) {
    styleEl.textContent = `
      .copy-id-btn:hover {
        background: rgba(255, 255, 255, 1) !important;
        border-color: rgba(26, 26, 26, 0.85) !important;
        box-shadow: 0 4px 20px rgba(26, 26, 26, 0.35) !important;
      }
      .copy-id-btn.copied {
        background: rgba(255, 255, 255, 1) !important;
        border-color: #1a1a1a !important;
      }
      .id-panel::before { color: rgba(26, 26, 26, 0.45) !important; }
      .id-value { color: #1a1a1a !important; }
      .id-value::selection {
        background: rgba(26, 26, 26, 0.25) !important;
        color: #ffffff !important;
      }
    `;
  } else {
    styleEl.textContent = `
      .copy-id-btn:hover {
        background: rgba(${p.rgb}, 0.22) !important;
        border-color: rgba(${p.rgb}, 0.85) !important;
        box-shadow: 0 4px 20px rgba(${p.rgb}, 0.35) !important;
      }
      .copy-id-btn.copied {
        background: rgba(${p.rgb}, 0.28) !important;
        border-color: ${p.color} !important;
      }
      .id-panel::before { color: rgba(${p.rgb}, 0.45) !important; }
      .id-value { color: ${p.color} !important; }
      .id-value::selection {
        background: rgba(${p.rgb}, 0.35) !important;
        color: #ffffff !important;
      }
    `;
  }

  iniciarAtencionBoton();
}

function resetColorPlataforma() {
  const btn = document.getElementById('copyIdBtn');
  const panel = document.querySelector('.id-panel');
  const textEl = document.getElementById('copyIdText');
  cancelarAtencion();

  if (btn) {
    btn.style.background = 'rgba(0, 255, 136, 0.08)';
    btn.style.borderColor = 'rgba(0, 255, 136, 0.35)';
    btn.style.borderWidth = '1px';
    btn.style.color = '#00ff88';
    btn.style.textShadow = '';
    btn.style.animation = '';
    btn.style.transform = '';
    btn.style.boxShadow = '';
    btn.style.fontSize = '';
    btn.style.fontWeight = '';
    btn.style.letterSpacing = '';
    btn.style.padding = '';
  }

  if (panel) panel.style.borderColor = 'rgba(0, 255, 136, 0.3)';

  if (textEl) {
    textEl.textContent = 'COPIAR ID';
    textEl.style.textShadow = '';
    textEl.style.fontWeight = '';
    textEl.style.fontSize = '';
    textEl.style.letterSpacing = '';
  }

  const iconEl = btn ? btn.querySelector('.copy-icon') : null;
  if (iconEl) {
    iconEl.style.fontSize = '';
    iconEl.style.filter = '';
  }

  const styleEl = document.getElementById('platform-style');
  if (styleEl) styleEl.textContent = '';
}

// ============================================================
// PULSO ATENCIÓN
// ============================================================
function iniciarAtencionBoton() {
  cancelarAtencion();
  const btn = document.getElementById('copyIdBtn');
  if (!btn) return;
  asegurarAnimacionesAtencion();
  btn.classList.add('attention-pulse');
  atencionInterval = setInterval(() => {
    if (!btn || !btn.classList.contains('attention-pulse')) return;
    btn.classList.add('attention-shake');
    setTimeout(() => {
      if (btn) btn.classList.remove('attention-shake');
    }, 500);
  }, 3500);
}

function asegurarAnimacionesAtencion() {
  if (document.getElementById('atencion-anim')) return;
  const style = document.createElement('style');
  style.id = 'atencion-anim';
  style.textContent = `
    @keyframes attentionPulse {
      0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 255, 255, 0.35); }
      50% { transform: scale(1.025); box-shadow: 0 0 0 8px rgba(255, 255, 255, 0); }
    }
    @keyframes attentionGlow {
      0%, 100% { filter: brightness(1); }
      50% { filter: brightness(1.35); }
    }
    @keyframes attentionShake {
      0%, 20%, 40%, 60%, 80%, 100% { transform: translateX(0) scale(1.025); }
      10%, 50% { transform: translateX(-2px) scale(1.025); }
      30%, 70% { transform: translateX(2px) scale(1.025); }
      90% { transform: translateX(1.5px) scale(1.025); }
    }
    .copy-id-btn.attention-pulse {
      animation:
        attentionPulse 1.4s ease-in-out infinite,
        attentionGlow 1.4s ease-in-out infinite;
    }
    .copy-id-btn.attention-shake {
      animation:
        attentionShake 0.5s ease-in-out,
        attentionGlow 0.5s ease-in-out !important;
    }
  `;
  document.head.appendChild(style);
}

// ============================================================
// MENSAJES DE COPIADO
// ============================================================
function mostrarMensajeCopiadoOk() {
  let msg = document.getElementById('msgCopiado');
  if (msg) msg.remove();

  msg = document.createElement('div');
  msg.id = 'msgCopiado';
  const p = obtenerColorPlataforma(ultimaPlataforma);

  msg.innerHTML = `
    <div class="linea1"><span class="check">✓</span> ID copiada al portapapeles</div>
    <div class="linea2">→ Ahora dirígete a <span class="premium-glow">PREMIUM ID</span></div>
  `;

  msg.style.cssText = `
    margin-top: 10px; padding: 14px;
    background: rgba(${p.rgb}, 0.12);
    border: 2px solid rgba(${p.rgb}, 0.55);
    border-radius: 10px;
    font-family: 'Inter', sans-serif;
    color: #FFFFFF;
    text-align: center;
    -webkit-font-smoothing: antialiased;
    animation: msgCopiadoEntrar 0.4s cubic-bezier(0.2, 0.9, 0.4, 1);
  `;

  const linea1 = msg.querySelector('.linea1');
  linea1.style.fontSize = '14px';
  linea1.style.fontWeight = '800';
  linea1.style.letterSpacing = '0.4px';
  linea1.style.marginBottom = '8px';
  linea1.style.webkitTextStroke = '0.4px rgba(0, 0, 0, 0.5)';

  const checkEl = msg.querySelector('.check');
  checkEl.style.color = '#00ff88';
  checkEl.style.fontWeight = '900';
  checkEl.style.fontSize = '16px';
  checkEl.style.marginRight = '6px';
  checkEl.style.display = 'inline-block';
  checkEl.style.textShadow = `
    -1px -1px 0 #fff,
     1px -1px 0 #fff,
    -1px  1px 0 #fff,
     1px  1px 0 #fff,
    -1.5px 0 0 #fff,
     1.5px 0 0 #fff,
     0 -1.5px 0 #fff,
     0  1.5px 0 #fff,
     0 0 6px rgba(0, 255, 136, 0.6),
     0 1px 2px rgba(0, 0, 0, 0.9)
  `;

  const linea2 = msg.querySelector('.linea2');
  linea2.style.marginTop = '8px';
  linea2.style.paddingTop = '8px';
  linea2.style.borderTop = `1px solid rgba(${p.rgb}, 0.3)`;
  linea2.style.fontSize = '13px';
  linea2.style.fontWeight = '800';
  linea2.style.webkitTextStroke = '0.4px rgba(0, 0, 0, 0.5)';

  const premiumEl = msg.querySelector('.premium-glow');
  if (premiumEl) {
    premiumEl.style.position = 'relative';
    premiumEl.style.display = 'inline-block';
    premiumEl.style.fontWeight = '900';
    premiumEl.style.fontSize = '14px';
    premiumEl.style.color = '#FFD700';
    premiumEl.style.padding = '0 3px';
    premiumEl.style.textShadow = `
      0 0 4px #FFD700, 0 0 8px #FFD700, 0 0 16px #FFB800,
      0 0 24px rgba(255, 184, 0, 0.7), 0 1px 2px rgba(0, 0, 0, 0.9)
    `;
    premiumEl.style.animation = 'premiumIdPulse 1.6s ease-in-out infinite';

    const d1 = document.createElement('span');
    d1.textContent = '✦';
    Object.assign(d1.style, {
      position: 'absolute', top: '-7px', left: '-10px',
      color: '#FFD700', fontSize: '10px',
      textShadow: '0 0 6px #FFD700, 0 0 12px #FFB800',
      pointerEvents: 'none',
      animation: 'premiumDestelloGirar 2s ease-in-out infinite',
      animationDelay: '0s'
    });
    const d2 = d1.cloneNode();
    Object.assign(d2.style, {
      top: '', left: '', bottom: '-7px', right: '-10px',
      animationDelay: '1s'
    });
    premiumEl.appendChild(d1);
    premiumEl.appendChild(d2);
  }

  const btn = document.getElementById('copyIdBtn');
  if (btn && btn.parentNode) btn.parentNode.insertBefore(msg, btn.nextSibling);

  asegurarAnimacionesMensaje();

  if (mensajeCopiadoTimeout) clearTimeout(mensajeCopiadoTimeout);
  mensajeCopiadoTimeout = setTimeout(() => {
    if (msg && msg.parentNode) {
      msg.style.animation = 'msgCopiadoSalir 0.3s ease forwards';
      setTimeout(() => { if (msg && msg.parentNode) msg.remove(); }, 300);
    }
  }, 5000);
}

function mostrarMensajeCopiadoError() {
  let msg = document.getElementById('msgCopiado');
  if (msg) msg.remove();

  msg = document.createElement('div');
  msg.id = 'msgCopiado';
  msg.innerHTML = `
    <div class="linea1"><span class="check">⚠</span> No se pudo copiar automáticamente</div>
    <div class="linea2">Copia manualmente seleccionando el texto del panel de arriba</div>
  `;

  msg.style.cssText = `
    margin-top: 10px; padding: 14px;
    background: rgba(255, 82, 82, 0.12);
    border: 2px solid rgba(255, 82, 82, 0.55);
    border-radius: 10px;
    font-family: 'Inter', sans-serif;
    color: #FFFFFF;
    text-align: center;
    animation: msgCopiadoEntrar 0.4s cubic-bezier(0.2, 0.9, 0.4, 1);
  `;

  const l1 = msg.querySelector('.linea1');
  l1.style.fontSize = '13px'; l1.style.fontWeight = '800'; l1.style.marginBottom = '6px';

  const ch = msg.querySelector('.check');
  ch.style.color = '#ff5252'; ch.style.fontWeight = '900'; ch.style.fontSize = '16px'; ch.style.marginRight = '6px';

  const l2 = msg.querySelector('.linea2');
  Object.assign(l2.style, {
    marginTop: '6px', paddingTop: '6px',
    borderTop: '1px solid rgba(255, 82, 82, 0.3)',
    fontSize: '10px', fontWeight: '600',
    color: '#ffb0b0', lineHeight: '1.4'
  });

  const btn = document.getElementById('copyIdBtn');
  if (btn && btn.parentNode) btn.parentNode.insertBefore(msg, btn.nextSibling);

  asegurarAnimacionesMensaje();

  if (mensajeCopiadoTimeout) clearTimeout(mensajeCopiadoTimeout);
  mensajeCopiadoTimeout = setTimeout(() => {
    if (msg && msg.parentNode) {
      msg.style.animation = 'msgCopiadoSalir 0.3s ease forwards';
      setTimeout(() => { if (msg && msg.parentNode) msg.remove(); }, 300);
    }
  }, 5000);
}

function ocultarMensajeCopiado() {
  const msg = document.getElementById('msgCopiado');
  if (msg && msg.parentNode) msg.remove();
  if (mensajeCopiadoTimeout) {
    clearTimeout(mensajeCopiadoTimeout);
    mensajeCopiadoTimeout = null;
  }
}

function asegurarAnimacionesMensaje() {
  if (document.getElementById('msg-copiado-anim')) return;
  const style = document.createElement('style');
  style.id = 'msg-copiado-anim';
  style.textContent = `
    @keyframes msgCopiadoEntrar {
      0% { opacity: 0; transform: translateY(-8px) scale(0.95); }
      60% { opacity: 1; transform: translateY(2px) scale(1.02); }
      100% { opacity: 1; transform: translateY(0) scale(1); }
    }
    @keyframes msgCopiadoSalir {
      0% { opacity: 1; transform: translateY(0); }
      100% { opacity: 0; transform: translateY(-6px); }
    }
    @keyframes premiumIdPulse {
      0%, 100% {
        text-shadow: 0 0 4px #FFD700, 0 0 8px #FFD700, 0 0 16px #FFB800, 0 0 24px rgba(255, 184, 0, 0.7), 0 1px 2px rgba(0, 0, 0, 0.9);
        transform: scale(1);
      }
      50% {
        text-shadow: 0 0 6px #FFD700, 0 0 12px #FFD700, 0 0 24px #FFB800, 0 0 40px rgba(255, 184, 0, 0.9), 0 1px 2px rgba(0, 0, 0, 0.9);
        transform: scale(1.08);
      }
    }
    @keyframes premiumDestelloGirar {
      0%, 100% { opacity: 0; transform: scale(0.5) rotate(0deg); }
      50% { opacity: 1; transform: scale(1.2) rotate(180deg); }
    }
  `;
  document.head.appendChild(style);
}

// ============================================================
// DESTELLOS
// ============================================================
function crearDestellos(btn) {
  if (!btn) return;
  const rect = btn.getBoundingClientRect();
  const color = btn.dataset.color || '#00ff88';
  const rgb = btn.dataset.rgb || '0, 255, 136';

  let container = document.getElementById('destellos-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'destellos-container';
    container.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 9998; overflow: hidden;`;
    document.body.appendChild(container);
  }

  const ripple = document.createElement('div');
  ripple.style.cssText = `
    position: absolute;
    left: ${rect.left + rect.width / 2}px;
    top: ${rect.top + rect.height / 2}px;
    width: 20px; height: 20px;
    margin-left: -10px; margin-top: -10px;
    border-radius: 50%;
    border: 2px solid ${color};
    opacity: 0.9; transform: scale(0);
    animation: rippleExpand 0.9s cubic-bezier(0.2, 0.9, 0.4, 1) forwards;
  `;
  container.appendChild(ripple);
  setTimeout(() => ripple.remove(), 900);

  for (let i = 0; i < 14; i++) {
    const angle = (Math.PI * 2 * i) / 14 + (Math.random() - 0.5) * 0.4;
    const distance = 40 + Math.random() * 40;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;
    const size = 3 + Math.random() * 4;
    const duration = 600 + Math.random() * 400;

    const est = document.createElement('div');
    est.style.cssText = `
      position: absolute;
      left: ${rect.left + rect.width / 2}px;
      top: ${rect.top + rect.height / 2}px;
      width: ${size}px; height: ${size}px;
      margin-left: ${-size / 2}px; margin-top: ${-size / 2}px;
      background: ${color};
      border-radius: 50%;
      box-shadow: 0 0 ${size * 2}px ${color}, 0 0 ${size * 4}px rgba(${rgb}, 0.5);
      animation: destelloVolar ${duration}ms cubic-bezier(0.15, 0.9, 0.3, 1) forwards;
      --dx: ${dx}px; --dy: ${dy}px;
    `;
    container.appendChild(est);
    setTimeout(() => est.remove(), duration);
  }

  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI * 2 * i) / 6 + Math.random() * 0.5;
    const distance = 20 + Math.random() * 30;
    const dx = Math.cos(angle) * distance;
    const dy = Math.sin(angle) * distance;

    const est = document.createElement('div');
    est.textContent = '✦';
    est.style.cssText = `
      position: absolute;
      left: ${rect.left + rect.width / 2}px;
      top: ${rect.top + rect.height / 2}px;
      font-size: ${10 + Math.random() * 6}px;
      color: ${color};
      text-shadow: 0 0 6px ${color}, 0 0 12px rgba(${rgb}, 0.6);
      pointer-events: none; opacity: 0;
      animation: estrellaAparecer 900ms cubic-bezier(0.2, 0.9, 0.4, 1) forwards;
      --dx: ${dx}px; --dy: ${dy}px;
    `;
    container.appendChild(est);
    setTimeout(() => est.remove(), 900);
  }

  btn.style.transition = 'transform 0.15s ease';
  btn.style.transform = 'scale(0.96)';
  setTimeout(() => { btn.style.transform = 'scale(1)'; }, 150);

  asegurarAnimacionesDestellos();
}

function asegurarAnimacionesDestellos() {
  if (document.getElementById('destellos-anim')) return;
  const style = document.createElement('style');
  style.id = 'destellos-anim';
  style.textContent = `
    @keyframes rippleExpand {
      0% { transform: scale(0); opacity: 0.9; }
      100% { transform: scale(6); opacity: 0; }
    }
    @keyframes destelloVolar {
      0% { transform: translate(0, 0) scale(1); opacity: 1; }
      100% { transform: translate(var(--dx), var(--dy)) scale(0.2); opacity: 0; }
    }
    @keyframes estrellaAparecer {
      0% { transform: translate(0, 0) scale(0.3) rotate(0deg); opacity: 0; }
      30% { transform: translate(calc(var(--dx) * 0.3), calc(var(--dy) * 0.3)) scale(1.2) rotate(45deg); opacity: 1; }
      100% { transform: translate(var(--dx), var(--dy)) scale(0) rotate(180deg); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

// ============================================================
// MOSTRAR ÉXITO / ERROR
// ============================================================
function showError({ titulo, detalle, sugerencia }) {
  cancelarTimeouts();
  const box = document.getElementById('err');
  box.classList.remove('show');
  document.getElementById('errTitle').textContent = titulo || 'Error';
  document.getElementById('errText').textContent = detalle || '';
  const tg = document.getElementById('errTg');
  tg.style.display = sugerencia ? 'block' : 'none';
  box.classList.add('show');

  ocultarTodosLosProgresos();
  hideInputField(false);
  ocultarMensajeCopiado();
  cargarHistorial();
}

function showOk({ id, servicio }) {
  ultimoId = id;
  const plataforma = servicio || detectarPlataformaDeId(id);
  ultimaPlataforma = plataforma;

  ocultarTodosLosProgresos();

  // ✅ Sin typewriter: la ID aparece directamente
  const idValue = document.getElementById('idValue');
  idValue.textContent = id;

  mostrarBadgePlataforma(plataforma);
  aplicarColorPlataforma(plataforma);

  if (!esModoDirecto) {
    setGenie(true);
  }

  const delayOk = esModoDirecto ? 100 : 900;
  setTimeout(() => {
    document.getElementById('ok').classList.add('show');
  }, delayOk);

  if (!esModoDirecto) {
    setTimeout(() => {
      startConfetti();
      cancelarTimeouts();
      ocultarEscenaTimeout = setTimeout(() => {
        ocultarEscena();
      }, 5000);
    }, 600);
  }

  setTimeout(() => cargarHistorial(), esModoDirecto ? 800 : 1500);

  // ✅ Auto-copia SILENCIOSA en modo directo.
  //    No mostramos mensaje: el mensaje solo sale al pulsar COPIAR ID.
  if (esModoDirecto) {
    (async () => {
      try {
        await navigator.clipboard.writeText(id);
      } catch (e) {}
    })();
  }
}

// ============================================================
// BOTÓN COPIAR
// ============================================================
function setupCopyButton() {
  const btn = document.getElementById('copyIdBtn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    if (!ultimoId) return;

    cancelarAtencion();
    crearDestellos(btn);

    const textEl = document.getElementById('copyIdText');
    const iconEl = btn.querySelector('.copy-icon');
    const p = obtenerColorPlataforma(ultimaPlataforma);
    const labelBase = p.nombre && p.nombre !== 'ID'
      ? `COPIAR ID · ${p.nombre.toUpperCase()}`
      : 'COPIAR ID';

    try {
      await navigator.clipboard.writeText(ultimoId);
      mostrarMensajeCopiadoOk();
      btn.classList.add('copied');
      iconEl.textContent = '✓';
      textEl.textContent = '¡COPIADO!';
      setTimeout(() => {
        btn.classList.remove('copied');
        iconEl.textContent = '📋';
        textEl.textContent = labelBase;
        iniciarAtencionBoton();
      }, 1600);
    } catch (e) {
      mostrarMensajeCopiadoError();
      iconEl.textContent = '⚠';
      textEl.textContent = 'ERROR';
      setTimeout(() => {
        iconEl.textContent = '📋';
        textEl.textContent = labelBase;
        iniciarAtencionBoton();
      }, 1600);
    }
  });
}

// ============================================================
// CONFETI
// ============================================================
function startConfetti() {
  stopConfetti();
  canvasC = document.getElementById('confetti');
  if (!canvasC) return;
  canvasC.width = document.body.offsetWidth;
  canvasC.height = document.body.offsetHeight;
  canvasC.style.display = 'block';
  ctxC = canvasC.getContext('2d');
  parts = [];
  const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bd6', '#ff9f43', '#a29bfe', '#00ff88'];
  for (let i = 0; i < 110; i++) {
    parts.push({
      x: Math.random() * canvasC.width,
      y: Math.random() * canvasC.height - canvasC.height,
      size: Math.random() * 6 + 3,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: Math.random() * 3.5 + 2,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 0.15,
      wobble: Math.random() * 0.06,
      life: 0
    });
  }
  confettiInt = setInterval(() => {
    ctxC.clearRect(0, 0, canvasC.width, canvasC.height);
    let active = 0;
    for (const p of parts) {
      p.y += p.speed;
      p.x += Math.sin(p.y * p.wobble) * 1.5;
      p.rotation += p.rotationSpeed;
      p.life++;
      if (p.y < canvasC.height + 30) active++;
      ctxC.save();
      ctxC.translate(p.x, p.y);
      ctxC.rotate(p.rotation);
      ctxC.fillStyle = p.color;
      ctxC.shadowColor = 'rgba(255,255,255,0.25)';
      ctxC.shadowBlur = 6;
      ctxC.fillRect(-p.size/2, -p.size/4, p.size, p.size/2);
      ctxC.restore();
    }
    if (active === 0 || parts.every(p => p.life > 300)) stopConfetti();
  }, 16);
}

function stopConfetti() {
  if (confettiInt) {
    clearInterval(confettiInt);
    confettiInt = null;
  }
  if (canvasC) {
    ctxC.clearRect(0, 0, canvasC.width, canvasC.height);
    canvasC.style.display = 'none';
  }
  parts = [];
}

// ============================================================
// PROCESAR
// ============================================================
async function iniciarProceso(link) {
  if (enProceso) return;
  if (!esValido(link)) return;

  const modoDirecto = esPasteDirecto(link);
  esModoDirecto = modoDirecto;

  reset();
  esModoDirecto = modoDirecto;
  detenerPlaceholderRotativo();
  hideInputField(true);

  enProceso = true;

  if (modoDirecto) {
    showProgressDirecta(true, 'Extrayendo ID…');
  } else {
    showProgress(true);
    setPct(0);
    setStage('Iniciando proceso…');
  }

  const timeoutMs = modoDirecto ? 180000 : 90000;
  timeoutProceso = setTimeout(() => {
    if (enProceso) {
      enProceso = false;
      ocultarTodosLosProgresos();
      hideInputField(false);
      iniciarPlaceholderRotativo();
      showError({
        titulo: 'TIMEOUT',
        detalle: 'El proceso tardó demasiado. Inténtalo de nuevo.',
        sugerencia: ''
      });
    }
  }, timeoutMs);

  try {
    chrome.runtime.sendMessage({ action: 'procesarShortLink', url: link });
  } catch (e) {
    enProceso = false;
    hideInputField(false);
    iniciarPlaceholderRotativo();
    clearTimeout(timeoutProceso);
    showError({
      titulo: 'Error interno',
      detalle: e.message || 'No se pudo iniciar el proceso.'
    });
  }
}

// ============================================================
// INIT
// ============================================================
document.addEventListener('DOMContentLoaded', async () => {
  const btn = document.getElementById('btn');
  const input = document.getElementById('link');
  const clearBtn = document.getElementById('clearBtn');
  const themeToggle = document.getElementById('themeToggle');
  const autoToggle = document.getElementById('autoToggle');
  const histClear = document.getElementById('histClear');

  reset();
  setDot(false, false);
  setupCopyButton();
  iniciarPlaceholderRotativo();

  await cargarTema();
  await cargarAutoExtraer();

  await cargarHistorial();

  try {
    const estado = await chrome.runtime.sendMessage({ action: 'estadoProceso' });
    if (estado && estado.activo) {
      enProceso = true;
      hideInputField(true);
      showProgressDirecta(true, 'Proceso en curso…');

      timeoutProceso = setTimeout(() => {
        if (enProceso) {
          enProceso = false;
          ocultarTodosLosProgresos();
          hideInputField(false);
          iniciarPlaceholderRotativo();
        }
      }, 180000);
    }
  } catch (e) {}

  themeToggle.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    toggleTema();
  });

  autoToggle.addEventListener('click', (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    toggleAutoExtraer();
  });

  histClear.addEventListener('click', borrarHistorial);

  clearBtn.addEventListener('click', () => {
    input.value = '';
    setDot(false, false);
    toggleClearBtn();
    reset();
    input.focus();
  });

  const onInput = () => {
    const val = input.value.trim();
    const ok = esValido(val);
    setDot(ok, val.length > 0);
    toggleClearBtn();

    if (document.getElementById('ok').classList.contains('show') ||
        document.getElementById('err').classList.contains('show')) {
      reset();
    }
  };

  input.addEventListener('input', onInput);
  input.addEventListener('paste', () => {
    setTimeout(async () => {
      onInput();
      if (autoExtraerActivo && esValido(input.value.trim()) && !enProceso) {
        const link = input.value.trim();
        if (link !== ultimoLinkProcesado) {
          setTimeout(() => iniciarProceso(link), 400);
        }
      }
    }, 30);
  });

  btn.addEventListener('click', () => {
    const link = input.value.trim();
    if (!esValido(link)) {
      setDot(false, true);
      return;
    }
    iniciarProceso(link);
  });
});

// ============================================================
// MENSAJES
// ============================================================
chrome.runtime.onMessage.addListener((req) => {
  if (req.action === 'actualizarProgreso') {
    if (esModoDirecto) return true;

    showProgress(true);
    setPct(req.porcentaje || 0);
    const p = req.porcentaje || 0;
    let etapa = '';
    if (req.mensaje) etapa = req.mensaje;
    else if (p < 20) etapa = 'Abriendo enlace…';
    else if (p < 50) etapa = 'Pasando anuncios…';
    else if (p < 90) etapa = 'Resolviendo gate…';
    else if (p < 95) etapa = 'Leyendo paste.myst.rs…';
    else if (p < 99) etapa = 'Verificando sesión…';
    else etapa = '¡Listo!';
    setStage(etapa);
    if (etapa === 'Pasando anuncios…') mostrarAvisoPestana();
    else ocultarAvisoPestana();
  }

  if (req.action === 'idExtraido') {
    clearTimeout(timeoutProceso);
    ocultarAvisoPestana();
    ocultarTodosLosProgresos();

    if (!esModoDirecto) {
      setPct(100);
      setStage('¡Listo!');
    }

    setTimeout(() => {
      enProceso = false;
      showOk({ id: req.id, servicio: req.servicio });
    }, esModoDirecto ? 100 : 400);
  }

  if (req.action === 'pestanaCerrada') {
    clearTimeout(timeoutProceso);
    enProceso = false;
    esModoDirecto = false;

    ocultarTodosLosProgresos();
    ocultarMensajeCopiado();

    reset();

    return true;
  }

  if (req.action === 'errorProcesamiento') {
    clearTimeout(timeoutProceso);
    enProceso = false;
    ocultarAvisoPestana();
    ocultarMensajeCopiado();

    if (req.codigo === 'SESION_MUERTA' && req.id) {
      ocultarTodosLosProgresos();
      setTimeout(() => {
        showOk({ id: req.id, servicio: req.servicio });
      }, 100);
      return true;
    }

    let titulo = req.titulo || 'Error';
    let detalle = req.detalle || req.error || 'No se pudo completar la extracción.';
    let sugerencia = req.sugerencia || '';

    if (req.codigo === 'PASTE_BORRADO' || req.codigo === 'SIN_ID') {
      titulo = 'No existe ID en ese paste';
      detalle = 'El creador borra los pastes de IDs que ya no sirven y los cambia por nuevos que sirven.';
      sugerencia = 'Si tienes dudas contacta con el creador @DANIPROPREMIUM (https://telegram.me/DANIPROPREMIUM).';
    }

    showError({ titulo, detalle, sugerencia });
  }

  return true;
});