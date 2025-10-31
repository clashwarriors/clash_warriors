import React, { useEffect, useState, useCallback, useMemo } from 'react'
import {
  TonConnectButton,
  useTonConnectUI,
  useTonWallet,
} from '@tonconnect/ui-react'
import { firestoreDB } from '../firebase'
import {
  collection,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
} from 'firebase/firestore'
import './style/settings.style.css'
import { triggerHapticFeedback } from './tournament/utils/haptic'
import { clearGameMemory } from '../utils/clearMemory'
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
    if (!wallet || !user?.userId || walletSaved) return

    const walletAddress = wallet.account.address
    const userDocRef = doc(firestoreDB, 'users', user.userId)

    const saveWallet = async () => {
      try {
        const userSnap = await getDoc(userDocRef)

        let walletData = {}
        if (userSnap.exists()) {
          walletData = userSnap.data().walletId || {}
        } else {
          // If user doc doesn't exist, create it
          await setDoc(userDocRef, { walletId: {} }, { merge: true })
        }

        // Check if wallet already exists
        const existing = Object.values(walletData)
        if (!existing.includes(walletAddress)) {
          const newIndex = Object.keys(walletData).length + 1
          const updates = { ...walletData, [newIndex]: walletAddress }
          await updateDoc(userDocRef, { walletId: updates })
        }

        setWalletSaved(true)
      } catch (error) {
        console.error('Failed to save wallet:', error)
      }
    }

    saveWallet()
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

  const faqData = [
    {
      question: 'How do I start a battle?',
      answer:
        'Tap "Start Battle". If a live user is available, you’ll face them; otherwise, you’ll battle an AI fallback.',
    },
    {
      question: 'What are abilities in Clash Warriors?',
      answer:
        'There are two types: Defense and Attack abilities. You can see details on the Tournament page.',
    },
    {
      question: 'What is $WARS token used for?',
      answer:
        '$WARS is the in-game currency for battles, wagers, marketplace trades, and premium items — coming soon.',
    },
    {
      question: 'How do I connect my wallet?',
      answer:
        'Tap the “Connect Wallet” button in Settings. We support Tonkeeper and Tonhub on TON.',
    },
    {
      question: 'Can I play without connecting my wallet?',
      answer:
        'Yes! You can start battles without a wallet. Wallet connection is required only for $WARS usage in the future.',
    },
    {
      question: 'What happens if I lose a battle?',
      answer:
        'If you lose, you can retry immediately. You won’t lose anything currently as battles are free.',
    },
    {
      question: 'How do I check my abilities?',
      answer:
        'Go to the Tournament page to view your Attack and Defense abilities and their effects.',
    },
    {
      question: 'Can I play with friends?',
      answer:
        'Currently battles are matched automatically. PvP friend battles will be added in future updates.',
    },
    {
      question: 'Is sound enabled by default?',
      answer: 'Yes! You can toggle sound effects in Settings at any time.',
    },
    {
      question: 'How do I report issues or ask questions?',
      answer:
        'Tap the "Contact Support" button in Settings and submit your question. Our team will respond soon.',
    },
  ]

  const visibleFAQs = showAllFAQs ? faqData : faqData.slice(0, 2)
  return (
    <div className="settings-page">
      <h2 className="settings-page__title">Settings</h2>

      {/* TonConnect Button */}
      <div className="settings-page__wallet">
        <TonConnectButton />
      </div>

      {/* FAQ List */}
      <div className="settings-page__faq">
        {visibleFAQs.map((faq, idx) => (
          <details key={idx} className="faq-item">
            <summary className="faq-item__question">Q: {faq.question}</summary>
            <p className="faq-item__answer">A: {faq.answer}</p>
          </details>
        ))}

        {faqData.length > 2 && (
          <button
            className="faq-toggle-btn"
            onClick={() => setShowAllFAQs(!showAllFAQs)}
          >
            {showAllFAQs ? 'Show Less' : 'Show More'}
          </button>
        )}
      </div>

      {/* Support Modal */}
      {showSupportModal && (
        <div
          className="support-modal__backdrop"
          onClick={() => setShowSupportModal(false)}
        >
          <div
            className="support-modal__content"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              className="support-modal__close"
              onClick={() => setShowSupportModal(false)}
            >
              &times;
            </button>
            <h3 className="support-modal__title">Submit a Question</h3>

            <form className="support-form" onSubmit={handleSubmitQuestion}>
              <input
                type="text"
                className="support-form__input"
                value={questionInput}
                onChange={(e) => setQuestionInput(e.target.value)}
                placeholder="Describe your issue..."
              />
              <button type="submit" className="support-form__submit">
                Submit
              </button>
              {submitMsg && (
                <div
                  className={`support-form__message ${
                    submitMsg.includes('✅') ? 'success' : 'error'
                  }`}
                >
                  {submitMsg}
                </div>
              )}
            </form>
          </div>
        </div>
      )}

      {/* Support Button */}
      <button
        className="settings-page__btn settings-page__btn--support"
        onClick={() => setShowSupportModal(true)}
      >
        Contact Support
      </button>

      {/* Memory Clear Button */}
      <button
        className="settings-page__btn settings-page__btn--memory"
        onClick={clearGameMemory}
      >
        Memory Clear
      </button>
    </div>
  )
}

export default Settings
