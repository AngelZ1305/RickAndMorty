let nextPageUrl = 'https://rickandmortyapi.com/api/episode'


const sleep = (ms) => new Promise((r) => setTimeout(r, ms));


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
    openStateMs = 10000,   // tiempo abierto
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


async function getEpisodes() {
  try {
    const response = await fetch(nextPageUrl)

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`)
    }

    const data = await response.json()

    nextPageUrl = data.info.next

    return data.results
  } catch (error) {
    console.error('Error al consumir la API:', error)
    return []
  }
}

document.getElementById('nextPage').addEventListener('click', async () => {
  if (!nextPageUrl) {
    alert('No hay más páginas')
    return
  }

  await showEpisodes()
})

async function getCharacterExample(url) {
  try {
    const data = await cb.exec(async () => {
      const response = await fetchWithRetry(url, {}, {
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

    return data;
  } catch (error) {
    if (error.code === "CIRCUIT_OPEN") {
      console.warn("Circuito abierto: llamada bloqueada temporalmente");
      return null;
    }

    console.error("Error al consumir el personaje:", error);
    return null;
  }
}

async function showEpisodes() {
  const container = document.getElementById('episodes')
  if (!container) return

  container.innerHTML = ''
  const episodes = await getEpisodes()

  for (const ep of episodes) {

    let characterImg = ''
    let characterName = 'No characters'

    if (ep.characters.length > 0) {
      const characterData = await getCharacterExample(ep.characters[5])
      if (characterData) {
        characterImg = characterData.image
        characterName = characterData.name
      }
    }

    const card = document.createElement('div')
    card.innerHTML = `
      <article class="bg-blue-900 border rounded-xl p-4 text-center" style="font-family: RickAndMorty;">
        <h3 class="font-extralight text-gray-100 text-2xl">${ep.name}</h3>

        <p class="font-extralight text-gray-200 mt-1">
          Episode: ${ep.episode}
        </p>

        <p class="text-gray-300">
          Air date: ${ep.air_date}
        </p>

        ${
          characterImg
            ? `<img 
                 src="${characterImg}" 
                 alt="${characterName}" 
                 class="w-[150px] mx-auto mt-3 rounded-2xl border"
               >
               <p class="text-gray-300 text-sm mt-1">
                 Example character: ${characterName}
               </p>`
            : ''
        }
      </article>
    `
    container.appendChild(card)
  }
}

showEpisodes()