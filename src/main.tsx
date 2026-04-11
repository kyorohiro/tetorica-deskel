import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { DialogProvider } from './useDialog';
import { isTauri } from './native';


if ("serviceWorker" in navigator && !isTauri()) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/tetorica-deskel/demo/sw.js");
  });
}
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DialogProvider>
      <App />
    </DialogProvider>
  </React.StrictMode>
)