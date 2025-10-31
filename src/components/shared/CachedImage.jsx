import React, { useState, useEffect } from 'react'

// Simple in-memory cache
const memoryCache = new Map()

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
    if (!src) return

    let isMounted = true

    // Check memory cache first
    if (memoryCache.has(src)) {
      setImageData(memoryCache.get(src))
      return
    }

    // Load image and store in memory cache
    const img = new Image()
    img.src = src
    img.onload = () => {
      if (!isMounted) return
      memoryCache.set(src, src)
      setImageData(src)
    }
    img.onerror = () => {
      if (!isMounted) return
      setImageData(fallback)
    }

    return () => {
      isMounted = false
    }
  }, [src, fallback])

  if (!imageData) return null

  return (
    <img
      src={imageData}
      alt={alt}
      className={className}
      style={style}
      {...props}
    />
  )
}

export { memoryCache }
export default CachedImage
