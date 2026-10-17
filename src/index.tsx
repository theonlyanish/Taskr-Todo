import React from 'react';
import ReactDOM from 'react-dom/client';
import './styles.css';
import { Analytics } from '@vercel/analytics/react';
import App from './App';
import { offlineStorage } from './utils/offlineStorage';

// Initialize offline storage
offlineStorage.init().catch(console.error);

// Register service worker for PWA support
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js')
      .then(registration => {
        console.log('ServiceWorker registration successful');
      })
      .catch(err => {
        console.error('ServiceWorker registration failed:', err);
      });
  });
}

// Set up online/offline listeners
const checkOnlineStatus = () => {
  const isOnline = navigator.onLine;
  document.body.classList.toggle('offline', !isOnline);
  const syncIndicator = document.querySelector('.sync-indicator');
  syncIndicator?.classList.toggle('offline', !isOnline);
};

window.addEventListener('online', async () => {
  checkOnlineStatus();
  const pendingChanges = await offlineStorage.getPendingChanges();
  if (pendingChanges.length > 0) {
    const syncIndicator = document.querySelector('.sync-indicator');
    syncIndicator?.classList.add('syncing');
    try {
      // Here you would sync with your backend
      // After successful sync:
      await offlineStorage.clearPendingChanges();
      syncIndicator?.classList.remove('syncing');
    } catch (error) {
      console.error('Sync failed:', error);
      syncIndicator?.classList.add('error');
    }
  }
});

window.addEventListener('offline', checkOnlineStatus);

// Initial online status check
checkOnlineStatus();

// Creating the root element for rendering the application
const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <App />
    <Analytics />
  </React.StrictMode>
);

// Hide the static landing section in public/index.html once the app has mounted.
// The section exists so crawlers and no-JS visitors get real text; it is not part of the UI.
document.body.classList.add('app-mounted');
