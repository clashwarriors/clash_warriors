// 🔹 Utility: Blob -> Base64
const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

// 🔹 Global memory cache
const animationMemoryCache = new Map() // stores {name -> base64[]}

// ----------------------------------------------------
// MAIN FUNCTION: Cache all animations into IndexedDB + Memory (base64 only)
// ----------------------------------------------------
export const setupAnimationsDB = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('Animations', 1)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      const stores = [
        'AEGIS_WARD',
        'ARCANE_OVERCHARGE',
        'BERSERKERS_FURY_HOR',
        'BERSERKERS_FURY_MAIN',
        'CELESTIAL_REJUVENATION',
        'DROP_ANIMATION',
        'FURY_UNLEASHED',
        'GUARDIANS_BULWARK',
        'MINDWRAP',
        'SOUL_LEECH',
        'TITAN_STRIKE',
        'TWIN_STRIKE',
      ]
      stores.forEach((store) => {
        if (!db.objectStoreNames.contains(store)) {
          db.createObjectStore(store, { keyPath: 'id' })
        }
      })
    }

    request.onsuccess = async (event) => {
      const db = event.target.result

      // Already cached → load memory
      if (localStorage.getItem('animationsCached') === 'true') {
        console.log(
          '✅ Animations already cached, loading from IndexedDB to memory...'
        )
        for (const storeName of db.objectStoreNames) {
          const tx = db.transaction(storeName, 'readonly')
          const store = tx.objectStore(storeName)
          const allReq = store.getAll()
          allReq.onsuccess = () => {
            animationMemoryCache.set(
              storeName,
              allReq.result.map((f) => f.dataUrl)
            )
          }
        }
        return resolve(db)
      }

      console.log('⏬ Downloading and caching animations in batches...')
      const animationMap = {
        AEGIS_WARD: {
          folder: 'AEGIS_WARD',
          baseName: 'aegisWard',
          frames: 119,
        },
        ARCANE_OVERCHARGE: {
          folder: 'ARCANE_OVERCHARGE',
          baseName: 'arcaneOvercharge',
          frames: 71,
        },
        BERSERKERS_FURY_HOR: {
          folder: 'BERSERKERS_FURY',
          baseName: 'berserkersFuryHor',
          frames: 47,
        },
        BERSERKERS_FURY_MAIN: {
          folder: 'BERSERKERS_FURY',
          baseName: 'berserkersFuryMain',
          frames: 94,
        },
        CELESTIAL_REJUVENATION: {
          folder: 'CELESTIAL_REJUVENATION',
          baseName: 'celestialRejuvenation',
          frames: 92,
        },
        DROP_ANIMATION: {
          folder: 'DROP_ANIMATION',
          baseName: 'dropSeq',
          frames: 60,
        },
        FURY_UNLEASHED: {
          folder: 'FURY_UNLEASHED',
          baseName: 'furyUnleashed',
          frames: 49,
        },
        GUARDIANS_BULWARK: {
          folder: 'GUARDIANS_BULWARK',
          baseName: 'guardiansBulwark',
          frames: 73,
        },
        MINDWRAP: { folder: 'MINDWRAP', baseName: 'mindWrap', frames: 119 },
        SOUL_LEECH: {
          folder: 'SOUL_LEECH',
          baseName: 'soulLeech',
          frames: 100,
        },
        TITAN_STRIKE: {
          folder: 'TITAN_STRIKE',
          baseName: 'titanStrike',
          frames: 74,
        },
        TWIN_STRIKE: {
          folder: 'TWIN_STRIKE',
          baseName: 'twinStrike',
          frames: 94,
        },
      }

      const BATCH_SIZE = 10

      for (const [storeName, info] of Object.entries(animationMap)) {
        const tasks = []
        for (let i = 1; i <= info.frames; i++) {
          const fileName = `${info.baseName}${String(i).padStart(3, '0')}.png`
          const filePath = `/animations/${info.folder}/${fileName}`
          tasks.push(
            fetch(filePath)
              .then((res) => {
                if (!res.ok) throw new Error(`File not found: ${filePath}`)
                return res.blob()
              })
              .then(blobToBase64)
              .then((base64) => ({ id: fileName, dataUrl: base64 }))
              .catch((err) => {
                console.warn(`❌ Skipping ${fileName}: ${err.message}`)
                return null
              })
          )
        }

        for (let j = 0; j < tasks.length; j += BATCH_SIZE) {
          const batch = tasks.slice(j, j + BATCH_SIZE)
          const results = await Promise.all(batch)
          const validResults = results.filter(Boolean)

          if (validResults.length > 0) {
            const tx = db.transaction(storeName, 'readwrite')
            const store = tx.objectStore(storeName)
            validResults.forEach((item) => store.put(item))
            await new Promise((r) => (tx.oncomplete = r))
          }

          if (!animationMemoryCache.has(storeName))
            animationMemoryCache.set(storeName, [])
          validResults.forEach((item) =>
            animationMemoryCache.get(storeName).push(item.dataUrl)
          )
        }

        console.log(`🎯 Cached ${storeName} (${info.frames} frames)`)
      }

      localStorage.setItem('animationsCached', 'true')
      console.log('🎉 All animations cached offline + memory')
      resolve(db)
    }

    request.onerror = (event) =>
      reject('Error opening Animations DB: ' + event.target.error)
  })
}

// ----------------------------------------------------
// FETCH SPECIFIC ABILITY FRAMES (for battle)
// ----------------------------------------------------
// fetchAbilityFrames: fetches frames for 1 ability only
export const fetchAbilityFrames = async (abilityName) => {
  // Check cache first (must be array)
  if (animationMemoryCache.has(abilityName)) {
    const cached = animationMemoryCache.get(abilityName)
    if (Array.isArray(cached)) return cached
    // If cached value is an object (all frames), reload single ability frames below
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open('Animations', 1)
    request.onsuccess = (event) => {
      const db = event.target.result

      if (!db.objectStoreNames.contains(abilityName)) return resolve([])

      const tx = db.transaction(abilityName, 'readonly')
      const store = tx.objectStore(abilityName)
      const getAllRequest = store.getAll()

      getAllRequest.onsuccess = () => {
        const frames = getAllRequest.result.map((f) => f.dataUrl)
        animationMemoryCache.set(abilityName, frames) // Cache single ability frames as Array
        resolve(frames)
      }
      getAllRequest.onerror = () => reject(getAllRequest.error)
    }
    request.onerror = (e) => reject(e.target.error)
  })
}
