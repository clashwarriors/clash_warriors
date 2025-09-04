import React, { useState, useEffect } from 'react'
import { ref, getDownloadURL } from 'firebase/storage'
import { storage } from '../firebase' // import your firebase storage instance

const FirebaseImage = ({ path }) => {
  const [url, setUrl] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!path) {
      setError('No image path provided')
      return
    }
    const imageRef = ref(storage, path)
    getDownloadURL(imageRef)
      .then((url) => setUrl(url))
      .catch((err) => {
        console.error(err)
        setError('Failed to load image')
      })
  }, [path])

  if (error) return <div>{error}</div>
  if (!url) return <div>Loading image...</div>

  return <img src={url} alt={path} style={{ maxWidth: '100%' }} />
}

export default function App() {
  return (
    <div>
      <h1>Load Firebase Storage Image</h1>
      <FirebaseImage path="free/frostguard1.avif" />
    </div>
  )
}
