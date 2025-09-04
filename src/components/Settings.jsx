import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  TonConnectButton,
  useTonConnectUI,
  useTonWallet,
} from '@tonconnect/ui-react'
import { realtimeDB, firestoreDB } from '../firebase'
import { ref, onValue, set } from 'firebase/database'
import { collection, getDocs, addDoc } from 'firebase/firestore'
import './style/settings.style.css'
import { deleteAllFrames } from './tournament/utils/indexedDBHelper'

const Settings = ({ user }) => {
  const wallet = useTonWallet()
  const [tonConnectUI] = useTonConnectUI()
  const [walletSaved, setWalletSaved] = useState(false)
  const [soundEnabled, setSoundEnabled] = useState(
    JSON.parse(localStorage.getItem('soundEnabled')) ?? true
  )
  const [importantFaqs, setImportantFaqs] = useState([])
  const [allFaqs, setAllFaqs] = useState([])
  const [faqLoading, setFaqLoading] = useState(true)
  const [questionInput, setQuestionInput] = useState('')
  const [submitMsg, setSubmitMsg] = useState('')
  const [showSupportModal, setShowSupportModal] = useState(false)
  const [showAllFAQs, setShowAllFAQs] = useState(false)

  useEffect(() => {
    if (wallet && user?.userId && !walletSaved) {
      const walletAddress = wallet.account.address
      const userWalletRef = ref(realtimeDB, `users/${user.userId}/walletId`)
      onValue(
        userWalletRef,
        (snapshot) => {
          const data = snapshot.val() || {}
          const existing = Object.values(data)
          if (!existing.includes(walletAddress)) {
            const newIndex = Object.keys(data).length + 1
            const updates = { ...data, [newIndex]: walletAddress }
            set(userWalletRef, updates)
          }
          setWalletSaved(true)
        },
        { onlyOnce: true }
      )
    }
  }, [wallet, user?.userId, walletSaved])

  const handleToggleSound = useCallback(() => {
    const newSoundState = !soundEnabled
    setSoundEnabled(newSoundState)
    localStorage.setItem('soundEnabled', JSON.stringify(newSoundState))
  }, [soundEnabled])

  const fetchFAQs = useCallback(async () => {
    try {
      const snapshot = await getDocs(collection(firestoreDB, 'faq'))
      const items = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }))
      setAllFaqs(items)
      setImportantFaqs(items.filter((item) => item.important))
    } catch (error) {
      console.error('Failed to fetch FAQs:', error)
    } finally {
      setFaqLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchFAQs()
  }, [fetchFAQs])

  const handleSubmitQuestion = useCallback(
    async (e) => {
      e.preventDefault()
      if (!questionInput.trim()) return

      try {
        await addDoc(collection(firestoreDB, 'faqUser'), {
          question: questionInput,
          answer: '',
          userId: user?.userId ?? '',
          timestamp: Date.now(),
        })

        setSubmitMsg('✅ Question submitted!')
        setQuestionInput('')
        setTimeout(() => setSubmitMsg(''), 3000)
      } catch (error) {
        console.error('Failed to submit question:', error)
        setSubmitMsg('❌ Failed to submit. Try again.')
      }
    },
    [questionInput, user?.userId]
  )

  const faqList = useMemo(
    () =>
      (showAllFAQs ? allFaqs : importantFaqs).map((faq, idx) => (
        <details
          key={faq.id || idx}
          className="settings-faq-item"
          style={{ marginBottom: '1rem' }}
        >
          <summary
            className="settings-faq-question"
            style={{ cursor: 'pointer', fontWeight: 'bold' }}
          >
            Q: {faq.question}
          </summary>
          <p className="settings-faq-answer" style={{ marginLeft: '1rem' }}>
            A: {faq.answer}
          </p>
        </details>
      )),
    [showAllFAQs, allFaqs, importantFaqs]
  )

  return (
    <div
      className="settings-container"
      style={{ padding: '1rem', textAlign: 'center' }}
    >
      <h2 className="settings-title">Settings</h2>

      <div
        style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}
      >
        <TonConnectButton />
      </div>

      <div className="settings-sound-toggle" style={{ marginTop: '1rem' }}>
        <label
          className="settings-sound-label"
          style={{
            fontWeight: 'bold',
            display: 'block',
            marginBottom: '0.5rem',
          }}
        >
          Sound Effects
        </label>

        <label className="switch">
          <input
            type="checkbox"
            checked={soundEnabled}
            onChange={handleToggleSound}
          />
          <span className="slider" />
        </label>
      </div>

      <button
        onClick={deleteAllFrames}
        style={{
          marginTop: '20px',
          padding: '10px',
          backgroundColor: 'red',
          color: 'white',
        }}
      >
        🗑️ Delete All Animations
      </button>

      <div
        className="settings-faq-support-section"
        style={{ marginTop: '2rem' }}
      >
        <h3 className="settings-faq-title">FAQ & Support</h3>

        <div
          className="settings-faq-list"
          style={{ textAlign: 'left', maxWidth: '600px', margin: '0 auto' }}
        >
          {faqLoading ? (
            <p className="settings-faq-loading">Loading FAQs...</p>
          ) : (
            <>
              {faqList}

              {allFaqs.length > importantFaqs.length && (
                <button
                  className="settings-show-toggle"
                  onClick={() => setShowAllFAQs(!showAllFAQs)}
                  style={{
                    marginTop: '1.2rem',
                    background: 'none',
                    border: 'none',
                    color: '#fff',
                    cursor: 'pointer',
                    textDecoration: 'underline',
                    fontWeight: 'bold',
                  }}
                >
                  {showAllFAQs ? 'Show Less' : 'Show All'}
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {showSupportModal && (
        <div
          className="settings-support-modal-backdrop"
          onClick={() => setShowSupportModal(false)}
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            width: '100%',
            height: '100%',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 9999,
          }}
        >
          <div
            className="settings-support-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              backgroundColor: '#000',
              padding: '2rem',
              borderRadius: '10px',
              width: '90%',
              maxWidth: '500px',
              position: 'relative',
            }}
          >
            <button
              className="settings-support-modal-close"
              onClick={() => setShowSupportModal(false)}
              style={{
                position: 'absolute',
                top: '10px',
                right: '15px',
                border: 'none',
                background: 'none',
                fontSize: '1.5rem',
                cursor: 'pointer',
              }}
            >
              &times;
            </button>
            <h3
              className="settings-support-modal-title"
              style={{ marginBottom: '1rem' }}
            >
              Submit a Question
            </h3>

            <form
              className="settings-support-form"
              onSubmit={handleSubmitQuestion}
            >
              <input
                type="text"
                className="settings-support-input"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                placeholder="Describe your issue..."
                style={{
                  padding: '0.5rem',
                  width: '100%',
                  borderRadius: '6px',
                  marginBottom: '1rem',
                }}
              />
              <button type="submit" className="settings-support-submit">
                Submit
              </button>
              {submitMsg && (
                <div
                  className="settings-support-message"
                  style={{
                    marginTop: '1rem',
                    color: submitMsg.includes('✅') ? 'green' : 'red',
                    fontWeight: 'bold',
                  }}
                >
                  {submitMsg}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      <button
        className="settings-support-button"
        onClick={() => setShowSupportModal(true)}
        style={{
          marginTop: '1rem',
          textDecoration: 'none',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          height: '40px',
          width: '150px',
          backgroundColor: '#007bff',
          color: '#fff',
          borderRadius: '10px',
          marginBottom: '2.8rem',
        }}
      >
        Contact Support
      </button>
    </div>
  )
}

export default Settings
