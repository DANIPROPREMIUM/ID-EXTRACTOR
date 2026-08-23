// BACKGROUND SERVICE WORKER - pasa anuncios y extrae ID de paste.myst.rs

let dominiosConocidos = {
  primeraRonda: 'mtc1.nclsil.in',
  segundaRonda: 'mtc1.livetechnewz.com',
  shortlinks: 'shortxlinks.in'
};

const DOMINIOS_BASE = ['softurl.in', 'shortxlinks.in', 'shortxlinks.com'];
const PASTE_DOMINIO = 'paste.myst.rs';

// ===== Páginas "gate" (blogspot y similares) =====
const PISTAS_DESTINO = /(shortxlinks|softurl|nclsil|livetechnewz|safelink|shrinkme|shrinklink|gplinks|droplink|exe\.io|ouo\.io|adf\.ly|clk\.sh|linkvertise|mediafire\.com|mega\.nz|drive\.google\.com|docs\.google\.com|pixeldrain\.(com|net)|workupload\.com|1fichier\.com|gofile\.io|sfl\.gl|terabox\.com)/i;
const DOMINIOS_ANUNCIO = /(temu\.|aliexpress|gamsgo|monetag|spinnyspinwheel|t\.co\/|shopee|amazon\.|bit\.ly|adsterra|propellerads|hilltopads|doubleclick|googlesyndication|googletagmanager|google-analytics|facebook\.|twitter\.|blogger\.com|blogspot\.com|gstatic|googleapis|schema\.org|w3\.org|youtube\.|telegram\.|t\.me)/i;
const HOSTS_ARCHIVO = /(mediafire\.com|mega\.nz|drive\.google\.com|docs\.google\.com|pixeldrain\.(com|net)|workupload\.com|1fichier\.com|gofile\.io|terabox\.com|dropbox\.com|sourceforge\.net|androidfilehost\.com|akirabox\.com|krakenfiles\.com|buzzheavier\.com|send\.cm|qiwi\.gg|datanodes\.to)/i;
const CLAVES_DESTINO = /(mediafire|final|download|descarga|apk|mega|drive|destino|target|real|unlock|link_?url|url_?link)/i;

let dominiosPendientes = [];
let procesosActivos = {};
let pestañaProceso = null;

// ---------- Inyección temprana (acelera timers, bloquea pop-ups) ----------
function inyeccionTemprana() {
  if (window.__paInyectado) return;
  window.__paInyectado = true;
  window.__paTimersAcelerados = true;
  window.__paOpens = window.__paOpens || [];

  try {
    Object.defineProperty(window, 'blurred', {
      get() { return false; },
      set() { /* ignorar */ },
      configurable: true
    });
  } catch (e) {}

  try {
    document.addEventListener('DOMContentLoaded', () => {
      try {
        if (document.getElementById('ad-banner') || !document.body) return;
        const cebo = document.createElement('div');
        cebo.id = 'ad-banner';
        cebo.className = 'ad-banner';
        cebo.setAttribute('style', 'height: 5px; width: 5px; position: absolute; top: 0;');
        document.body.appendChild(cebo);
      } catch (e) {}
    });
  } catch (e) {}

  const FACTOR = 3;
  const _setInterval = window.setInterval;
  const _setTimeout = window.setTimeout;

  window.setInterval = function(fn, delay, ...args) {
    if (typeof delay === 'number' && delay >= 700) {
      delay = Math.max(50, Math.round(delay / FACTOR));
    }
    return _setInterval(fn, delay, ...args);
  };

  window.setTimeout = function(fn, delay, ...args) {
    if (typeof delay === 'number' && delay >= 700) {
      delay = Math.max(50, Math.round(delay / FACTOR));
    }
    return _setTimeout(fn, delay, ...args);
  };

  const ventanaFalsa = {
    closed: false,
    focus() {}, blur() {}, close() {}, print() {},
    postMessage() {}, moveTo() {}, resizeTo() {},
    document: { write() {}, writeln() {}, close() {} },
    location: { href: '', replace() {}, assign() {} }
  };

  const _open = window.open.bind(window);

  window.open = function(url, target, features) {
    let u = '';
    try { u = url ? String(url) : ''; } catch (e) {}
    const tgt = target ? String(target) : '';

    try {
      if (u) window.__paOpens.push({ url: u, target: tgt, t: Date.now() });
    } catch (e) {}

    if (!tgt || tgt === '_self' || tgt === '_top' || tgt === '_parent') {
      if (u) {
        try { window.location.href = u; } catch (e) { try { _open(url, target, features); } catch (e2) {} }
      }
      return window;
    }
    return ventanaFalsa;
  };
}

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.tabId !== pestañaProceso) return;
  chrome.scripting.executeScript({
    target: { tabId: details.tabId, frameIds: [details.frameId] },
    world: 'MAIN',
    injectImmediately: true,
    func: inyeccionTemprana
  }).catch(() => {});
});

