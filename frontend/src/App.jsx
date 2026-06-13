import React, { useState, useEffect } from 'react';
import PublicPortal from './pages/PublicPortal';
import AdminDashboard from './pages/AdminDashboard';

function App() {
  const [currentHash, setCurrentHash] = useState(window.location.hash || '#/');

  useEffect(() => {
    const handleHashChange = () => {
      setCurrentHash(window.location.hash || '#/');
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => {
      window.removeEventListener('hashchange', handleHashChange);
    };
  }, []);

  const navigateTo = (hash) => {
    window.location.hash = hash;
    setCurrentHash(hash);
  };

  // Simple routing based on hash paths
  if (currentHash.startsWith('#/admin')) {
    return <AdminDashboard navigate={navigateTo} />;
  }

  return <PublicPortal navigate={navigateTo} />;
}

export default App;
