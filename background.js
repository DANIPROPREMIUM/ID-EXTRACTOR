// ============================================================
// ID EXTRACTOR v16.1 — Background
// - Detección GENÉRICA de reward dialog (cualquier prefijo)
// - NO depende de hoftm/wrfpv/prdij/yuqdh/tisyl/nrxua/kavoy
// - Limpia procesoEnCurso al arrancar/instalar
// - Verifica pestaña existe antes de "ocupado"
// ============================================================

(function silenciarConsola() {
  try { console.log = function () {}; console.warn = function () {}; console.error = function () {}; } catch (e) {}
})();

let dominiosConocidos = {
  primeraRonda: 'mtc1.indiapharmajobs.in',
  segundaRonda: 'mtc1.whatsstatusvideo.com',
  shortlinks: 'shortxlinks.in'
};

const DOMINIOS_BASE = ['softurl.in', 'xl.gl'];
const PASTE_DOMINIO = 'paste.myst.rs';

const PISTAS_DESTINO = /(shortxlinks|softurl|nclsil|livetechnewz|indiapharmajobs|whatsstatusvideo|questain|safelink|shrinkme|shrinklink|gplinks|droplink|exe\.io|ouo\.io|adf\.ly|clk\.sh|linkvertise|xl\.gl|mediafire\.com|mega\.nz|drive\.google\.com|docs\.google\.com|pixeldrain\.(com|net)|workupload\.com|1fichier\.com|gofile\.io|sfl\.gl|terabox\.com)/i;
const DOMINIOS_ANUNCIO = /(temu\.|aliexpress|gamsgo|monetag|spinnyspinwheel|t\.co\/|shopee|amazon\.|bit\.ly|adsterra|propellerads|hilltopads|doubleclick|googlesyndication|googletagmanager|google-analytics|facebook\.|twitter\.|blogger\.com|blogspot\.com|gstatic|googleapis|schema\.org|w3\.org|youtube\.|telegram\.|t\.me|lkz\.ai|lkz\.)/i;
const CLAVES_DESTINO = /(mediafire|final|download|descarga|apk|mega|drive|destino|target|real|unlock|link_?url|url_?link)/i;

let dominiosPendientes = [];
let procesosActivos = {};
let pestañaProceso = null;
let intervaloProgreso = null;
let alarmaKeepAlive = null;
let inicioProgreso = 0;
const DURACION_ESTIMADA = 90000;

let procesoAbortado = false;

async function xlLog(tabId, msg) {
  try {
    const url = tabId ? await obtenerUrlActual(tabId) : '';
    const { debugXlGl } = await chrome.storage.local.get('debugXlGl');
    const arr = Array.isArray(debugXlGl) ? debugXlGl : [];
    arr.push({ t: Date.now(), tabId, url, msg: String(msg) });
    await chrome.storage.local.set({ debugXlGl: arr.slice(-250) });
  } catch (e) {}
}

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
    const res = await fetch(cfg.url, { method: 'GET', credentials: 'include', redirect: 'follow', signal: ctl.signal, headers: { 'cache-control': 'no-cache' } });
    clearTimeout(timer);
    if (res.status === 401 || res.status === 403) return { estado: 'muerta', detalle: `HTTP ${res.status}` };
    const urlFinal = res.url || '';
    if (cfg.loginHint.test(urlFinal)) return { estado: 'muerta', detalle: 'Redirigido a login' };
    if (!res.ok) return { estado: 'muerta', detalle: `HTTP ${res.status}` };
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
      } else { muestra = (await res.text()).slice(0, 6144); }
    } catch (e) {}
    if (/(login\s*required|sign\s*in\s*required|inicia\s*sesi[oó]n|please\s*sign\s*in|session\s*expired|sesi[oó]n\s*expirada)/i.test(muestra)) return { estado: 'muerta', detalle: 'Login requerido' };
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

  try { Object.defineProperty(window, 'blurred', { get() { return false; }, set() {}, configurable: true }); } catch (e) {}
  try { Object.defineProperty(document, 'hasFocus', { get() { return () => true; }, configurable: true }); } catch (e) {}
  try {
    Object.defineProperty(document, 'visibilityState', { get() { return 'visible'; }, configurable: true });
    Object.defineProperty(document, 'hidden', { get() { return false; }, configurable: true });
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
    closed: false, focus() {}, blur() {}, close() {}, print() {},
    postMessage() {}, moveTo() {}, resizeTo() {},
    document: { write() {}, writeln() {}, close() {} },
    location: { href: '', replace() {}, assign() {} }
  };
  const _open = window.open.bind(window);
  window.open = function(url, target, features) {
    let u = ''; try { u = url ? String(url) : ''; } catch (e) {}
    const tgt = target ? String(target) : '';
    try { if (u) window.__paOpens.push({ url: u, target: tgt, t: Date.now() }); } catch (e) {}
    if (!tgt || tgt === '_self' || tgt === '_top' || tgt === '_parent') {
      if (u) { try { window.location.href = u; } catch (e) { try { _open(url, target, features); } catch (e2) {} } }
      return window;
    }
    return ventanaFalsa;
  };
}

