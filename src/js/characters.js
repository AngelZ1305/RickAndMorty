

async function getCharacters() {
    try {
        const response = await fetch('https://rickandmortyapi.com/api/character')

        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`)
        }

        const data = await response.json()
        console.log(data)
        return data.results

    } catch (error) {
        console.error('Error al consumir la API:', error)
        return []
    }
}



async function showCharacters() {
    const container = document.getElementById('characters')
    if (!container) return

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