// ---------- Gestión de dominios ----------
function cargarDominios() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['dominiosExitosos', 'dominiosPendientes'], function(result) {
      if (result.dominiosExitosos) {
        dominiosConocidos = result.dominiosExitosos;
        console.log('✅ Dominios cargados:', dominiosConocidos);
      }
      if (result.dominiosPendientes) {
        dominiosPendientes = result.dominiosPendientes;
      }
      resolve();
    });
  });
}

function guardarDominios() {
  chrome.storage.local.set({ dominiosExitosos: dominiosConocidos });
  console.log('✅ Dominios guardados');
}

cargarDominios();

// ---------- Mensajes ----------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "procesarShortLink") {
    (async () => {
      const { procesoEnCurso } = await chrome.storage.local.get('procesoEnCurso');
      const enCurso = procesoEnCurso && (Date.now() - procesoEnCurso.timestamp < 8 * 60 * 1000);

      if (pestañaProceso !== null || enCurso) {
        console.log("⚠️ Ya hay un proceso en curso, ignorando nueva solicitud");
        sendResponse({ status: "ocupado" });
        return;
      }

      const shortLink = request.url;
      console.log("Background: Procesando:", shortLink);
      await chrome.storage.local.set({ procesoEnCurso: { url: shortLink, timestamp: Date.now() } });
      procesarEnlaceAcortado(shortLink);
      sendResponse({ status: "iniciado" });
    })();
    return true;
  }
});

// ---------- Helpers ----------
async function crearPestañaSilenciosa(url) {
  try {
    const tab = await chrome.tabs.create({ url: url, active: false, index: 999 });
    pestañaProceso = tab.id;
    try { await chrome.tabs.update(tab.id, { muted: true }); } catch(e) {}
    console.log("✅ Pestaña silenciosa creada");
    return pestañaProceso;
  } catch (error) {
    console.error("Error creando pestaña:", error);
    throw error;
  }
}

async function cerrarPestañaProceso() {
  if (pestañaProceso) {
    try { await chrome.tabs.remove(pestañaProceso); } catch(e) {}
    pestañaProceso = null;
  }
}

function obtenerHost(url) {
  try { return new URL(url).hostname; } catch (e) { return ''; }
}

function esShortlinkConocido(host) {
  if (!host) return false;
  const lista = [
    dominiosConocidos.primeraRonda,
    dominiosConocidos.segundaRonda,
    dominiosConocidos.shortlinks,
    ...DOMINIOS_BASE
  ].filter(Boolean);
  return lista.some(d => host.includes(d) || d.includes(host));
}

function esDominioConocido(host) {
  if (!host) return false;
  const conocidos = [
    dominiosConocidos.primeraRonda,
    dominiosConocidos.segundaRonda,
    dominiosConocidos.shortlinks,
    ...DOMINIOS_BASE,
    ...dominiosPendientes
  ].filter(Boolean);
  return conocidos.some(d => host.includes(d) || d.includes(host));
}

