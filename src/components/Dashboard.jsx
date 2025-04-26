import React, { useState, useEffect, useCallback, useMemo } from 'react';
import './style/dashboard.style.css';
import Header from './DashComp/Header';
import Daily from './DashComp/Daily';
import TaptoEarn from './DashComp/TaptoEarn';
import Tutorial from './Tutorial';

function Dashboard({ user, status }) {
  const [isTutorialOpen, setIsTutorialOpen] = useState(false);

  useEffect(() => {
    if (localStorage.getItem('tutorialDone') !== 'true') {
      setIsTutorialOpen(true);
    }
  }, []);

  const handleCloseTutorial = useCallback(() => {
    setIsTutorialOpen(false);
    localStorage.setItem('tutorialDone', 'true'); // Save so it doesn't reopen next time
  }, []);

  const dashboardContent = useMemo(() => {
    if (!user) {
      return <div>{status}</div>;
    }

    return (
      <div>
        <Header user={user} />
        <Daily user={user} />
        <TaptoEarn user={user} />
        {isTutorialOpen && <Tutorial user={user} onClose={handleCloseTutorial} />}
      </div>
    );
  }, [user, status, isTutorialOpen, handleCloseTutorial]);

  return (
    <div className="dashboard">
      {!user ? (
        <div>Loading...</div>
      ) : (
        dashboardContent
      )}
    </div>
  );
}

export default Dashboard;
