import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AuthGate from './components/AuthGate';

const isElectron = !!window.treenote;

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {isElectron ? (
      <App session={null} />
    ) : (
      <AuthGate>
        {(session) => <App session={session} />}
      </AuthGate>
    )}
  </StrictMode>
);
