export const clearGameMemory = async () => {
  try {
    console.log('🧠 Clearing game memory (except IndexedDB)...')

    // 1️⃣ Clear Local + Session Storage
    localStorage.clear()
    sessionStorage.clear()

    // 2️⃣ Clear all caches (service worker, runtime, images)
    if ('caches' in window) {
      const cacheNames = await caches.keys()
      await Promise.all(cacheNames.map(name => caches.delete(name)))
      console.log('✅ Cache storage cleared')
    }

    // 3️⃣ Unregister service workers
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations()
      for (const reg of regs) {
        await reg.unregister()
      }
      console.log('✅ Service workers unregistered')
    }

    // 4️⃣ Clear in-memory blobs and image URLs
    if (window.URL && window.URL.revokeObjectURL) {
      // optional: if you store blob URLs globally, revoke them
      if (window.cachedImageURLs) {
        window.cachedImageURLs.forEach((url) => URL.revokeObjectURL(url))
        window.cachedImageURLs = []
      }
      console.log('✅ Image blob memory cleared')
    }

    // 5️⃣ Force React state reset via reload (optional)
    window.location.reload()

  } catch (err) {
    console.error('❌ Error clearing game memory:', err)
  }
}
