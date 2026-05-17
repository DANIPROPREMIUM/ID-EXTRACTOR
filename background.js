// BACKGROUND SERVICE WORKER - guarda paste URL en storage

let dominiosConocidos = {
  primeraRonda: 'mtc1.tazabook.com',
  segundaRonda: 'mtc1.cashlyfree.com',
  shortlinks: 'shortxlinks'
};

let dominiosPendientes = [];
let procesosActivos = {};
let pestañaProceso = null;

function cargarDominios() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['dominiosExitosos'], function(result) {
      if (result.dominiosExitosos) {
        dominiosConocidos = result.dominiosExitosos;
        console.log('✅ Dominios cargados:', dominiosConocidos);
      }
      resolve();
    });
  });
}

function guardarDominios() {
  chrome.storage.local.set({ 
    dominiosExitosos: dominiosConocidos
  });
  console.log('✅ Dominios guardados');
}

cargarDominios();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "procesarShortLink") {
    const shortLink = request.url;
    const esAndroid = request.esAndroid === true;
    console.log("Background: Procesando:", shortLink, "| Android:", esAndroid);
    procesarEnlaceAcortado(shortLink, esAndroid);
    sendResponse({status: "iniciado"});
    return true;
  }
});

async function crearPestañaSilenciosa(url) {
  try {
    const tab = await chrome.tabs.create({ 
      url: url, 
      active: false,
      index: 999
    });
    
    pestañaProceso = tab.id;
    
    try {
      await chrome.tabs.update(tab.id, { muted: true });
    } catch(e) {}
    
    console.log("✅ Pestaña silenciosa creada");
    return pestañaProceso;
    
  } catch (error) {
    console.error("Error creando pestaña:", error);
    throw error;
  }
}

async function cerrarPestañaProceso() {
  if (pestañaProceso) {
    try {
      await chrome.tabs.remove(pestañaProceso);
      console.log("✅ Pestaña cerrada");
    } catch(e) {}
    pestañaProceso = null;
  }
}

