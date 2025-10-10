import { openDB } from 'idb'

const DB_NAME = 'ClashImageCache'
const STORE_NAME = 'images'

// ✅ Global memory cache
export const memoryCache = new Map()

// Initialize IndexedDB
const initImageDB = async () => {
  return openDB(DB_NAME, 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    },
  })
}

// Blob -> Base64
const blobToBase64 = (blob) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onloadend = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })

// Fetch and cache a single image
const cacheSingleImage = async (db, src) => {
  const key = src.startsWith('/') ? src.slice(1) : src
  const cached = await db.get(STORE_NAME, key)
  if (cached) {
    memoryCache.set(key, cached)
    return
  }

  try {
    const response = await fetch(src)
    if (!response.ok) throw new Error(`Failed to fetch ${src}`)
    const blob = await response.blob()

    // For low-end devices, optionally store as ObjectURL instead of base64
    const base64 = await blobToBase64(blob)
    await db.put(STORE_NAME, base64, key)
    memoryCache.set(key, base64)
  } catch (err) {
    console.warn(`❌ Failed to cache ${src}`, err)
  }
}

// Batch caching with concurrency limit
const cacheBatch = async (db, paths = [], concurrency = 10) => {
  for (let i = 0; i < paths.length; i += concurrency) {
    const batch = paths.slice(i, i + concurrency)
    await Promise.all(batch.map((src) => cacheSingleImage(db, src)))
  }
}

// Main preload function
export const preloadImagesToIDB = async (paths = []) => {
  const db = await initImageDB()

  // Split paths: top-level first, subfolders second
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
      topLevel.push(src)
    }
  })

  // Cache top-level assets first (blocking)
  await cacheBatch(db, topLevel, 10)

  // Cache subfolder assets in background
  cacheBatch(db, subFolders, 5)
    .then(() => console.log('✅ Subfolder assets caching complete'))
    .catch((err) => console.error('❌ Subfolder caching failed', err))
}