function puntuarDestino(url, clave) {
  if (!url || !/^https?:\/\//i.test(url)) return -1;
  if (DOMINIOS_ANUNCIO.test(url)) return -1;
  if (/\.(png|jpe?g|gif|webp|svg|ico|css|js|woff2?|ttf|mp4|mp3)(\?|#|$)/i.test(url)) return -1;
  const host = obtenerHost(url);
  if (!host) return -1;
  let puntos = 0;
  if (PISTAS_DESTINO.test(host)) puntos += 10;
  if (clave && CLAVES_DESTINO.test(clave)) puntos += 5;
  return puntos > 0 ? puntos : -1;
}

function extraerDestinoDeHtml(html, urlBase) {
  if (!html) return null;
  const hostBase = obtenerHost(urlBase);
  const candidatos = new Map();
  const anotar = (url, clave) => {
    let limpia = (url || '').trim().replace(/\\\//g, '/').replace(/&amp;/g, '&');
    if (!limpia) return;
    if (obtenerHost(limpia) === hostBase) return;
    const puntos = puntuarDestino(limpia, clave);
    if (puntos < 0) return;
    const previo = candidatos.get(limpia) || 0;
    if (puntos > previo) candidatos.set(limpia, puntos);
  };
  const rePar = /([A-Za-z_$][\w$]*)\s*[:=]\s*["'](https?:\/\/[^"'\s]+)["']/g;
  let m;
  while ((m = rePar.exec(html)) !== null) anotar(m[2], m[1]);
  const reSuelta = /["'](https?:\/\/[^"'\s<>]+)["']/g;
  while ((m = reSuelta.exec(html)) !== null) anotar(m[1], null);
  if (candidatos.size === 0) return null;
  const ordenados = [...candidatos.entries()].sort((a, b) => b[1] - a[1]);
  const [mejorUrl, mejorPuntos] = ordenados[0];
  if (mejorPuntos < 10) return null;
  console.log(`🎯 Destino del gate: ${mejorUrl} (${mejorPuntos} pts)`);
  return mejorUrl;
}

async function extraerDestinoDePagina(tabId) {
  try {
    const html = await ejecutarEnPagina(tabId, () => document.documentElement.outerHTML, '');
    if (!html) return null;
    const urlActual = await obtenerUrlActual(tabId);
    return extraerDestinoDeHtml(html, urlActual);
  } catch (e) { return null; }
}

async function resolverGateDirecto(url) {
  try {
    const resp = await fetch(url, { credentials: 'omit', redirect: 'follow' });
    if (!resp.ok) return null;
    const html = await resp.text();
    return extraerDestinoDeHtml(html, url);
  } catch (e) {
    console.log('No se pudo resolver el gate por fetch:', e.message);
    return null;
  }
}

// ---------- Extracción de ID desde paste.myst.rs ----------
async function extraerIdDePaste(url) {
  try {
    let rawUrl = url.trim().replace(/\/$/, '');
    if (!rawUrl.endsWith('/raw')) rawUrl = rawUrl + '/raw';

    try {
      const res = await fetch(rawUrl);
      if (res.ok) {
        const texto = await res.text();
        return { texto, esRaw: true };
      }
    } catch(e) {}

    const res2 = await fetch(url);
    if (!res2.ok) throw new Error(`Error HTTP: ${res2.status}`);
    const html = await res2.text();
    return { texto: html, esRaw: false };
  } catch (error) {
    console.error('Error fetch paste:', error);
    throw error;
  }
}

function extraerId(texto, servicio) {
  if (!servicio) {
    const regexCualquier = /(premium_id:[a-zA-Z]+:[a-zA-Z0-9]{4,12}:[a-zA-Z0-9]{4,12}:[A-Za-z0-9+/=]{20,})/i;
    const matchCualquier = texto.match(regexCualquier);
    if (matchCualquier) return matchCualquier[1];
    const regexSimple = /(premium_id:[^\s<"']+)/i;
    const matchSimple = texto.match(regexSimple);
    if (matchSimple) return matchSimple[1];
    return null;
  }
  // Si se especifica servicio, se puede refinar, pero con el genérico basta
  return null;
}

function detectarServicioDesdeTexto(texto) {
  const textoLower = texto.toLowerCase();
  if (textoLower.includes('premium_id:netflix') || textoLower.includes('netflix_session')) return 'netflix';
  if (textoLower.includes('premium_id:crunchyroll') || textoLower.includes('crunchyroll_session')) return 'crunchyroll';
  if (textoLower.includes('premium_id:prime') || textoLower.includes('session_paste')) return 'prime';
  if (textoLower.includes('premium_id:viki')) return 'viki';
  if (textoLower.includes('premium_id:atresplayer')) return 'atresplayer';
  if (textoLower.includes('premium_id:paramount')) return 'paramount';
  if (textoLower.includes('premium_id:premium') || textoLower.includes('premium_id:plus')) return 'plus';
  return null;
}

async function esperarYExtraerIdDePaste(tabId, timeout = 20000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const resultado = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const tieneContenido = 
            document.querySelector('.paste-pasties') !== null ||
            document.querySelector('.pasty') !== null ||
            document.querySelector('textarea') !== null ||
            (document.body && document.body.innerText && document.body.innerText.length > 100) ||
            document.title.includes('paste') ||
            document.querySelector('main')?.innerText?.length > 50;
          return tieneContenido;
        }
      });
      if (resultado[0]?.result === true) {
        await delay(2000);
        const url = await obtenerUrlActual(tabId);
        const { texto } = await extraerIdDePaste(url);
        const servicio = detectarServicioDesdeTexto(texto);
        let id = extraerId(texto, servicio);
        if (!id) id = extraerId(texto, null);
        if (id) {
          console.log(`✅ ID extraído: ${id}`);
          return id;
        }
        return null;
      }
    } catch (e) {}
    await delay(1000);
  }
  return null;
}

// ---------- Detección de tipos de página ----------
async function detectarTipoPagina(tabId) {
  try {
    const resultado = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        if (document.getElementById('wpsafelinkhuman') ||
            document.getElementById('wpsafe-generate') ||
            document.getElementById('wpsafe-link') ||
            document.getElementById('wpsafelink-landing')) {
          return 'wpsafelink';
        }
        if (document.getElementById('go-link') ||
            document.getElementById('waiting-btn') ||
            document.querySelector('.get-link')) {
          return 'adlinkfly';
        }
        const h1 = document.querySelector('h1');
        if (h1 && h1.innerText && h1.innerText.includes('Too Early')) {
          return 'too_early';
        }
        const botonesPaso = document.querySelectorAll(
          '[id^="btn-s"], .step button, .step a.btn, [class*="step"] > button'
        );
        const botonFinal = document.querySelector(
          '#btn-download, #final-link button, #final-link a, [id*="final"] button'
        );
        if (botonesPaso.length >= 2 && botonFinal) {
          return 'gate';
        }
        const hayContador = document.querySelector(
          '[id*="countdown" i], [class*="countdown" i], [id*="timer" i], [class*="timer" i]'
        );
        if (hayContador) {
          const PISTA = /final|get-?link|continue|continuar|download|descarga|destino|unlock/i;
          for (const a of document.querySelectorAll('a[href^="http"]')) {
            const seña = (a.id || '') + ' ' + (a.className || '');
            if (!PISTA.test(seña)) continue;
            const estilo = window.getComputedStyle(a);
            const oculto = estilo.display === 'none' ||
                           estilo.visibility === 'hidden' ||
                           a.offsetParent === null;
            if (oculto && a.href !== location.href) return 'gate';
          }
        }
        if (document.getElementById('landing')) return 'landing';
        if (document.readyState !== 'complete') return 'desconocido';
        if (!document.body || document.body.innerText.trim().length < 100) return 'desconocido';
        return 'final';
      }
    });
    return resultado[0]?.result || 'desconocido';
  } catch (e) {
    return 'desconocido';
  }
}

