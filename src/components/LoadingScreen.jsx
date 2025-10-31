const FullScreenLoading = () => {
  return (
    <div
      style={{
        width: '100vw',
        height: '100vh',
        backgroundColor: '#000',
        position: 'relative',
      }}
    >
      {/* Background image */}
      <img
        src="/loading.png"
        alt="Loading..."
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
          position: 'absolute',
          zIndex: 1,
        }}
      />

      {/* Loading bar */}
      <div
        style={{
          position: 'absolute',
          bottom: '50px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '70%',
          height: '6px',
          background: '#444',
          borderRadius: '5px',
          overflow: 'hidden',
          zIndex: 2,
        }}
      >
        <div
          style={{
            width: '100%',
            height: '100%',
            background: 'linear-gradient(90deg, #00f0ff, #00ff73)',
            animation: 'railAnimation 2s infinite',
          }}
        />
      </div>

      {/* Animation keyframes */}
      <style>{`
        @keyframes railAnimation {
          0% { transform: translateX(-100%); }
          50% { transform: translateX(0%); }
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  )
}

export default FullScreenLoading
