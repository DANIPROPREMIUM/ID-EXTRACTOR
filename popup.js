// popup.js - Con genio emoji 🧞‍♂️, mensaje completo y barra sutil

let enProceso = false;

// Shortlinks que la extensión pasa de punta a punta
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
}

function mostrarExito() {
  const resultBox = document.getElementById('resultBox');
  if (resultBox) resultBox.style.display = 'block';
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

async function pegarDesdePortapapeles(linkInput, forzar = false) {
  try {
    const texto = await navigator.clipboard.readText();
    if (texto && esLinkValido(texto.trim())) {
      const actual = linkInput.value.trim();
      if (forzar || !actual) {
        linkInput.value = texto.trim();
        validarURLyActivarGenio();
      }
    }
  } catch (e) {
    // Portapapeles no disponible
  }
}

document.addEventListener('DOMContentLoaded', async function() {
  const btnProcesar = document.getElementById('btnProcesar');
  const linkInput = document.getElementById('linkInput');

  if (!btnProcesar || !linkInput) return;

  resetearVista();
  await verificarProcesoPendiente();

  if (!linkInput.value.trim()) {
    await pegarDesdePortapapeles(linkInput);
  }

  const btnPegar = document.getElementById('btnPegar');
  if (btnPegar) {
    btnPegar.addEventListener('click', async function() {
      await pegarDesdePortapapeles(linkInput, true);
    });
  }

  linkInput.addEventListener('input', validarURLyActivarGenio);
  linkInput.addEventListener('paste', function() {
    setTimeout(validarURLyActivarGenio, 10);
  });

  btnProcesar.addEventListener('click', async function() {
    if (enProceso) return;

    const link = linkInput.value.trim();
    if (!link) return;
    if (!esLinkValido(link)) return;

    enProceso = true;
    this.disabled = true;
    this.innerHTML = '<span class="btn-text">⏳ EXTRAYENDO...</span>';
    this.classList.remove('palpitar');
    resetearVista();
    activarGenio(false);
    await chrome.storage.local.remove('descargaLista');
    await chrome.storage.local.remove('errorPendiente');

    // Mostrar el progreso
    mostrarProgreso();

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
    // Asegurar que el contenedor esté visible
    mostrarProgreso();
  }

  if (request.action === "idExtraido") {
    ocultarProgreso();
    mostrarExito();
    // Copiar al portapapeles
    try {
      navigator.clipboard.writeText(request.id).catch(() => {});
    } catch(e) {}
    enProceso = false;
    resetearBoton();
    activarGenio(false);
  }

  if (request.action === "errorProcesamiento") {
    enProceso = false;
    resetearBoton();
    ocultarProgreso();
    resetearVista();
    activarGenio(false);
  }

  return true;
});