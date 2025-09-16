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
const decodedCache = new Map() // stores {name -> Image[]}

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

      // If already cached, just load into memory map
      if (localStorage.getItem('animationsCached') === 'true') {
        console.log(
          '✅ Animations already cached, loading from IndexedDB to memory...'
        )
        await preloadAllFromDB(db)
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
                if (!res.headers.get('content-type')?.includes('image/png'))
                  throw new Error(`Not a PNG: ${filePath}`)
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

        // Process in batches
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

          // Also push into memory cache
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
// HELPER: Load all from IndexedDB into memory (base64 only)
// ----------------------------------------------------

const preloadAllFromDB = async (db) => {
  const stores = db.objectStoreNames
  for (let i = 0; i < stores.length; i++) {
    const storeName = stores[i]
    const tx = db.transaction(storeName, 'readonly')
    const store = tx.objectStore(storeName)
    const req = store.getAll()
    await new Promise((resolve) => {
      req.onsuccess = () => {
        animationMemoryCache.set(
          storeName,
          req.result.map((r) => r.dataUrl)
        )
        resolve()
      }
    })
    console.log(`📦 Loaded ${storeName} into memory`)
  }
}

// ----------------------------------------------------
// SECOND FUNCTION: Decode 2 animations on demand
// ----------------------------------------------------

export const decodeAnimations = async (names = []) => {
  // Clear previously decoded
  decodedCache.clear()

  for (const name of names) {
    const base64Array = animationMemoryCache.get(name)
    if (!base64Array) {
      console.warn(`⚠️ Animation ${name} not found in memory`)
      continue
    }

    const decodedFrames = []
    for (const dataUrl of base64Array) {
      const img = new Image()
      img.src = dataUrl
      await img.decode()
      decodedFrames.push(img)
    }

    decodedCache.set(name, decodedFrames)
    console.log(`✅ Decoded ${name} into Image[]`)
  }

  return decodedCache
}
