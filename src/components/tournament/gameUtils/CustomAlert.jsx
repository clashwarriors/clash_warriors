import React, { useState, useEffect } from 'react'

const CustomAlert = ({ message, onClose }) => {
  const [style, setStyle] = useState({
    position: 'fixed',
    top: '130px',
    left: '50%',
    transform: 'translateX(-50%) translateY(0)',
    backgroundColor: '#e74c3c', // red
    color: '#fff',
    padding: '12px 20px',
    borderRadius: '8px',
    fontWeight: 'bold',
    zIndex: 9999,
    opacity: 1,
    pointerEvents: 'none',
    transition: 'all 2.5s ease',
    width: '80%', // <-- add this
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      setStyle((prev) => ({
        ...prev,
        transform: 'translateX(-50%) translateY(-60px)',
        opacity: 0,
      }))
      setTimeout(onClose, 500) // remove after fade
    }, 2500)

    return () => clearTimeout(timer)
  }, [onClose])

  return <div style={style}>{message}</div>
}

export default CustomAlert
