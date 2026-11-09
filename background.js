// ============================================================
// ID EXTRACTOR v13.7 — Background
// Fix: si se cierra la pestaña del acortador, aborta el bucle
//      y avisa al popup para volver al menú principal.
// Historial: 10 últimas extracciones.
// ============================================================

(function silenciarConsola() {
  try {
    console.log = function () {};
    console.warn = function () {};
    console.error = function () {};
  } catch (e) {}
})();

let dominiosConocidos = {
  primeraRonda: 'mtc1.indiapharmajobs.in',
  segundaRonda: 'mtc1.whatsstatusvideo.com',
  shortlinks: 'shortxlinks.in'
};

const DOMINIOS_BASE = ['softurl.in', 'shortxlinks.in', 'shortxlinks.com'];
const PASTE_DOMINIO = 'paste.myst.rs';

const PISTAS_DESTINO = /(shortxlinks|softurl|nclsil|livetechnewz|indiapharmajobs|whatsstatusvideo|questain|safelink|shrinkme|shrinklink|gplinks|droplink|exe\.io|ouo\.io|adf\.ly|clk\.sh|linkvertise|mediafire\.com|mega\.nz|drive\.google\.com|docs\.google\.com|pixeldrain\.(com|net)|workupload\.com|1fichier\.com|gofile\.io|sfl\.gl|terabox\.com)/i;
const DOMINIOS_ANUNCIO = /(temu\.|aliexpress|gamsgo|monetag|spinnyspinwheel|t\.co\/|shopee|amazon\.|bit\.ly|adsterra|propellerads|hilltopads|doubleclick|googlesyndication|googletagmanager|google-analytics|facebook\.|twitter\.|blogger\.com|blogspot\.com|gstatic|googleapis|schema\.org|w3\.org|youtube\.|telegram\.|t\.me)/i;
const CLAVES_DESTINO = /(mediafire|final|download|descarga|apk|mega|drive|destino|target|real|unlock|link_?url|url_?link)/i;

let dominiosPendientes = [];
let procesosActivos = {};
let pestañaProceso = null;
let intervaloProgreso = null;
let inicioProgreso = 0;
const DURACION_ESTIMADA = 90000;

// ✅ flag para abortar el bucle si se cierra la pestaña
let procesoAbortado = false;

const URLS_VERIFICACION = {
  netflix:     { url: 'https://www.netflix.com/browse',           loginHint: /\/login|\/signin|sign\s*in/i },
  crunchyroll: { url: 'https://www.crunchyroll.com/',             loginHint: /\/login|\/signin/i },
  prime:       { url: 'https://www.primevideo.com/',              loginHint: /\/ap\/signin|\/signin|\/auth/i },
  paramount:   { url: 'https://www.paramountplus.com/',           loginHint: /\/login|\/signin/i },
  viki:        { url: 'https://www.viki.com/',                    loginHint: /\/login|\/signin/i },
  atresplayer: { url: 'https://www.atresplayer.com/',             loginHint: /\/iniciar-sesion|\/login/i },
  hbomax:      { url: 'https://play.hbomax.com/',                 loginHint: /\/login|\/signin|\/sign-in/i },
  appletv:     { url: 'https://tv.apple.com/',                    loginHint: /\/login|\/signin|\/sign-in/i },
  hidive:      { url: 'https://www.hidive.com/',                  loginHint: /\/login|\/signin/i },
  disney:      { url: 'https://www.disneyplus.com/',              loginHint: /\/login|\/signup|\/identity\/login/i },
  plus:        { url: 'https://www.paramountplus.com/',           loginHint: /\/login|\/signin/i }
};

