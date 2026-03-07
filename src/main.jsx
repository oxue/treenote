import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import AuthGate from './components/AuthGate';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthGate>
      {(session) => <App session={session} />}
    </AuthGate>
  </StrictMode>
);