// ---------- Procesamiento de gates, wpsafelink, adlinkfly ----------
async function procesarPaginaGate(tabId) {
  const escondido = await extraerEnlaceFinalEscondido(tabId);
  if (escondido) {
    console.log(`⚡ gate: enlace final ya presente, se navega directo a ${escondido}`);
    try { await chrome.tabs.update(tabId, { url: escondido }); } catch (e) {}
    await delay(3000);
    return true;
  }
  await prepararGate(tabId);
  await delay(500);
  const pasos = await ejecutarEnPagina(tabId, () => {
    return document.querySelectorAll(
      '[id^="btn-s"], .step button, .step a.btn, [class*="step"] > button'
    ).length;
  }, 0);
  for (let i = 0; i < Math.min(pasos, 8); i++) {
    const clickeado = await ejecutarEnPagina(tabId, (indice) => {
      const botones = document.querySelectorAll(
        '[id^="btn-s"], .step button, .step a.btn, [class*="step"] > button'
      );
      const btn = botones[indice];
      if (!btn) return false;
      btn.click();
      return true;
    }, false, [i]);
    if (!clickeado) break;
    console.log(`✓ gate: paso ${i + 1}/${pasos} clickeado`);
    await esperarFinDePaso(tabId, 30000);
  }
  const url = await clickBotonFinalGate(tabId, 20000);
  if (url) {
    try {
      const urlActual = await obtenerUrlActual(tabId);
      const destino = new URL(url, urlActual).href;
      console.log(`✅ gate: destino capturado ${destino}`);
      await chrome.tabs.update(tabId, { url: destino });
      await delay(3000);
      return true;
    } catch (e) {}
  }
  return false;
}

function extraerEnlaceFinalEscondido(tabId) {
  return ejecutarEnPagina(tabId, () => {
    const PISTA = /final|get-?link|continue|continuar|download|descarga|destino|unlock/i;
    const candidatos = [];
    for (const a of document.querySelectorAll('a[href]')) {
      const href = a.href || '';
      if (!/^https?:\/\//i.test(href)) continue;
      if (href === location.href) continue;
      const seña = (a.id || '') + ' ' + (a.className || '');
      if (!PISTA.test(seña)) continue;
      const estilo = window.getComputedStyle(a);
      const oculto = estilo.display === 'none' ||
                     estilo.visibility === 'hidden' ||
                     a.offsetParent === null;
      if (!oculto) continue;
      let puntos = 1;
      if (PISTA.test(a.id || '')) puntos += 2;
      if (/final|unlock|destino/i.test(seña)) puntos += 2;
      candidatos.push({ href, puntos });
    }
    if (!candidatos.length) return null;
    candidatos.sort((x, y) => y.puntos - x.puntos);
    return candidatos[0].href;
  }, null);
}

async function prepararGate(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        if (window.__paGateListo) return true;
        window.__paGateListo = true;
        const FACTOR = 30;
        const CLAVE_TIEMPO = /TIME|SECOND|SEGUND|DELAY|WAIT|ESPERA|COUNT|TIMER|DURATION/i;
        const aplanarTiempos = (obj) => {
          try {
            let tocaAlgo = false;
            for (const k of Object.keys(obj)) {
              if (CLAVE_TIEMPO.test(k) && typeof obj[k] === 'number') tocaAlgo = true;
            }
            if (!tocaAlgo) return false;
            for (const k of Object.keys(obj)) {
              if (CLAVE_TIEMPO.test(k) && typeof obj[k] === 'number' && obj[k] > 0 && obj[k] <= 600) {
                obj[k] = 0;
              }
            }
            return true;
          } catch (e) { return false; }
        };
        try { if (typeof CONFIG === 'object' && CONFIG) aplanarTiempos(CONFIG); } catch (e) {}
        try {
          for (const k of Object.getOwnPropertyNames(window)) {
            let v;
            try { v = window[k]; } catch (e) { continue; }
            if (v && typeof v === 'object' && !Array.isArray(v) && v !== window) {
              try { if (Object.keys(v).length < 40) aplanarTiempos(v); } catch (e) {}
            }
          }
        } catch (e) {}
        try {
          const OrigDate = Date;
          const _now = OrigDate.now.bind(OrigDate);
          const T0 = _now();
          const warp = () => T0 + (_now() - T0) * FACTOR;
          OrigDate.now = warp;
          const DateProxy = new Proxy(OrigDate, {
            construct(target, args) {
              return args.length === 0 ? new target(warp()) : new target(...args);
            },
            apply() { return new OrigDate(warp()).toString(); }
          });
          window.Date = DateProxy;
        } catch (e) {}
        try {
          const _pnow = performance.now.bind(performance);
          const P0 = _pnow();
          performance.now = () => P0 + (_pnow() - P0) * FACTOR;
        } catch (e) {}
        return true;
      }
    });
  } catch (e) {}
}

