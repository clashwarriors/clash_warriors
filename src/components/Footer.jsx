import React, { memo, useCallback } from 'react'
import { Link } from 'react-router-dom'
import CachedImage from './Shared/CachedImage'
import { triggerHapticFeedback } from './tournament/utils/haptic'
import './style/footer.css'

// Memoize Footer so it only re-renders if props change
const Footer = () => {
  const handleHaptic = useCallback(() => {
    triggerHapticFeedback()
  }, [])

  // Static footer buttons array
  const footerButtons = [
    { to: '/', src: '/new/home.png', alt: 'Home' },
    { to: '/collections', src: '/new/shop.png', alt: 'Shop' },
    { to: '/tournament', src: '/new/battle.png', alt: 'Battle' },
    { to: '/friends', src: '/new/friends.png', alt: 'Friends' },
    { to: '/airdrop', src: '/new/airdrop.png', alt: 'Airdrop' },
  ]

  return (
    <div className="new-homescreen-footer">
      <div className="footer-buttons">
        {footerButtons.map(({ to, src, alt }) => (
          <Link key={to} to={to} onClick={handleHaptic}>
            <CachedImage
              src={src}
              alt={alt}
              className="new-homescreen-footer-icon"
            />
          </Link>
        ))}
      </div>
    </div>
  )
}

// Memo to prevent unnecessary re-renders
export default memo(Footer)
