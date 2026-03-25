import React from 'react'
import ReactDOM from 'react-dom/client'
import ChargingStationCalculator from './ChargingStationCalculator.jsx'
import CookieConsent from './CookieConsent.jsx'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ChargingStationCalculator />
    <CookieConsent />
  </React.StrictMode>,
)
