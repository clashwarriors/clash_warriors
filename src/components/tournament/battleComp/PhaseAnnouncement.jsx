// ./battleComp/PhaseAnnouncement.jsx
import React, { memo } from 'react'

const PhaseAnnouncement = memo(({ text }) => {
  if (!text) return null
  return <div className="phase-announcement">{text.toUpperCase()}</div>
})

export default PhaseAnnouncement