async function verificarSesionViva(servicio) {
  const cfg = URLS_VERIFICACION[servicio];
  if (!cfg) return { estado: 'desconocido', detalle: 'Plataforma no soportada' };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), 8000);

  try {
    const res = await fetch(cfg.url, {
      method: 'GET',
      credentials: 'include',
      redirect: 'follow',
      signal: ctl.signal,
      headers: { 'cache-control': 'no-cache' }
    });
    clearTimeout(timer);

    if (res.status === 401 || res.status === 403) {
      return { estado: 'muerta', detalle: `HTTP ${res.status}` };
    }
    const urlFinal = res.url || '';
    if (cfg.loginHint.test(urlFinal)) {
      return { estado: 'muerta', detalle: 'Redirigido a login' };
    }
    if (!res.ok) {
      return { estado: 'muerta', detalle: `HTTP ${res.status}` };
    }

    let muestra = '';
    try {
      const reader = res.body && res.body.getReader ? res.body.getReader() : null;
      if (reader) {
        const decoder = new TextDecoder();
        let total = 0;
        while (total < 6144) {
          const { value, done } = await reader.read();
          if (done) break;
          muestra += decoder.decode(value, { stream: true });
          total += value.length;
        }
        try { reader.cancel(); } catch (e) {}
      } else {
        const t = await res.text();
        muestra = t.slice(0, 6144);
      }
    } catch (e) {}

    const lower = muestra.toLowerCase();
    if (/(login\s*required|sign\s*in\s*required|inicia\s*sesi[oó]n|please\s*sign\s*in|session\s*expired|sesi[oó]n\s*expirada)/i.test(lower)) {
      return { estado: 'muerta', detalle: 'Login requerido' };
    }

    return { estado: 'viva', detalle: 'Accesible' };
  } catch (e) {
    clearTimeout(timer);
    if (e.name === 'AbortError') return { estado: 'desconocido', detalle: 'Timeout' };
    return { estado: 'desconocido', detalle: e.message || 'Error de red' };
  }
}

function inyeccionTemprana() {
  if (window.__paInyectado) return;
  window.__paInyectado = true;
  window.__paTimersAcelerados = true;
  window.__paOpens = window.__paOpens || [];

  try {
    Object.defineProperty(window, 'blurred', {
      get() { return false; },
      set() {},
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

// ✅ si el usuario cierra la pestaña del proceso, abortar y volver al menú
chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId !== pestañaProceso) return;

  procesoAbortado = true;
  pestañaProceso = null;

  detenerProgresoTemporal();

  chrome.runtime.sendMessage({
    action: 'pestanaCerrada'
  }).catch(() => {});

  chrome.storage.local.remove('procesoEnCurso').catch(() => {});
});

function normalizarUrl(u) {
  let v = String(u || '').trim();
  for (let i = 0; i < 5; i++) {
    const m = v.match(/^(https?):\/\/https?:?\/\/?(.+)$/i);
    if (!m) break;
    v = m[1] + '://' + m[2];
  }
  return v;
}

async function obtenerUrlPestaña(tabId) {
  try { const t = await chrome.tabs.get(tabId); return t.url || ''; } catch (e) { return ''; }
}

async function repararUrlRota(tabId) {
  const url = await obtenerUrlPestaña(tabId);
  const limpia = normalizarUrl(url);
  if (limpia === url || !/^https?:\/\//i.test(limpia)) return false;
  try { await chrome.tabs.update(tabId, { url: normalizarUrl(limpia) }); } catch (e) {}
  await delay(3000);
  return true;
}

chrome.webNavigation.onErrorOccurred.addListener((detalles) => {
  if (detalles.tabId !== pestañaProceso || detalles.frameId !== 0) return;
  const limpia = normalizarUrl(detalles.url);
  if (limpia === detalles.url) return;
  chrome.tabs.update(detalles.tabId, { url: limpia }).catch(() => {});
});

function cargarDominios() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['dominiosExitosos', 'dominiosPendientes'], function(result) {
      if (result.dominiosExitosos) dominiosConocidos = result.dominiosExitosos;
      if (result.dominiosPendientes) dominiosPendientes = result.dominiosPendientes;
      resolve();
    });
  });
}

function guardarDominios() {
  chrome.storage.local.set({ dominiosExitosos: dominiosConocidos });
}

cargarDominios();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "procesarShortLink") {
    (async () => {
      const { procesoEnCurso } = await chrome.storage.local.get('procesoEnCurso');
      const enCurso = procesoEnCurso && (Date.now() - procesoEnCurso.timestamp < 8 * 60 * 1000);

      if (pestañaProceso !== null || enCurso) {
        sendResponse({ status: "ocupado" });
        return;
      }

      const shortLink = request.url;
      await chrome.storage.local.set({ procesoEnCurso: { url: shortLink, timestamp: Date.now() } });
      procesarEnlaceAcortado(shortLink);
      sendResponse({ status: "iniciado" });
    })();
    return true;
  }

  if (request.action === "estadoProceso") {
    (async () => {
      const { procesoEnCurso } = await chrome.storage.local.get('procesoEnCurso');
      const activo = procesoEnCurso && (Date.now() - procesoEnCurso.timestamp < 8 * 60 * 1000) && pestañaProceso !== null;
      sendResponse({
        activo,
        url: procesoEnCurso ? procesoEnCurso.url : null,
        timestamp: procesoEnCurso ? procesoEnCurso.timestamp : null
      });
    })();
    return true;
  }
});

