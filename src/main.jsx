import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { registerSW } from 'virtual:pwa-register'

registerSW({
  immediate: true,
  onNeedRefresh() {
    window.location.reload()
  },
  onOfflineReady() {
    window.dispatchEvent(new CustomEvent('pwa-offline-ready'))
  },
  onRegistered(r) {
    if (r) {
      setInterval(() => r.update(), 60 * 60 * 1000)
    }
  },
  onRegisterError(error) {
    console.error('Error registrando SW:', error)
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <App />
)
