import React, { useState, useEffect } from 'react'
import { openDB } from 'idb'
import { memoryCache } from '../../utils/imagePreloader'

const DB_NAME = 'ClashImageCache'
const STORE_NAME = 'images'

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

const CachedImage = ({
  src,
  alt = '',
  className = '',
  style = {},
  fallback = '/fallback.png',
  ...props
}) => {
  const [imageData, setImageData] = useState(null)
  const [triedNetwork, setTriedNetwork] = useState(false)

  useEffect(() => {
    let isMounted = true
    const cleanKey = src?.startsWith('/') ? src.slice(1) : src

    const loadFromCache = async () => {
      if (!src || typeof src !== 'string') return

      if (src.startsWith('data:')) {
        setImageData(src)
        return
      }

      // Check memory cache first
      if (memoryCache.has(cleanKey)) {
        setImageData(memoryCache.get(cleanKey))
        return
      }

      try {
        const db = await initImageDB()
        const cached = await db.get(STORE_NAME, cleanKey)

        if (cached && isMounted) {
          memoryCache.set(cleanKey, cached)
          setImageData(cached)
        } else {
          // If not cached and haven't tried network yet, fetch now
          if (!triedNetwork) {
            try {
              const response = await fetch(src)
              if (!response.ok) throw new Error('Network response not ok')
              const blob = await response.blob()
              const base64 = await blobToBase64(blob)
              if (isMounted) {
                memoryCache.set(cleanKey, base64)
                setImageData(base64)
                const db = await initImageDB()
                await db.put(STORE_NAME, base64, cleanKey)
              }
              setTriedNetwork(true)
            } catch {
              if (isMounted) setImageData(fallback)
            }
          } else {
            if (isMounted) setImageData(fallback)
          }
        }
      } catch (err) {
        console.error(`❌ CachedImage error for ${src}:`, err)
        if (isMounted) setImageData(fallback)
      }
    }

    loadFromCache()
    return () => {
      isMounted = false
      setTriedNetwork(false)
    }
  }, [src, fallback, triedNetwork])

  // Prevent infinite fallback loop:
  const handleError = () => {
    if (imageData !== fallback) setImageData(fallback)
  }

  if (!imageData) return null

  return (
    <img
      src={imageData}
      alt={alt}
      className={className}
      style={style}
      {...props}
      onError={handleError}
    />
  )
}

export default CachedImage
