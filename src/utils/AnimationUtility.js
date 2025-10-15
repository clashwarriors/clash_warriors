// 🔹 Utility: Blob -> Base64 (only convert when needed)
const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

// 🔹 Global memory cache (store blobs, convert to base64 on render)
const animationMemoryCache = new Map()
const soundMemoryCache = new Map()

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

      if (localStorage.getItem('animationsCached') === 'true') {
        console.log('✅ Animations already cached, loading memory...')
        for (const storeName of db.objectStoreNames) {
          const tx = db.transaction(storeName, 'readonly')
          const store = tx.objectStore(storeName)
          const allReq = store.getAll()
          allReq.onsuccess = () => {
            animationMemoryCache.set(
              storeName,
              allReq.result.map((f) => f.dataUrl) // all stored as Base64
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
                .then((blob) => blobToBase64(blob)) // convert to Base64 here
                .catch((err) => {
                  console.warn(`❌ Skipping ${fileName}: ${err.message}`)
                  return null
                })
            )
          }

          const batchBase64 = await Promise.all(batchPromises)
          const validBase64 = batchBase64.filter(Boolean)
          validBase64.forEach((dataUrl) => framesArray.push(dataUrl))

          if (validBase64.length > 0) {
            const tx = db.transaction(storeName, 'readwrite')
            const store = tx.objectStore(storeName)
            validBase64.forEach((dataUrl, idx) => {
              const id = `${info.baseName}${String(i + idx).padStart(3, '0')}.png`
              store.put({ id, dataUrl })
            })
            await new Promise((r) => (tx.oncomplete = r))
          }
        }

        console.log(
          `🎯 Cached ${storeName} (${framesArray.length} frames as Base64)`
        )
      }

      localStorage.setItem('animationsCached', 'true')
      console.log('🎉 All animations cached offline + memory (Base64)')
      resolve(db)
    }

    request.onerror = (event) =>
      reject('Error opening Animations DB: ' + event.target.error)
  })
}

// ----------------------------------------------------
// MAIN FUNCTION: Cache all soundEffects into IndexedDB + Memory
// ----------------------------------------------------

export const setupSoundsDB = async () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('SoundEffects', 1)

    request.onupgradeneeded = (event) => {
      const db = event.target.result
      const sounds = [
        'berserkersFury',
        'aegisWard',
        'arcaneOvercharge',
        'celestialRejuvenation',
        'furyUnleashed',
        'guardianBulwark',
        'mindWrap',
        'soulLeech',
        'titanStrike',
        'twinStrike',
      ]
      if (!db.objectStoreNames.contains('sounds')) {
        db.createObjectStore('sounds', { keyPath: 'name' })
      }
    }

    request.onsuccess = async (event) => {
      const db = event.target.result
      if (localStorage.getItem('soundsCached') === 'true') {
        console.log('✅ Sounds already cached, loading memory...')
        const tx = db.transaction('sounds', 'readonly')
        const store = tx.objectStore('sounds')
        const allReq = store.getAll()
        allReq.onsuccess = () => {
          allReq.result.forEach((item) =>
            soundMemoryCache.set(item.name, item.blob)
          )
          resolve(db)
        }
        allReq.onerror = (err) => reject(err)
        return
      }

      console.log('⏬ Downloading and caching sounds...')
      const soundMap = {
        berserkersFury: '/soundEffects/berserkersFury.mp3',
        aegisWard: '/soundEffects/aegisWard.mp3',
        arcaneOvercharge: '/soundEffects/arcaneOvercharge.mp3',
        celestialRejuvenation: '/soundEffects/celestialRejuvenction.mp3',
        furyUnleashed: '/soundEffects/furyUnleashed.mp3',
        guardianBulwark: '/soundEffects/guardianBulwark.mp3',
        mindWrap: '/soundEffects/mindWrap.mp3',
        soulLeech: '/soundEffects/soulLeech.mp3',
        titanStrike: '/soundEffects/titanStrike.mp3',
        twinStrike: '/soundEffects/twinStrike.mp3',
      }

      for (const [name, url] of Object.entries(soundMap)) {
        try {
          const res = await fetch(url)
          if (!res.ok) throw new Error(`Failed to fetch ${url}`)
          const blob = await res.blob()
          soundMemoryCache.set(name, blob)

          const tx = db.transaction('sounds', 'readwrite')
          const store = tx.objectStore('sounds')
          store.put({ name, blob })
          await new Promise((r) => (tx.oncomplete = r))
          console.log(`🎯 Cached sound: ${name}`)
        } catch (err) {
          console.warn(`❌ Skipping ${name}: ${err.message}`)
        }
      }

      localStorage.setItem('soundsCached', 'true')
      console.log('🎉 All sounds cached offline + memory')
      resolve(db)
    }

    request.onerror = (e) => reject(e.target.error)
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
        // Only fetch Base64 / dataUrl
        const frames = getAllRequest.result.map((f) => f.dataUrl)
        animationMemoryCache.set(abilityName, frames)
        resolve(frames)
      }
      getAllRequest.onerror = () => reject(getAllRequest.error)
    }
    request.onerror = (e) => reject(e.target.error)
  })
}

export const fetchSoundEffects = (() => {
  const activeSounds = []

  // Fetch Audio object directly from IndexedDB
  const fetchAudio = async (name) => {
    const db = await new Promise((res, rej) => {
      const req = indexedDB.open('SoundEffects', 1)
      req.onsuccess = () => res(req.result)
      req.onerror = (e) => rej(e.target.error)
    })

    if (!db.objectStoreNames.contains('sounds')) return null

    const tx = db.transaction('sounds', 'readonly')
    const store = tx.objectStore('sounds')
    const req = store.get(name)

    const blob = await new Promise((resolve) => {
      req.onsuccess = () => resolve(req.result?.blob || null)
      req.onerror = () => resolve(null)
    })

    if (!blob) return null

    const audio = new Audio(URL.createObjectURL(blob))
    audio.preload = 'auto'
    return audio
  }

  return {
    play: async (name, autoStopMs = null) => {
      const audio = await fetchAudio(name)
      if (!audio) return null

      audio.play().catch(() => console.warn(`Failed to play sound: ${name}`))
      activeSounds.push(audio)

      if (autoStopMs) {
        setTimeout(() => {
          if (audio && typeof audio.pause === 'function') {
            audio.pause()
            audio.currentTime = 0
            const idx = activeSounds.indexOf(audio)
            if (idx >= 0) activeSounds.splice(idx, 1)
          }
        }, autoStopMs)
      }

      return audio
    },

    stop: (audio) => {
      if (!audio || typeof audio.pause !== 'function') return
      audio.pause()
      audio.currentTime = 0
      const idx = activeSounds.indexOf(audio)
      if (idx >= 0) activeSounds.splice(idx, 1)
    },

    stopAll: () => {
      activeSounds.forEach((audio) => {
        if (audio && typeof audio.pause === 'function') {
          audio.pause()
          audio.currentTime = 0
        }
      })
      activeSounds.length = 0
    },
  }
})()