async function crearPestañaSilenciosa(url) {
  const tab = await chrome.tabs.create({
    url: normalizarUrl(url),
    active: false,
    pinned: false,
    index: 999
  });

  pestañaProceso = tab.id;
  try { await chrome.tabs.update(tab.id, { muted: true }); } catch (e) {}
  try { await chrome.tabs.update(tab.id, { autoDiscardable: true }); } catch (e) {}

  return pestañaProceso;
}

async function cerrarPestañaProceso() {
  if (pestañaProceso) {
    const id = pestañaProceso;
    pestañaProceso = null; // ✅ primero, para que onRemoved no dispare pestanaCerrada
    try { await chrome.tabs.remove(id); } catch (e) {}
  }
}

function obtenerHost(url) {
  try { return new URL(url).hostname; } catch (e) { return ''; }
}

function esShortlinkConocido(host) {
  if (!host) return false;
  if (/^mtc\d*\./i.test(host)) return true;
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
  } catch (e) { return null; }
}

function detectarServicioDesdeTexto(texto) {
  const t = (texto || '').toLowerCase();
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
  return null;
}

// ============================================================
// EXTRACCIÓN DE ID con soporte Disney+ (largos)
// ============================================================
function extraerId(texto, servicio) {
  if (!texto) return null;

  if (servicio === 'disney' || /premium_id:disney/i.test(texto)) {
    const matchDisney = texto.match(/premium_id:disney:[^\r\n]+/i);
    if (matchDisney && matchDisney[0]) {
      return matchDisney[0].trim();
    }
  }

  const regexCualquier = /(premium_id:[a-zA-Z]+:[a-zA-Z0-9]{4,12}:[a-zA-Z0-9]{4,12}:[A-Za-z0-9+/=]{20,})/i;
  const m1 = texto.match(regexCualquier);
  if (m1) return m1[1];

  const regexSimple = /(premium_id:[^\s<"']+)/i;
  const m2 = texto.match(regexSimple);
  if (m2) return m2[1];

  return null;
}

const PASTE_TEXTO_404 = /(404|not\s*found|no\s*encontrad|go\s*back\s*to\s*the\s*home|page\s*not\s*found|paste\s*(not\s*found|deleted|removed|expired)|este\s*paste\s*no\s*existe|el\s*paste\s*ha\s*sido\s*eliminado|paste\s*does\s*not\s*exist)/i;
const PASTE_TEXTO_SESION_CERRADA = /(session\s*(closed|expired|invalid|ended)|sesi[oó]n\s*(cerrada|expirada|inv[aá]lida|finalizada)|account\s*(closed|disabled|suspended|banned)|cuenta\s*(cerrada|deshabilitada|suspendida|baneada)|token\s*(expired|invalid)|invalid\s*(session|token|cookie)|login\s*required|sign\s*in\s*required|inicia\s*sesi[oó]n|please\s*log\s*in|needs?\s*to\s*(log|sign)\s*in)/i;

async function clasificarPaste(url) {
  let rawUrl = url.trim().replace(/\/$/, '');
  if (!rawUrl.endsWith('/raw')) rawUrl = rawUrl + '/raw';

  let httpStatus = 0;
  let texto = '';

  try {
    const res = await fetch(rawUrl, { credentials: 'omit', redirect: 'follow' });
    httpStatus = res.status;
    if (res.ok) texto = await res.text();
  } catch (e) {}

  if (!texto) {
    try {
      const res2 = await fetch(url, { credentials: 'omit', redirect: 'follow' });
      httpStatus = res2.status;
      if (res2.ok) texto = await res2.text();
    } catch (e) {}
  }

  if (httpStatus === 404 || (httpStatus >= 400 && httpStatus < 500)) {
    return { estado: 'borrado', texto, servicio: null, id: null, httpStatus };
  }
  if (PASTE_TEXTO_404.test(texto) && !/premium_id:/i.test(texto)) {
    return { estado: 'borrado', texto, servicio: null, id: null, httpStatus };
  }
  if (!texto) {
    return { estado: 'error_red', texto, servicio: null, id: null, httpStatus };
  }

  const tienePremiumId = /premium_id:/i.test(texto);

  if (!tienePremiumId) {
    if (PASTE_TEXTO_SESION_CERRADA.test(texto)) {
      return { estado: 'sesion_cerrada', texto, servicio: null, id: null, httpStatus };
    }
    return { estado: 'sin_id', texto, servicio: null, id: null, httpStatus };
  }

  const servicio = detectarServicioDesdeTexto(texto);
  const id = extraerId(texto, servicio) || extraerId(texto, null);

  if (!id) {
    return { estado: 'sin_id', texto, servicio, id: null, httpStatus };
  }

  return { estado: 'ok', texto, servicio, id, httpStatus };
}

async function esperarYClasificarPaste(tabId, timeout = 30000) {
  const startTime = Date.now();
  let ultimaClasificacion = null;

  while (Date.now() - startTime < timeout) {
    if (procesoAbortado) {
      return ultimaClasificacion || { estado: 'error_red', id: null, servicio: null, httpStatus: 0 };
    }
    try {
      const listo = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const bodyText = document.body?.innerText || '';
          return (
            document.querySelector('.paste-pasties, .pasty, textarea') !== null ||
            bodyText.length > 200 ||
            document.querySelector('main')?.innerText?.length > 100 ||
            document.title.includes('paste') ||
            /not found|404|deleted/i.test(bodyText)
          );
        }
      });

      if (listo[0]?.result === true) {
        const url = await obtenerUrlActual(tabId);
        ultimaClasificacion = await clasificarPaste(url);
        if (['borrado', 'sesion_cerrada', 'ok', 'sin_id'].includes(ultimaClasificacion.estado)) {
          return ultimaClasificacion;
        }
      }
    } catch (e) {}
    await delay(1500);
  }

  return ultimaClasificacion || { estado: 'error_red', id: null, servicio: null, httpStatus: 0 };
}