async function esperarFinDePaso(tabId, timeout = 30000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeout) {
    const estado = await ejecutarEnPagina(tabId, () => {
      const overlay = document.querySelector('#timer-overlay, [id*="overlay"]');
      const visible = overlay && window.getComputedStyle(overlay).display !== 'none';
      if (visible) {
        const reanudar = document.querySelector('#resume-btn, [id*="resume"]');
        if (reanudar && window.getComputedStyle(reanudar).display !== 'none') {
          reanudar.click();
          return 'reanudado';
        }
        return 'esperando';
      }
      return 'libre';
    }, 'libre');
    if (estado === 'libre') {
      await delay(400);
      return true;
    }
    await delay(400);
  }
  return false;
}

async function clickBotonFinalGate(tabId, timeout = 20000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeout) {
    const resultado = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        const btn = document.querySelector(
          '#btn-download, #final-link button, #final-link a, [id*="final"] button'
        );
        if (!btn) return null;
        const cont = btn.closest('#final-link, [id*="final"]') || btn.parentElement;
        if (cont && window.getComputedStyle(cont).display === 'none') return null;
        const href = btn.getAttribute && btn.getAttribute('href');
        if (href && !href.startsWith('javascript:') && href !== '#') return { url: href };
        window.__paOpens = window.__paOpens || [];
        const antes = window.__paOpens.length;
        btn.click();
        const nuevos = window.__paOpens.slice(antes);
        if (nuevos.length) return { url: nuevos[nuevos.length - 1].url };
        return { clickeado: true };
      }
    }).then(r => r[0]?.result).catch(() => null);
    if (resultado && resultado.url) return resultado.url;
    if (resultado && resultado.clickeado) {
      await delay(1200);
      const tardia = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: () => {
          const abiertos = window.__paOpens || [];
          return abiertos.length ? abiertos[abiertos.length - 1].url : null;
        }
      }).then(r => r[0]?.result).catch(() => null);
      if (tardia) return tardia;
    }
    await delay(800);
  }
  return null;
}

async function ejecutarEnPagina(tabId, func, porDefecto = null, args = []) {
  try {
    const r = await chrome.scripting.executeScript({ target: { tabId }, func, args });
    const valor = r[0]?.result;
    return valor === undefined || valor === null ? porDefecto : valor;
  } catch (e) {
    return porDefecto;
  }
}

async function procesarRondaWpSafelink(tabId) {
  await esperarYHacerClic(tabId, '#wpsafelinkhuman', 'verificación humana', 20000);
  await delay(1500);
  const generado = await esperarYHacerClic(tabId, 'a[onclick="wpsafegenerate()"]', 'generar enlace', 45000);
  if (generado) await delay(3000);
  const continuo = await esperarYHacerClicDownload(tabId, 'continuar', 15000);
  if (!continuo) {
    const oculto = await extraerDestinoWpSafelink(tabId);
    if (oculto) {
      console.log(`↪ wpsafelink: botón oculto, se navega directo a ${oculto}`);
      try { await chrome.tabs.update(tabId, { url: oculto }); } catch (e) {}
      await delay(3000);
      return;
    }
  }
  await delay(1500);
}

