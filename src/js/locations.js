let nextPageUrl = 'https://rickandmortyapi.com/api/location'


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


async function getLocations() {
  try {
    const response = await fetch(nextPageUrl)
    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`)

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
  await showLocations()
})

async function getResident(url) {
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
      console.warn("Circuito abierto: residente bloqueado temporalmente");
      return null;
    }

    console.error("Error al consumir el residente:", error);
    return null;
  }
}

async function showLocations() {
  const container = document.getElementById('locations')
  if (!container) return

  container.innerHTML = ''
  const locations = await getLocations()

  for (const location of locations) {
    let residentImage = ''
    let residentName = ''

    if (location.residents.length > 0) {
      const residentData = await getResident(location.residents[0])
      if (residentData?.image) {
        residentImage = residentData.image
        residentName = residentData.name || ''
      }
    }

    const residentHtml = residentImage
      ? `<img src="${residentImage}" alt="${residentName || 'Resident'}" class="border rounded-2xl w-[150px] mx-auto" />`
      : `<p class="text-gray-400 text-sm mt-2 mb-30">No residents</p>`

    const card = document.createElement('div')
    card.innerHTML = `
      <article class="bg-blue-900 border rounded-xl p-4 " style="font-family: RickAndMorty;">
        <h3 class="font-extralight text-gray-100 text-lg">Name: ${location.name}</h3>
        <p class="text-gray-300">Type: ${location.type}</p>
        <p class="text-gray-200 mt-2">Resident example</p>
        ${residentHtml}
      </article>
    `
    container.appendChild(card)
  }
}

showLocations()