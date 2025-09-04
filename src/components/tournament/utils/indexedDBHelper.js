import { openDB } from 'idb';

// ✅ Initialize IndexedDB
export const initDB = async () => {
  return openDB('AnimationDB', 1, {
    upgrade(db) {
      if (!db.objectStoreNames.contains('frames')) {
        db.createObjectStore('frames');
        console.log('✅ IndexedDB initialized with "frames" store.');
      }
    },
  });
};

// ✅ Count Stored Frames
export const countStoredFrames = async (folder) => {
  const db = await initDB();
  const totalFrames = folder === 'dropSeq' ? 60 : 165;
  let stored = 0;

  for (let i = 1; i <= totalFrames; i++) {
    const id = folder === 'dropSeq'
      ? `72000${String(i).padStart(2, '0')}`
      : `${folder}_${i}`;
    if (await db.get('frames', id)) stored++;
  }
  return stored;
};

// ✅ Check if Frames Exist
export const checkIfFramesExist = async () => {
  const db = await initDB();
  return (await db.get('frames', 'ltr_1')) !== undefined;
};

// ✅ Save All Frames to IndexedDB (Turbo Speed)
export const saveAllFramesToIndexedDB = async (setProgress) => {
  const db = await initDB();
  const folders = ['ltr', 'rtl', 'dropSeq'];
  const frameCounts = { ltr: 165, rtl: 165, dropSeq: 60 };
  const batchSize = 20; // 🎯 Balanced for best download speed
  let savedFrames = 0;

  for (const folder of folders) {
    const total = frameCounts[folder];
    const existing = await countStoredFrames(folder);

    if (existing >= total) {
      console.log(`✅ ${folder} already complete (${existing}/${total}).`);
      savedFrames += existing;
      if (setProgress) setProgress(savedFrames);
      continue;
    }

    console.log(`⏳ Downloading missing frames for ${folder}...`);

    const fetchFrame = async (i) => {
      const frameID = folder === 'dropSeq'
        ? `72000${String(i).padStart(2, '0')}`
        : `${folder}_${i}`;

      const already = await db.get('frames', frameID);
      if (already) return null;

      const fileName = folder === 'dropSeq' ? `${frameID}.png` : `${i}.png`;
      const url = `${window.location.origin}/animations/${folder}/${fileName}`;

      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
        const blob = await res.blob();
        const base64 = await new Promise((resolve) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.readAsDataURL(blob);
        });
        return { frameID, base64 };
      } catch (e) {
        console.error(`❌ Failed to download ${url}`, e);
        return null;
      }
    };

    let framesToSave = [];
    for (let i = 1; i <= total; i += batchSize) {
      const batch = [...Array(batchSize).keys()]
        .map(offset => i + offset)
        .filter(n => n <= total)
        .map(fetchFrame);

      const results = await Promise.all(batch);
      framesToSave.push(...results.filter(Boolean));

      if (framesToSave.length > 0) {
        const tx = db.transaction('frames', 'readwrite');
        const store = tx.objectStore('frames');
        for (const { frameID, base64 } of framesToSave) {
          await store.put(base64, frameID);
          savedFrames++;
          if (setProgress) setProgress(savedFrames);
        }
        await tx.done;
        framesToSave = [];
      }
    }
  }

  console.log('✅ All frames downloaded and stored.');
};

// ✅ Load Frames from IndexedDB
export const loadFramesFromIndexedDB = async (folder, totalFrames = 165) => {
  const db = await initDB();
  const frames = [];

  for (let i = 1; i <= totalFrames; i++) {
    const frame = await db.get('frames', `${folder}_${i}`);
    if (frame) frames.push(frame);
    else console.warn(`⚠️ Missing frame: ${folder}_${i}`);
  }

  return frames;
};

// ✅ Memory Cache
const frameCache = { ltr: [], rtl: [], dropSeq: [] };

// ✅ Load Frames into Memory
export const loadFramesIntoMemory = async (folder) => {
  if (frameCache[folder]?.length > 0) {
    console.log(`✅ Frames already cached for ${folder}`);
    return frameCache[folder];
  }

  const db = await initDB();
  const frames = [];
  const count = folder === 'dropSeq' ? 60 : 165;

  for (let i = 1; i <= count; i++) {
    const frameID = folder === 'dropSeq'
      ? `72000${String(i).padStart(2, '0')}`
      : `${folder}_${i}`;

    const frame = await db.get('frames', frameID);
    if (frame) frames.push(frame);
    else console.warn(`⚠️ Missing frame: ${frameID}`);
  }

  frameCache[folder] = frames;
  console.log(`✅ Loaded ${frames.length} frames into memory for ${folder}`);
  return frames;
};

// ✅ Get Cached Frames
export const getFrames = (folder) => {
  return frameCache[folder] || [];
};

// ✅ Delete All Frames from IndexedDB
export const deleteAllFrames = async () => {
  const db = await initDB();
  await db.clear('frames');
  frameCache.ltr = [];
  frameCache.rtl = [];
  frameCache.dropSeq = [];
  console.log('🗑️ All animation frames deleted.');
};
