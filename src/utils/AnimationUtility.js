// 🔹 Utility: Blob -> Base64 (only convert when needed)
const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

// 🔹 Global memory cache (store blobs, convert to base64 on render)
const animationMemoryCache = new Map() // { abilityName -> Blob[] }

// ----------------------------------------------------
// MAIN FUNCTION: Cache all animations into IndexedDB + Memory
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

      // Already cached? Load memory from IndexedDB
      if (localStorage.getItem('animationsCached') === 'true') {
        console.log('✅ Animations already cached, loading memory...')
        for (const storeName of db.objectStoreNames) {
          const tx = db.transaction(storeName, 'readonly')
          const store = tx.objectStore(storeName)
          const allReq = store.getAll()
          allReq.onsuccess = () => {
            animationMemoryCache.set(
              storeName,
              allReq.result.map((f) => f.blob || f.dataUrl) // fallback
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
        if (!animationMemoryCache.has(storeName))
          animationMemoryCache.set(storeName, [])
        const framesArray = animationMemoryCache.get(storeName)

        for (let i = 1; i <= info.frames; i += BATCH_SIZE) {
          const batchPromises = []
          for (let j = 0; j < BATCH_SIZE && i + j <= info.frames; j++) {
            const idx = i + j
            const fileName = `${info.baseName}${String(idx).padStart(3, '0')}.png`
            const filePath = `/animations/${info.folder}/${fileName}`
            batchPromises.push(
              fetch(filePath)
                .then((res) => {
                  if (!res.ok) throw new Error(`File not found: ${filePath}`)
                  return res.blob()
                })
                .catch((err) => {
                  console.warn(`❌ Skipping ${fileName}: ${err.message}`)
                  return null
                })
            )
          }

          const batchBlobs = await Promise.all(batchPromises)
          const validBlobs = batchBlobs.filter(Boolean)
          validBlobs.forEach((blob) => framesArray.push(blob))

          if (validBlobs.length > 0) {
            const tx = db.transaction(storeName, 'readwrite')
            const store = tx.objectStore(storeName)
            validBlobs.forEach((blob, idx) => {
              const id = `${info.baseName}${String(i + idx).padStart(3, '0')}.png`
              store.put({ id, blob })
            })
            await new Promise((r) => (tx.oncomplete = r))
          }
        }

        console.log(`🎯 Cached ${storeName} (${framesArray.length} frames)`)
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
export const fetchAbilityFrames = async (abilityName) => {
  // Memory cache first
  if (animationMemoryCache.has(abilityName)) {
    const cached = animationMemoryCache.get(abilityName)
    if (Array.isArray(cached)) return cached
  }

  return new Promise((resolve, reject) => {
    const request = indexedDB.open('Animations', 1)
    request.onsuccess = async (event) => {
      const db = event.target.result
      if (!db.objectStoreNames.contains(abilityName)) return resolve([])

      const tx = db.transaction(abilityName, 'readonly')
      const store = tx.objectStore(abilityName)
      const getAllRequest = store.getAll()
      getAllRequest.onsuccess = () => {
        const frames = getAllRequest.result.map((f) => f.blob || f.dataUrl)
        animationMemoryCache.set(abilityName, frames)
        resolve(frames)
      }
      getAllRequest.onerror = () => reject(getAllRequest.error)
    }
    request.onerror = (e) => reject(e.target.error)
  })
}
