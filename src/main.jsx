import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Capacitor } from '@capacitor/core';
import App from './App';
import MobileApp from './MobileApp';
import AuthGate from './components/AuthGate';

// Detect mobile mode: ?mobile=true in URL, or auto-detect from Capacitor
const params = new URLSearchParams(window.location.search);
const isMobile = params.get('mobile') === 'true' || Capacitor.isNativePlatform();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthGate>
      {(session) => isMobile ? <MobileApp session={session} /> : <App session={session} />}
    </AuthGate>
  </StrictMode>
);
