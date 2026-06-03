import React from 'react';
import { createRoot } from 'react-dom/client';
import { gsap } from 'gsap';
import { useGSAP } from '@gsap/react';
import App from './App.jsx';
import './styles.css';

gsap.registerPlugin(useGSAP);

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
