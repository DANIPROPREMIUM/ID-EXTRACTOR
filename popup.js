// popup.js - Progreso por tiempo, confeti en toda la pantalla, sin iconos flotantes

let enProceso = false;
let confetiInterval = null;
let canvas = null;
let ctx = null;
let particles = [];

const DOMINIOS_VALIDOS = ['softurl.in', 'shortxlinks.in', 'shortxlinks.com'];

function esLinkValido(url) {
  if (!url) return false;
  if (DOMINIOS_VALIDOS.some(d => url.includes(d))) return true;
  try {
    const u = new URL(url.trim());
    return (u.protocol === 'http:' || u.protocol === 'https:') && u.hostname.includes('.');
  } catch (e) {
    return false;
  }
}

function mostrarProgreso() {
  const container = document.getElementById('progressContainer');
  if (container) container.style.display = 'block';
}

function ocultarProgreso() {
  const container = document.getElementById('progressContainer');
  if (container) container.style.display = 'none';
}

function resetearVista() {
  const resultBox = document.getElementById('resultBox');
  if (resultBox) resultBox.style.display = 'none';
  ocultarProgreso();
  actualizarCirculo(0);
  document.getElementById('progressStage').textContent = '';
  detenerConfeti();
}

function mostrarExito() {
  const resultBox = document.getElementById('resultBox');
  if (resultBox) resultBox.style.display = 'block';
  ocultarProgreso();
  iniciarConfeti();
}

function activarGenio(activar) {
  const genio = document.getElementById('genioEmoji');
  const lampara = document.getElementById('lampara');

  if (genio && lampara) {
    if (activar) {
      genio.classList.add('visible');
      lampara.classList.add('brillando');
    } else {
      genio.classList.remove('visible');
      lampara.classList.remove('brillando');
    }
  }
}

function actualizarCirculo(porcentaje) {
  const circle = document.getElementById('progressCircle');
  const text = document.getElementById('progressText');
  if (!circle || !text) return;
  const circumference = 263.89;
  const offset = circumference - (porcentaje / 100) * circumference;
  circle.style.strokeDashoffset = offset;
  text.textContent = Math.round(porcentaje) + '%';
}

function actualizarEtapa(mensaje) {
  const stage = document.getElementById('progressStage');
  if (stage) stage.textContent = mensaje || '';
}

function validarURLyActivarGenio() {
  const linkInput = document.getElementById('linkInput');
  const btnProcesar = document.getElementById('btnProcesar');

  if (!linkInput || !btnProcesar) return;

  const url = linkInput.value.trim();
  const esValido = esLinkValido(url);

  if (esValido && !enProceso) {
    btnProcesar.classList.add('palpitar');
    linkInput.classList.add('valid');
    activarGenio(true);
  } else {
    btnProcesar.classList.remove('palpitar');
    linkInput.classList.remove('valid');
    activarGenio(false);
  }
}

function resetearBoton() {
  const btnProcesar = document.getElementById('btnProcesar');
  if (btnProcesar) {
    btnProcesar.disabled = false;
    btnProcesar.innerHTML = '<span class="btn-text">EXTRAER</span>';
    btnProcesar.classList.remove('palpitar');
  }
}

async function verificarProcesoPendiente() {
  await chrome.storage.local.remove(['descargaLista', 'errorPendiente', 'procesoEnCurso', 'ultimoIdExtraido']);
}

async function limpiarEstadoExito() {
  await chrome.storage.local.remove('extraccionExitosa');
}

async function comprobarExtraccionExitosa() {
  const data = await chrome.storage.local.get('extraccionExitosa');
  if (data.extraccionExitosa) {
    const { id, timestamp } = data.extraccionExitosa;
    if (Date.now() - timestamp < 10 * 60 * 1000) {
      mostrarExito();
      return true;
    } else {
      await chrome.storage.local.remove('extraccionExitosa');
    }
  }
  return false;
}

