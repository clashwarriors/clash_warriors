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

const CachedImage = ({
  src,
  alt = '',
  className = '',
  style = {},
  fallback = '/fallback.png',
  ...props
}) => {
  const [imageData, setImageData] = useState(null)

  useEffect(() => {
    let isMounted = true
    const key = src.startsWith('/') ? src.slice(1) : src

    const loadImage = async () => {
      if (!src) return

      // Memory cache
      if (memoryCache.has(key)) {
        setImageData(memoryCache.get(key))
        return
      }

      try {
        const db = await initImageDB()
        const cachedData = await db.get(STORE_NAME, key) // could be Blob or Base64 string

        let imageURL

        if (cachedData) {
          // If it's a Blob, create object URL
          if (cachedData instanceof Blob) {
            imageURL = URL.createObjectURL(cachedData)
          } else {
            // Assume string (Base64 or URL)
            imageURL = cachedData
          }

          memoryCache.set(key, imageURL)
          if (isMounted) setImageData(imageURL)
          return
        }

        // Fetch if not cached
        const response = await fetch(src)
        if (!response.ok) throw new Error('Failed to fetch')
        const blob = await response.blob()

        // Convert to Base64 if you want consistent storage
        const reader = new FileReader()
        reader.onloadend = () => {
          const base64 = reader.result
          db.put(STORE_NAME, base64, key)
          memoryCache.set(key, base64)
          if (isMounted) setImageData(base64)
        }
        reader.readAsDataURL(blob)
      } catch (err) {
        console.warn(`❌ CachedImage error for ${src}`, err)
        if (isMounted) setImageData(fallback)
      }
    }

    loadImage()

    return () => {
      isMounted = false
    }
  }, [src, fallback])

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
