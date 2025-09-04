import React, { useCallback } from 'react'
import { Link } from 'react-router-dom'
import { triggerHapticFeedback } from './tournament/utils/haptic'
import './style/footer.css'

const Footer = () => {
  const handleHaptic = useCallback(() => {
    triggerHapticFeedback()
  }, [])

  return (
    <div className="new-homescreen-footer">
      <div className="footer-buttons">
        <Link to="/" onClick={handleHaptic}>
          <img
            src="/new/home.png"
            alt="Home"
            className="new-homescreen-footer-icon"
          />{' '}
        </Link>
        <Link to="/collections" onClick={handleHaptic}>
          <img
            src="/new/shop.png"
            alt="Shop"
            className="new-homescreen-footer-icon"
          />{' '}
        </Link>
        <Link to="/tournament" onClick={handleHaptic}>
          <img
            src="/new/battle.png"
            alt="Battle"
            className="new-homescreen-footer-icon"
          />{' '}
        </Link>
        <Link to="/friends" onClick={handleHaptic}>
          <img
            src="/new/friends.png"
            alt="Friends"
            className="new-homescreen-footer-icon"
          />{' '}
        </Link>
        <Link to="/airdrop" onClick={handleHaptic}>
          <img
            src="/new/airdrop.png"
            alt="Airdrop"
            className="new-homescreen-footer-icon"
          />{' '}
        </Link>
      </div>
      <div></div>
    </div>
  )
}

export default Footer
