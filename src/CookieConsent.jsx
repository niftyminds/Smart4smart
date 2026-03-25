import React, { useState, useEffect, useRef } from 'react';

const STORAGE_KEY = 'cookie_consent';

const defaultPreferences = {
  analytics: false,
  ads: false,
  personalization: false,
};

function updateGtagConsent(preferences) {
  const params = {
    analytics_storage: preferences.analytics ? 'granted' : 'denied',
    ad_storage: preferences.ads ? 'granted' : 'denied',
    ad_user_data: preferences.ads ? 'granted' : 'denied',
    ad_personalization: preferences.ads ? 'granted' : 'denied',
    personalization_storage: preferences.personalization ? 'granted' : 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
  };
  if (typeof window.gtag === 'function') {
    window.gtag('consent', 'update', params);
  } else {
    // Fallback: push directly to dataLayer if gtag isn't available yet
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ 0: 'consent', 1: 'update', 2: params });
  }
}

export default function CookieConsent() {
  const [status, setStatus] = useState(null); // null = not decided yet
  const [showModal, setShowModal] = useState(false);
  const [preferences, setPreferences] = useState(defaultPreferences);
  const bannerAnimated = useRef(false);

  // Derive slide class before render — true after first banner appearance
  const slideClass = bannerAnimated.current ? '' : 'animate-slide-up';
  if (status === null && !showModal && !bannerAnimated.current) {
    bannerAnimated.current = true;
  }

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setPreferences(parsed);
        setStatus('decided');
        updateGtagConsent(parsed);
      } catch {
        localStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const saveConsent = (prefs) => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    setPreferences(prefs);
    setStatus('decided');
    setShowModal(false);
    updateGtagConsent(prefs);
  };

  const acceptAll = () => saveConsent({ analytics: true, ads: true, personalization: true });
  const rejectAll = () => saveConsent({ analytics: false, ads: false, personalization: false });
  const saveCustom = () => saveConsent(preferences);

  return (
    <>
      {/* Floating cookie icon — shown after decision */}
      {status === 'decided' && !showModal && (
        <button
          onClick={() => setShowModal(true)}
          className="fixed bottom-4 left-4 z-50 w-12 h-12 bg-white rounded-full shadow-lg border border-slate-200 flex items-center justify-center text-xl hover:shadow-xl transition-shadow"
          aria-label="Nastavení cookies"
          title="Nastavení cookies"
        >
          🍪
        </button>
      )}

      {/* Initial banner — shown on first visit */}
      {status === null && !showModal && (
        <div className="fixed bottom-6 left-2 right-2 sm:bottom-10 sm:left-10 sm:right-10 z-50 py-3 px-1 sm:p-3">
          <div className={`${slideClass} max-w-5xl mx-auto bg-slate-100 rounded-2xl shadow-[0_20px_60px_-5px_rgba(0,0,0,0.12)] border border-slate-200 px-6 py-5 sm:px-8 sm:py-6 max-h-[calc(100vh-5rem)] overflow-y-auto`}>
            <div className="flex flex-col sm:flex-row sm:items-center gap-5">
              <div className="flex-1 min-w-0">
                <h3 className="text-slate-900 font-bold text-base mb-1">
                  <span aria-hidden="true">🍪 </span>Používáme cookies
                </h3>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Cookies nám pomáhají zlepšovat web a zobrazovat relevantní obsah. Nezbytné cookies jsou vždy aktivní.
                </p>
              </div>
              {/* Desktop: left→right | Mobile: col-reverse = Přijmout nahoře */}
              <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2 shrink-0">
                <button
                  onClick={rejectAll}
                  className="px-5 py-2.5 border-2 border-slate-300 text-slate-600 text-sm font-semibold rounded-xl hover:border-slate-400 hover:text-slate-800 transition-colors whitespace-nowrap"
                >
                  Odmítnout vše
                </button>
                <button
                  onClick={() => setShowModal(true)}
                  className="px-5 py-2.5 border-2 border-slate-300 text-slate-600 text-sm font-semibold rounded-xl hover:border-slate-400 hover:text-slate-800 transition-colors whitespace-nowrap"
                >
                  Přizpůsobit
                </button>
                <button
                  onClick={acceptAll}
                  className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold rounded-xl transition-all duration-200 whitespace-nowrap shadow-lg hover:shadow-xl"
                >
                  Přijmout vše
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preferences modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/75 flex items-center justify-center px-3 py-4 sm:p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget && status === 'decided') setShowModal(false);
          }}
        >
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl">
            <div className="p-5 sm:p-6">
              <div className="flex items-center justify-between mb-5">
                <h2 className="text-slate-900 font-bold text-lg sm:text-xl">
                  <span aria-hidden="true">🍪 </span>Nastavení cookies
                </h2>
                {status === 'decided' && (
                  <button
                    onClick={() => setShowModal(false)}
                    className="text-slate-400 hover:text-slate-600 transition-colors p-1 -mr-1 text-2xl leading-none"
                    aria-label="Zavřít"
                  >
                    ×
                  </button>
                )}
              </div>

              <div className="space-y-3 mb-6">
                <CookieCategory
                  title="Nezbytné cookies"
                  description="Zajišťují základní funkce webu jako navigace, formuláře a bezpečnost. Nelze je vypnout."
                  checked={true}
                  disabled={true}
                />
                <CookieCategory
                  title="Analytické cookies"
                  description="Pomáhají nám pochopit, jak návštěvníci web používají, a zlepšovat obsah (Google Analytics)."
                  checked={preferences.analytics}
                  onChange={(v) => setPreferences((p) => ({ ...p, analytics: v }))}
                />
                <CookieCategory
                  title="Reklamní cookies"
                  description="Umožňují zobrazovat relevantní reklamy a měřit jejich výkon (Google Ads, Meta/Facebook)."
                  checked={preferences.ads}
                  onChange={(v) => setPreferences((p) => ({ ...p, ads: v }))}
                />
                <CookieCategory
                  title="Personalizační cookies"
                  description="Zapamatují si vaše preference pro lepší zážitek při příštích návštěvách."
                  checked={preferences.personalization}
                  onChange={(v) => setPreferences((p) => ({ ...p, personalization: v }))}
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3">
                {status === null && (
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-3 border-2 border-slate-300 text-slate-700 font-medium rounded-xl hover:border-slate-400 transition-colors text-sm"
                  >
                    Zpět
                  </button>
                )}
                <button
                  onClick={saveCustom}
                  className="flex-1 px-4 py-3 border-2 border-slate-300 text-slate-700 font-medium rounded-xl hover:border-blue-600 hover:text-blue-600 transition-colors text-sm whitespace-nowrap"
                >
                  {status === null ? 'Přijmout vybrané' : 'Uložit nastavení'}
                </button>
                <button
                  onClick={acceptAll}
                  className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all duration-200 text-sm shadow-lg hover:shadow-xl"
                >
                  Přijmout vše
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function CookieCategory({ title, description, checked, disabled, onChange }) {
  return (
    <div className="flex items-start gap-3 p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border border-blue-100">
      <div className="flex-1 min-w-0">
        <p className="text-slate-900 font-semibold text-sm mb-0.5">{title}</p>
        <p className="text-slate-500 text-xs leading-relaxed">{description}</p>
      </div>
      {/* Toggle: w-12 (48px), thumb w-5 (20px) at top-0.5 left-0.5 (2px offset)
          OFF: thumb spans 2–22px | ON translate-x-6 (24px): thumb spans 26–46px, within 48px ✓ */}
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange?.(!checked)}
        className={`shrink-0 relative w-12 h-6 rounded-full transition-colors duration-200 mt-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
          disabled
            ? 'bg-blue-400/50 cursor-not-allowed'
            : checked
            ? 'bg-blue-600 cursor-pointer'
            : 'bg-slate-200 cursor-pointer hover:bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform duration-200 ${
            checked ? 'translate-x-6' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}