async function verificarYNotificarDominio(tabId) {
  try {
    const tabInfo = await chrome.tabs.get(tabId);
    const urlActual = tabInfo.url;
    const urlObj = new URL(urlActual);
    const dominioActual = urlObj.hostname;
    
    console.log(`📍 Verificando dominio: ${dominioActual}`);
    
    const todosLosDominios = [
      dominiosConocidos.primeraRonda,
      dominiosConocidos.segundaRonda,
      dominiosConocidos.shortlinks,
      ...dominiosPendientes
    ];
    
    const esNuevoDominio = !todosLosDominios.some(d => dominioActual.includes(d));
    
    if (esNuevoDominio && dominioActual) {
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
    
  } catch (e) {
    console.error("Error:", e);
    return true;
  }
}

async function procesarEnlaceAcortado(shortLink, esAndroid = false) {
  let tabId = null;

  try {
    enviarProgreso(5);
    
    tabId = await crearPestañaSilenciosa(shortLink);
    enviarProgreso(10);
    await delay(5000);
    
    procesosActivos[tabId] = {
      etapa: 'iniciando',
      shortLink: shortLink,
      tabId: tabId
    };
    
    console.log("===== PRIMERA RONDA =====");
    enviarProgreso(15);
    
    if (!await verificarYNotificarDominio(tabId)) return;
    enviarProgreso(20);
    
    await esperarYHacerClic(tabId, '#wpsafelinkhuman', 'Boton 1');
    enviarProgreso(25);
    await delay(3000);
    
    if (!await verificarYNotificarDominio(tabId)) return;
    enviarProgreso(30);
    
    await esperarYHacerClic(tabId, 'a[onclick="wpsafegenerate()"]', 'Boton 2');
    enviarProgreso(35);
    await delay(3000);
    
    if (!await verificarYNotificarDominio(tabId)) return;
    enviarProgreso(40);
    
    await esperarYHacerClicDownload(tabId, '1ra');
    enviarProgreso(45);
    await delay(5000);
    
    let rondaExtra = 2;
    const MAX_RONDAS = 10;
    
    while (rondaExtra <= MAX_RONDAS) {
      const urlLoop = await obtenerUrlActual(tabId);
      if (urlLoop.includes('shortxlinks')) break;
      
      if (await detectarTooEarly(tabId)) {
        enviarProgreso(45 + (rondaExtra * 2));
        const superado = await manejarTooEarly(tabId);
        if (!superado) throw new Error('ShortXLinks bloqueó el acceso');
        const urlTrasRetry = await obtenerUrlActual(tabId);
        if (urlTrasRetry.includes('shortxlinks')) break;
        await delay(3000);
        continue;
      }

      console.log(`===== RONDA ${rondaExtra} =====`);
      enviarProgreso(45 + (rondaExtra * 3));
      
      if (!await verificarYNotificarDominio(tabId)) return;
      
      await procesarSegundaRondaFlexible(tabId);
      rondaExtra++;
    }
    
    console.log("===== ESPERANDO SHORTXLINKS =====");
    enviarProgreso(70);
    
    if (await detectarTooEarly(tabId)) {
      enviarProgreso(72);
      const superado = await manejarTooEarly(tabId);
      if (!superado) throw new Error('ShortXLinks bloqueó el acceso');
      await delay(3000);
    }
    
    if (!await verificarYNotificarDominio(tabId)) return;
    enviarProgreso(75);
    
    await esperarCondicionUrl(tabId, 'shortxlinks', 30000);
    await delay(5000);
    enviarProgreso(80);
    
    console.log("===== OBTENIENDO LINK DIRECTO =====");
    enviarProgreso(85);
    
    const linkDirecto = await obtenerHrefValido(tabId);
    console.log(`✅ Link obtenido: ${linkDirecto}`);
    
    await chrome.tabs.update(tabId, { url: linkDirecto });
    enviarProgreso(90);
    
    console.log("===== ESPERANDO PASTE =====");
    enviarProgreso(92);
    
    await esperarCondicionUrl(tabId, 'paste.myst.rs', 30000);
    await delay(3000);
    enviarProgreso(95);
    
    const contenidoListo = await esperarContenidoPasteMejorado(tabId, 20000);
    
    if (contenidoListo) {
      const urlFinal = await obtenerUrlActual(tabId);
      console.log(`✅ Paste listo: ${urlFinal}`);
      enviarProgreso(100);

      // GUARDAR EN STORAGE para que el popup lo encuentre aunque se cierre
      await chrome.storage.local.set({ 
        pastePendiente: {
          url: urlFinal,
          timestamp: Date.now(),
          esAndroid: esAndroid
        }
      });
      
      // También enviar mensaje por si el popup está abierto
      chrome.runtime.sendMessage({ 
        action: esAndroid ? "pasteEncontradoAndroid" : "procesarPasteDirecto",
        pasteUrl: urlFinal
      }).catch(() => {});
      
      // Cerrar pestaña
      setTimeout(() => {
        cerrarPestañaProceso();
        delete procesosActivos[tabId];
      }, 3000);
      
    } else {
      throw new Error('No se pudo cargar el contenido del paste');
    }

  } catch (error) {
    console.error("Error:", error);
    
    // Guardar error en storage
    await chrome.storage.local.set({ 
      errorPendiente: {
        mensaje: error.message,
        timestamp: Date.now()
      }
    });
    
    chrome.runtime.sendMessage({ 
      action: "errorProcesamiento", 
      error: error.message 
    }).catch(() => {});
    
    setTimeout(() => {
      cerrarPestañaProceso();
    }, 1000);
    
    delete procesosActivos[tabId];
  }
}

function enviarProgreso(porcentaje) {
  chrome.runtime.sendMessage({ 
    action: "actualizarProgreso", 
    porcentaje: porcentaje
  }).catch(() => {});
}

async function procesarSegundaRondaFlexible(tabId) {
  try {
    console.log("🔄 Segunda ronda...");
    
    let urlActual = await obtenerUrlActual(tabId);
    if (urlActual.includes('shortxlinks')) {
      console.log("✅ Ya en shortxlinks");
      return true;
    }
    
    const boton1 = await intentarClicConTimeout(tabId, '#wpsafelinkhuman', 3000);
    if (boton1) {
      console.log("✓ Botón 1 clickeado");
      await delay(3000);
      urlActual = await obtenerUrlActual(tabId);
      if (urlActual.includes('shortxlinks')) return true;
    }
    
    const boton2 = await intentarClicConTimeout(tabId, 'a[onclick="wpsafegenerate()"]', 3000);
    if (boton2) {
      console.log("✓ Botón 2 clickeado");
      await delay(3000);
      urlActual = await obtenerUrlActual(tabId);
      if (urlActual.includes('shortxlinks')) return true;
    }
    
    const download = await intentarDownloadConTimeout(tabId, 3000);
    if (download) {
      console.log("✓ Download clickeado");
      await delay(5000);
      urlActual = await obtenerUrlActual(tabId);
      if (urlActual.includes('shortxlinks')) return true;
    }
    
    urlActual = await obtenerUrlActual(tabId);
    console.log(`📍 URL final: ${urlActual}`);
    
    return urlActual.includes('shortxlinks');
    
  } catch (error) {
    console.log("Error:", error);
    return false;
  }
}

async function esperarContenidoPasteMejorado(tabId, timeout = 20000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const resultado = await chrome.scripting.executeScript({
        target: { tabId: tabId },
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
        console.log('✅ Contenido detectado');
        await delay(2000);
        return true;
      }
    } catch (e) {}
    await delay(1000);
  }
  
  return false;
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
  } catch (e) {
    return false;
  }
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
      
      if (resultado[0]?.result === true) {
        return true;
      }
    } catch (e) {}
    await delay(200);
  }
  return false;
}

