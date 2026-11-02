import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { listenBackButton } from './lib/back';
import './fonts.css';
import './styles.css';

listenBackButton();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