chrome.webNavigation.onCommitted.addListener((details) => {
  if (details.tabId !== pestañaProceso) return;
  chrome.scripting.executeScript({ target: { tabId: details.tabId, frameIds: [details.frameId] }, world: 'MAIN', injectImmediately: true, func: inyeccionTemprana }).catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => {
  if (tabId !== pestañaProceso) return;
  xlLog(null, `onRemoved: pestaña proceso ${tabId} cerrada`);
  procesoAbortado = true;
  pestañaProceso = null;
  detenerProgresoTemporal();
  actualizarBadge('', '#888888');
  chrome.runtime.sendMessage({ action: 'pestanaCerrada' }).catch(() => {});
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
function guardarDominios() { chrome.storage.local.set({ dominiosExitosos: dominiosConocidos }); }
cargarDominios();

chrome.runtime.onStartup.addListener(() => {
  chrome.storage.local.remove('procesoEnCurso').catch(() => {});
  pestañaProceso = null;
});
chrome.runtime.onInstalled.addListener(() => {
  chrome.storage.local.remove('procesoEnCurso').catch(() => {});
  pestañaProceso = null;
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "procesarShortLink") {
    (async () => {
      const { procesoEnCurso } = await chrome.storage.local.get('procesoEnCurso');
      const enCurso = procesoEnCurso && (Date.now() - procesoEnCurso.timestamp < 8 * 60 * 1000);

      let bloqueado = false;

      if (pestañaProceso !== null) {
        bloqueado = true;
      } else if (enCurso) {
        if (procesoEnCurso.tabId) {
          try {
            const tab = await chrome.tabs.get(procesoEnCurso.tabId);
            if (tab) {
              pestañaProceso = procesoEnCurso.tabId;
              bloqueado = true;
            } else {
              await chrome.storage.local.remove('procesoEnCurso');
              bloqueado = false;
            }
          } catch (e) {
            await chrome.storage.local.remove('procesoEnCurso');
            bloqueado = false;
          }
        } else {
          const edad = Date.now() - procesoEnCurso.timestamp;
          if (edad > 60000) {
            await chrome.storage.local.remove('procesoEnCurso');
            bloqueado = false;
          } else {
            bloqueado = true;
          }
        }
      }

      if (bloqueado) { sendResponse({ status: "ocupado" }); return; }

      const shortLink = request.url;
      await chrome.storage.local.set({ procesoEnCurso: { url: shortLink, timestamp: Date.now(), tabId: null } });
      procesarEnlaceAcortado(shortLink);
      sendResponse({ status: "iniciado" });
    })();
    return true;
  }

  if (request.action === "estadoProceso") {
    (async () => {
      const { procesoEnCurso } = await chrome.storage.local.get('procesoEnCurso');
      const activo = procesoEnCurso && (Date.now() - procesoEnCurso.timestamp < 8 * 60 * 1000) && pestañaProceso !== null;
      sendResponse({ activo, url: procesoEnCurso ? procesoEnCurso.url : null, timestamp: procesoEnCurso ? procesoEnCurso.timestamp : null });
    })();
    return true;
  }

  if (request.action === "abortarProceso") {
    (async () => {
      procesoAbortado = true;
      if (pestañaProceso) {
        const id = pestañaProceso;
        pestañaProceso = null;
        try { await chrome.tabs.remove(id); } catch (e) {}
      }
      detenerProgresoTemporal();
      actualizarBadge('', '#888888');
      await chrome.storage.local.remove('procesoEnCurso').catch(() => {});
      sendResponse({ ok: true });
    })();
    return true;
  }
});

async function crearPestañaSilenciosa(url) {
  const urlNorm = normalizarUrl(url);
  await xlLog(null, `crearPestañaSilenciosa inicio url="${url}" urlNorm="${urlNorm}"`);
  if (!urlNorm || !/^https?:\/\//i.test(urlNorm)) {
    await xlLog(null, `crearPestañaSilenciosa ERROR: URL invalida "${urlNorm}"`);
    throw new Error('URL invalida: ' + urlNorm);
  }
  try {
    const tab = await chrome.tabs.create({ url: urlNorm, active: false, pinned: false, index: 999 });
    pestañaProceso = tab.id;
    await xlLog(tab.id, `crearPestañaSilenciosa OK tabId=${tab.id} url="${urlNorm}"`);
    try { await chrome.tabs.update(tab.id, { muted: true }); } catch (e) {}
    try { await chrome.tabs.update(tab.id, { autoDiscardable: false }); } catch (e) {}
    try {
      const { procesoEnCurso } = await chrome.storage.local.get('procesoEnCurso');
      if (procesoEnCurso) {
        procesoEnCurso.tabId = tab.id;
        await chrome.storage.local.set({ procesoEnCurso });
      }
    } catch (e) {}
    return pestañaProceso;
  } catch (e) {
    await xlLog(null, `crearPestañaSilenciosa ERROR: ${e.message}`);
    throw e;
  }
}

async function cerrarPestañaProceso() {
  if (pestañaProceso) {
    const id = pestañaProceso;
    pestañaProceso = null;
    try { await chrome.tabs.remove(id); } catch (e) {}
  }
}

function obtenerHost(url) { try { return new URL(url).hostname; } catch (e) { return ''; } }

function esShortlinkConocido(host) {
  if (!host) return false;
  if (/^mtc\d*\./i.test(host)) return true;
  const lista = [dominiosConocidos.primeraRonda, dominiosConocidos.segundaRonda, dominiosConocidos.shortlinks, ...DOMINIOS_BASE].filter(Boolean);
  return lista.some(d => host.includes(d) || d.includes(host));
}

function esDominioConocido(host) {
  if (!host) return false;
  const conocidos = [dominiosConocidos.primeraRonda, dominiosConocidos.segundaRonda, dominiosConocidos.shortlinks, ...DOMINIOS_BASE, ...dominiosPendientes].filter(Boolean);
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
    return extraerDestinoDeHtml(await resp.text(), url);
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

function extraerId(texto, servicio) {
  if (!texto) return null;
  if (servicio === 'disney' || /premium_id:disney/i.test(texto)) {
    const matchDisney = texto.match(/premium_id:disney:[^\r\n]+/i);
    if (matchDisney && matchDisney[0]) return matchDisney[0].trim();
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
  if (httpStatus === 404 || (httpStatus >= 400 && httpStatus < 500)) return { estado: 'borrado', texto, servicio: null, id: null, httpStatus };
  if (PASTE_TEXTO_404.test(texto) && !/premium_id:/i.test(texto)) return { estado: 'borrado', texto, servicio: null, id: null, httpStatus };
  if (!texto) return { estado: 'error_red', texto, servicio: null, id: null, httpStatus };
  const tienePremiumId = /premium_id:/i.test(texto);
  if (!tienePremiumId) {
    if (PASTE_TEXTO_SESION_CERRADA.test(texto)) return { estado: 'sesion_cerrada', texto, servicio: null, id: null, httpStatus };
    return { estado: 'sin_id', texto, servicio: null, id: null, httpStatus };
  }
  const servicio = detectarServicioDesdeTexto(texto);
  const id = extraerId(texto, servicio) || extraerId(texto, null);
  if (!id) return { estado: 'sin_id', texto, servicio, id: null, httpStatus };
  return { estado: 'ok', texto, servicio, id, httpStatus };
}

async function esperarYClasificarPaste(tabId, timeout = 30000) {
  const startTime = Date.now();
  let ultimaClasificacion = null;
  while (Date.now() - startTime < timeout) {
    if (procesoAbortado) return ultimaClasificacion || { estado: 'error_red', id: null, servicio: null, httpStatus: 0 };
    try {
      const listo = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const bodyText = document.body?.innerText || '';
          return (document.querySelector('.paste-pasties, .pasty, textarea') !== null || bodyText.length > 200 || document.querySelector('main')?.innerText?.length > 100 || document.title.includes('paste') || /not found|404|deleted/i.test(bodyText));
        }
      });
      if (listo[0]?.result === true) {
        const url = await obtenerUrlActual(tabId);
        ultimaClasificacion = await clasificarPaste(url);
        if (['borrado', 'sesion_cerrada', 'ok', 'sin_id'].includes(ultimaClasificacion.estado)) return ultimaClasificacion;
      }
    } catch (e) {}
    await delay(1500);
  }
  return ultimaClasificacion || { estado: 'error_red', id: null, servicio: null, httpStatus: 0 };
}

function mensajeDeClasificacion(clasif, pasteUrl, verificacion) {
  const nombres = { netflix: 'Netflix', crunchyroll: 'Crunchyroll', prime: 'Prime Video', paramount: 'Paramount+', viki: 'Rakuten Viki', atresplayer: 'AtresPlayer', hbomax: 'HBO Max', appletv: 'Apple TV', hidive: 'HiDive', disney: 'Disney+', plus: 'Premium+' };
  const nombre = clasif.servicio ? (nombres[clasif.servicio] || clasif.servicio) : null;
  switch (clasif.estado) {
    case 'borrado':
    case 'sin_id':
      return { ok: false, codigo: clasif.estado === 'borrado' ? 'PASTE_BORRADO' : 'SIN_ID', titulo: 'NO EXISTE ID EN ESE PASTE', detalle: 'EL CREADOR BORRA LOS PASTES DE IDs QUE YA NO SIRVEN Y LOS CAMBIA POR NUEVOS QUE SIRVEN.', sugerencia: 'Si tienes dudas contacta con el creador @DANIPROPREMIUM (https://telegram.me/DANIPROPREMIUM).', servicio: clasif.servicio || null, id: null, pasteUrl, sesionEstado: null };
    case 'sesion_cerrada':
      return { ok: false, codigo: 'SESION_CERRADA', titulo: 'SESIÓN CERRADA', detalle: 'El paste existe pero la sesión fue cerrada, expiró o la cuenta fue deshabilitada.', sugerencia: 'Prueba con otro ID o pide una cuenta nueva.', servicio: null, id: null, pasteUrl, sesionEstado: 'muerta' };
    case 'error_red':
      return { ok: false, codigo: 'ERROR_RED', titulo: 'ERROR DE RED', detalle: 'No se pudo leer el paste.myst.rs (timeout o bloqueo).', sugerencia: 'Revisa tu conexión e intenta de nuevo.', servicio: null, id: null, pasteUrl, sesionEstado: null };
    case 'ok':
    default: {
      const sesionEstado = verificacion ? verificacion.estado : 'desconocido';
      if (sesionEstado === 'viva') return { ok: true, codigo: 'OK_VIVA', titulo: nombre ? `SESIÓN VIVA — ${nombre}` : 'SESIÓN VIVA', detalle: nombre ? `Sesión verificada y activa para ${nombre}. ID extraído.` : 'Sesión verificada y activa. ID extraído.', sugerencia: 'Dirígete a PREMIUM ID para restaurar la sesión.', servicio: clasif.servicio || null, id: clasif.id, pasteUrl, sesionEstado };
      return { ok: true, codigo: 'OK_EXTRAIDO', titulo: nombre ? `ID EXTRAÍDO — ${nombre}` : 'ID EXTRAÍDO', detalle: nombre ? `ID extraído para ${nombre}. La verificación de sesión no es concluyente.` : 'ID extraído. Verificación de sesión no concluyente.', sugerencia: 'Dirígete a PREMIUM ID para probar la sesión.', servicio: clasif.servicio || null, id: clasif.id, pasteUrl, sesionEstado };
    }
  }
}

async function detectarTipoPagina(tabId) {
  try {
    const resultado = await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        const host = location.hostname || '';
        const bodyClass = (document.body && document.body.className) || '';
        const bodyText = (document.body && document.body.innerText) || '';

        if (/this page is supported by ads/i.test(document.title) ||
            /this page is supported by ads/i.test(bodyText) ||
            /content blocker/i.test(bodyText) ||
            /bloqueador de anuncios/i.test(bodyText) ||
            /pause it, then continue/i.test(bodyText) ||
            /desactiva.*bloqueador/i.test(bodyText)) {
          return 'adblock';
        }

        // ✅ Detección genérica: cualquier página con data-*-step o form data-*-form
        if (/(^|\.)xl\.gl$/i.test(host) ||
            /-page(\s|$)/i.test(bodyClass) && document.querySelector('[data-hoftm-step], [data-wrfpv-step], [data-prdij-step], [data-yuqdh-step], [data-tisyl-step], [data-nrxua-step], [data-kavoy-step]') ||
            document.querySelector('.cf-turnstile') ||
            document.getElementById('_mcl') ||
            document.querySelector('form[data-hoftm-form], form[data-wrfpv-form], form[data-prdij-form], form[data-yuqdh-form], form[data-tisyl-form], form[data-nrxua-form], form[data-kavoy-form]')) {
          return 'xlgl';
        }

        if (document.getElementById('wpsafelinkhuman') || document.getElementById('wpsafe-generate') || document.getElementById('wpsafe-link') || document.getElementById('wpsafelink-landing')) return 'wpsafelink';
        if (document.getElementById('go-link') || document.getElementById('waiting-btn') || document.querySelector('.get-link')) return 'adlinkfly';
        const h1 = document.querySelector('h1');
        if (h1 && h1.innerText && h1.innerText.includes('Too Early')) return 'too_early';
        const botonesPaso = document.querySelectorAll('[id^="btn-s"], .step button, .step a.btn, [class*="step"] > button');
        const botonFinal = document.querySelector('#btn-download, #final-link button, #final-link a, [id*="final"] button');
        if (botonesPaso.length >= 2 && botonFinal) return 'gate';
        const hayContador = document.querySelector('[id*="countdown" i], [class*="countdown" i], [id*="timer" i], [class*="timer" i]');
        if (hayContador) {
          const PISTA = /final|get-?link|continue|continuar|download|descarga|destino|unlock/i;
          for (const a of document.querySelectorAll('a[href^="http"]')) {
            const seña = (a.id || '') + ' ' + (a.className || '');
            if (!PISTA.test(seña)) continue;
            const estilo = window.getComputedStyle(a);
            const oculto = estilo.display === 'none' || estilo.visibility === 'hidden' || a.offsetParent === null;
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
  } catch (e) { return 'desconocido'; }
}

async function esperarNavegacion(tabId, urlAntes, timeout = 15000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeout) {
    if (procesoAbortado) return false;
    const urlAhora = await obtenerUrlActual(tabId);
    if (urlAhora && urlAhora !== urlAntes) return true;
    await delay(500);
  }
  return false;
}

// ============================================================
// INSPECCIÓN GENÉRICA (cualquier prefijo xl.gl)
// ============================================================
async function xlGlInspeccionar(tabId) {
  return ejecutarEnPagina(tabId, () => {
    function esAvanzar(txt) {
      const t = (txt || '').trim().toLowerCase();
      const exactos = ['continue', 'continuar', 'get link', 'getlink', 'obtener enlace', 'obtener link', 'ver enlace', 'ir al enlace', 'go', 'go to link', 'proceed', 'proceder', 'next', 'siguiente', 'unlock', 'destino'];
      if (exactos.includes(t)) return true;
      if (t.length > 40) return false;
      if (/^get\s*link/i.test(t)) return true;
      if (/^continue/i.test(t)) return true;
      if (/^obtener\s*enlace/i.test(t)) return true;
      if (/^ver\s*enlace/i.test(t)) return true;
      return false;
    }
    function esStart(txt) {
      const t = (txt || '').trim().toLowerCase();
      return /start\s*timer/i.test(t) || /iniciar\s*temporizador/i.test(t) || /^start$/i.test(t) || /empezar/i.test(t);
    }
    function estaHabilitado(el) {
      if (!el) return false;
      if (el.disabled) return false;
      if (el.classList.contains('is-idle') || el.classList.contains('is-paused')) return false;
      const estilo = window.getComputedStyle(el);
      if (estilo.display === 'none' || estilo.visibility === 'hidden') return false;
      return true;
    }
    function buscarBoton(pred) {
      for (const b of document.querySelectorAll('button')) if (pred(b.textContent)) return b;
      for (const f of document.querySelectorAll('form')) {
        const b = f.querySelector('button[type="submit"]');
        if (b && pred(b.textContent)) return b;
      }
      for (const b of document.querySelectorAll('input[type="submit"]')) if (pred(b.value)) return b;
      return null;
    }

    // ✅ GENÉRICO: cualquier dialog[open] con botón dentro → reward dialog
    function buscarRewardDialogGenerico() {
      const dialogs = document.querySelectorAll('dialog[open]');
      for (const d of dialogs) {
        const btn = d.querySelector('button[type="submit"], button');
        if (btn) return d;
      }
      // También cualquier elemento con data-*-reward[open]
      const el = document.querySelector('[data-hoftm-reward][open], [data-wrfpv-reward][open], [data-prdij-reward][open], [data-yuqdh-reward][open], [data-tisyl-reward][open], [data-nrxua-reward][open], [data-kavoy-reward][open]');
      if (el) return el;
      return null;
    }
    function buscarAdOverlay() {
      const el = document.getElementById('ad_position_box');
      if (!el) return false;
      const estilo = window.getComputedStyle(el);
      return estilo.display !== 'none' && estilo.visibility !== 'hidden';
    }

    const tieneAdOverlay = buscarAdOverlay();
    const dialogReward = buscarRewardDialogGenerico();
    const btnAdvance = buscarBoton(esAvanzar);
    const btnStart = buscarBoton(esStart);
    const turnstileResp = document.querySelector('input[name="cf-turnstile-response"]');
    const turnstileOk = turnstileResp ? !!turnstileResp.value : false;
    const tieneTurnstile = !!document.querySelector('.cf-turnstile') || !!turnstileResp;

    let fase = 'otra';
    if (dialogReward) fase = 'reward_dialog';
    else if (tieneAdOverlay) fase = 'ad_overlay';
    else if (btnStart) fase = 'start_timer';
    else if (btnAdvance) fase = 'advance';
    else if (tieneTurnstile) fase = 'wait_turnstile';

    return {
      fase, tieneTurnstile, turnstileOk,
      tieneAdOverlay,
      tieneDialog: !!dialogReward,
      tieneAdvance: !!btnAdvance,
      advanceHabilitado: estaHabilitado(btnAdvance),
      advanceTexto: btnAdvance ? (btnAdvance.textContent || '').trim().substring(0, 30) : '',
      tieneStart: !!btnStart,
      startHabilitado: estaHabilitado(btnStart),
      bodyClass: ((document.body && document.body.className) || '').substring(0, 100)
    };
  }, { fase: 'otra' });
}

async function xlGlClickAdvance(tabId) {
  return ejecutarEnPagina(tabId, () => {
    function esAvanzar(txt) {
      const t = (txt || '').trim().toLowerCase();
      const exactos = ['continue', 'continuar', 'get link', 'getlink', 'obtener enlace', 'obtener link', 'ver enlace', 'ir al enlace', 'go', 'go to link', 'proceed', 'proceder', 'next', 'siguiente', 'unlock', 'destino'];
      if (exactos.includes(t)) return true;
      if (t.length > 40) return false;
      if (/^get\s*link/i.test(t)) return true;
      if (/^continue/i.test(t)) return true;
      if (/^obtener\s*enlace/i.test(t)) return true;
      if (/^ver\s*enlace/i.test(t)) return true;
      return false;
    }
    let target = null;
    for (const b of document.querySelectorAll('button')) if (esAvanzar(b.textContent)) { target = b; break; }
    if (!target) {
      for (const f of document.querySelectorAll('form')) {
        const b = f.querySelector('button[type="submit"]');
        if (b && esAvanzar(b.textContent)) { target = b; break; }
      }
    }
    if (target) {
      if (target.disabled) {
        target.disabled = false;
        target.removeAttribute('disabled');
      }
      target.click();
      return true;
    }
    return false;
  }, false);
}

async function xlGlClickStart(tabId) {
  return ejecutarEnPagina(tabId, () => {
    function esStart(txt) {
      const t = (txt || '').trim().toLowerCase();
      return /start\s*timer/i.test(t) || /iniciar\s*temporizador/i.test(t) || /^start$/i.test(t) || /empezar/i.test(t);
    }
    let target = null;
    for (const b of document.querySelectorAll('button')) if (esStart(b.textContent) && !b.disabled) { target = b; break; }
    if (!target) {
      for (const f of document.querySelectorAll('form')) {
        const b = f.querySelector('button[type="submit"]');
        if (b && esStart(b.textContent) && !b.disabled) { target = b; break; }
      }
    }
    if (target) { target.click(); return true; }
    return false;
  }, false);
}

// ✅ GENÉRICO: pulsar botón del dialog open o cualquier [data-*-reward-continue]
async function xlGlClickRewardDialog(tabId) {
  return ejecutarEnPagina(tabId, () => {
    function esContinuar(txt) {
      const t = (txt || '').trim().toLowerCase();
      return t === 'continue' || t === 'continuar' || t === 'get link' || t === 'getlink' || t === 'obtener enlace' || t === 'ver enlace' || /^continue/i.test(t) || /^get\s*link/i.test(t);
    }
    // 1) Botones con data-*-reward-continue de cualquier prefijo
    const sels = [
      '[data-hoftm-reward-continue]', '[data-wrfpv-reward-continue]',
      '[data-prdij-reward-continue]', '[data-yuqdh-reward-continue]',
      '[data-tisyl-reward-continue]', '[data-nrxua-reward-continue]',
      '[data-kavoy-reward-continue]'
    ];
    for (const s of sels) {
      const btn = document.querySelector(s);
      if (btn) { btn.disabled = false; btn.removeAttribute('disabled'); btn.click(); return true; }
    }
    // 2) Botón dentro de cualquier dialog[open]
    const dialogs = document.querySelectorAll('dialog[open]');
    for (const d of dialogs) {
      const btn = d.querySelector('button[type="submit"], button');
      if (btn) { btn.disabled = false; btn.removeAttribute('disabled'); btn.click(); return true; }
    }
    // 3) Cualquier botón con texto "Continue"/"Get Link" que esté en un dialog
    for (const d of dialogs) {
      for (const b of d.querySelectorAll('button')) {
        if (esContinuar(b.textContent)) { b.disabled = false; b.removeAttribute('disabled'); b.click(); return true; }
      }
    }
    return false;
  }, false);
}

// ✅ GENÉRICO: forzar submit del form con proof del JSON genérico
async function xlGlForzarForm(tabId) {
  return ejecutarEnPagina(tabId, () => {
    function esAvanzar(txt) {
      const t = (txt || '').trim().toLowerCase();
      const exactos = ['continue', 'continuar', 'get link', 'getlink', 'obtener enlace', 'obtener link', 'ver enlace', 'ir al enlace', 'go', 'go to link', 'proceed', 'proceder', 'next', 'siguiente', 'unlock', 'destino'];
      if (exactos.includes(t)) return true;
      if (t.length > 40) return false;
      if (/^get\s*link/i.test(t)) return true;
      if (/^continue/i.test(t)) return true;
      return false;
    }

    // Buscar cualquier form cuyo button[type=submit] esté fuera de un dialog
    let form = null;
    for (const f of document.querySelectorAll('form')) {
      const btn = f.querySelector('button[type="submit"]');
      if (!btn) continue;
      if (btn.closest('dialog')) continue;
      if (!esAvanzar(btn.textContent)) continue;
      form = f;
      break;
    }
    if (!form) return false;

    // Extraer proof del JSON *-step-data de cualquier prefijo
    let proof = '';
    const ids = ['hoftm-step-data', 'wrfpv-step-data', 'prdij-step-data', 'yuqdh-step-data', 'tisyl-step-data', 'nrxua-step-data', 'kavoy-step-data'];
    for (const id of ids) {
      const el = document.getElementById(id);
      if (!el) continue;
      try {
        const data = JSON.parse(el.textContent || '{}');
        if (data.proof) { proof = data.proof; break; }
      } catch (e) {}
    }

    // Rellenar inputs con cualquier prefijo
    const prefijos = ['hoftm', 'wrfpv', 'prdij', 'yuqdh', 'tisyl', 'nrxua', 'kavoy'];
    for (const pref of prefijos) {
      const inputRew = form.querySelector(`input[name="${pref}_rewarded"]`);
      if (inputRew && !inputRew.value) inputRew.value = 'unavailable';
      const inputProof = form.querySelector(`input[name="${pref}_proof"]`);
      if (inputProof && !inputProof.value && proof) inputProof.value = proof;
      const inputConsent = form.querySelector(`input[name="${pref}_consent"]`);
      if (inputConsent && !inputConsent.value) inputConsent.value = 'not_applicable';
      const inputMcl = form.querySelector(`input[name="${pref}_mcl"]`);
      if (inputMcl && !inputMcl.value) inputMcl.value = 'ok';
    }

    try {
      HTMLFormElement.prototype.submit.call(form);
      return true;
    } catch (e) {
      return false;
    }
  }, false);
}

// ============================================================
// MANEJO DEL REWARDED AD DE GOOGLE
// ============================================================
async function xlGlManejarAdOverlay(tabId, _prof = 0) {
  await xlLog(tabId, `xlGlManejarAdOverlay inicio (prof=${_prof})`);

  // 1) ¿Dialog de "Thanks for watching" ya visible?
  const tieneDialog = await ejecutarEnPagina(tabId, () => {
    const dialogs = document.querySelectorAll('dialog[open]');
    for (const d of dialogs) if (d.querySelector('button')) return true;
    return !!document.querySelector('[data-hoftm-reward][open], [data-wrfpv-reward][open], [data-prdij-reward][open], [data-yuqdh-reward][open], [data-tisyl-reward][open], [data-nrxua-reward][open], [data-kavoy-reward][open]');
  }, false);
  if (tieneDialog) {
    await xlLog(tabId, 'ad_overlay: dialog ya visible → pulsando');
    await xlGlClickRewardDialog(tabId);
    await delay(2000);
    return 'dialog';
  }

  // 2) ¿Botón close-button real visible?
  const tieneCloseReal = await ejecutarEnPagina(tabId, () => {
    const btn = document.getElementById('close-button');
    if (!btn) return false;
    const estilo = window.getComputedStyle(btn);
    return estilo.display !== 'none' && estilo.visibility !== 'hidden';
  }, false);
  if (tieneCloseReal) {
    await xlLog(tabId, 'ad_overlay: close-button real visible → pulsando');
    await ejecutarEnPagina(tabId, () => {
      const btn = document.getElementById('close-button');
      if (btn) { btn.disabled = false; btn.classList.remove('disabled'); btn.click(); }
    }, null);
    await delay(2000);
    return 'closed-real';
  }

  // 3) Esperar hasta 20s a close real o dialog
  await xlLog(tabId, 'ad_overlay: esperando hasta 20s a close real o dialog');
  for (let i = 0; i < 20; i++) {
    if (procesoAbortado) return 'abortado';
    await delay(1000);

    const ahoraDialog = await ejecutarEnPagina(tabId, () => {
      const dialogs = document.querySelectorAll('dialog[open]');
      for (const d of dialogs) if (d.querySelector('button')) return true;
      return false;
    }, false);
    if (ahoraDialog) {
      await xlLog(tabId, `ad_overlay: dialog apareció tras ${i+1}s → pulsando`);
      await xlGlClickRewardDialog(tabId);
      await delay(2000);
      return 'dialog-late';
    }

    const ahoraCloseReal = await ejecutarEnPagina(tabId, () => {
      const btn = document.getElementById('close-button');
      if (!btn) return false;
      const estilo = window.getComputedStyle(btn);
      return estilo.display !== 'none' && estilo.visibility !== 'hidden';
    }, false);
    if (ahoraCloseReal) {
      await xlLog(tabId, `ad_overlay: close real visible tras ${i+1}s → pulsando`);
      await ejecutarEnPagina(tabId, () => {
        const btn = document.getElementById('close-button');
        if (btn) { btn.disabled = false; btn.classList.remove('disabled'); btn.click(); }
      }, null);
      await delay(2000);
      return 'closed-real-late';
    }
  }

  // 4) Último recurso: pulsar dismiss-button-element
  await xlLog(tabId, 'ad_overlay: 20s sin close real ni dialog → pulsando dismiss-button-element');
  await ejecutarEnPagina(tabId, () => {
    const btn = document.getElementById('dismiss-button-element');
    if (btn) btn.click();
  }, null);
  await delay(3000);

  const sigue = await ejecutarEnPagina(tabId, () => {
    const el = document.getElementById('ad_position_box');
    if (!el) return false;
    const estilo = window.getComputedStyle(el);
    return estilo.display !== 'none' && estilo.visibility !== 'hidden';
  }, false);

  if (!sigue) {
    await xlLog(tabId, 'ad_overlay: dismiss-button-element cerró el overlay');
    return 'dismiss-ok';
  }

  if (_prof > 1) {
    await xlLog(tabId, 'ad_overlay: ya eliminado una vez, forzando form');
    await xlGlForzarForm(tabId);
    await delay(3000);
    return 'forzado';
  }

  await xlLog(tabId, 'ad_overlay: eliminando overlay del ad');
  await ejecutarEnPagina(tabId, () => {
    document.querySelectorAll('#ad_position_box, .close-button-outer, #dismiss-button, #ad_iframe, .creative').forEach(el => {
      try { el.remove(); } catch (e) {}
    });
  }, null);
  await delay(1500);

  return await xlGlManejarAdOverlay(tabId, _prof + 1);
}

async function procesarPaginaXlGl(tabId, _prof = 0) {
  if (procesoAbortado) return false;
  await xlLog(tabId, `procesarPaginaXlGl inicio (prof=${_prof})`);

  await prepararGate(tabId);
  await delay(800);

  const inspeccion = await xlGlInspeccionar(tabId);
  await xlLog(tabId, `inspeccion fase=${inspeccion.fase} bodyClass="${inspeccion.bodyClass}" turnstile=${inspeccion.tieneTurnstile}/${inspeccion.turnstileOk} adOverlay=${inspeccion.tieneAdOverlay} dialog=${inspeccion.tieneDialog} advance=${inspeccion.tieneAdvance}(${inspeccion.advanceHabilitado})"${inspeccion.advanceTexto}" start=${inspeccion.tieneStart}(${inspeccion.startHabilitado})`);

  if (inspeccion.fase === 'reward_dialog') {
    if (_prof > 6) { await xlLog(tabId, 'reward_dialog: demasiadas iteraciones'); return false; }
    await xlLog(tabId, 'fase reward_dialog: pulsando Get Link del dialog');
    const ok = await xlGlClickRewardDialog(tabId);
    await xlLog(tabId, `reward_dialog click=${ok}`);
    await delay(3000);
    return await procesarPaginaXlGl(tabId, _prof + 1);
  }

  if (inspeccion.fase === 'ad_overlay') {
    if (_prof > 3) { await xlLog(tabId, 'ad_overlay: demasiadas iteraciones, forzando form'); await xlGlForzarForm(tabId); await delay(3000); return true; }
    const resultado = await xlGlManejarAdOverlay(tabId, 0);
    await xlLog(tabId, `ad_overlay resultado=${resultado}`);
    if (resultado === 'forzado') return true;
    return await procesarPaginaXlGl(tabId, _prof + 1);
  }

  if (inspeccion.fase === 'advance' || inspeccion.fase === 'wait_turnstile') {
    await xlLog(tabId, 'fase advance: esperando turnstile + boton habilitado');

    let listo = false;
    const inicio = Date.now();
    while (Date.now() - inicio < 30000) {
      if (procesoAbortado) break;
      const ins = await xlGlInspeccionar(tabId);
      if (ins.fase === 'ad_overlay' || ins.fase === 'reward_dialog') {
        return await procesarPaginaXlGl(tabId, _prof + 1);
      }
      if (ins.tieneAdvance && ins.advanceHabilitado) {
        if (ins.tieneTurnstile && !ins.turnstileOk) { /* aún no */ }
        else { listo = true; break; }
      }
      await delay(1000);
    }

    if (!listo) {
      await xlLog(tabId, 'fallback: activando pestaña para resolver captcha');
      try {
        const tab = await chrome.tabs.get(tabId);
        await chrome.windows.update(tab.windowId, { focused: true });
        await chrome.tabs.update(tabId, { active: true });
      } catch (e) {}
      const inicio2 = Date.now();
      while (Date.now() - inicio2 < 90000) {
        if (procesoAbortado) break;
        const ins = await xlGlInspeccionar(tabId);
        if (ins.fase === 'ad_overlay' || ins.fase === 'reward_dialog') {
          return await procesarPaginaXlGl(tabId, _prof + 1);
        }
        if (ins.tieneAdvance && ins.advanceHabilitado) {
          if (!(ins.tieneTurnstile && !ins.turnstileOk)) { listo = true; break; }
        }
        await delay(1000);
      }
    }

    await xlLog(tabId, `fase advance boton habilitado=${listo}`);
    if (!listo) { await xlLog(tabId, 'fase advance: timeout'); return false; }

    try {
      const tab = await chrome.tabs.get(tabId);
      const ventanas = await chrome.windows.getAll({ populate: false });
      const otraVentana = ventanas.find(v => v.id !== tab.windowId && v.focused);
      if (otraVentana) await chrome.windows.update(otraVentana.id, { focused: true });
    } catch (e) {}

    await delay(1000);
    const urlAntes = await obtenerUrlActual(tabId);
    const clickOk = await xlGlClickAdvance(tabId);
    await xlLog(tabId, `fase advance click=${clickOk}`);

    let navegó = await esperarNavegacion(tabId, urlAntes, 5000);
    await xlLog(tabId, `fase advance tras click navego=${navegó}`);

    if (!navegó) {
      const ins = await xlGlInspeccionar(tabId);
      if (ins.fase === 'ad_overlay' || ins.fase === 'reward_dialog') {
        await xlLog(tabId, `advance: apareció ${ins.fase}, recursión`);
        return await procesarPaginaXlGl(tabId, _prof + 1);
      }
    }

    if (!navegó) {
      await xlLog(tabId, 'advance: forzando form nativo');
      const formOk = await xlGlForzarForm(tabId);
      await xlLog(tabId, `advance forzarForm=${formOk}`);
      navegó = await esperarNavegacion(tabId, urlAntes, 15000);
      await xlLog(tabId, `advance tras forzarForm navego=${navegó}`);
    }

    if (!navegó) {
      await xlLog(tabId, 'advance: reintentando click normal');
      await delay(2000);
      await xlGlClickAdvance(tabId);
      navegó = await esperarNavegacion(tabId, urlAntes, 15000);
      await xlLog(tabId, `advance reintento navego=${navegó}`);
    }

    if (!navegó) await delay(3000);

    const siguiente = await xlGlInspeccionar(tabId);
    await xlLog(tabId, `fase advance siguiente=${siguiente.fase} bodyClass="${siguiente.bodyClass}"`);
    if (siguiente.fase === 'ad_overlay' || siguiente.fase === 'reward_dialog' || siguiente.fase === 'start_timer' || siguiente.fase === 'advance' || siguiente.fase === 'wait_turnstile') {
      return await procesarPaginaXlGl(tabId, _prof + 1);
    }
    return true;
  }

  if (inspeccion.fase === 'start_timer') {
    await xlLog(tabId, 'fase start_timer: pulsando Start timer');

    await xlGlClickStart(tabId);
    await delay(1500);
    await ejecutarEnPagina(tabId, () => { try { window.scrollTo(0, document.body.scrollHeight); } catch (e) {} }, null);

    let listo = false;
    const inicio = Date.now();
    while (Date.now() - inicio < 90000) {
      if (procesoAbortado) break;
      const ins = await xlGlInspeccionar(tabId);
      if (ins.fase === 'ad_overlay' || ins.fase === 'reward_dialog') {
        return await procesarPaginaXlGl(tabId, _prof + 1);
      }
      if (ins.tieneAdvance && ins.advanceHabilitado) { listo = true; break; }
      await delay(1000);
    }

    await xlLog(tabId, `fase start_timer advance habilitado=${listo}`);
    if (!listo) { await xlLog(tabId, 'fase start_timer: timeout'); return false; }

    await delay(800);
    const urlAntes = await obtenerUrlActual(tabId);
    await xlGlClickAdvance(tabId);
    let navegó = await esperarNavegacion(tabId, urlAntes, 5000);
    await xlLog(tabId, `fase start_timer tras click navego=${navegó}`);

    if (!navegó) {
      const ins = await xlGlInspeccionar(tabId);
      if (ins.fase === 'ad_overlay' || ins.fase === 'reward_dialog') {
        await xlLog(tabId, `start_timer: apareció ${ins.fase}, recursión`);
        return await procesarPaginaXlGl(tabId, _prof + 1);
      }
    }
    if (!navegó) {
      await xlLog(tabId, 'start_timer: forzando form nativo');
      await xlGlForzarForm(tabId);
      navegó = await esperarNavegacion(tabId, urlAntes, 15000);
      await xlLog(tabId, `start_timer tras forzarForm navego=${navegó}`);
    }

    if (!navegó) await delay(3000);

    const siguiente = await xlGlInspeccionar(tabId);
    await xlLog(tabId, `fase start_timer siguiente=${siguiente.fase} bodyClass="${siguiente.bodyClass}"`);

    if (siguiente.fase === 'ad_overlay' || siguiente.fase === 'reward_dialog' || siguiente.fase === 'start_timer' || siguiente.fase === 'advance' || siguiente.fase === 'wait_turnstile') {
      return await procesarPaginaXlGl(tabId, _prof + 1);
    }
    if (siguiente.fase === 'otra') {
      const destino = await extraerDestinoDePagina(tabId);
      await xlLog(tabId, `fase start_timer sin botones, destino=${destino || 'null'}`);
      if (destino) { try { await chrome.tabs.update(tabId, { url: normalizarUrl(destino) }); } catch (e) {} await delay(3000); return true; }
    }
    return true;
  }

  await xlLog(tabId, `otra fase bodyClass="${inspeccion.bodyClass}"`);
  const escondido = await extraerEnlaceFinalEscondido(tabId);
  await xlLog(tabId, `otra fase escondido=${escondido || 'null'}`);
  if (escondido) { try { await chrome.tabs.update(tabId, { url: normalizarUrl(escondido) }); } catch (e) {} await delay(3000); return true; }
  const destino = await extraerDestinoDePagina(tabId);
  await xlLog(tabId, `otra fase destino=${destino || 'null'}`);
  if (destino) { try { await chrome.tabs.update(tabId, { url: normalizarUrl(destino) }); } catch (e) {} await delay(3000); return true; }

  const hostActual = obtenerHost(await obtenerUrlActual(tabId));
  if (/(^|\.)xl\.gl$/i.test(hostActual)) {
    await xlLog(tabId, 'otra fase en xl.gl: forzando form como último recurso');
    const formOk = await xlGlForzarForm(tabId);
    if (formOk) { await delay(3000); return true; }
  }
  return false;
}

async function procesarPaginaGate(tabId) {
  if (procesoAbortado) return false;
  const escondido = await extraerEnlaceFinalEscondido(tabId);
  if (escondido) { try { await chrome.tabs.update(tabId, { url: normalizarUrl(escondido) }); } catch (e) {} await delay(3000); return true; }
  await delay(500);
  const pasos = await ejecutarEnPagina(tabId, () => document.querySelectorAll('[id^="btn-s"], .step button, .step a.btn, [class*="step"] > button').length, 0);
  for (let i = 0; i < Math.min(pasos, 8); i++) {
    if (procesoAbortado) return false;
    const clickeado = await ejecutarEnPagina(tabId, (indice) => {
      const botones = document.querySelectorAll('[id^="btn-s"], .step button, .step a.btn, [class*="step"] > button');
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
      const oculto = estilo.display === 'none' || estilo.visibility === 'hidden' || a.offsetParent === null;
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
        const CLAVE_TIEMPO = /TIME|SECOND|SEGUND|DELAY|WAIT|ESPERA|COUNT|TIMER|DURATION|remaining_ms|after_captcha_ms|continue_hold_ms/i;
        const aplanarTiempos = (obj) => {
          try {
            let tocaAlgo = false;
            for (const k of Object.keys(obj)) if (CLAVE_TIEMPO.test(k) && typeof obj[k] === 'number') tocaAlgo = true;
            if (!tocaAlgo) return false;
            for (const k of Object.keys(obj)) if (CLAVE_TIEMPO.test(k) && typeof obj[k] === 'number' && obj[k] > 0 && obj[k] <= 600) obj[k] = 0;
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
          const DateProxy = new Proxy(OrigDate, { construct(target, args) { return args.length === 0 ? new target(warp()) : new target(...args); }, apply() { return new OrigDate(warp()).toString(); } });
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
    if (procesoAbortado) return false;
    const estado = await ejecutarEnPagina(tabId, () => {
      const overlay = document.querySelector('#timer-overlay, [id*="overlay"]');
      const visible = overlay && window.getComputedStyle(overlay).display !== 'none';
      if (visible) {
        const reanudar = document.querySelector('#resume-btn, [id*="resume"]');
        if (reanudar && window.getComputedStyle(reanudar).display !== 'none') { reanudar.click(); return 'reanudado'; }
        return 'esperando';
      }
      return 'libre';
    }, 'libre');
    if (estado === 'libre') { await delay(400); return true; }
    await delay(400);
  }
  return false;
}

async function clickBotonFinalGate(tabId, timeout = 20000) {
  const inicio = Date.now();
  while (Date.now() - inicio < timeout) {
    if (procesoAbortado) return null;
    const resultado = await chrome.scripting.executeScript({
      target: { tabId }, world: 'MAIN',
      func: () => {
        const btn = document.querySelector('#btn-download, #final-link button, #final-link a, [id*="final"] button, #get-link, #continue');
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
        target: { tabId }, world: 'MAIN',
        func: () => { const abiertos = window.__paOpens || []; return abiertos.length ? abiertos[abiertos.length - 1].url : null; }
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
  } catch (e) { return porDefecto; }
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
    if (oculto) { try { await chrome.tabs.update(tabId, { url: normalizarUrl(oculto) }); } catch (e) {} await delay(3000); return; }
  }
  await delay(1500);
}

function extraerDestinoWpSafelink(tabId) {
  return ejecutarEnPagina(tabId, () => {
    const enlaces = [...document.querySelectorAll('#wpsafe-link a[onclick], a[onclick]')];
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
          if (href && !href.startsWith('javascript:') && !boton.classList.contains('disabled')) return href;
          return null;
        }
      });
      if (resultado[0]?.result) return resultado[0].result;
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
        const candidatos = [...document.querySelectorAll('input[type="checkbox"]'), ...document.querySelectorAll('button, a.btn, .btn')];
        for (const el of candidatos) {
          const texto = (el.innerText || el.value || el.getAttribute('aria-label') || '').toLowerCase();
          if (texto.includes('robot') || texto.includes('human') || texto.includes('verif')) { el.click(); return true; }
        }
        return false;
      }
    });
  } catch (e) {}
}

async function detectarTooEarly(tabId) {
  try {
    const resultado = await chrome.scripting.executeScript({ target: { tabId }, func: () => { const h1 = document.querySelector('h1'); return h1 && h1.innerText.includes("Too Early"); } });
    return resultado[0]?.result === true;
  } catch (e) { return false; }
}

async function manejarTooEarly(tabId, maxIntentos = 8) {
  for (let intento = 1; intento <= maxIntentos; intento++) {
    if (procesoAbortado) return false;
    if (!(await detectarTooEarly(tabId))) return true;
    try { await chrome.scripting.executeScript({ target: { tabId }, func: () => { const btn = document.querySelector('a.btn'); if (btn) btn.click(); } }); } catch (e) {}
    await delay(3000 + intento * 1000);
  }
  return false;
}

async function intentarClicConTimeout(tabId, selector, timeout) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (procesoAbortado) return false;
    try {
      const r = await chrome.scripting.executeScript({ target: { tabId }, func: (s) => { const e = document.querySelector(s); if (e) { e.click(); return true; } return false; }, args: [selector] });
      if (r[0]?.result === true) return true;
    } catch (e) {}
    await delay(200);
  }
  return false;
}

async function elementoVisible(tabId, selector) {
  try {
    const r = await chrome.scripting.executeScript({ target: { tabId }, func: (s) => { const e = document.querySelector(s); if (!e) return false; const st = window.getComputedStyle(e); return st.display !== 'none' && st.visibility !== 'hidden' && e.offsetParent !== null; }, args: [selector] });
    return r[0]?.result === true;
  } catch (e) { return false; }
}

async function clickElemento(tabId, selector) {
  try {
    const r = await chrome.scripting.executeScript({ target: { tabId }, func: (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, args: [selector] });
    return r[0]?.result === true;
  } catch (e) { return false; }
}

async function esperarYHacerClic(tabId, selector, descripcion, timeout = 60000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeout) {
    if (procesoAbortado) return false;
    if (await elementoVisible(tabId, selector)) { await delay(800); if (await clickElemento(tabId, selector)) return true; }
    await delay(1000);
  }
  return false;
}

async function esperarYHacerClicDownload(tabId, descripcion, timeout = 15000) {
  const startTime = Date.now();
  const urlInicial = await obtenerUrlActual(tabId);
  const buscarVisible = () => chrome.scripting.executeScript({ target: { tabId }, func: () => { const w = document.getElementById('wpsafe-link'); if (w && window.getComputedStyle(w).display !== 'none') return true; for (const e of document.querySelectorAll('a[onclick]')) { const oc = e.getAttribute('onclick') || ''; if (oc.includes('window.open') && window.getComputedStyle(e).display !== 'none') return true; } return false; } }).then(r => r[0]?.result === true).catch(() => false);
  const clickearSiVisible = () => chrome.scripting.executeScript({ target: { tabId }, func: () => { const w = document.getElementById('wpsafe-link'); if (w && window.getComputedStyle(w).display !== 'none') { const en = w.querySelector('a'); if (en) { en.click(); return true; } } for (const e of document.querySelectorAll('a[onclick]')) { const oc = e.getAttribute('onclick') || ''; if (oc.includes('window.open') && window.getComputedStyle(e).display !== 'none') { e.click(); return true; } } return false; } }).then(r => r[0]?.result === true).catch(() => false);
  while (Date.now() - startTime < timeout) {
    if (procesoAbortado) return false;
    if (await buscarVisible()) {
      await delay(800);
      if (await clickearSiVisible()) {
        const lim = Date.now() + 4000;
        while (Date.now() < lim) {
          if (procesoAbortado) return false;
          await delay(500);
          const u = await obtenerUrlActual(tabId);
          if (u && u !== urlInicial) return true;
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
    const r = await chrome.scripting.executeScript({ target: { tabId }, func: () => window.location.href });
    return r[0]?.result || '';
  } catch (e) { return ''; }
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

function actualizarBadge(texto, color) {
  try {
    chrome.action.setBadgeText({ text: texto || '' });
    if (color) chrome.action.setBadgeBackgroundColor({ color });
  } catch (e) {}
}

function iniciarProgresoTemporal() {
  inicioProgreso = Date.now();
  if (intervaloProgreso) clearInterval(intervaloProgreso);
  intervaloProgreso = setInterval(() => {
    const el = Date.now() - inicioProgreso;
    let p = Math.min(95, (el / DURACION_ESTIMADA) * 100);
    p = Math.round(p * 10) / 10;
    enviarProgreso(p);
  }, 500);
  if (alarmaKeepAlive) clearInterval(alarmaKeepAlive);
  alarmaKeepAlive = setInterval(() => { try { chrome.runtime.getPlatformInfo(() => {}); } catch (e) {} }, 20000);
}

function detenerProgresoTemporal() {
  if (intervaloProgreso) { clearInterval(intervaloProgreso); intervaloProgreso = null; }
  if (alarmaKeepAlive) { clearInterval(alarmaKeepAlive); alarmaKeepAlive = null; }
}

function enviarProgreso(p) {
  p = Math.min(100, Math.max(0, p));
  chrome.runtime.sendMessage({ action: "actualizarProgreso", porcentaje: p, mensaje: null }).catch(() => {});
  actualizarBadge(Math.round(p) + '%', '#ffb800');
}

async function procesarEnlaceAcortado(shortLink) {
  let tabId = null;
  try {
    procesoAbortado = false;
    iniciarProgresoTemporal();
    enviarProgreso(0);
    try { await chrome.storage.local.set({ debugXlGl: [] }); } catch (e) {}
    try { await chrome.storage.local.remove('resultadoPendiente'); } catch (e) {}

    await xlLog(null, `procesarEnlaceAcortado inicio shortLink="${shortLink}"`);

    const esUrlPasteDirecto = shortLink.includes(PASTE_DOMINIO);
    let urlInicio = shortLink;
    if (!esShortlinkConocido(obtenerHost(shortLink)) && !esUrlPasteDirecto) {
      const directo = await resolverGateDirecto(shortLink);
      if (directo) urlInicio = directo;
    }

    tabId = await crearPestañaSilenciosa(urlInicio);
    await delay(esUrlPasteDirecto ? 2000 : 5000);

    procesosActivos[tabId] = { etapa: 'iniciando', shortLink, tabId };
    const MAX_INTENTOS = esUrlPasteDirecto ? 10 : 40;
    let llegoAlFinal = false;
    let intentosGate = 0;
    let saltosFinales = 0;
    let idExtraido = null;
    let mensajeError = null;

    for (let intento = 1; intento <= MAX_INTENTOS; intento++) {
      if (procesoAbortado) {
        detenerProgresoTemporal();
        actualizarBadge('', '#888888');
        delete procesosActivos[tabId];
        pestañaProceso = null;
        await chrome.storage.local.remove('procesoEnCurso');
        return;
      }

      const urlActual = await obtenerUrlActual(tabId);
      await xlLog(tabId, `[intento ${intento}/${MAX_INTENTOS}] url=${urlActual}`);

      if (urlActual.includes(PASTE_DOMINIO)) {
        const clasif = await esperarYClasificarPaste(tabId, 15000);
        if (procesoAbortado) {
          detenerProgresoTemporal(); actualizarBadge('', '#888888'); delete procesosActivos[tabId]; pestañaProceso = null;
          await chrome.storage.local.remove('procesoEnCurso'); return;
        }

        let verificacion = null;
        if (clasif.estado === 'ok' && clasif.servicio) { enviarProgreso(90); verificacion = await verificarSesionViva(clasif.servicio); }
        const msg = mensajeDeClasificacion(clasif, urlActual, verificacion);

        if (msg.ok) {
          idExtraido = msg.id;
          await chrome.storage.local.set({
            ultimoIdExtraido: idExtraido,
            extraccionExitosa: { id: idExtraido, servicio: msg.servicio, sesionEstado: msg.sesionEstado, timestamp: Date.now() },
            resultadoPendiente: { id: idExtraido, servicio: msg.servicio || null, sesionEstado: msg.sesionEstado || null, timestamp: Date.now() }
          });
          try {
            const { historialIds } = await chrome.storage.local.get('historialIds');
            const hist = Array.isArray(historialIds) ? historialIds : [];
            hist.unshift({ id: idExtraido, servicio: msg.servicio || null, timestamp: Date.now() });
            await chrome.storage.local.set({ historialIds: hist.slice(0, 10) });
          } catch (e) {}
        } else {
          await chrome.storage.local.set({ errorPendiente: { codigo: msg.codigo, titulo: msg.titulo, detalle: msg.detalle, sugerencia: msg.sugerencia, servicio: msg.servicio, timestamp: Date.now() } });
        }

        chrome.runtime.sendMessage({
          action: msg.ok ? 'idExtraido' : 'errorProcesamiento',
          id: msg.id || null, codigo: msg.codigo, titulo: msg.titulo, detalle: msg.detalle,
          sugerencia: msg.sugerencia || '', servicio: msg.servicio || null,
          sesionEstado: msg.sesionEstado || null, pasteUrl: msg.pasteUrl || null
        }).catch(() => {});

        detenerProgresoTemporal();
        setTimeout(async () => { pestañaProceso = null; try { await chrome.tabs.remove(tabId); } catch (e) {} }, msg.ok ? 800 : 1200);

        if (msg.ok) { enviarProgreso(100); actualizarBadge('✓', '#00ff88'); llegoAlFinal = true; break; }
        else { mensajeError = msg; actualizarBadge('!', '#ff5252'); break; }
      }

      if (await repararUrlRota(tabId)) continue;
      await verificarYNotificarDominio(tabId);
      const tipo = await detectarTipoPagina(tabId);
      await xlLog(tabId, `[intento ${intento}/${MAX_INTENTOS}] tipo=${tipo}`);

      if (procesoAbortado) {
        detenerProgresoTemporal(); actualizarBadge('', '#888888'); delete procesosActivos[tabId]; pestañaProceso = null;
        await chrome.storage.local.remove('procesoEnCurso'); return;
      }

      if (tipo === 'adblock') {
        await xlLog(tabId, 'adblock detectado → avisando al popup');
        actualizarBadge('ADB', '#ff5252');
        detenerProgresoTemporal();
        chrome.runtime.sendMessage({ action: 'avisoAdblock' }).catch(() => {});

        const inicioEspera = Date.now();
        while (Date.now() - inicioEspera < 15000) {
          if (procesoAbortado) { await xlLog(tabId, 'adblock: abortarProceso recibido'); return; }
          try { await chrome.tabs.get(tabId); }
          catch (e) {
            delete procesosActivos[tabId]; pestañaProceso = null;
            await chrome.storage.local.remove('procesoEnCurso').catch(() => {});
            return;
          }
          await delay(500);
        }
        try { await chrome.tabs.remove(tabId); } catch (e) {}
        pestañaProceso = null; actualizarBadge('', '#888888');
        await chrome.storage.local.remove('procesoEnCurso').catch(() => {});
        delete procesosActivos[tabId]; return;
      }

      if (tipo === 'too_early') {
        const sup = await manejarTooEarly(tabId);
        if (!sup) { mensajeError = { titulo: 'BLOQUEO', detalle: 'Too Early bloqueó el acceso' }; actualizarBadge('!', '#ff5252'); break; }
        await delay(2000); continue;
      }
      if (tipo === 'landing') { await delay(2000); continue; }

      if (tipo === 'xlgl') {
        const urlAntes = urlActual;
        await procesarPaginaXlGl(tabId);
        const urlDespues = await obtenerUrlActual(tabId);
        if (urlDespues && urlDespues !== urlAntes) intentosGate = 0;
        else { intentosGate++; if (intentosGate > 5) { mensajeError = { titulo: 'BLOQUEO', detalle: 'No se pudo pasar xl.gl' }; actualizarBadge('!', '#ff5252'); break; } }
        continue;
      }

      if (tipo === 'gate') {
        const urlAntes = urlActual;
        await procesarPaginaGate(tabId);
        const urlDespues = await obtenerUrlActual(tabId);
        if (urlDespues && urlDespues !== urlAntes) intentosGate = 0;
        else { intentosGate++; if (intentosGate > 3) { mensajeError = { titulo: 'BLOQUEO', detalle: 'No se pudo pasar la página de pasos' }; actualizarBadge('!', '#ff5252'); break; } }
        continue;
      }
      if (tipo === 'wpsafelink') { await procesarRondaWpSafelink(tabId); continue; }
      if (tipo === 'adlinkfly') { await procesarPaginaAdlinkfly(tabId); continue; }

      if (tipo === 'final') {
        await delay(1500);
        const tipoConf = await detectarTipoPagina(tabId);
        if (tipoConf === 'final') {
          const urlConf = await obtenerUrlActual(tabId);
          const hostConf = obtenerHost(urlConf);
          await xlLog(tabId, `final: url=${urlConf} host=${hostConf}`);
          if (/(^|\.)xl\.gl$/i.test(hostConf)) { await xlLog(tabId, 'final en xl.gl → esperar'); await delay(3000); continue; }
          if (urlConf.includes(PASTE_DOMINIO)) continue;
          if (saltosFinales < 2) {
            const destino = await extraerDestinoDePagina(tabId);
            if (destino) { saltosFinales++; try { await chrome.tabs.update(tabId, { url: normalizarUrl(destino) }); } catch (e) {} await delay(3000); continue; }
          }
          llegoAlFinal = true; break;
        }
        continue;
      }
      await delay(1500);
    }

    if (!llegoAlFinal && !idExtraido && !mensajeError) {
      mensajeError = { titulo: 'NO SE PUDO EXTRAER', detalle: 'No se pudo llegar a paste.myst.rs o extraer el ID.' };
      actualizarBadge('!', '#ff5252');
    }
    if (mensajeError) {
      detenerProgresoTemporal();
      await xlLog(tabId, `ERROR FINAL: ${mensajeError.titulo} - ${mensajeError.detalle}`);
    }

    delete procesosActivos[tabId];
    pestañaProceso = null;
    guardarDominios();
    await chrome.storage.local.remove('procesoEnCurso');

  } catch (error) {
    if (procesoAbortado) {
      detenerProgresoTemporal(); actualizarBadge('', '#888888'); delete procesosActivos[tabId]; pestañaProceso = null;
      await chrome.storage.local.remove('procesoEnCurso').catch(() => {});
      procesoAbortado = false; return;
    }
    await chrome.storage.local.set({ errorPendiente: { mensaje: error.message, timestamp: Date.now() } });
    chrome.runtime.sendMessage({ action: "errorProcesamiento", codigo: 'ERROR_GENERAL', titulo: 'ERROR', detalle: error.message, sugerencia: '' }).catch(() => {});
    detenerProgresoTemporal();
    actualizarBadge('!', '#ff5252');
    await xlLog(tabId, `EXCEPCION: ${error.message}`);
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
      if (!dominiosPendientes.includes(dominioActual)) dominiosPendientes.push(dominioActual);
      chrome.storage.local.set({ 'dominiosPendientes': dominiosPendientes });
      chrome.runtime.sendMessage({ action: "dominioAprendido", dominio: dominioActual }).catch(() => {});
    }
    return true;
  } catch (e) { return true; }
}