// Función para resaltar múltiples palabras con color y selector opcional
function highlightWords(words) {
  if (!Array.isArray(words) || words.length === 0) return;
  // Agrupar palabras por selector
  const globalWords = words.filter(w => !w.selector);
  const selectorGroups = words.filter(w => w.selector);

  // Resaltar palabras globales (sin selector)
  if (globalWords.length > 0) {
    highlightWordsInNodes(globalWords, [document.body]);
  }

  // Resaltar palabras con selector
  selectorGroups.forEach(w => {
    try {
      const nodes = Array.from(document.querySelectorAll(w.selector));
      if (nodes.length > 0) {
        highlightWordsInNodes([w], nodes);
      }
    } catch (e) {
      // Selector inválido, ignorar
    }
  });
}

// Función auxiliar para resaltar palabras en un conjunto de nodos
function highlightWordsInNodes(words, nodes) {
  nodes.forEach(root => {
    const walker = document.createTreeWalker(
      root,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );
    const textNodes = [];
    let node;
    while (node = walker.nextNode()) {
      textNodes.push(node);
    }
    textNodes.forEach(textNode => {
      const parent = textNode.parentNode;
      if (parent.tagName === 'SCRIPT' || 
          parent.tagName === 'STYLE' || 
          parent.classList.contains('nueva-highlight')) {
        return;
      }
      const text = textNode.textContent;
      const escapedWords = words.map(w => w.word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
      const regex = new RegExp(`\\b(${escapedWords.join('|')})\\b`, 'gi');
      if (regex.test(text)) {
        const temp = document.createElement('div');
        temp.innerHTML = text.replace(regex, (match) => {
          const found = words.find(w => w.word.toLowerCase() === match.toLowerCase());
          const color = found && found.color ? found.color : '#ffff00';
          return `<span class=\"nueva-highlight\" style=\"background-color:${color};\">${match}</span>`;
        });
        const fragment = document.createDocumentFragment();
        while (temp.firstChild) {
          fragment.appendChild(temp.firstChild);
        }
        parent.replaceChild(fragment, textNode);
      }
    });
  });
}

// Función para cargar palabras y resaltar, solo si no está pausado y el sitio está activo
function loadAndHighlight() {
  chrome.storage.sync.get({ palabrasPorDominio: {}, paused: false, siteStates: {} }, (data) => {
    const domain = window.location.hostname;
    const siteActive = data.siteStates[domain] === true; // Por defecto apagado
    const palabrasDominio = data.palabrasPorDominio[domain] || [];
    // Palabras globales
    let palabrasGlobales = [];
    Object.values(data.palabrasPorDominio).forEach(arr => {
      if (Array.isArray(arr)) {
        arr.forEach(p => { if (p.global) palabrasGlobales.push(p); });
      }
    });
    // Unir y evitar duplicados exactos
    const palabras = [...palabrasDominio, ...palabrasGlobales.filter(pg => !palabrasDominio.some(pd => pd.word === pg.word && pd.selector === pg.selector))];
    if (!data.paused && siteActive) {
      highlightWords(palabras);
    } else {
      removeHighlights();
    }
  });
}

// Función para eliminar todos los resaltados
function removeHighlights() {
  const highlights = document.querySelectorAll('span.nueva-highlight');
  highlights.forEach(span => {
    if (span.parentNode) {
      span.parentNode.replaceChild(document.createTextNode(span.textContent), span);
    }
  });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadAndHighlight);
} else {
  loadAndHighlight();
}

// También eliminar resaltados si el complemento está pausado al cargar la página
chrome.storage.sync.get({ paused: false }, (data) => {
  if (data.paused) {
    removeHighlights();
  }
});

const observer = new MutationObserver((mutations) => {
  mutations.forEach((mutation) => {
    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
      setTimeout(loadAndHighlight, 100);
    }
  });
});
observer.observe(document.body, {
  childList: true,
  subtree: true
});

// Escuchar cambios en el almacenamiento para actualizar resaltado en tiempo real
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'sync' && changes.palabrasPorDominio) {
    loadAndHighlight();
  }
  if (area === 'sync' && changes.siteStates) {
    loadAndHighlight();
  }
  if (area === 'sync' && changes.paused) {
    loadAndHighlight();
  }
  if (area === 'sync' && changes.hotkey) {
    lastHotkey = changes.hotkey.newValue;
  }
});

// Escuchar combinación de teclas personalizada
let lastHotkey = '';
chrome.storage.sync.get({ hotkey: '' }, (data) => {
  lastHotkey = data.hotkey;
});
window.addEventListener('keydown', (e) => {
  if (!lastHotkey) return;
  let keys = [];
  if (e.ctrlKey) keys.push('Ctrl');
  if (e.shiftKey) keys.push('Shift');
  if (e.altKey) keys.push('Alt');
  if (e.metaKey) keys.push('Meta');
  const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
  if (!['Control','Shift','Alt','Meta'].includes(key)) keys.push(key);
  const pressed = keys.join('+');
  if (pressed === lastHotkey) {
    e.preventDefault();
    chrome.storage.sync.get({ paused: false }, (data) => {
      chrome.storage.sync.set({ paused: !data.paused }, () => {
        location.reload();
      });
    });
  }
});

// Escuchar mensajes para forzar actualización desde el popup
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg && msg.action === "reloadHighlight") {
    loadAndHighlight();
  }
});