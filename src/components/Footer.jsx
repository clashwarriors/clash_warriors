import React, { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { triggerHapticFeedback } from './tournament/utils/haptic';
import './style/footer.css';

const Footer = () => {
  const handleHaptic = useCallback(() => {
    triggerHapticFeedback();
  }, []);

  return (
    <div className="footer-container">
      <div className="footer-buttons">
        <Link to="/" onClick={handleHaptic}>
          <img src="/assets/footer/stats.ft.png" alt="Stats" className="footer-icon" />
        </Link>
        <Link to="/collections" onClick={handleHaptic}>
          <img src="/assets/footer/collection.ft.png" alt="Collections" className="footer-icon" />
        </Link>
        <Link to="/tournament" onClick={handleHaptic}>
          <img src="/assets/footer/tournament.ft.png" alt="Tournament" className="footer-icon" />
        </Link>
        <Link to="/friends" onClick={handleHaptic}>
          <img src="/assets/footer/friends.ft.png" alt="Friends" className="footer-icon" />
        </Link>
        <Link to="/airdrop" onClick={handleHaptic}>
          <img src="/assets/footer/airdrop.ft.png" alt="Airdrop" className="footer-icon" />
        </Link>
      </div>
    </div>
  );
};

export default Footer;
