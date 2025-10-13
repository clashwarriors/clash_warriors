// src/components/tournament/FriendlyModal.jsx
import React from 'react'
import '../tournament/style/tournament.style.css'

const FriendlyModal = ({
  backend,
  friendlyChallenge,
  friendUsername,
  setFriendUsername,
  sendChallenge,
  cancelChallenge,
  closeModal,
}) => {
  return (
    <div className="friendly-modal-overlay" onClick={closeModal}>
      <div
        className="friendly-modal-container"
        onClick={(e) => e.stopPropagation()}
      >
        <h2>Friendly Challenge Created</h2>

        <div className="friendly-code-wrapper">
          <input
            type="text"
            value={friendlyChallenge.code}
            readOnly
            className="friendly-code-input"
          />
          <button
            className="friendly-code-copy"
            onClick={() =>
              navigator.clipboard.writeText(friendlyChallenge.code)
            }
          >
            ✔
          </button>
        </div>

        <div className="friendly-link-wrapper">
          <input
            type="text"
            value={`${backend}/battle-invite/${friendlyChallenge.code}`}
            readOnly
            className="friendly-link-input"
          />
          <button
            className="friendly-link-copy"
            onClick={() =>
              navigator.clipboard.writeText(
                `${backend}/battle-challenge/${friendlyChallenge.code}`
              )
            }
          >
            Copy Link
          </button>
        </div>

        <input
          type="text"
          placeholder="Enter friend's username"
          className="friendly-username-input"
          value={friendUsername}
          onChange={(e) => setFriendUsername(e.target.value)}
        />
        <button className="friendly-send-btn" onClick={sendChallenge}>
          Send Challenge
        </button>
        <button className="friendly-send-btn" onClick={cancelChallenge}>
          Cancel Challenge
        </button>
      </div>
    </div>
  )
}

export default FriendlyModal