// ---------- CONFETI ----------
function iniciarConfeti() {
  detenerConfeti();
  canvas = document.getElementById('confetiCanvas');
  if (!canvas) return;
  canvas.width = document.body.offsetWidth;
  canvas.height = document.body.offsetHeight;
  canvas.style.position = 'fixed';
  canvas.style.top = '0';
  canvas.style.left = '0';
  canvas.style.pointerEvents = 'none';
  canvas.style.zIndex = '9999';
  canvas.style.display = 'block';
  
  ctx = canvas.getContext('2d');
  particles = [];
  const colors = ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6bd6', '#ff9f43', '#a29bfe'];
  
  for (let i = 0; i < 150; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height - canvas.height,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: Math.random() * 4 + 2,
      angle: Math.random() * Math.PI * 2,
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 0.1,
      wobble: Math.random() * 0.05,
      wobbleSpeed: Math.random() * 0.02 + 0.01
    });
  }
  
  confetiInterval = setInterval(() => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let allDone = true;
    for (const p of particles) {
      p.y += p.speed;
      p.x += Math.sin(p.y * p.wobble) * 1.5;
      p.rotation += p.rotationSpeed;
      
      if (p.y < canvas.height + 20) allDone = false;
      
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rotation);
      ctx.fillStyle = p.color;
      ctx.shadowColor = 'rgba(255,255,255,0.3)';
      ctx.shadowBlur = 10;
      ctx.fillRect(-p.size/2, -p.size/4, p.size, p.size/2);
      ctx.restore();
    }
    if (allDone) detenerConfeti();
  }, 16);
}

function detenerConfeti() {
  if (confetiInterval) {
    clearInterval(confetiInterval);
    confetiInterval = null;
  }
  if (canvas) {
    const ctx2 = canvas.getContext('2d');
    ctx2.clearRect(0, 0, canvas.width, canvas.height);
    canvas.style.display = 'none';
  }
  particles = [];
}

// ---------- DOM ----------
document.addEventListener('DOMContentLoaded', async function() {
  const btnProcesar = document.getElementById('btnProcesar');
  const linkInput = document.getElementById('linkInput');

  if (!btnProcesar || !linkInput) return;

  resetearVista();
  await verificarProcesoPendiente();

  const hayExito = await comprobarExtraccionExitosa();

  linkInput.addEventListener('input', function() {
    if (document.getElementById('resultBox').style.display === 'block') {
      limpiarEstadoExito();
      resetearVista();
    }
    validarURLyActivarGenio();
  });
  linkInput.addEventListener('paste', function() {
    setTimeout(() => {
      if (document.getElementById('resultBox').style.display === 'block') {
        limpiarEstadoExito();
        resetearVista();
      }
      validarURLyActivarGenio();
    }, 10);
  });

  btnProcesar.addEventListener('click', async function() {
    if (enProceso) return;

    const link = linkInput.value.trim();
    if (!link) return;
    if (!esLinkValido(link)) return;

    await limpiarEstadoExito();
    resetearVista();

    enProceso = true;
    this.disabled = true;
    this.innerHTML = '<span class="btn-text">⏳ EXTRAYENDO...</span>';
    this.classList.remove('palpitar');
    await chrome.storage.local.remove('descargaLista');
    await chrome.storage.local.remove('errorPendiente');

    mostrarProgreso();
    actualizarCirculo(0);
    actualizarEtapa('Procesando...');

    try {
      chrome.runtime.sendMessage({ action: "procesarShortLink", url: link });
    } catch (error) {
      console.error('Error:', error);
      enProceso = false;
      resetearBoton();
      ocultarProgreso();
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "actualizarProgreso") {
    mostrarProgreso();
    actualizarCirculo(request.porcentaje || 0);
    if (request.mensaje) {
      actualizarEtapa(request.mensaje);
    } else {
      const p = request.porcentaje || 0;
      if (p < 30) actualizarEtapa('Iniciando proceso...');
      else if (p < 60) actualizarEtapa('Procesando enlaces...');
      else if (p < 90) actualizarEtapa('Extrayendo información...');
      else if (p < 100) actualizarEtapa('Casi listo...');
      else actualizarEtapa('¡Completado!');
    }
  }

  if (request.action === "idExtraido") {
    (async () => {
      try {
        await navigator.clipboard.writeText(request.id);
        console.log('✅ ID copiada al portapapeles desde popup');
      } catch (e) {
        console.error('❌ Error al copiar ID:', e);
        await chrome.storage.local.set({ ultimoIdExtraido: request.id });
      }
    })();
    
    actualizarCirculo(100);
    actualizarEtapa('¡Completado!');
    setTimeout(() => {
      mostrarExito();
      enProceso = false;
      resetearBoton();
      activarGenio(false);
    }, 600);
  }

  if (request.action === "errorProcesamiento") {
    enProceso = false;
    resetearBoton();
    ocultarProgreso();
    resetearVista();
    activarGenio(false);
    chrome.storage.local.remove('extraccionExitosa');
    detenerConfeti();
  }

  return true;
});