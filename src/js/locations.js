let nextPageUrl = 'https://rickandmortyapi.com/api/location'

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
    const response = await fetch(url)
    if (!response.ok) throw new Error(`Error HTTP: ${response.status}`)
    return await response.json()
  } catch (error) {
    console.error('Error al consumir el residente:', error)
    return null
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