function extraerDestinoWpSafelink(tabId) {
  return ejecutarEnPagina(tabId, () => {
    const enlaces = [
      ...document.querySelectorAll('#wpsafe-link a[onclick], a[onclick]')
    ];
    for (const enlace of enlaces) {
      const onclick = enlace.getAttribute('onclick') || '';
      if (!onclick.includes('window.open')) continue;
      const m = onclick.match(/window\.open\(\s*['"]([^'"]+)['"]/);
      if (m && /^https?:\/\//i.test(m[1])) return m[1];
    }
    const directo = document.querySelector('#wpsafe-link a[href^="http"]');
    return directo ? directo.getAttribute('href') : null;
  }, null);
}

async function procesarPaginaAdlinkfly(tabId) {
  await intentarClicVerificacionHumana(tabId);
  await delay(1000);
  for (let i = 0; i < 6; i++) {
    const estado = await desbloquearContadorAdlinkfly(tabId);
    if (estado === 'enviado' || estado === 'sin-formulario') break;
    await delay(1000);
  }
  const href = await esperarHrefGetLink(tabId, 30000);
  if (href) {
    try {
      const urlActual = await obtenerUrlActual(tabId);
      const nuevaUrl = new URL(href, urlActual).href;
      await chrome.tabs.update(tabId, { url: nuevaUrl });
    } catch (e) {}
    await delay(3000);
    return true;
  }
  await intentarClicConTimeout(tabId, '.btn-success.get-link, #waiting-btn, a.get-link', 2000);
  await delay(2000);
  return false;
}

async function desbloquearContadorAdlinkfly(tabId) {
  try {
    const r = await chrome.scripting.executeScript({
      target: { tabId },
      world: 'MAIN',
      func: () => {
        if (window.__paAdlinkflyEnviado) return 'enviado';
        const form = document.getElementById('go-link');
        if (!form) return 'sin-formulario';
        const jq = window.jQuery || window.$;
        if (!jq || !jq.fn) return 'sin-jquery';
        let listo = false;
        try {
          const eventos = jq._data ? jq._data(form, 'events') : null;
          listo = !!(eventos && eventos.submit && eventos.submit.length);
        } catch (e) {}
        if (!listo && document.readyState === 'complete') listo = true;
        if (!listo) return 'sin-manejador';
        window.__paAdlinkflyEnviado = true;
        jq(form).addClass('go-link');
        jq(form).submit();
        return 'enviado';
      }
    });
    const estado = r[0]?.result || 'error';
    if (estado === 'enviado') console.log('✓ adlinkfly: contador salteado, formulario enviado');
    return estado;
  } catch (e) { return 'error'; }
}

async function esperarHrefGetLink(tabId, timeout = 30000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const resultado = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const boton = document.querySelector('.btn-success.get-link') || document.getElementById('waiting-btn');
          if (!boton) return null;
          const href = boton.getAttribute('href') || '';
          if (href && !href.startsWith('javascript:') && !boton.classList.contains('disabled')) {
            return href;
          }
          return null;
        }
      });
      const href = resultado[0]?.result;
      if (href) return href;
    } catch (e) {}
    await delay(1000);
  }
  return null;
}

async function intentarClicVerificacionHumana(tabId) {
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const candidatos = [
          ...document.querySelectorAll('input[type="checkbox"]'),
          ...document.querySelectorAll('button, a.btn, .btn')
        ];
        for (const el of candidatos) {
          const texto = (el.innerText || el.value || el.getAttribute('aria-label') || '').toLowerCase();
          if (texto.includes('robot') || texto.includes('human') || texto.includes('verif')) {
            el.click();
            return true;
          }
        }
        return false;
      }
    });
  } catch (e) {}
}

async function detectarTooEarly(tabId) {
  try {
    const resultado = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const h1 = document.querySelector('h1');
        return h1 && h1.innerText.includes("Too Early");
      }
    });
    return resultado[0]?.result === true;
  } catch (e) { return false; }
}

async function manejarTooEarly(tabId, maxIntentos = 8) {
  for (let intento = 1; intento <= maxIntentos; intento++) {
    const esTooEarly = await detectarTooEarly(tabId);
    if (!esTooEarly) {
      console.log("✅ Too Early superado");
      return true;
    }
    console.log(`⏳ Too Early (${intento}/${maxIntentos})`);
    try {
      await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const btn = document.querySelector('a.btn');
          if (btn) btn.click();
        }
      });
    } catch (e) {}
    await delay(3000 + intento * 1000);
  }
  return false;
}

async function intentarClicConTimeout(tabId, selector, timeout) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    try {
      const resultado = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (selector) => {
          const elemento = document.querySelector(selector);
          if (elemento) {
            elemento.click();
            return true;
          }
          return false;
        },
        args: [selector]
      });
      if (resultado[0]?.result === true) return true;
    } catch (e) {}
    await delay(200);
  }
  return false;
}

