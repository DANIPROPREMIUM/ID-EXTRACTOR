// popup.js - Con genio emoji 🧞‍♂️

let enProceso = false;
let idActual = null;
const esAndroid = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

function actualizarProgreso(porcentaje) {
  const container = document.getElementById('progressContainer');
  const percentageDiv = document.getElementById('percentage');
  const fill = document.getElementById('progressFill');
  
  if (!container || !percentageDiv || !fill) return;
  
  container.style.display = 'block';
  percentageDiv.innerHTML = `${Math.floor(porcentaje)}%`;
  fill.style.width = `${porcentaje}%`;
  
  let color;
  if (porcentaje <= 50) {
    const r = 255;
    const g = Math.floor(255 * (porcentaje / 50));
    color = `rgb(${r}, ${g}, 0)`;
  } else {
    const r = Math.floor(255 * (1 - (porcentaje - 50) / 50));
    const g = 255;
    color = `rgb(${r}, ${g}, 0)`;
  }
  
  fill.style.background = `linear-gradient(90deg, ${color}, #00ff00)`;
}

function ocultarProgreso() {
  const container = document.getElementById('progressContainer');
  if (container) container.style.display = 'none';
}

function resetearPorcentaje() {
  actualizarProgreso(0);
}

function mostrarExito() {
  const resultBox = document.getElementById('resultBox');
  if (resultBox) resultBox.style.display = 'block';
}

function resetearVista() {
  const resultBox = document.getElementById('resultBox');
  if (resultBox) resultBox.style.display = 'none';
}

// Activar genio emoji y lámpara
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

