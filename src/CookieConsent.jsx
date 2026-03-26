import React, { useState, useEffect, useRef } from 'react';

function CookieIcon({ size = 20, className = '' }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" />
      <path d="M8.5 8.5v.01" />
      <path d="M16 15.5v.01" />
      <path d="M12 12v.01" />
      <path d="M11 17v.01" />
      <path d="M7 14v.01" />
    </svg>
  );
}

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
          className="fixed bottom-4 left-4 z-50 w-12 h-12 bg-white rounded-full shadow-lg border border-slate-200 flex items-center justify-center hover:shadow-xl transition-shadow text-slate-600"
          aria-label="Nastavení cookies"
          title="Nastavení cookies"
        >
          <CookieIcon size={22} />
        </button>
      )}

      {/* Initial banner — shown on first visit */}
      {status === null && !showModal && (
        /* Mobile: full-width bottom sheet | Desktop: floating card with margins */
        <div className="fixed bottom-2 left-2 right-2 sm:bottom-2 sm:left-4 sm:right-4 lg:bottom-10 lg:left-10 lg:right-10 z-50 lg:p-3">
          {/* Shadow wrapper — no overflow so shadow isn't clipped */}
          <div className={`${slideClass} max-w-5xl mx-auto rounded-2xl shadow-[0_0_40px_rgba(0,0,0,0.10)] lg:shadow-[0_20px_60px_-5px_rgba(0,0,0,0.12)]`}>
          {/* Content wrapper — overflow here, no shadow */}
          <div className="bg-slate-100 rounded-2xl border border-slate-200 px-5 pt-5 pb-6 sm:px-8 sm:py-6 max-h-[calc(100vh-2rem)] overflow-y-auto">
            {/* Title + description — always stacked */}
            <h3 className="text-slate-900 font-bold text-base mb-1.5 flex items-center gap-2">
              <CookieIcon size={18} className="text-slate-500 shrink-0" />
              Používáme cookies
            </h3>
            <p className="text-slate-500 text-sm leading-relaxed mb-4 sm:mb-0">
              Cookies nám pomáhají zlepšovat web a zobrazovat relevantní obsah. Nezbytné cookies jsou vždy aktivní.
            </p>
            {/* Buttons: row on mobile (equal width), row on desktop (auto width right-aligned) */}
            <div className="flex flex-row gap-2 mt-4 sm:mt-3 sm:justify-end">
              <button
                onClick={rejectAll}
                className="flex-1 sm:flex-none px-2 sm:px-5 py-2.5 border-2 border-slate-300 text-slate-600 text-xs sm:text-sm font-semibold rounded-xl hover:border-slate-400 hover:text-slate-800 transition-colors"
              >
                Odmítnout
              </button>
              <button
                onClick={() => setShowModal(true)}
                className="flex-1 sm:flex-none px-2 sm:px-5 py-2.5 border-2 border-slate-300 text-slate-600 text-xs sm:text-sm font-semibold rounded-xl hover:border-slate-400 hover:text-slate-800 transition-colors"
              >
                Přizpůsobit
              </button>
              <button
                onClick={acceptAll}
                className="flex-1 sm:flex-none px-2 sm:px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl"
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
                <h2 className="text-slate-900 font-bold text-lg sm:text-xl flex items-center gap-2">
                  <CookieIcon size={20} className="text-slate-500 shrink-0" />
                  Nastavení cookies
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
