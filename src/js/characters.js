let nextPageUrl = 'https://rickandmortyapi.com/api/character'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

document.getElementById('nextPage').addEventListener('click', async () => {
  if (!nextPageUrl) {
    alert('No hay más páginas')
    return
  }

  await showCharacters()
})

async function fetchWithRetry(url, options = {}, cfg = {}) {
  const {
    retries = 2,
    baseDelayMs = 250,
    maxDelayMs = 2500,
    jitter = 0.2,
    timeoutMs = 7000,
    retryOn = (err, res) => {
      if (err) return true;
      return res && (res.status === 429 || (res.status >= 500 && res.status <= 599));
    },
  } = cfg;

  for (let attempt = 0; attempt <= retries; attempt++) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      clearTimeout(t);

      if (!retryOn(null, res) || attempt === retries) return res;

      const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const j = exp * jitter * (Math.random() * 2 - 1);
      await sleep(Math.max(0, exp + j));
    } catch (err) {
      clearTimeout(t);

      if (!retryOn(err, null) || attempt === retries) throw err;

      const exp = Math.min(maxDelayMs, baseDelayMs * 2 ** attempt);
      const j = exp * jitter * (Math.random() * 2 - 1);
      await sleep(Math.max(0, exp + j));
    }
  }
}


function createCircuitBreaker(cfg = {}) {
  const {
    failureThreshold = 4,  // fallas seguidas para abrir
    successThreshold = 2,  // éxitos en HALF_OPEN para cerrar
    openStateMs = 1000,   // tiempo abierto
  } = cfg;

  let state = "CLOSED"; // CLOSED | OPEN | HALF_OPEN
  let failures = 0;
  let successes = 0;
  let nextTryAt = 0;

  const canRequest = () => {
    if (state === "OPEN") {
      if (Date.now() >= nextTryAt) {
        state = "HALF_OPEN";
        successes = 0;
        return true;
      }
      return false;
    }
    return true;
  };

  const onSuccess = () => {
    if (state === "HALF_OPEN") {
      successes++;
      if (successes >= successThreshold) {
        state = "CLOSED";
        failures = 0;
        successes = 0;
      }
    } else {
      failures = 0;
    }
  };

  const onFailure = () => {
    if (state === "HALF_OPEN") {
      state = "OPEN";
      nextTryAt = Date.now() + openStateMs;
      failures = 0;
      successes = 0;
      return;
    }

    failures++;
    if (failures >= failureThreshold) {
      state = "OPEN";
      nextTryAt = Date.now() + openStateMs;
    }
  };

  return {
    getState: () => state,
    exec: async (fn) => {
      if (!canRequest()) {
        const err = new Error("CircuitBreakerOpen");
        err.code = "CIRCUIT_OPEN";
        throw err;
      }
      try {
        const result = await fn();
        onSuccess();
        return result;
      } catch (e) {
        onFailure();
        throw e;
      }
    },
  };
}

const cb = createCircuitBreaker({
  failureThreshold: 4,
  successThreshold: 2,
  openStateMs: 10000,
});

async function getCharacters() {
  try {
    if (!nextPageUrl) return [];

    const data = await cb.exec(async () => {
      const response = await fetchWithRetry(nextPageUrl, {}, {
        retries: 2,
        timeoutMs: 7000,
      });

      if (!response.ok) {
        const err = new Error(`HTTP ${response.status}`);
        err.status = response.status;
        throw err;
      }

      return response.json();
    });

    nextPageUrl = data.info?.next ?? null;
    return data.results ?? [];
  } catch (error) {
    if (error.code === "CIRCUIT_OPEN") {
      console.warn("Circuito abierto: evita spamear la API por unos segundos.");
      alert("La API está temporalmente no disponible. Intenta en unos segundos.");
      return [];
    }

    console.error("Error al consumir la API:", error);
    return [];
  }
}


async function showCharacters() {
    const container = document.getElementById('characters')
    if (!container) return

    container.innerHTML = ''
    const characters = await getCharacters()

    let statusClass = 'text-gray-400'

    

    characters.forEach(character => {
        if (character.status === 'Alive') {
        statusClass = 'text-green-600'
    } else if (character.status === 'Dead') {
        statusClass = 'text-red-600'
    } else if (character.status === 'unknown'){
        character.status = '¿ Unknown ?'
        statusClass = 'text-gray-400'
    }
        const card = document.createElement('div')
        card.innerHTML = `
    <article class="bg-blue-900 border rounded-xl p-4" style="font-family: RickAndMorty;">
      <h3 class="font-black text-gray-100 text-2xl" >${character.name}</h3>
      <img src="${character.image}" alt="${character.name}" class="border rounded-2xl w-[150px] mx-auto">
      <p class="font-semibold text-2xl mt-2 ${statusClass}">
    ${character.status}      </article>
    `
        container.appendChild(card)
    })
}

showCharacters()