async function elementoVisible(tabId, selector) {
  try {
    const resultado = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (selector) => {
        const elemento = document.querySelector(selector);
        if (!elemento) return false;
        const estilo = window.getComputedStyle(elemento);
        return estilo.display !== 'none' && estilo.visibility !== 'hidden' && elemento.offsetParent !== null;
      },
      args: [selector]
    });
    return resultado[0]?.result === true;
  } catch (e) { return false; }
}

async function clickElemento(tabId, selector) {
  try {
    const resultado = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: (selector) => {
        const elemento = document.querySelector(selector);
        if (!elemento) return false;
        elemento.click();
        return true;
      },
      args: [selector]
    });
    return resultado[0]?.result === true;
  } catch (e) { return false; }
}

async function esperarYHacerClic(tabId, selector, descripcion, timeout = 60000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (await elementoVisible(tabId, selector)) {
      await delay(800);
      if (await clickElemento(tabId, selector)) {
        console.log(`✓ ${descripcion} clickeado`);
        return true;
      }
    }
    await delay(1000);
  }
  return false;
}

async function esperarYHacerClicDownload(tabId, descripcion, timeout = 15000) {
  const startTime = Date.now();
  const urlInicial = await obtenerUrlActual(tabId);
  const buscarVisible = () => chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      const wpsafeLink = document.getElementById('wpsafe-link');
      if (wpsafeLink && window.getComputedStyle(wpsafeLink).display !== 'none') return true;
      const enlaces = document.querySelectorAll('a[onclick]');
      for (const enlace of enlaces) {
        const onclick = enlace.getAttribute('onclick') || '';
        if (onclick.includes('window.open')) {
          if (window.getComputedStyle(enlace).display !== 'none') return true;
        }
      }
      return false;
    }
  }).then(r => r[0]?.result === true).catch(() => false);
  const clickearSiVisible = () => chrome.scripting.executeScript({
    target: { tabId: tabId },
    func: () => {
      const wpsafeLink = document.getElementById('wpsafe-link');
      if (wpsafeLink && window.getComputedStyle(wpsafeLink).display !== 'none') {
        const enlace = wpsafeLink.querySelector('a');
        if (enlace) { enlace.click(); return true; }
      }
      const enlaces = document.querySelectorAll('a[onclick]');
      for (const enlace of enlaces) {
        const onclick = enlace.getAttribute('onclick') || '';
        if (onclick.includes('window.open')) {
          if (window.getComputedStyle(enlace).display !== 'none') { enlace.click(); return true; }
        }
      }
      return false;
    }
  }).then(r => r[0]?.result === true).catch(() => false);
  while (Date.now() - startTime < timeout) {
    if (await buscarVisible()) {
      await delay(800);
      if (await clickearSiVisible()) {
        console.log(`✓ ${descripcion} clickeado, esperando navegación...`);
        const limiteVerificacion = Date.now() + 4000;
        while (Date.now() < limiteVerificacion) {
          await delay(500);
          const urlAhora = await obtenerUrlActual(tabId);
          if (urlAhora && urlAhora !== urlInicial) {
            console.log(`✓ ${descripcion}: navegación confirmada`);
            return true;
          }
        }
        console.log(`↻ ${descripcion}: sin navegación, reintentando clic...`);
        continue;
      }
    }
    await delay(1000);
  }
  return false;
}