async function intentarDownloadConTimeout(tabId, timeout) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const resultado = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          const wpsafeLink = document.getElementById('wpsafe-link');
          if (wpsafeLink) {
            const enlace = wpsafeLink.querySelector('a');
            if (enlace) {
              enlace.click();
              return true;
            }
          }
          
          const enlaces = document.querySelectorAll('a[onclick]');
          for (const enlace of enlaces) {
            const onclick = enlace.getAttribute('onclick') || '';
            if (onclick.includes('window.open')) {
              enlace.click();
              return true;
            }
          }
          
          return false;
        }
      });
      
      if (resultado[0]?.result === true) {
        return true;
      }
    } catch (e) {}
    await delay(200);
  }
  return false;
}

async function esperarYHacerClic(tabId, selector, descripcion) {
  const MAX_ESPERA = 60000;
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_ESPERA) {
    try {
      const resultado = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: (selector) => {
          const elemento = document.querySelector(selector);
          if (!elemento) return 'no_existe';

          const estilo = window.getComputedStyle(elemento);
          const esVisible = estilo.display !== 'none' && estilo.visibility !== 'hidden' && elemento.offsetParent !== null;

          if (!esVisible) return 'oculto';
          elemento.click();
          return 'clickeado';
        },
        args: [selector]
      });

      const res = resultado[0]?.result;
      if (res === 'clickeado') {
        console.log(`✓ ${descripcion} clickeado`);
        return true;
      }
    } catch (e) {}
    await delay(1000);
  }
  throw new Error(`Timeout: ${descripcion}`);
}

async function esperarYHacerClicDownload(tabId, ronda) {
  const MAX_ESPERA = 40000;
  const startTime = Date.now();

  while (Date.now() - startTime < MAX_ESPERA) {
    try {
      const resultado = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          const wpsafeLink = document.getElementById('wpsafe-link');
          if (wpsafeLink) {
            const estilo = window.getComputedStyle(wpsafeLink);
            if (estilo.display === 'none') return 'oculto';
            const enlace = wpsafeLink.querySelector('a');
            if (enlace) { enlace.click(); return 'clickeado'; }
          }
          const enlaces = document.querySelectorAll('a[onclick]');
          for (const enlace of enlaces) {
            const onclick = enlace.getAttribute('onclick') || '';
            if (onclick.includes('window.open')) {
              const est = window.getComputedStyle(enlace);
              if (est.display !== 'none') { enlace.click(); return 'clickeado'; }
            }
          }
          return 'no_existe';
        }
      });

      const res = resultado[0]?.result;
      if (res === 'clickeado') {
        console.log(`✓ Download (${ronda}) clickeado`);
        return true;
      }
    } catch (e) {}
    await delay(1000);
  }
  throw new Error(`No se pudo encontrar download link`);
}

function esperarCondicionUrl(tabId, texto, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const checkInterval = setInterval(async () => {
      try {
        const urlActual = await obtenerUrlActual(tabId);
        if (urlActual.includes(texto)) {
          clearInterval(checkInterval);
          resolve(true);
        } else if (Date.now() - startTime > timeout) {
          clearInterval(checkInterval);
          reject(new Error(`Timeout esperando URL con: ${texto}`));
        }
      } catch (e) {}
    }, 500);
  });
}

async function obtenerUrlActual(tabId) {
  try {
    const resultado = await chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: () => window.location.href
    });
    return resultado[0]?.result || '';
  } catch (e) {
    return '';
  }
}

async function obtenerHrefValido(tabId, timeout = 15000) {
  const startTime = Date.now();
  
  while (Date.now() - startTime < timeout) {
    try {
      const resultado = await chrome.scripting.executeScript({
        target: { tabId: tabId },
        func: () => {
          const boton = document.querySelector('.btn-success.get-link');
          if (boton && boton.href && !boton.href.startsWith('javascript:')) {
            return boton.href;
          }
          
          const enlaces = document.querySelectorAll('a[href]');
          for (const enlace of enlaces) {
            if (enlace.href && enlace.href.startsWith('http') && 
                !enlace.href.includes('shortxlinks') &&
                !enlace.href.includes('javascript')) {
              return enlace.href;
            }
          }
          return null;
        }
      });
      
      if (resultado[0]?.result) {
        return resultado[0].result;
      }
    } catch (e) {}
    await delay(500);
  }
  throw new Error('No se pudo obtener href válido');
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}