// Validar URL
function validarURLyActivarGenio() {
  const linkInput = document.getElementById('linkInput');
  const btnProcesar = document.getElementById('btnProcesar');
  
  if (!linkInput || !btnProcesar) return;
  
  const url = linkInput.value.trim();
  const esValido = url.includes('shortxlinks.in') || url.includes('shortxlinks.com');
  
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

async function procesarPaste(pasteUrl) {
  actualizarProgreso(95);

  try {
    const { texto } = await extraerIdDePaste(pasteUrl);
    actualizarProgreso(97);
    
    const servicioDetectado = detectarServicioDesdeTexto(texto);
    let idEncontrado = false;
    
    if (servicioDetectado) {
      const id = extraerId(texto, servicioDetectado);
      if (id) {
        idActual = id;
        idEncontrado = true;
        actualizarProgreso(100);
        
        chrome.storage.local.set({
          ultimoIdExtraido: {
            id: id,
            servicio: servicioDetectado,
            timestamp: Date.now()
          }
        });
        
        try { await navigator.clipboard.writeText(id); } catch(e) {}
      }
    }
    
    if (!idEncontrado) {
      const idGenerico = extraerId(texto, null);
      if (idGenerico) {
        idActual = idGenerico;
        idEncontrado = true;
        actualizarProgreso(100);
        
        chrome.storage.local.set({
          ultimoIdExtraido: {
            id: idGenerico,
            servicio: 'auto',
            timestamp: Date.now()
          }
        });
        
        try { await navigator.clipboard.writeText(idGenerico); } catch(e) {}
      }
    }
    
    if (idEncontrado) {
      mostrarExito();
      
      await chrome.storage.local.remove('pastePendiente');
      await chrome.storage.local.remove('errorPendiente');
      
      setTimeout(ocultarProgreso, 1500);
      return true;
    }
    
    throw new Error('No se encontró ningún ID');
    
  } catch (error) {
    console.error('Error:', error);
    actualizarProgreso(0);
    setTimeout(ocultarProgreso, 2000);
    return false;
  }
}

async function verificarPastePendiente() {
  const result = await chrome.storage.local.get(['pastePendiente', 'errorPendiente']);
  
  if (result.pastePendiente) {
    const paste = result.pastePendiente;
    const tiempoTranscurrido = Date.now() - paste.timestamp;
    
    if (tiempoTranscurrido < 120000) {
      console.log("📋 Paste pendiente encontrado, procesando...");
      await procesarPaste(paste.url);
      enProceso = false;
      const btnProcesar = document.getElementById('btnProcesar');
      if (btnProcesar) {
        btnProcesar.disabled = false;
        btnProcesar.innerHTML = '<span class="btn-text">EXTRAER</span>';
        btnProcesar.classList.remove('palpitar');
      }
      activarGenio(false);
    } else {
      await chrome.storage.local.remove('pastePendiente');
    }
  }
  
  if (result.errorPendiente) {
    const error = result.errorPendiente;
    const tiempoTranscurrido = Date.now() - error.timestamp;
    if (tiempoTranscurrido > 120000) {
      await chrome.storage.local.remove('errorPendiente');
    }
  }
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
    console.error('Error fetch:', error);
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

  const plataformaMap = {
    netflix: 'netflix', crunchyroll: 'crunchyroll', prime: 'prime',
    viki: 'viki', atresplayer: 'atresplayer', paramount: 'paramount'
  };

  const plataforma = plataformaMap[servicio];
  if (plataforma) {
    const textoLimpio = texto.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#43;/g, '+').replace(/&#61;/g, '=').replace(/\r\n/g, '\n');

    const regex = new RegExp(`premium_id:${plataforma}:[a-zA-Z0-9]{4,12}:[a-zA-Z0-9]{4,12}:([A-Za-z0-9+/=]{20,})`, 'i');
    const match = textoLimpio.match(regex);
    if (match) {
      const idx = textoLimpio.indexOf(match[0]);
      return textoLimpio.substring(idx, idx + match[0].length);
    }

    const regexAmplio = new RegExp(`(premium_id:${plataforma}:[^\\s<"']{10,})`, 'i');
    const matchAmplio = textoLimpio.match(regexAmplio);
    if (matchAmplio) return matchAmplio[1].trim();
  }

  if (servicio === 'netflix') {
    const match = texto.match(/(netflix_session:[a-zA-Z0-9:_\-\.{}"`,;=@]+)/i);
    if (match) return match[1] || match[0];
  }
  if (servicio === 'crunchyroll') {
    const match = texto.match(/(crunchyroll_session:[a-zA-Z0-9:_\-\.{}"`,;=@]+)/i);
    if (match) return match[1] || match[0];
  }
  if (servicio === 'prime') {
    const match = texto.match(/(session_paste\s+[A-Za-z0-9\/+=]+)/i);
    if (match) return match[0];
  }

  return null;
}

document.addEventListener('DOMContentLoaded', async function() {
  const btnProcesar = document.getElementById('btnProcesar');
  const linkInput = document.getElementById('linkInput');
  
  if (!btnProcesar || !linkInput) return;
  
  resetearVista();
  await verificarPastePendiente();

  linkInput.addEventListener('input', validarURLyActivarGenio);
  linkInput.addEventListener('paste', function() {
    setTimeout(validarURLyActivarGenio, 10);
  });

  btnProcesar.addEventListener('click', async function() {
    if (enProceso) return;

    const link = linkInput.value.trim();
    if (!link) return;
    if (!link.includes('shortxlinks.in') && !link.includes('shortxlinks.com')) return;

    enProceso = true;
    this.disabled = true;
    this.innerHTML = '<span class="btn-text">⏳ EXTRAYENDO...</span>';
    this.classList.remove('palpitar');
    resetearVista();
    activarGenio(false);
    await chrome.storage.local.remove('ultimoIdExtraido');
    await chrome.storage.local.remove('pastePendiente');
    await chrome.storage.local.remove('errorPendiente');
    resetearPorcentaje();

    try {
      chrome.runtime.sendMessage({ action: "procesarShortLink", url: link, esAndroid });
    } catch (error) {
      console.error('Error:', error);
      enProceso = false;
      this.disabled = false;
      this.innerHTML = '<span class="btn-text">EXTRAER</span>';
      ocultarProgreso();
    }
  });
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "actualizarProgreso") {
    actualizarProgreso(request.porcentaje);
  }
  
  if (request.action === "pasteEncontrado" || request.action === "procesarPasteDirecto" || request.action === "pasteEncontradoAndroid") {
    procesarPaste(request.pasteUrl).then(() => {
      enProceso = false;
      const btnProcesar = document.getElementById('btnProcesar');
      if (btnProcesar) {
        btnProcesar.disabled = false;
        btnProcesar.innerHTML = '<span class="btn-text">EXTRAER</span>';
        btnProcesar.classList.remove('palpitar');
      }
    });
  }
  
  if (request.action === "errorProcesamiento") {
    enProceso = false;
    const btnProcesar = document.getElementById('btnProcesar');
    if (btnProcesar) {
      btnProcesar.disabled = false;
      btnProcesar.innerHTML = '<span class="btn-text">EXTRAER</span>';
      btnProcesar.classList.remove('palpitar');
    }
    ocultarProgreso();
    resetearVista();
    activarGenio(false);
  }
  
  return true;
});