async function obtenerUrlActual(tabId) {
  try {
    const resultado = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => window.location.href
    });
    return resultado[0]?.result || '';
  } catch (e) { return ''; }
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ---------- Función principal ----------
async function procesarEnlaceAcortado(shortLink) {
  let tabId = null;
  try {
    enviarProgreso(5);
    let urlInicio = shortLink;
    if (!esShortlinkConocido(obtenerHost(shortLink))) {
      const directo = await resolverGateDirecto(shortLink);
      if (directo) {
        console.log(`⚡ Gate saltado directo: ${directo}`);
        urlInicio = directo;
      } else {
        console.log('↻ Gate no resuelto por HTML, se abrirá y se simularán los pasos');
      }
    }
    tabId = await crearPestañaSilenciosa(urlInicio);
    enviarProgreso(10);
    await delay(5000);
    procesosActivos[tabId] = { etapa: 'iniciando', shortLink: shortLink, tabId: tabId };
    const MAX_INTENTOS = 40;
    let llegoAlFinal = false;
    let intentosGate = 0;
    let saltosFinales = 0;
    let idExtraido = null;

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      enviarProgreso(Math.min(10 + intento * 3, 95));
      await verificarYNotificarDominio(tabId);
      const tipo = await detectarTipoPagina(tabId);
      const urlActual = await obtenerUrlActual(tabId);
      console.log(`[Intento ${intento}/${MAX_INTENTOS}] tipo=${tipo} url=${urlActual}`);

      // Si la URL contiene paste.myst.rs, extraer ID y finalizar
      if (urlActual.includes(PASTE_DOMINIO)) {
        console.log('🎯 Llegamos a paste.myst.rs, extrayendo ID...');
        idExtraido = await esperarYExtraerIdDePaste(tabId, 20000);
        if (idExtraido) {
          console.log(`✅ ID extraído: ${idExtraido}`);
          // Copiar al portapapeles desde el background
          try {
            await chrome.scripting.executeScript({
              target: { tabId },
              func: (id) => navigator.clipboard.writeText(id),
              args: [idExtraido]
            });
          } catch (e) {
            // Fallback: usar storage
            await chrome.storage.local.set({ ultimoIdExtraido: idExtraido });
          }
          // Notificar al popup
          chrome.runtime.sendMessage({
            action: "idExtraido",
            id: idExtraido
          }).catch(() => {});
          // Dejar la pestaña visible
          try { await chrome.tabs.update(tabId, { active: true, muted: false }); } catch(e) {}
          llegoAlFinal = true;
          break;
        } else {
          console.log('⚠️ No se pudo extraer ID del paste, reintentando...');
          await delay(2000);
          continue;
        }
      }

      if (tipo === 'too_early') {
        const superado = await manejarTooEarly(tabId);
        if (!superado) throw new Error('Too Early bloqueó el acceso');
        await delay(2000);
        continue;
      }
      if (tipo === 'landing') {
        await delay(2000);
        continue;
      }
      if (tipo === 'gate') {
        const urlAntes = urlActual;
        await procesarPaginaGate(tabId);
        const urlDespues = await obtenerUrlActual(tabId);
        if (urlDespues && urlDespues !== urlAntes) {
          intentosGate = 0;
        } else {
          intentosGate++;
          if (intentosGate > 3) throw new Error('No se pudo pasar la página de pasos (gate)');
        }
        continue;
      }
      if (tipo === 'wpsafelink') {
        await procesarRondaWpSafelink(tabId);
        continue;
      }
      if (tipo === 'adlinkfly') {
        await procesarPaginaAdlinkfly(tabId);
        continue;
      }
      if (tipo === 'final') {
        // Si es final pero no es paste, podría ser una redirección intermedia
        await delay(1500);
        const tipoConfirmacion = await detectarTipoPagina(tabId);
        if (tipoConfirmacion === 'final') {
          const urlConfirmada = await obtenerUrlActual(tabId);
          if (urlConfirmada.includes(PASTE_DOMINIO)) continue; // lo capturará en la siguiente iteración
          if (saltosFinales < 2) {
            const destino = await extraerDestinoDePagina(tabId);
            if (destino) {
              saltosFinales++;
              console.log(`⚡ salto final directo: ${destino}`);
              try { await chrome.tabs.update(tabId, { url: destino }); } catch (e) {}
              await delay(3000);
              continue;
            }
          }
          llegoAlFinal = true;
          break;
        }
        continue;
      }
      await delay(1500);
    }

    if (!llegoAlFinal && !idExtraido) {
      throw new Error('No se pudo llegar a paste.myst.rs o extraer el ID');
    }

    if (idExtraido) {
      enviarProgreso(100);
      // El mensaje de éxito se envía desde el popup al recibir "idExtraido"
    } else {
      throw new Error('No se pudo extraer el ID');
    }

    delete procesosActivos[tabId];
    pestañaProceso = null;
    guardarDominios();
    await chrome.storage.local.remove('procesoEnCurso');

  } catch (error) {
    console.error("Error:", error);
    await chrome.storage.local.set({
      errorPendiente: { mensaje: error.message, timestamp: Date.now() }
    });
    chrome.runtime.sendMessage({
      action: "errorProcesamiento",
      error: error.message
    }).catch(() => {});
    setTimeout(() => cerrarPestañaProceso(), 1000);
    delete procesosActivos[tabId];
    await chrome.storage.local.remove('procesoEnCurso');
  }
}

function enviarProgreso(porcentaje) {
  chrome.runtime.sendMessage({
    action: "actualizarProgreso",
    porcentaje: porcentaje
  }).catch(() => {});
}

async function verificarYNotificarDominio(tabId) {
  try {
    const urlActual = await obtenerUrlActual(tabId);
    const dominioActual = obtenerHost(urlActual);
    if (!dominioActual) return true;
    if (!esDominioConocido(dominioActual)) {
      console.log(`🔄 NUEVO DOMINIO: ${dominioActual}`);
      if (!dominiosPendientes.includes(dominioActual)) {
        dominiosPendientes.push(dominioActual);
      }
      chrome.storage.local.set({ 'dominiosPendientes': dominiosPendientes });
      chrome.runtime.sendMessage({
        action: "dominioAprendido",
        dominio: dominioActual
      }).catch(() => {});
    }
    return true;
  } catch (e) { return true; }
}