export const playStoredAudio = (key) => {
  const soundEnabled = JSON.parse(localStorage.getItem('soundEnabled')) ?? true; // Default to true

  if (!soundEnabled) {
    console.log('🔇 Sound is disabled. Skipping audio playback.');
    return;
  }

  const audioData = localStorage.getItem(key);

  if (!audioData) {
    console.warn(`⚠️ No audio found in LocalStorage for key: ${key}`);
    return;
  }

  try {
    const audio = new Audio(audioData);
    audio.loop = false;
    const playPromise = audio.play();

    if (playPromise !== undefined) {
      playPromise
        .then(() => {
          console.log(`🔊 Successfully playing audio: ${key}`);
        })
        .catch((error) => {
          console.error(`❌ Failed to play audio "${key}":`, error);
        });
    }
  } catch (error) {
    console.error(`❌ Error while initializing audio for key "${key}":`, error);
  }
};
