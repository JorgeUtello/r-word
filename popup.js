document.addEventListener("DOMContentLoaded", () => {
  const addForm = document.getElementById("addForm");
  const wordInput = document.getElementById("wordInput");
  const colorInput = document.getElementById("colorInput");
  const selectorInput = document.getElementById("selectorInput");
  const wordList = document.getElementById("wordList");
  const toggleBtn = document.getElementById("toggleExtensionBtn");
  const reloadBtn = document.getElementById("reloadPageBtn");

  // Tabs
  const tabWordsBtn = document.getElementById("tabWordsBtn");
  const tabConfigBtn = document.getElementById("tabConfigBtn");
  const tabWords = document.getElementById("tabWords");
  const tabConfig = document.getElementById("tabConfig");
  tabWordsBtn.addEventListener("click", () => {
    tabWordsBtn.classList.add("active");
    tabConfigBtn.classList.remove("active");
    tabWords.classList.add("active");
    tabConfig.classList.remove("active");
  });
  tabConfigBtn.addEventListener("click", () => {
    tabConfigBtn.classList.add("active");
    tabWordsBtn.classList.remove("active");
    tabConfig.classList.add("active");
    tabWords.classList.remove("active");
  });

  // Hotkey input
  const hotkeyInput = document.getElementById("hotkeyInput");
  const hotkeyInfo = document.getElementById("hotkeyInfo");
  let hotkeyValue = "";
  hotkeyInput.addEventListener("keydown", (e) => {
    e.preventDefault();
    let keys = [];
    if (e.ctrlKey) keys.push("Ctrl");
    if (e.shiftKey) keys.push("Shift");
    if (e.altKey) keys.push("Alt");
    if (e.metaKey) keys.push("Meta");
    const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
    if (!["Control", "Shift", "Alt", "Meta"].includes(key)) keys.push(key);
    hotkeyValue = keys.join("+");
    hotkeyInput.value = hotkeyValue;
    chrome.storage.sync.set({ hotkey: hotkeyValue });
    hotkeyInfo.textContent = "Combinación guardada";
    setTimeout(() => {
      hotkeyInfo.textContent = "Presiona la combinación deseada";
    }, 1200);
  });
  // Mostrar hotkey guardada
  chrome.storage.sync.get({ hotkey: "" }, (data) => {
    if (data.hotkey) hotkeyInput.value = data.hotkey;
  });

  let currentDomain = null;
  let palabrasPorDominio = {};

  // Obtener dominio actual y cargar palabras
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]) {
      try {
        const url = new URL(tabs[0].url);
        currentDomain = url.hostname;
        // Leer palabras guardadas por dominio
        chrome.storage.sync.get({ palabrasPorDominio: {} }, (data) => {
          palabrasPorDominio = data.palabrasPorDominio;
          loadWords();
        });
        // Leer estado guardado del slider
        chrome.storage.sync.get({ siteStates: {} }, (data) => {
          const state = data.siteStates[currentDomain];
          siteActiveSwitch.checked = state === true;
        });
      } catch (e) {}
    }
  });

  function renderList(words) {
    wordList.innerHTML = "";
    words.forEach((item, idx) => {
      const li = document.createElement("li");
      // Check global
      const globalCheck = document.createElement("input");
      globalCheck.type = "checkbox";
      globalCheck.className = "global-check";
      globalCheck.title = "Usar esta palabra en todos los sitios";
      globalCheck.checked = !!item.global;
      globalCheck.addEventListener("change", () => {
        words[idx].global = globalCheck.checked;
        saveWords(words);
        // Forzar actualización en todas las pestañas
        chrome.tabs.query({}, (tabs) => {
          tabs.forEach(tab => {
            if (tab.id) {
              chrome.tabs.sendMessage(tab.id, { action: "reloadHighlight" });
            }
          });
        });
      });
      li.appendChild(globalCheck);
      // Mostrar la palabra y el color
      const colorBox = document.createElement("input");
      colorBox.type = "color";
      colorBox.value = item.color || "#ffff00";
      colorBox.title = "Cambiar color";
      colorBox.style.marginRight = "8px";
      colorBox.addEventListener("input", (e) => {
        words[idx].color = e.target.value;
        saveWords(words);
      });
      li.appendChild(colorBox);
      li.appendChild(document.createTextNode(item.word));
      // Mostrar el selector si existe
      if (item.selector) {
        const selectorSpan = document.createElement("span");
        selectorSpan.textContent = ` [${item.selector}]`;
        selectorSpan.style.fontSize = "0.9em";
        selectorSpan.style.color = "#888";
        selectorSpan.style.marginLeft = "6px";
        li.appendChild(selectorSpan);
      }
      const delBtn = document.createElement("button");
      delBtn.textContent = "Eliminar";
      delBtn.addEventListener("click", () => {
        words.splice(idx, 1);
        saveWords(words);
      });
      li.appendChild(delBtn);
      wordList.appendChild(li);
    });
  }

  function loadWords() {
    if (!currentDomain) return;
    const words = palabrasPorDominio[currentDomain] || [];
    renderList(words);
  }

  function saveWords(words) {
    if (!currentDomain) return;
    palabrasPorDominio[currentDomain] = words;
    chrome.storage.sync.set({ palabrasPorDominio }, loadWords);
  }

  function updateToggleBtn(paused) {
    toggleBtn.textContent = paused
      ? "Reanudar complemento"
      : "Pausar complemento";
  }

  toggleBtn.addEventListener("click", () => {
    chrome.storage.sync.get({ paused: false }, (data) => {
      const newPaused = !data.paused;
      chrome.storage.sync.set({ paused: newPaused }, () => {
        updateToggleBtn(newPaused);
        // Recargar la página actual
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
          if (tabs[0]) chrome.tabs.reload(tabs[0].id);
        });
      });
    });
  });

  reloadBtn.addEventListener("click", () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) chrome.tabs.reload(tabs[0].id);
    });
  });

  // Inicializar el estado del botón
  chrome.storage.sync.get({ paused: false }, (data) => {
    updateToggleBtn(data.paused);
  });

  addForm.addEventListener("submit", (e) => {
    e.preventDefault();
    if (!currentDomain) return;
    const newWord = wordInput.value.trim();
    const newColor = colorInput.value;
    const newSelector = selectorInput.value.trim();
    let words = palabrasPorDominio[currentDomain] || [];
    if (!words.some((item) => item.word === newWord && item.selector === newSelector)) {
      words.push({ word: newWord, color: newColor, selector: newSelector });
      saveWords(words);
    }
    wordInput.value = "";
    colorInput.value = "#ffff00";
    selectorInput.value = "";
  });

  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === "sync" && changes.palabrasPorDominio) {
      palabrasPorDominio = changes.palabrasPorDominio.newValue;
      loadWords();
    }
    if (area === "sync" && changes.paused) {
      updateToggleBtn(changes.paused.newValue);
    }
    // Forzar actualización de checks globales en todas las pestañas
    if (area === "sync" && changes.palabrasPorDominio) {
      loadWords();
    }
  });

  const siteActiveSwitch = document.getElementById("siteActiveSwitch");
  const siteActiveSwitchHeader = document.getElementById("siteActiveSwitchHeader");
  // Sincronizar ambos sliders
  function setSiteSwitch(checked) {
    siteActiveSwitchHeader.checked = checked;
    siteActiveSwitch.checked = checked;
  }
  function getCurrentDomain(callback) {
    if (currentDomain) return callback(currentDomain);
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]) {
        try {
          const url = new URL(tabs[0].url);
          callback(url.hostname);
        } catch (e) {}
      }
    });
  }
  // Inicializar slider header
  getCurrentDomain((domain) => {
    chrome.storage.sync.get({ siteStates: {} }, (data) => {
      const state = data.siteStates[domain];
      setSiteSwitch(state === true);
    });
  });
  // Cambiar estado al usar el slider header
  siteActiveSwitchHeader.addEventListener("change", () => {
    getCurrentDomain((domain) => {
      chrome.storage.sync.get({ siteStates: {} }, (data) => {
        data.siteStates[domain] = siteActiveSwitchHeader.checked;
        chrome.storage.sync.set({ siteStates: data.siteStates }, () => {
          setSiteSwitch(siteActiveSwitchHeader.checked);
          chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) chrome.tabs.reload(tabs[0].id);
          });
        });
      });
    });
  });
  // Cambiar estado al usar el slider oculto (por compatibilidad)
  siteActiveSwitch.addEventListener("change", () => {
    siteActiveSwitchHeader.checked = siteActiveSwitch.checked;
    siteActiveSwitchHeader.dispatchEvent(new Event("change"));
  });
});
