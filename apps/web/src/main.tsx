/**
 * App entry: mounts React app
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import './styles/globals.css';
import App from './App';

const rootEl = document.getElementById('root')!;
createRoot(rootEl).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);