function mensajeDeClasificacion(clasif, pasteUrl, verificacion) {
  const nombres = {
    netflix: 'Netflix', crunchyroll: 'Crunchyroll', prime: 'Prime Video',
    paramount: 'Paramount+', viki: 'Rakuten Viki', atresplayer: 'AtresPlayer',
    hbomax: 'HBO Max', appletv: 'Apple TV', hidive: 'HiDive', disney: 'Disney+',
    plus: 'Premium+'
  };
  const nombre = clasif.servicio ? (nombres[clasif.servicio] || clasif.servicio) : null;

  switch (clasif.estado) {
    case 'borrado':
    case 'sin_id':
      return {
        ok: false,
        codigo: clasif.estado === 'borrado' ? 'PASTE_BORRADO' : 'SIN_ID',
        titulo: 'NO EXISTE ID EN ESE PASTE',
        detalle: 'EL CREADOR BORRA LOS PASTES DE IDs QUE YA NO SIRVEN Y LOS CAMBIA POR NUEVOS QUE SIRVEN.',
        sugerencia: 'Si tienes dudas contacta con el creador @DANIPROPREMIUM (https://telegram.me/DANIPROPREMIUM).',
        servicio: clasif.servicio || null,
        id: null,
        pasteUrl,
        sesionEstado: null
      };
    case 'sesion_cerrada':
      return {
        ok: false, codigo: 'SESION_CERRADA',
        titulo: 'SESIÓN CERRADA',
        detalle: 'El paste existe pero la sesión fue cerrada, expiró o la cuenta fue deshabilitada.',
        sugerencia: 'Prueba con otro ID o pide una cuenta nueva.',
        servicio: null, id: null, pasteUrl, sesionEstado: 'muerta'
      };
    case 'error_red':
      return {
        ok: false, codigo: 'ERROR_RED',
        titulo: 'ERROR DE RED',
        detalle: 'No se pudo leer el paste.myst.rs (timeout o bloqueo).',
        sugerencia: 'Revisa tu conexión e intenta de nuevo.',
        servicio: null, id: null, pasteUrl, sesionEstado: null
      };
    case 'ok':
    default: {
      const sesionEstado = verificacion ? verificacion.estado : 'desconocido';

      if (sesionEstado === 'viva') {
        return {
          ok: true, codigo: 'OK_VIVA',
          titulo: nombre ? `SESIÓN VIVA — ${nombre}` : 'SESIÓN VIVA',
          detalle: nombre ? `Sesión verificada y activa para ${nombre}. ID extraído.` : 'Sesión verificada y activa. ID extraído.',
          sugerencia: 'Dirígete a PREMIUM ID para restaurar la sesión.',
          servicio: clasif.servicio || null,
          id: clasif.id,
          pasteUrl,
          sesionEstado
        };
      }

      return {
        ok: true,
        codigo: 'OK_EXTRAIDO',
        titulo: nombre ? `ID EXTRAÍDO — ${nombre}` : 'ID EXTRAÍDO',
        detalle: nombre
          ? `ID extraído para ${nombre}. La verificación de sesión no es concluyente.`
          : 'ID extraído. Verificación de sesión no concluyente.',
        sugerencia: 'Dirígete a PREMIUM ID para probar la sesión.',
        servicio: clasif.servicio || null,
        id: clasif.id,
        pasteUrl,
        sesionEstado
      };
    }
  }
}

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

