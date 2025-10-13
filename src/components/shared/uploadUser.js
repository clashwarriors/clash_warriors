import axios from 'axios';
import { getUserData } from '../../utils/indexedDBService';

const backend = import.meta.env.VITE_API_BASE_URL;

export const logUserData = async (user) => {
  if (!user?.userId) return null;

  const fetchedUser = await getUserData(user.userId);
  if (!fetchedUser) return null;

  const payload = {
    first_name: fetchedUser.first_name,
    last_name: fetchedUser.last_name,
    photo_url: fetchedUser.photo_url,
    elo: fetchedUser.elo || 1200,
    league: fetchedUser.league || 'bronze',
    time_zone: fetchedUser.userTimeZone || 'UTC',
  };

  const res = await axios.post(
    `${backend}/api/upload-user-mysql/${fetchedUser.userId}`,
    payload, 
    { headers: { 'Content-Type': 'application/json' } }
  );

  console.log('Backend response:', res.data);
  return res.data;
};
