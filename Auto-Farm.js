(async () => {
  const CONFIG = {
    START_X: 742,
    START_Y: 1148,
    PIXELS_PER_LINE: 100,
    DELAY: 1000,
    THEME: {
      primary: '#000000',
      secondary: '#111111',
      accent: '#222222',
      text: '#ffffff',
      highlight: '#775ce3',
      success: '#00ff00',
      error: '#ff0000'
    }
  };

  const state = {
    running: false,
    paintedCount: 0,
    charges: { count: 0, max: 80, cooldownMs: 30000 },
    userInfo: null,
    lastPixel: null,
    minimized: false,
    menuOpen: false,
    language: 'en',
    autoRefresh: true,
    pausedForManual: false
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  const fetchAPI = async (url, options = {}) => {
    try {
      const res = await fetch(url, {
        credentials: 'include',
        ...options
      });
      return await res.json();
    } catch (e) {
      return null;
    }
  };

  const getRandomPosition = () => ({
    x: Math.floor(Math.random() * CONFIG.PIXELS_PER_LINE),
    y: Math.floor(Math.random() * CONFIG.PIXELS_PER_LINE)
  });

  const paintPixel = async (x, y) => {
    const randomColor = Math.floor(Math.random() * 31) + 1;
    const url = `https://backend.wplace.live/s0/pixel/${CONFIG.START_X}/${CONFIG.START_Y}`;
    const payload = JSON.stringify({ coords: [x, y], colors: [randomColor] });
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=UTF-8' },
        credentials: 'include',
        body: payload
      });
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    } catch (e) {
      return null;
    }
  };

  const getCharge = async () => {
    const data = await fetchAPI('https://backend.wplace.live/me');
    if (data) {
      state.userInfo = data;
      state.charges = {
        count: Math.floor(data.charges.count),
        max: Math.floor(data.charges.max),
        cooldownMs: data.charges.cooldownMs
      };
      if (state.userInfo.level) {
        state.userInfo.level = Math.floor(state.userInfo.level);
      }
    }
    return state.charges;
  };

  const detectUserLocation = async () => {
    try {
      const response = await fetch('https://ipapi.co/json/');
      const data = await response.json();
      state.language = data.country === 'BR' ? 'pt' : 'en';
    } catch {
      state.language = 'en';
    }
  };

  const paintLoop = async () => {
    while (state.running) {
      const { count, cooldownMs } = state.charges;
      
      if (count < 1) {
        updateUI(
          state.language === 'pt'
            ? `⌛ Sem cargas. Esperando ${Math.ceil(cooldownMs/1000)}s...`
            : `⌛ No charges. Waiting ${Math.ceil(cooldownMs/1000)}s...`,
          'status'
        );
        await sleep(cooldownMs);
        await getCharge();
        continue;
      }

      const randomPos = getRandomPosition();
      const paintResult = await paintPixel(randomPos.x, randomPos.y);

      if (paintResult?.painted === 1) {
        state.paintedCount++;
        state.lastPixel = { 
          x: CONFIG.START_X + randomPos.x,
          y: CONFIG.START_Y + randomPos.y,
          time: new Date() 
        };
        state.charges.count--;
        
        document.getElementById('paintEffect').style.animation = 'pulse 0.5s';
        setTimeout(() => {
          document.getElementById('paintEffect').style.animation = '';
        }, 500);
        
        updateUI(state.language === 'pt' ? '✅ Pixel pintado!' : '✅ Pixel painted!', 'success');
      } else {
        updateUI(state.language === 'pt' ? '❌ Falha ao pintar' : '❌ Failed to paint', 'error');
      }

      await sleep(CONFIG.DELAY);
      updateStats();
    }
  };

  const createUI = () => {
    if (state.menuOpen) return;
    state.menuOpen = true;

    const style = document.createElement('style');
    style.textContent = `
      @keyframes pulse {
        0% { box-shadow: 0 0 0 0 rgba(0, 255, 0, 0.7); }
        70% { box-shadow: 0 0 0 10px rgba(0, 255, 0, 0); }
        100% { box-shadow: 0 0 0 0 rgba(0, 255, 0, 0); }
      }
      .wplace-bot-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        width: 250px;
        background: ${CONFIG.THEME.primary};
        border: 1px solid ${CONFIG.THEME.accent};
        border-radius: 8px;
        z-index: 9999;
        color: ${CONFIG.THEME.text};
        font-family: 'Segoe UI', Roboto, sans-serif;
      }
    `;
    document.head.appendChild(style);

    const t = {
      pt: { title: "WPlace Auto-Farm", start: "Iniciar", stop: "Parar", ready: "Pronto" },
      en: { title: "WPlace Auto-Farm", start: "Start", stop: "Stop", ready: "Ready" }
    }[state.language] || { title: "Auto-Farm", start: "Start", stop: "Stop", ready: "Ready" };

    const panel = document.createElement('div');
    panel.className = 'wplace-bot-panel';
    panel.innerHTML = `
      <div id="paintEffect"></div>
      <div>
        <button id="toggleBtn">${t.start}</button>
        <div id="statsArea"></div>
        <div id="statusText">${t.ready}</div>
      </div>
    `;
    document.body.appendChild(panel);

    const toggleBtn = panel.querySelector('#toggleBtn');
    toggleBtn.addEventListener('click', () => {
      state.running = !state.running;
      if (state.running) {
        toggleBtn.textContent = t.stop;
        paintLoop();
      } else {
        toggleBtn.textContent = t.start;
        updateUI(state.language === 'pt' ? '⏹️ Parado' : '⏹️ Stopped', 'default');
      }
    });
  };

  window.updateUI = (message, type = 'default') => {
    const statusText = document.querySelector('#statusText');
    if (statusText) statusText.textContent = message;
  };

  window.updateStats = async () => {
    await getCharge();
    const statsArea = document.querySelector('#statsArea');
    if (statsArea && state.userInfo) {
      statsArea.innerHTML = `
        User: ${state.userInfo.name}<br>
        Pixels: ${state.paintedCount}<br>
        Charges: ${state.charges.count}/${state.charges.max}<br>
        Level: ${state.userInfo?.level || 0}
      `;
    }
  };

  await detectUserLocation();
  createUI();
  await getCharge();
  updateStats();
})();