async function procesarPaginaGate(tabId) {
  if (procesoAbortado) return false;
  const escondido = await extraerEnlaceFinalEscondido(tabId);
  if (escondido) {
    try { await chrome.tabs.update(tabId, { url: normalizarUrl(escondido) }); } catch (e) {}
    await delay(3000);
    return true;
  }
  await delay(500);
  const pasos = await ejecutarEnPagina(tabId, () => {
    return document.querySelectorAll(
      '[id^="btn-s"], .step button, .step a.btn, [class*="step"] > button'
    ).length;
  }, 0);
  for (let i = 0; i < Math.min(pasos, 8); i++) {
    if (procesoAbortado) return false;
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
    await esperarFinDePaso(tabId, 30000);
  }
  const url = await clickBotonFinalGate(tabId, 20000);
  if (url) {
    try {
      const urlActual = await obtenerUrlActual(tabId);
      const destino = new URL(url, urlActual).href;
      await chrome.tabs.update(tabId, { url: normalizarUrl(destino) });
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

async function esperarFinDePaso(tabId, timeout = 30000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeout) {
    if (procesoAbortado) return false;
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
    if (procesoAbortado) return null;
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
  if (procesoAbortado) return;
  await esperarYHacerClic(tabId, '#wpsafelinkhuman', 'verificación humana', 20000);
  await delay(1500);
  const generado = await esperarYHacerClic(tabId, 'a[onclick="wpsafegenerate()"]', 'generar enlace', 45000);
  if (generado) await delay(3000);
  const continuo = await esperarYHacerClicDownload(tabId, 'continuar', 15000);
  if (!continuo) {
    const oculto = await extraerDestinoWpSafelink(tabId);
    if (oculto) {
      try { await chrome.tabs.update(tabId, { url: normalizarUrl(oculto) }); } catch (e) {}
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
  if (procesoAbortado) return false;
  await intentarClicVerificacionHumana(tabId);
  await delay(1000);
  const href = await esperarHrefGetLink(tabId, 45000);
  if (href) {
    try {
      const urlActual = await obtenerUrlActual(tabId);
      const nuevaUrl = new URL(href, urlActual).href;
      await chrome.tabs.update(tabId, { url: normalizarUrl(nuevaUrl) });
    } catch (e) {}
    await delay(3000);
    return true;
  }
  await intentarClicConTimeout(tabId, '.btn-success.get-link, #waiting-btn, a.get-link', 2000);
  await delay(2000);
  return false;
}

async function esperarHrefGetLink(tabId, timeout = 30000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (procesoAbortado) return null;
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
    if (procesoAbortado) return false;
    const esTooEarly = await detectarTooEarly(tabId);
    if (!esTooEarly) return true;
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
    if (procesoAbortado) return false;
    try {
      const resultado = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (selector) => {
          const elemento = document.querySelector(selector);
          if (elemento) { elemento.click(); return true; }
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
    if (procesoAbortado) return false;
    if (await elementoVisible(tabId, selector)) {
      await delay(800);
      if (await clickElemento(tabId, selector)) return true;
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
    if (procesoAbortado) return false;
    if (await buscarVisible()) {
      await delay(800);
      if (await clickearSiVisible()) {
        const limiteVerificacion = Date.now() + 4000;
        while (Date.now() < limiteVerificacion) {
          if (procesoAbortado) return false;
          await delay(500);
          const urlAhora = await obtenerUrlActual(tabId);
          if (urlAhora && urlAhora !== urlInicial) return true;
        }
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

function iniciarProgresoTemporal() {
  inicioProgreso = Date.now();
  if (intervaloProgreso) clearInterval(intervaloProgreso);
  intervaloProgreso = setInterval(() => {
    const elapsed = Date.now() - inicioProgreso;
    let progreso = Math.min(95, (elapsed / DURACION_ESTIMADA) * 100);
    progreso = Math.round(progreso * 10) / 10;
    enviarProgreso(progreso);
  }, 500);
}

function detenerProgresoTemporal() {
  if (intervaloProgreso) {
    clearInterval(intervaloProgreso);
    intervaloProgreso = null;
  }
}

function enviarProgreso(porcentaje) {
  porcentaje = Math.min(100, Math.max(0, porcentaje));
  chrome.runtime.sendMessage({
    action: "actualizarProgreso",
    porcentaje: porcentaje,
    mensaje: null
  }).catch(() => {});
}

// ============================================================
// ✅ FUNCIÓN PRINCIPAL v13.7
// ============================================================
async function procesarEnlaceAcortado(shortLink) {
  let tabId = null;
  try {
    procesoAbortado = false;
    iniciarProgresoTemporal();
    enviarProgreso(0);

    const esUrlPasteDirecto = shortLink.includes(PASTE_DOMINIO);

    let urlInicio = shortLink;
    if (!esShortlinkConocido(obtenerHost(shortLink)) && !esUrlPasteDirecto) {
      const directo = await resolverGateDirecto(shortLink);
      if (directo) urlInicio = directo;
    }

    tabId = await crearPestañaSilenciosa(urlInicio);

    await delay(esUrlPasteDirecto ? 2000 : 5000);

    procesosActivos[tabId] = { etapa: 'iniciando', shortLink: shortLink, tabId: tabId };
    const MAX_INTENTOS = esUrlPasteDirecto ? 10 : 40;
    let llegoAlFinal = false;
    let intentosGate = 0;
    let saltosFinales = 0;
    let idExtraido = null;
    let mensajeError = null;

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      if (procesoAbortado) {
        detenerProgresoTemporal();
        delete procesosActivos[tabId];
        pestañaProceso = null;
        await chrome.storage.local.remove('procesoEnCurso');
        return;
      }

      const urlActual = await obtenerUrlActual(tabId);

      if (urlActual.includes(PASTE_DOMINIO)) {
        const clasif = await esperarYClasificarPaste(tabId, 15000);

        if (procesoAbortado) {
          detenerProgresoTemporal();
          delete procesosActivos[tabId];
          pestañaProceso = null;
          await chrome.storage.local.remove('procesoEnCurso');
          return;
        }

        let verificacion = null;
        if (clasif.estado === 'ok' && clasif.servicio) {
          enviarProgreso(90);
          verificacion = await verificarSesionViva(clasif.servicio);
        }

        const msg = mensajeDeClasificacion(clasif, urlActual, verificacion);

        if (msg.ok) {
          idExtraido = msg.id;
          await chrome.storage.local.set({
            ultimoIdExtraido: idExtraido,
            extraccionExitosa: {
              id: idExtraido,
              servicio: msg.servicio,
              sesionEstado: msg.sesionEstado,
              timestamp: Date.now()
            }
          });

          try {
            const { historialIds } = await chrome.storage.local.get('historialIds');
            const hist = Array.isArray(historialIds) ? historialIds : [];
            hist.unshift({
              id: idExtraido,
              servicio: msg.servicio || null,
              timestamp: Date.now()
            });
            // ✅ 10 últimas extracciones
            const histFinal = hist.slice(0, 10);
            await chrome.storage.local.set({ historialIds: histFinal });
          } catch (e) {}
        } else {
          await chrome.storage.local.set({
            errorPendiente: {
              codigo: msg.codigo,
              titulo: msg.titulo,
              detalle: msg.detalle,
              sugerencia: msg.sugerencia,
              servicio: msg.servicio,
              timestamp: Date.now()
            }
          });
        }

        chrome.runtime.sendMessage({
          action: msg.ok ? 'idExtraido' : 'errorProcesamiento',
          id: msg.id || null,
          codigo: msg.codigo,
          titulo: msg.titulo,
          detalle: msg.detalle,
          sugerencia: msg.sugerencia || '',
          servicio: msg.servicio || null,
          sesionEstado: msg.sesionEstado || null,
          pasteUrl: msg.pasteUrl || null
        }).catch(() => {});

        detenerProgresoTemporal();

        setTimeout(async () => {
          pestañaProceso = null;
          try { await chrome.tabs.remove(tabId); } catch (e) {}
        }, msg.ok ? 800 : 1200);

        if (msg.ok) {
          enviarProgreso(100);
          llegoAlFinal = true;
          break;
        } else {
          mensajeError = msg;
          break;
        }
      }

      if (await repararUrlRota(tabId)) continue;
      await verificarYNotificarDominio(tabId);
      const tipo = await detectarTipoPagina(tabId);

      if (procesoAbortado) {
        detenerProgresoTemporal();
        delete procesosActivos[tabId];
        pestañaProceso = null;
        await chrome.storage.local.remove('procesoEnCurso');
        return;
      }

      if (tipo === 'too_early') {
        const superado = await manejarTooEarly(tabId);
        if (!superado) { mensajeError = { titulo: 'BLOQUEO', detalle: 'Too Early bloqueó el acceso' }; break; }
        await delay(2000);
        continue;
      }
      if (tipo === 'landing') { await delay(2000); continue; }
      if (tipo === 'gate') {
        const urlAntes = urlActual;
        await procesarPaginaGate(tabId);
        const urlDespues = await obtenerUrlActual(tabId);
        if (urlDespues && urlDespues !== urlAntes) intentosGate = 0;
        else {
          intentosGate++;
          if (intentosGate > 3) { mensajeError = { titulo: 'BLOQUEO', detalle: 'No se pudo pasar la página de pasos' }; break; }
        }
        continue;
      }
      if (tipo === 'wpsafelink') { await procesarRondaWpSafelink(tabId); continue; }
      if (tipo === 'adlinkfly') { await procesarPaginaAdlinkfly(tabId); continue; }
      if (tipo === 'final') {
        await delay(1500);
        const tipoConfirmacion = await detectarTipoPagina(tabId);
        if (tipoConfirmacion === 'final') {
          const urlConfirmada = await obtenerUrlActual(tabId);
          if (urlConfirmada.includes(PASTE_DOMINIO)) continue;
          if (saltosFinales < 2) {
            const destino = await extraerDestinoDePagina(tabId);
            if (destino) {
              saltosFinales++;
              try { await chrome.tabs.update(tabId, { url: normalizarUrl(destino) }); } catch (e) {}
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

    if (!llegoAlFinal && !idExtraido && !mensajeError) {
      mensajeError = { titulo: 'NO SE PUDO EXTRAER', detalle: 'No se pudo llegar a paste.myst.rs o extraer el ID.' };
    }

    if (mensajeError) {
      detenerProgresoTemporal();
      setTimeout(async () => {
        pestañaProceso = null;
        try { await chrome.tabs.remove(tabId); } catch (e) {}
      }, 800);
    }

    delete procesosActivos[tabId];
    pestañaProceso = null;
    guardarDominios();
    await chrome.storage.local.remove('procesoEnCurso');

  } catch (error) {
    if (procesoAbortado) {
      detenerProgresoTemporal();
      delete procesosActivos[tabId];
      pestañaProceso = null;
      await chrome.storage.local.remove('procesoEnCurso').catch(() => {});
      procesoAbortado = false;
      return;
    }

    await chrome.storage.local.set({
      errorPendiente: { mensaje: error.message, timestamp: Date.now() }
    });
    chrome.runtime.sendMessage({
      action: "errorProcesamiento",
      codigo: 'ERROR_GENERAL',
      titulo: 'ERROR',
      detalle: error.message,
      sugerencia: ''
    }).catch(() => {});
    detenerProgresoTemporal();
    setTimeout(async () => {
      pestañaProceso = null;
      try { if (tabId) await chrome.tabs.remove(tabId); } catch (e) {}
    }, 800);
    delete procesosActivos[tabId];
    await chrome.storage.local.remove('procesoEnCurso');
  }
}

async function verificarYNotificarDominio(tabId) {
  try {
    const urlActual = await obtenerUrlActual(tabId);
    const dominioActual = obtenerHost(urlActual);
    if (!dominioActual) return true;
    if (!esDominioConocido(dominioActual)) {
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