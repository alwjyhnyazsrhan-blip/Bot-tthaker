import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { installGlobalFetchInterceptor } from './utils/authManager';

// Automatically inject active Bearer Token on every outgoing request
installGlobalFetchInterceptor();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
