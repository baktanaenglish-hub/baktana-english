import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { listenBackButton } from './lib/back';
import './styles.css';

listenBackButton();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
