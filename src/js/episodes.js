let nextPageUrl = 'https://rickandmortyapi.com/api/episode'

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
    const response = await fetch(url)

    if (!response.ok) {
      throw new Error(`Error HTTP: ${response.status}`)
    }

    return await response.json()
  } catch (error) {
    console.error('Error al consumir el personaje:', error)
    return null
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