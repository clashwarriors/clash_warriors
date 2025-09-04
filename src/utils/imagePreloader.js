import { openDB } from 'idb'

const DB_NAME = 'ClashImageCache'
const STORE_NAME = 'images'

// ✅ Global memory cache
export const memoryCache = new Map()

const initImageDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    },
  })
}

const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

export const preloadImagesToIDB = async (paths = []) => {
  const db = await initImageDB()

  // Split into top-level new/ assets and subfolder assets
  const topLevel = []
  const subFolders = []

  paths.forEach((src) => {
    const cleanSrc = src.startsWith('/') ? src.slice(1) : src
    const parts = cleanSrc.split('/')

    if (parts.length === 2 && parts[0] === 'new') {
      topLevel.push(src)
    } else if (parts.length > 2 && parts[0] === 'new') {
      subFolders.push(src)
    } else {
      // If any other cases, treat as top level (optional)
      topLevel.push(src)
    }
  })

  // Helper to cache an array of paths concurrently with limited concurrency (e.g. 10)
  const concurrencyLimit = 10
  const cacheBatch = async (arr) => {
    for (let i = 0; i < arr.length; i += concurrencyLimit) {
      const batch = arr.slice(i, i + concurrencyLimit)
      await Promise.all(batch.map(async (src) => {
        const key = src.startsWith('/') ? src.slice(1) : src
        const cached = await db.get(STORE_NAME, key)
        if (!cached) {
          try {
            const response = await fetch(src)
            const blob = await response.blob()
            const base64 = await blobToBase64(blob)
            await db.put(STORE_NAME, base64, key)
            memoryCache.set(key, base64)
            console.log(`✅ Cached: ${key}`)
          } catch (err) {
            console.error(`❌ Failed to cache ${src}`, err)
          }
        } else {
          memoryCache.set(key, cached)
          //console.log(`📦 Already cached: ${key}`)
        }
      }))
    }
  }

  // First cache top-level assets
  await cacheBatch(topLevel)

  // Then cache subfolder assets (in background or after)
  cacheBatch(subFolders).then(() => {
    console.log('Subfolder assets caching complete')
  })
}
