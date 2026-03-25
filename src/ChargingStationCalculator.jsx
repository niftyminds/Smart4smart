import React, { useState, useEffect, useRef } from 'react';

const ChargingStationCalculator = () => {
  // GTM DataLayer helper
  const pushToDataLayer = (eventName, eventData = {}) => {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: eventName,
      ...eventData
    });
    console.log('📊 DataLayer Event:', eventName, eventData);
  };

  // Helper function for price ranges (for remarketing audiences)
  const getPriceRange = (price) => {
    if (price < 100000) return '0-100k';
    if (price < 200000) return '100-200k';
    if (price < 300000) return '200-300k';
    if (price < 500000) return '300-500k';
    return '500k+';
  };

  // Page routing
  const [page, setPage] = useState(() =>
    window.location.hash === '#calculator' ? 'calculator' : 'home'
  );

  // Modals
  const [showGdprModal, setShowGdprModal] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);

  // Flow control
  const [step, setStep] = useState('segment');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [segment, setSegment] = useState('');
  const calculatorRef = useRef(null);

  const navigateTo = (target) => {
    setPage(target);
    window.location.hash = target === 'calculator' ? 'calculator' : '';
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  useEffect(() => {
    const onHashChange = () => {
      setPage(window.location.hash === '#calculator' ? 'calculator' : 'home');
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, []);

  // Track when calculator section becomes visible
  useEffect(() => {
    if (!calculatorRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            // GTM Event: Calculator viewed
            pushToDataLayer('view_calculator', {
              page: page,
              viewport: window.innerWidth < 768 ? 'mobile' : 'desktop'
            });
            // Trigger only once
            observer.disconnect();
          }
        });
      },
      { threshold: 0.3 } // Trigger when 30% visible
    );

    observer.observe(calculatorRef.current);

    return () => observer.disconnect();
  }, [page]);

  // Track when result is displayed
  useEffect(() => {
    if (step === 'result') {
      const finalPrice = calculatePrice();
      // GTM Event: Price result viewed
      pushToDataLayer('view_price_result', {
        segment: segment,
        segment_name: segment === 'rodinny' ? 'Rodinný dům' :
                      segment === 'firemni' ? 'Firemní prostředí' : 'Bytový dům',
        price: finalPrice,
        price_range: getPriceRange(finalPrice),
        currency: 'CZK'
      });
    }
  }, [step, segment]);

  // States (same as before)
  const [rodinnyData, setRodinnyData] = useState({
    chargingLocation: '',
    parkingSpace: '',
    chargingSpeed: '',
    distance: '',
    smartFunctions: {
      dynamicPower: false,
      lowTariff: false,
      planning: false,
      rfid: false
    }
  });

  const [firemniData, setFiremniData] = useState({
    targetAudience: '',
    carCount: '',
    dcStation: '',
    costAccounting: false,
    preparationState: ''
  });

  const [bytovyData, setBytovyData] = useState({
    role: '',
    installLocation: '',
    approvalStatus: '',
    stationCount: '',
    commonPower: ''
  });

  const [leadData, setLeadData] = useState({
    email: '',
    phoneCountry: '+420',
    phoneNumber: '',
    consentData: false,
    consentContact: false
  });
  const [formError, setFormError] = useState(null);

  const [basePrice, setBasePrice] = useState(0);

  // Price calculation
  useEffect(() => {
    let price = 0;

    if (segment === 'rodinny') {
      if (rodinnyData.distance === '0-5') price = 10004;
      else if (rodinnyData.distance === '5-15') price = 10685;
      else if (rodinnyData.distance === '15+') price = 12823;

      // Smart funkce - nová logika
      if (rodinnyData.smartFunctions.dynamicPower) {
        // Dynamické řízení zahrnuje plánování + RFID
        price += 36366;
        // Nízký tarif lze přidat k dynamickému řízení
        if (rodinnyData.smartFunctions.lowTariff) {
          price += 2000;
        }
      } else if (rodinnyData.smartFunctions.lowTariff) {
        // Nízký tarif zahrnuje plánování + RFID
        price += 30776;
      } else if (rodinnyData.smartFunctions.planning || rodinnyData.smartFunctions.rfid) {
        // Plánování nebo RFID = stejná cena (zahrnují se vzájemně)
        price += 28776;
      } else {
        // Základní stanice bez smart funkcí
        price += 15305;
      }
    }
    else if (segment === 'firemni') {
      if (firemniData.carCount === '1-2') price += 39000;
      else if (firemniData.carCount === '3-5') price += 156000;
      else if (firemniData.carCount === '6-12') price += 390000;
      else if (firemniData.carCount === '12+') price += 546000;

      if (firemniData.dcStation === '40-120') price += 350000;
      else if (firemniData.dcStation === '160-240') price += 980000;
      else if (firemniData.dcStation === '400') price += 1450000;

      if (firemniData.costAccounting) price += 5000;

      if (firemniData.preparationState === 'capacity') price += 50000;
      else if (firemniData.preparationState === 'other') price += 20000;
    }
    else if (segment === 'bytovy') {
      if (bytovyData.stationCount === '1') price += 53000;
      else if (bytovyData.stationCount === '2') price += 87000;
      else if (bytovyData.stationCount === '3') price += 131000;
      else if (bytovyData.stationCount === '5') price += 203000;
      else if (bytovyData.stationCount === '10') price += 737000;

      if (bytovyData.commonPower === 'yes') price += 9823;
    }

    setBasePrice(price);
  }, [segment, rodinnyData, firemniData, bytovyData]);

  const getPriceInterval = (price) => {
    const lowerBound = Math.round(price * 0.95);
    const upperBound = Math.round(price * 1.05);
    return { lowerBound, upperBound };
  };

  const formatPrice = (price) => {
    return price.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
  };

  const getPriceBreakdown = () => {
    const items = [];

    if (segment === 'rodinny') {
      // 1. Základní cena instalace
      if (rodinnyData.distance === '0-5') {
        items.push({ description: 'Základní cena instalace – vzdálenost od rozvaděče 0-5m', price: 10004 });
      } else if (rodinnyData.distance === '5-15') {
        items.push({ description: 'Základní cena instalace – vzdálenost od rozvaděče 5-15m', price: 10685 });
      } else if (rodinnyData.distance === '15+') {
        items.push({ description: 'Základní cena instalace – vzdálenost od rozvaděče 15+m', price: 12823 });
      }

      // 2. Nabíjecí stanice dle zvolených parametrů
      let stationPrice = 0;
      let stationFeatures = [];

      if (rodinnyData.smartFunctions.dynamicPower) {
        stationPrice = 36366;
        stationFeatures.push('Dynamické řízení výkonu');
        stationFeatures.push('Plánování nabíjení (zahrnuto)');
        stationFeatures.push('Zabezpečení PIN kódem nebo RFID kartou (zahrnuto)');

        if (rodinnyData.smartFunctions.lowTariff) {
          stationPrice += 2000;
          stationFeatures.push('Možnost automatického nabíjení jen v nízkém tarifu');
        }
      } else if (rodinnyData.smartFunctions.lowTariff) {
        stationPrice = 30776;
        stationFeatures.push('Možnost automatického nabíjení jen v nízkém tarifu');
        stationFeatures.push('Plánování nabíjení (zahrnuto)');
        stationFeatures.push('Zabezpečení PIN kódem nebo RFID kartou (zahrnuto)');
      } else if (rodinnyData.smartFunctions.planning || rodinnyData.smartFunctions.rfid) {
        stationPrice = 28776;
        stationFeatures.push('Plánování nabíjení');
        stationFeatures.push('Zabezpečení PIN kódem nebo RFID kartou');
      } else {
        stationPrice = 15305;
        stationFeatures.push('Základní nabíjecí stanice');
      }

      items.push({
        description: 'Nabíjecí stanice dle Vámi zvolených parametrů',
        price: stationPrice,
        features: stationFeatures
      });
    }
    else if (segment === 'firemni') {
      // AC nabíjecí stanice
      if (firemniData.carCount === '1-2') {
        items.push({ description: 'AC nabíjecí stanice pro 1-2 vozidla', price: 39000 });
      } else if (firemniData.carCount === '3-5') {
        items.push({ description: 'AC nabíjecí stanice pro 3-5 vozidel', price: 156000 });
      } else if (firemniData.carCount === '6-12') {
        items.push({ description: 'AC nabíjecí stanice pro 6-12 vozidel', price: 390000 });
      } else if (firemniData.carCount === '12+') {
        items.push({ description: 'AC nabíjecí stanice pro více než 12 vozidel', price: 546000 });
      }

      // DC stanice
      if (firemniData.dcStation === '40-120') {
        items.push({ description: 'DC rychlonabíjecí stanice 40-120 kW', price: 350000 });
      } else if (firemniData.dcStation === '160-240') {
        items.push({ description: 'DC rychlonabíjecí stanice 160-240 kW', price: 980000 });
      } else if (firemniData.dcStation === '400') {
        items.push({ description: 'DC rychlonabíjecí stanice 400 kW', price: 1450000 });
      }

      // Rozúčtování nákladů
      if (firemniData.costAccounting) {
        items.push({ description: 'Přehledné rozúčtování spotřeby mezi uživatele', price: 5000 });
      }

      // Stav přípravy
      if (firemniData.preparationState === 'capacity') {
        items.push({ description: 'Řešení problému s kapacitou přípojky', price: 50000 });
      } else if (firemniData.preparationState === 'other') {
        items.push({ description: 'Jiné úpravy elektroinstalace', price: 20000 });
      } else if (firemniData.preparationState === 'ready') {
        items.push({ description: 'Místo připraveno k instalaci', price: 0 });
      }
    }
    else if (segment === 'bytovy') {
      // Počet stanic
      if (bytovyData.stationCount === '1') {
        items.push({ description: '1 nabíjecí stanice', price: 53000 });
      } else if (bytovyData.stationCount === '2') {
        items.push({ description: '2 nabíjecí stanice', price: 87000 });
      } else if (bytovyData.stationCount === '3') {
        items.push({ description: '3 nabíjecí stanice', price: 131000 });
      } else if (bytovyData.stationCount === '5') {
        items.push({ description: '5 nabíjecích stanic', price: 203000 });
      } else if (bytovyData.stationCount === '10') {
        items.push({ description: '10 nabíjecích stanic', price: 737000 });
      }

      // Napojení na společné rozvody
      if (bytovyData.commonPower === 'yes') {
        items.push({ description: 'Zajištění napojení na společné rozvody v domě', price: 9823 });
      }
    }

    return items;
  };

  const calculatePrice = () => {
    return basePrice;
  };

  const isQuestionnaireComplete = () => {
    if (segment === 'rodinny') {
      return rodinnyData.chargingLocation &&
             rodinnyData.parkingSpace &&
             rodinnyData.chargingSpeed &&
             rodinnyData.distance;
    } else if (segment === 'firemni') {
      return firemniData.targetAudience &&
             firemniData.carCount &&
             firemniData.preparationState;
    } else if (segment === 'bytovy') {
      return bytovyData.role &&
             bytovyData.installLocation &&
             bytovyData.approvalStatus &&
             bytovyData.stationCount;
    }
    return false;
  };

  const handleSegmentSelect = (selectedSegment) => {
    // GTM Event: Segment Selection
    pushToDataLayer('select_segment', {
      segment_type: selectedSegment === 'rodinny' ? 'Rodinný dům' :
                    selectedSegment === 'firemni' ? 'Firemní prostředí' : 'Bytový dům',
      segment_id: selectedSegment
    });

    setSegment(selectedSegment);
    setStep('questionnaire');
  };

  const handleContinueToLead = () => {
    if (isQuestionnaireComplete()) {
      // GTM Event: Begin Checkout (user proceeds to lead form)
      pushToDataLayer('begin_checkout', {
        segment: segment,
        estimated_price: calculatePrice(),
        currency: 'CZK'
      });

      setStep('lead');
      setTimeout(() => calculatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
    }
  };

  const handleLeadSubmit = async (e) => {
    e.preventDefault();

    // Validate phone: exactly 9 digits after stripping spaces and dashes
    const normalizedPhone = leadData.phoneNumber.replace(/[\s\-]/g, '');
    if (!/^\d{9}$/.test(normalizedPhone)) {
      setFormError('Zadejte platné telefonní číslo (9 číslic, např. 123 456 789)');
      return;
    }
    setFormError(null);

    const combinedPhone = `${leadData.phoneCountry}${normalizedPhone}`;
    const finalPrice = calculatePrice();
    const fullLeadData = {
      segment,
      email: leadData.email,
      phone: combinedPhone,
      estimatedPrice: finalPrice,
      questionnaire: segment === 'rodinny' ? rodinnyData :
                     segment === 'firemni' ? firemniData :
                     bytovyData
    };

    // GTM Event: Lead Conversion
    pushToDataLayer('generate_lead', {
      segment: segment,
      segment_name: segment === 'rodinny' ? 'Rodinný dům' :
                    segment === 'firemni' ? 'Firemní prostředí' : 'Bytový dům',
      price: finalPrice,
      price_range: getPriceRange(finalPrice),
      currency: 'CZK',
      email: leadData.email,
      phone: combinedPhone
    });

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/submit-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fullLeadData),
      });
      if (res.status === 400) {
        const body = await res.json();
        if (body.error === 'invalid_phone') {
          setFormError('Zadejte platné telefonní číslo');
          setIsSubmitting(false);
          return;
        }
      }
    } catch {
      // Backend failure is handled server-side (error email sent)
      // User still proceeds to results
    } finally {
      setIsSubmitting(false);
    }

    setStep('result');
    setTimeout(() => calculatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  const handleSmartFunctionToggle = (functionName) => {
    setRodinnyData(prev => ({
      ...prev,
      smartFunctions: {
        ...prev.smartFunctions,
        [functionName]: !prev.smartFunctions[functionName]
      }
    }));
  };

  const scrollToCalculator = () => {
    // GTM Event: CTA Click
    pushToDataLayer('click_cta', {
      cta_location: page === 'home' ? 'hero' : 'navbar',
      cta_text: 'Spočítat odhad'
    });

    if (page === 'home') {
      calculatorRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else {
      navigateTo('calculator');
    }
  };

  const segmentFaqs = {
    rodinny: [
      {
        q: 'Lze nabíjecí stanici nainstalovat do každého domu?',
        a: 'Ve většině rodinných domů ano. Vždy ale záleží na stavu elektroinstalace, velikosti hlavního jističe a dostupném příkonu. Před instalací se proto doporučuje odborné posouzení, díky kterému zjistíte, jaké řešení je pro Váš dům nejvhodnější a bezpečné.'
      },
      {
        q: 'Nebude nabíjení přetěžovat elektroinstalaci v domě?',
        a: 'Správně navržená nabíjecí stanice provoz domácnosti neohrozí. Pokud je součástí řešení dynamické řízení výkonu, stanice automaticky hlídá aktuální spotřebu domu a upravuje výkon nabíjení tak, aby nedošlo k přetížení hlavního jističe.'
      },
      {
        q: 'Je nabíjení doma levnější než na veřejné stanici?',
        a: 'Určitě ano. Domácí nabíjení bývá cenově výhodnější a zároveň pohodlnější, protože vůz nabíjíte tam, kde běžně parkujete. Další úsporu může přinést nabíjení v nízkém tarifu nebo chytré plánování nabíjení.'
      },
      {
        q: 'Potřebuji pro instalaci nějaké povolení?',
        a: 'U většiny běžných domácích instalací není potřeba složité povolování. Důležité ale je, aby montáž provedla odborně způsobilá firma a vše bylo zakončeno výchozí revizí. U specifických objektů nebo větších úprav se může postup lišit.'
      },
      {
        q: 'Jaký je rozdíl mezi nabíjením ze zásuvky a z nabíjecí stanice?',
        a: 'Běžná zásuvka není určená pro dlouhodobé pravidelné nabíjení elektromobilu ve vyšším výkonu. Nabíjecí stanice je bezpečnější, rychlejší a nabízí i chytré funkce, jako je řízení výkonu, plánování nabíjení nebo zabezpečení přístupu.'
      }
    ],
    firemni: [
      {
        q: 'Je naše firma připravená na instalaci nabíjecích stanic?',
        a: 'Ve většině případů ano. Je ale potřeba ověřit dostupnou kapacitu, stav elektroinstalace a možnosti umístění. Na základě odborného posouzení lze navrhnout vhodné a bezpečné řešení pro konkrétní provoz.'
      },
      {
        q: 'Kolik nabíjecích stanic budeme potřebovat?',
        a: 'To záleží na počtu vozidel, jejich vytížení a plánech do budoucna. Řešení by mělo odpovídat současným potřebám firmy a zároveň umožnit snadné rozšíření infrastruktury.'
      },
      {
        q: 'Lze oddělit nabíjení zaměstnanců, firemních vozů a návštěv?',
        a: 'Ano. Systém umožňuje přehledně evidovat nabíjení podle jednotlivých uživatelů nebo vozidel, nastavit přístupová oprávnění a následně spotřebu i náklady rozúčtovat.'
      },
      {
        q: 'Jak zabránit přetížení firemní elektroinstalace?',
        a: 'Pomocí dynamického řízení výkonu lze řídit výkon nabíjení podle aktuální spotřeby objektu. Díky tomu je možné nabíjet efektivně a bezpečně bez přetížení hlavního přívodu.'
      },
      {
        q: 'Dá se firemní nabíjecí infrastruktura připravit i pro budoucí rozšíření?',
        a: 'Ano, a právě to je při návrhu velmi důležité. Dobře navržená infrastruktura počítá s budoucím navýšením počtu vozidel i nabíjecích bodů, takže firma nemusí při dalším rozšiřování začínat od začátku.'
      }
    ],
    bytovy: [
      {
        q: 'Nebude nabíjení přetěžovat elektroinstalaci domu?',
        a: 'Správně navržené řešení s tím počítá. Pomocí dynamického řízení výkonu lze hlídat celkové zatížení objektu a automaticky upravovat výkon nabíjení podle aktuální spotřeby domu. Tím se snižuje riziko přetížení hlavního přívodu.'
      },
      {
        q: 'Kdo hradí spotřebu elektřiny při nabíjení?',
        a: 'To záleží na zvoleném řešení. Spotřebu lze měřit u každého uživatele samostatně a náklady pak přesně rozúčtovat. Díky tomu je možné spravedlivě oddělit soukromé nabíjení od společné spotřeby domu.'
      },
      {
        q: 'Co když dnes potřebuje nabíjení jen několik lidí, ale časem jich bude víc?',
        a: 'Právě proto je vhodné myslet na budoucí rozšíření už při návrhu. Dobře připravená infrastruktura umožní postupně připojovat další nabíjecí místa bez nutnosti složitých a nákladných úprav v budoucnu.'
      },
      {
        q: 'Je pro instalaci potřeba souhlas SVJ nebo bytového družstva?',
        a: 'Ve většině případů ano, protože se zásah týká společných částí domu nebo společných rozvodů. Přesný postup záleží na konkrétním typu objektu a způsobu řešení. Proto je vhodné mít připravený jasný technický návrh i přehled provozního modelu.'
      },
      {
        q: 'Co všechno je potřeba vyřešit před instalací?',
        a: 'Nejdůležitější je ověřit technický stav objektu, dostupnou kapacitu, způsob napájení, umístění stanic a budoucí správu uživatelů. Součástí návrhu by mělo být také měření spotřeby, rozúčtování nákladů a možnost dalšího rozšíření.'
      }
    ]
  };

  // SVG Icons (same as before)
  const HomeIcon = () => (
    <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="homeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{stopColor: '#3B82F6', stopOpacity: 1}} />
          <stop offset="100%" style={{stopColor: '#1D4ED8', stopOpacity: 1}} />
        </linearGradient>
      </defs>
      <path d="M8 32L32 12L56 32V52C56 54.2091 54.2091 56 52 56H12C9.79086 56 8 54.2091 8 52V32Z" fill="url(#homeGradient)"/>
      <path d="M24 56V40C24 37.7909 25.7909 36 28 36H36C38.2091 36 40 37.7909 40 40V56" fill="#60A5FA"/>
      <rect x="16" y="20" width="8" height="8" rx="1" fill="#60A5FA"/>
      <rect x="40" y="20" width="8" height="8" rx="1" fill="#60A5FA"/>
    </svg>
  );

  const BuildingIcon = () => (
    <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="buildingGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{stopColor: '#8B5CF6', stopOpacity: 1}} />
          <stop offset="100%" style={{stopColor: '#6D28D9', stopOpacity: 1}} />
        </linearGradient>
      </defs>
      <rect x="12" y="8" width="40" height="48" rx="2" fill="url(#buildingGradient)"/>
      <rect x="18" y="14" width="6" height="6" rx="1" fill="#C4B5FD"/>
      <rect x="29" y="14" width="6" height="6" rx="1" fill="#C4B5FD"/>
      <rect x="40" y="14" width="6" height="6" rx="1" fill="#C4B5FD"/>
      <rect x="18" y="24" width="6" height="6" rx="1" fill="#C4B5FD"/>
      <rect x="29" y="24" width="6" height="6" rx="1" fill="#C4B5FD"/>
      <rect x="40" y="24" width="6" height="6" rx="1" fill="#C4B5FD"/>
      <rect x="18" y="34" width="6" height="6" rx="1" fill="#C4B5FD"/>
      <rect x="29" y="34" width="6" height="6" rx="1" fill="#C4B5FD"/>
      <rect x="40" y="34" width="6" height="6" rx="1" fill="#C4B5FD"/>
      <rect x="24" y="46" width="16" height="10" fill="#A78BFA"/>
    </svg>
  );

  const ApartmentIcon = () => (
    <svg className="w-16 h-16" viewBox="0 0 64 64" fill="none">
      <defs>
        <linearGradient id="apartmentGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style={{stopColor: '#06B6D4', stopOpacity: 1}} />
          <stop offset="100%" style={{stopColor: '#0891B2', stopOpacity: 1}} />
        </linearGradient>
      </defs>
      <rect x="8" y="4" width="48" height="52" rx="2" fill="url(#apartmentGradient)"/>
      <rect x="14" y="10" width="8" height="8" rx="1" fill="#67E8F9"/>
      <rect x="28" y="10" width="8" height="8" rx="1" fill="#67E8F9"/>
      <rect x="42" y="10" width="8" height="8" rx="1" fill="#67E8F9"/>
      <rect x="14" y="22" width="8" height="8" rx="1" fill="#67E8F9"/>
      <rect x="28" y="22" width="8" height="8" rx="1" fill="#67E8F9"/>
      <rect x="42" y="22" width="8" height="8" rx="1" fill="#67E8F9"/>
      <rect x="14" y="34" width="8" height="8" rx="1" fill="#67E8F9"/>
      <rect x="28" y="34" width="8" height="8" rx="1" fill="#67E8F9"/>
      <rect x="42" y="34" width="8" height="8" rx="1" fill="#67E8F9"/>
      <rect x="22" y="46" width="20" height="10" fill="#22D3EE"/>
    </svg>
  );

  const ChargingIcon = () => (
    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );

  const LocationIcon = () => (
    <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );

  const SpeedIcon = () => (
    <svg className="w-6 h-6 text-teal-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );

  const Tooltip = ({ text }) => (
    <span className="group relative inline-flex items-center">
      <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 rounded-full bg-slate-200 text-slate-500 text-xs font-bold cursor-help hover:bg-blue-100 hover:text-blue-700 transition-colors select-none">
        i
      </span>
      <span className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 w-60 bg-slate-900 text-white text-xs rounded-lg px-3 py-2.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 leading-relaxed shadow-xl">
        {text}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-slate-900"></span>
      </span>
    </span>
  );

  return (
    <div className="min-h-screen bg-white">

      {/* Navbar */}
      <nav className="sticky top-0 z-50 bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14">
            <button
              onClick={() => navigateTo('home')}
              className="text-slate-900 font-bold text-sm sm:text-base tracking-tight hover:text-blue-600 transition-colors"
            >
              <span className="hidden md:inline">Kalkulátor instalace nabíjecích stanic</span>
              <span className="md:hidden">Kalkulátor stanic</span>
            </button>
            <div className="flex items-center gap-1">
              <button
                onClick={() => navigateTo('home')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  page === 'home'
                    ? 'bg-slate-100 text-slate-900'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Úvod
              </button>
              <button
                onClick={() => navigateTo('calculator')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  page === 'calculator'
                    ? 'bg-blue-600 text-white'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                Kalkulačka
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section - LP only */}
      {page === 'home' && <>
      <section className="bg-white border-b border-slate-200 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <h1 className="text-4xl md:text-6xl font-bold text-slate-900 leading-tight mb-6">
                Zjistěte cenu instalace nabíjecí stanice
              </h1>

              <p className="text-xl text-slate-600 mb-4 leading-relaxed">
                Orientační odhad nákladů pro rodinné domy, firmy i bytové domy — bez registrace a bez závazků.
              </p>

              <p className="text-base text-slate-500 mb-10">
                Ceny vycházejí z průměrných tržních cen pro rok 2026 a zahrnují kompletní instalaci včetně materiálu i práce. Výsledný odhad slouží jako orientační základ pro vaše rozhodování. Finální cena se vždy odvíjí od konkrétních podmínek v místě instalace.
              </p>

              <div className="flex flex-col sm:flex-row gap-4">
                <button
                  onClick={scrollToCalculator}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-xl transition-all duration-200 shadow-lg hover:shadow-xl text-base"
                >
                  Spočítat odhad
                </button>
                <button
                  onClick={scrollToCalculator}
                  className="border-2 border-slate-300 text-slate-700 hover:border-blue-600 hover:text-blue-600 font-semibold py-4 px-8 rounded-xl transition-all duration-200 text-base"
                >
                  Jak kalkulátor funguje?
                </button>
              </div>
            </div>

            <div className="hidden md:block">
              <img
                src="/images/hero-illustration.svg"
                alt="Kalkulátor instalace nabíjecích stanic"
                className="w-full h-auto"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              Jak kalkulátor funguje?
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl">
              Ve 3 krocích zjistíte, kolik bude stát instalace nabíjecí stanice
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                step: '01',
                title: 'Zvolte typ instalace',
                desc: 'Vyberte, zda řešíte nabíjení pro rodinný dům, firmu nebo bytový dům. Každý typ projektu má jiné technické požadavky a odlišné faktory, které ovlivňují výslednou cenu.',
                note: 'B2C i B2B v jednom nástroji',
                stepCls: 'text-blue-100',
                noteCls: 'text-blue-600 bg-blue-50'
              },
              {
                step: '02',
                title: 'Vyplňte parametry projektu',
                desc: 'Stačí doplnit několik základních údajů — například vzdálenost od rozvaděče, požadovaný výkon a počet stanic. Kalkulátor zohlední hlavní cenotvorné faktory do celkových nákladů.',
                note: 'Průměrně 5 otázek, méně než 2 minuty',
                stepCls: 'text-indigo-100',
                noteCls: 'text-indigo-600 bg-indigo-50'
              },
              {
                step: '03',
                title: 'Získejte rozpad ceny',
                desc: 'Okamžitě uvidíte orientační cenové rozmezí (±5 %) a detailní rozpad jednotlivých položek — od základní instalace až po volitelné chytré funkce. Bez skrytých položek.',
                note: 'Orientační cena bez DPH, zdarma',
                stepCls: 'text-purple-100',
                noteCls: 'text-purple-600 bg-purple-50'
              }
            ].map((item, idx) => (
              <div key={idx} className="bg-white border border-slate-200 rounded-2xl p-8 hover:border-blue-300 hover:shadow-lg transition-all duration-200">
                <div className={`text-5xl font-bold ${item.stepCls} mb-4`}>{item.step}</div>
                <h3 className="text-xl font-bold text-slate-900 mb-3">
                  {item.title}
                </h3>
                <p className="text-slate-600 leading-relaxed mb-4">
                  {item.desc}
                </p>
                <div className={`text-sm font-medium ${item.noteCls} inline-block px-3 py-1 rounded-full`}>
                  {item.note}
                </div>
              </div>
            ))}
          </div>

          {/* Technical Overview Image */}
          <div className="mt-16 max-w-5xl mx-auto">
            <img
              src="/images/technical-overview.png"
              alt="Technické zobrazení instalace nabíjecích stanic"
              className="w-full h-auto rounded-2xl shadow-2xl"
            />
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              Proč použít kalkulátor před poptávkou?
            </h2>
            <p className="text-lg text-slate-600 max-w-2xl">
              Získejte rychlý přehled o cenovém rozmezí, pochopte hlavní cenotvorné faktory a lépe se připravte na poptávku konkrétní nabídky.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            {[
              {
                title: 'Porovnejte náklady předem',
                desc: 'Získejte orientační přehled o cenovém rozmezí ještě před oslovením dodavatelů. Budete vědět, s jakým rozpočtem přibližně počítat.',
                highlight: 'Žádná registrace, žádné závazky',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                ),
                iconCls: 'bg-blue-50 border-blue-200 text-blue-600',
                highlightCls: 'text-blue-700 bg-blue-50'
              },
              {
                title: 'Pochopte co cenu ovlivňuje',
                desc: 'Výslednou cenu neurčuje jen samotná stanice. Kalkulátor zohledňuje typ objektu, výkon, vzdálenost od rozvaděče i počet stanic.',
                highlight: 'Všechny klíčové faktory',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                ),
                iconCls: 'bg-green-50 border-green-200 text-green-600',
                highlightCls: 'text-green-700 bg-green-50'
              },
              {
                title: 'Získejte přehledný rozpad ceny',
                desc: 'Místo jednoho čísla uvidíte orientační rozpad jednotlivých položek. Snadno pochopíte, kde vznikají hlavní náklady a co může cenu navýšit.',
                highlight: 'Transparentní, položkový přehled',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 10h16M4 14h16M4 18h16" />
                  </svg>
                ),
                iconCls: 'bg-purple-50 border-purple-200 text-purple-600',
                highlightCls: 'text-purple-700 bg-purple-50'
              },
              {
                title: 'Rozhodujte se rychleji a jistěji',
                desc: 'Během několika minut získáte nezávislý orientační odhad bez registrace a bez závazků. Lépe porovnáte varianty a připravíte se na další krok.',
                highlight: 'Rychlý a nezávislý odhad',
                icon: (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                ),
                iconCls: 'bg-amber-50 border-amber-200 text-amber-600',
                highlightCls: 'text-amber-700 bg-amber-50'
              }
            ].map((benefit, idx) => (
              <div key={idx} className="flex gap-5 p-6 border border-slate-200 rounded-2xl hover:border-slate-300 hover:shadow-md transition-all duration-200">
                <div className={`flex-shrink-0 w-12 h-12 ${benefit.iconCls} border rounded-xl flex items-center justify-center`}>
                  {benefit.icon}
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 mb-2">
                    {benefit.title}
                  </h3>
                  <p className="text-slate-600 text-sm leading-relaxed mb-3">
                    {benefit.desc}
                  </p>
                  <span className={`text-xs font-semibold ${benefit.highlightCls} px-2 py-1 rounded`}>
                    {benefit.highlight}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
      </>}

      {/* Calculator Section - always visible */}
      <section ref={calculatorRef} className={`${page === 'calculator' ? 'py-12' : 'py-20'} bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {page === 'home' && (
            <div className="text-center mb-12">
              <div className="inline-flex items-center justify-center p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl mb-6 shadow-lg">
                <svg className="w-12 h-12 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h2 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-slate-900 via-blue-900 to-indigo-900 bg-clip-text text-transparent mb-4">
                Kalkulátor instalace nabíjecích stanic
              </h2>
              <p className="text-xl text-slate-600 max-w-2xl mx-auto">
                Získejte orientační cenovou nabídku pro instalaci nabíjecí stanice
              </p>
            </div>
          )}
          {page === 'calculator' && (
            <div className="text-center mb-10">
              <h1 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
                Zjistěte cenu instalace nabíjecí stanice
              </h1>
              <p className="text-lg text-slate-600 max-w-xl mx-auto">
                Orientační odhad ceny instalace pro váš typ objektu — zdarma a bez závazků.
              </p>
            </div>
          )}

          {/* Progress Indicator - only show when in calculator flow */}
          {step !== 'segment' && (
            <div className="mb-12 max-w-5xl mx-auto">
              <div className="flex items-center justify-center">
                <div className="flex items-center space-x-1 sm:space-x-2">
                  {[
                    { num: 1, label: 'Výběr', active: step === 'segment' },
                    { num: 2, label: 'Dotazník', active: step === 'questionnaire' },
                    { num: 3, label: 'Kontakt', active: step === 'lead' },
                    { num: 4, label: 'Výsledek', active: step === 'result' }
                  ].map((item, idx) => (
                    <React.Fragment key={item.num}>
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-bold text-xs sm:text-sm transition-all duration-300 ${
                          item.active
                            ? 'bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg scale-110'
                            : (step === 'questionnaire' || step === 'lead' || step === 'result') && item.num === 1
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                            : (step === 'lead' || step === 'result') && item.num === 2
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                            : step === 'result' && item.num === 3
                            ? 'bg-gradient-to-br from-green-500 to-emerald-600 text-white'
                            : 'bg-slate-200 text-slate-400'
                        }`}>
                          {(step === 'questionnaire' || step === 'lead' || step === 'result') && item.num === 1 ? '✓' :
                           (step === 'lead' || step === 'result') && item.num === 2 ? '✓' :
                           step === 'result' && item.num === 3 ? '✓' :
                           item.num}
                        </div>
                        <span className="text-xs mt-2 font-medium text-slate-600 hidden md:block">{item.label}</span>
                      </div>
                      {idx < 3 && (
                        <div className={`w-8 sm:w-16 h-1 rounded-full transition-all duration-300 ${
                          (step === 'questionnaire' || step === 'lead' || step === 'result') && idx === 0
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                            : (step === 'lead' || step === 'result') && idx === 1
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                            : step === 'result' && idx === 2
                            ? 'bg-gradient-to-r from-green-500 to-emerald-600'
                            : 'bg-slate-200'
                        }`}></div>
                      )}
                    </React.Fragment>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Calculator Content */}
          <div className="max-w-5xl mx-auto">
            <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-10 border border-white/20">
              {/* The rest of your calculator JSX continues here... I'll include just the segment selection for brevity */}

              {step === 'segment' && (
                <div className="animate-fadeIn">
                  <h3 className="text-3xl font-bold text-slate-900 mb-8 text-center">
                    Vyberte typ instalace
                  </h3>
                  <div className="grid md:grid-cols-3 gap-6">
                    {[
                      {
                        id: 'rodinny',
                        title: 'Rodinný dům',
                        icon: <HomeIcon />,
                        desc: 'Soukromé nabíjecí u Vás doma',
                        gradient: 'from-blue-500 to-blue-600'
                      },
                      {
                        id: 'firemni',
                        title: 'Firemní prostředí',
                        icon: <BuildingIcon />,
                        desc: 'Nabíjení firemních nebo zaměstnaneckých vozidel a návštěv',
                        gradient: 'from-purple-500 to-purple-600'
                      },
                      {
                        id: 'bytovy',
                        title: 'Bytový dům',
                        icon: <ApartmentIcon />,
                        desc: 'Koncepční řešení nabíjení v bytovém domě',
                        gradient: 'from-cyan-500 to-cyan-600'
                      }
                    ].map((seg) => (
                      <button
                        key={seg.id}
                        onClick={() => handleSegmentSelect(seg.id)}
                        className="group relative p-8 rounded-2xl border-2 border-slate-200 hover:border-transparent hover:shadow-2xl transition-all duration-300 bg-white overflow-hidden"
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br ${seg.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>
                        <div className="relative z-10">
                          <div className="flex justify-center mb-4 transform group-hover:scale-110 transition-transform duration-300">
                            {seg.icon}
                          </div>
                          <div className="text-xl font-bold text-slate-900 mb-2">
                            {seg.title}
                          </div>
                          <div className="text-sm text-slate-600">
                            {seg.desc}
                          </div>
                          <div className={`mt-4 inline-flex items-center text-sm font-semibold bg-gradient-to-r ${seg.gradient} bg-clip-text text-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300`}>
                            Vybrat
                            <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* STEP 2: Questionnaire - Rodinný dům */}
              {step === 'questionnaire' && segment === 'rodinny' && (
                <div className="space-y-8 animate-fadeIn">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-3xl font-bold text-slate-900 mb-2">
                        Rodinný dům
                      </h2>
                      <p className="text-slate-600">Odpovězte prosím na následující otázky</p>
                    </div>
                    <button
                      onClick={() => setStep('segment')}
                      className="text-slate-600 hover:text-slate-900 text-sm font-medium flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      Změnit typ
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Kde budete nabíjet */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <ChargingIcon />
                        </div>
                        <label className="text-lg font-semibold text-slate-900">
                          Kde budete nabíjet?
                        </label>
                      </div>
                      <div className="grid gap-3">
                        {[
                          { value: 'dum', label: 'Dům' },
                          { value: 'chata', label: 'Chata' },
                          { value: 'garaz', label: 'Garáž jinde' }
                        ].map((opt) => (
                          <label
                            key={opt.value}
                            className={`flex items-center p-4 rounded-xl cursor-pointer transition-all ${
                              rodinnyData.chargingLocation === opt.value
                                ? 'bg-white shadow-md border-2 border-blue-500'
                                : 'bg-white/50 border-2 border-transparent hover:bg-white hover:shadow'
                            }`}
                          >
                            <input
                              type="radio"
                              name="chargingLocation"
                              value={opt.value}
                              checked={rodinnyData.chargingLocation === opt.value}
                              onChange={(e) => setRodinnyData({...rodinnyData, chargingLocation: e.target.value})}
                              className="w-5 h-5 text-blue-600"
                            />
                            <span className="ml-3 text-slate-900 font-medium">
                              {opt.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Parkovací místo */}
                    <div className="bg-gradient-to-br from-purple-50 to-pink-50 rounded-2xl p-6 border border-purple-100">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <LocationIcon />
                        </div>
                        <label className="text-lg font-semibold text-slate-900">
                          Máte vyhrazené parkovací místo?
                        </label>
                      </div>
                      <div className="grid gap-3">
                        {[
                          { value: 'pozemek', label: 'Pozemek' },
                          { value: 'garaz', label: 'Garáž' },
                          { value: 'neresim', label: 'Neřeším' }
                        ].map((opt) => (
                          <label
                            key={opt.value}
                            className={`flex items-center p-4 rounded-xl cursor-pointer transition-all ${
                              rodinnyData.parkingSpace === opt.value
                                ? 'bg-white shadow-md border-2 border-purple-500'
                                : 'bg-white/50 border-2 border-transparent hover:bg-white hover:shadow'
                            }`}
                          >
                            <input
                              type="radio"
                              name="parkingSpace"
                              value={opt.value}
                              checked={rodinnyData.parkingSpace === opt.value}
                              onChange={(e) => setRodinnyData({...rodinnyData, parkingSpace: e.target.value})}
                              className="w-5 h-5 text-purple-600"
                            />
                            <span className="ml-3 text-slate-900 font-medium">
                              {opt.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Rychlost nabíjení */}
                    <div className="bg-gradient-to-br from-teal-50 to-cyan-50 rounded-2xl p-6 border border-teal-100">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-teal-100 rounded-lg">
                          <SpeedIcon />
                        </div>
                        <label className="text-lg font-semibold text-slate-900 flex items-center">
                          Jak rychle chcete nabíjet?
                          <Tooltip text="kW = výkon nabíjení. 11 kW nabijí průměrné auto za jednu noc (cca 6–8 h). 22 kW nabijí dvakrát rychleji, ale vyžadují silnější elektro přípojku." />
                        </label>
                      </div>
                      <div className="grid gap-3">
                        {[
                          { value: '11kw', label: '11 kW', desc: 'Standardní rychlost' },
                          { value: '22kw', label: '22 kW', desc: 'Rychlejší nabíjení' },
                          { value: 'nevim', label: 'Nevím', desc: 'Poradíme vám' }
                        ].map((opt) => (
                          <label
                            key={opt.value}
                            className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${
                              rodinnyData.chargingSpeed === opt.value
                                ? 'bg-white shadow-md border-2 border-teal-500'
                                : 'bg-white/50 border-2 border-transparent hover:bg-white hover:shadow'
                            }`}
                          >
                            <div className="flex items-center">
                              <input
                                type="radio"
                                name="chargingSpeed"
                                value={opt.value}
                                checked={rodinnyData.chargingSpeed === opt.value}
                                onChange={(e) => setRodinnyData({...rodinnyData, chargingSpeed: e.target.value})}
                                className="w-5 h-5 text-teal-600"
                              />
                              <div className="ml-3">
                                <div className="text-slate-900 font-medium">{opt.label}</div>
                                <div className="text-sm text-slate-600">{opt.desc}</div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Vzdálenost od rozváděče */}
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-2xl p-6 border border-amber-100">
                      <label className="text-lg font-semibold text-slate-900 mb-4 flex items-center">
                        Vzdálenost od rozváděče
                        <Tooltip text="Rozváděč (pojistková skříň) je místo, odkud se rozvádí elektřina v domě. Čím dál je stanice od rozváděče, tím více kabeláže je potřeba — a tím vyšší jsou náklady." />
                      </label>
                      <div className="grid gap-3">
                        {[
                          { value: '0-5', label: 'Do 5 metrů' },
                          { value: '5-15', label: '5 - 15 metrů' },
                          { value: '15+', label: '15+ metrů' }
                        ].map((opt) => (
                          <label
                            key={opt.value}
                            className={`flex items-center p-4 rounded-xl cursor-pointer transition-all ${
                              rodinnyData.distance === opt.value
                                ? 'bg-white shadow-md border-2 border-amber-500'
                                : 'bg-white/50 border-2 border-transparent hover:bg-white hover:shadow'
                            }`}
                          >
                            <input
                              type="radio"
                              name="distance"
                              value={opt.value}
                              checked={rodinnyData.distance === opt.value}
                              onChange={(e) => setRodinnyData({...rodinnyData, distance: e.target.value})}
                              className="w-5 h-5 text-amber-600"
                            />
                            <span className="ml-3 text-slate-900 font-medium">
                              {opt.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Smart funkce */}
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-6 border border-indigo-100">
                      <label className="text-lg font-semibold text-slate-900 mb-2 block">
                        Smart funkce
                      </label>
                      <p className="text-sm text-slate-600 mb-4">
                        {rodinnyData.smartFunctions.dynamicPower
                          ? '✓ Dynamické řízení zahrnuje plánování nabíjení a zabezpečení PIN/RFID'
                          : rodinnyData.smartFunctions.lowTariff
                          ? '✓ Automatické nabíjení v nízkém tarifu zahrnuje plánování a zabezpečení PIN/RFID'
                          : (rodinnyData.smartFunctions.planning || rodinnyData.smartFunctions.rfid)
                          ? '✓ Plánování a zabezpečení PIN/RFID se vzájemně zahrnují'
                          : 'Bez výběru smart funkce se použije základní stanice'}
                      </p>
                      <div className="space-y-3">
                        <label className="flex items-start p-4 rounded-xl bg-white/50 border-2 border-transparent hover:bg-white hover:shadow cursor-pointer transition-all">
                          <input
                            type="checkbox"
                            checked={rodinnyData.smartFunctions.dynamicPower}
                            onChange={() => handleSmartFunctionToggle('dynamicPower')}
                            className="mt-1 w-5 h-5 text-indigo-600 rounded"
                          />
                          <div className="ml-3 flex-1">
                            <div className="text-slate-900 font-medium flex items-center">
                              Dynamické řízení výkonu
                              <Tooltip text="Automaticky hlídá aktuální spotřebu budovy a podle volné kapacity plynule upravuje výkon nabíjení. Díky tomu se vozidla nabíjejí co nejrychleji, aniž by došlo k přetížení hlavního jističe nebo omezení provozu ostatních zařízení." />
                            </div>
                            <p className="text-sm text-slate-600 mt-1">
                              Zahrnuje plánování nabíjení a zabezpečení PIN kódem nebo RFID kartou
                            </p>
                          </div>
                        </label>

                        <label className={`flex items-start p-4 rounded-xl cursor-pointer transition-all ${
                          rodinnyData.smartFunctions.lowTariff
                            ? 'bg-white shadow-md border-2 border-green-500'
                            : 'bg-white/50 border-2 border-transparent hover:bg-white hover:shadow'
                        }`}>
                          <input
                            type="checkbox"
                            checked={rodinnyData.smartFunctions.lowTariff}
                            onChange={() => handleSmartFunctionToggle('lowTariff')}
                            className="mt-1 w-5 h-5 text-green-600 rounded"
                          />
                          <div className="ml-3 flex-1">
                            <div className="text-slate-900 font-medium flex items-center">
                              Možnost automatického nabíjení jen v nízkém tarifu
                              <Tooltip text="Umožňuje spustit nabíjení pouze v době, kdy je aktivní HDO a běží levnější sazba elektřiny. Nabíjecí stanice je připojena na HDO přes svorkovnici a uživatel si může zvolit, že se vůz bude nabíjet jen tehdy, když je elektřina cenově výhodnější." />
                            </div>
                            {rodinnyData.smartFunctions.dynamicPower && (
                              <p className="text-sm text-slate-500 mt-1">Přidává se k dynamickému řízení (+2.000 Kč)</p>
                            )}
                          </div>
                        </label>

                        <label className={`flex items-start p-4 rounded-xl cursor-pointer transition-all ${
                          rodinnyData.smartFunctions.dynamicPower || rodinnyData.smartFunctions.lowTariff || rodinnyData.smartFunctions.rfid
                            ? 'opacity-50 cursor-not-allowed bg-slate-50'
                            : rodinnyData.smartFunctions.planning
                            ? 'bg-white shadow-md border-2 border-blue-500'
                            : 'bg-white/50 border-2 border-transparent hover:bg-white hover:shadow'
                        }`}>
                          <input
                            type="checkbox"
                            checked={rodinnyData.smartFunctions.planning}
                            onChange={() => {
                              if (!rodinnyData.smartFunctions.dynamicPower && !rodinnyData.smartFunctions.lowTariff && !rodinnyData.smartFunctions.rfid) {
                                handleSmartFunctionToggle('planning');
                              }
                            }}
                            disabled={rodinnyData.smartFunctions.dynamicPower || rodinnyData.smartFunctions.lowTariff || rodinnyData.smartFunctions.rfid}
                            className="mt-1 w-5 h-5 text-blue-600 rounded"
                          />
                          <div className="ml-3 flex-1">
                            <div className="text-slate-900 font-medium flex items-center">
                              Plánování nabíjení
                              <Tooltip text="Umožňuje nastavit výkon nabíjení podle dnů a hodin. Díky tomu lze snadno přizpůsobit provoz nabíjecí stanice době, kdy je v objektu nižší spotřeba, levnější elektřina nebo menší zatížení celé sítě." />
                            </div>
                            {rodinnyData.smartFunctions.dynamicPower && (
                              <p className="text-sm text-slate-500 mt-1">Zahrnuto v dynamickém řízení</p>
                            )}
                            {rodinnyData.smartFunctions.lowTariff && !rodinnyData.smartFunctions.dynamicPower && (
                              <p className="text-sm text-slate-500 mt-1">Zahrnuto v automatickém nabíjení v nízkém tarifu</p>
                            )}
                            {rodinnyData.smartFunctions.rfid && !rodinnyData.smartFunctions.dynamicPower && !rodinnyData.smartFunctions.lowTariff && (
                              <p className="text-sm text-slate-500 mt-1">Zahrnuto v zabezpečení PIN/RFID (stejná cena)</p>
                            )}
                          </div>
                        </label>

                        <label className={`flex items-start p-4 rounded-xl cursor-pointer transition-all ${
                          rodinnyData.smartFunctions.dynamicPower || rodinnyData.smartFunctions.lowTariff || rodinnyData.smartFunctions.planning
                            ? 'opacity-50 cursor-not-allowed bg-slate-50'
                            : rodinnyData.smartFunctions.rfid
                            ? 'bg-white shadow-md border-2 border-blue-500'
                            : 'bg-white/50 border-2 border-transparent hover:bg-white hover:shadow'
                        }`}>
                          <input
                            type="checkbox"
                            checked={rodinnyData.smartFunctions.rfid}
                            onChange={() => {
                              if (!rodinnyData.smartFunctions.dynamicPower && !rodinnyData.smartFunctions.lowTariff && !rodinnyData.smartFunctions.planning) {
                                handleSmartFunctionToggle('rfid');
                              }
                            }}
                            disabled={rodinnyData.smartFunctions.dynamicPower || rodinnyData.smartFunctions.lowTariff || rodinnyData.smartFunctions.planning}
                            className="mt-1 w-5 h-5 text-blue-600 rounded"
                          />
                          <div className="ml-3 flex-1">
                            <div className="text-slate-900 font-medium flex items-center">
                              Zabezpečení PIN kódem nebo RFID kartou
                              <Tooltip text="Umožňuje spustit nabíjení jen oprávněným uživatelům pomocí PIN kódu nebo RFID karty. Díky tomu máte kontrolu nad tím, kdo může stanici používat, a zabráníte neoprávněnému nabíjení." />
                            </div>
                            {rodinnyData.smartFunctions.dynamicPower && (
                              <p className="text-sm text-slate-500 mt-1">Zahrnuto v dynamickém řízení</p>
                            )}
                            {rodinnyData.smartFunctions.lowTariff && !rodinnyData.smartFunctions.dynamicPower && (
                              <p className="text-sm text-slate-500 mt-1">Zahrnuto v automatickém nabíjení v nízkém tarifu</p>
                            )}
                            {rodinnyData.smartFunctions.planning && !rodinnyData.smartFunctions.dynamicPower && !rodinnyData.smartFunctions.lowTariff && (
                              <p className="text-sm text-slate-500 mt-1">Zahrnuto v plánování (stejná cena)</p>
                            )}
                          </div>
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Continue Button */}
                  <button
                    onClick={handleContinueToLead}
                    disabled={!isQuestionnaireComplete()}
                    className={`w-full py-5 px-8 rounded-2xl font-bold text-white text-lg transition-all duration-300 transform ${
                      isQuestionnaireComplete()
                        ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:shadow-2xl hover:scale-105 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700'
                        : 'bg-slate-300 cursor-not-allowed'
                    }`}
                  >
                    {isQuestionnaireComplete() ? (
                      <span className="flex items-center justify-center gap-2">
                        Pokračovat
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </span>
                    ) : 'Vyplňte všechny povinné údaje'}
                  </button>
                </div>
              )}

              {/* STEP 2: Questionnaire - Firemní prostředí */}
              {step === 'questionnaire' && segment === 'firemni' && (
                <div className="space-y-8 animate-fadeIn">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-3xl font-bold text-slate-900 mb-2">
                        Firemní prostředí
                      </h2>
                      <p className="text-slate-600">Odpovězte prosím na následující otázky</p>
                    </div>
                    <button
                      onClick={() => setStep('segment')}
                      className="text-slate-600 hover:text-slate-900 text-sm font-medium flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      Změnit typ
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Komu bude infrastruktura určena */}
                    <div className="bg-gradient-to-br from-violet-50 to-purple-50 rounded-2xl p-6 border border-violet-100">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-violet-100 rounded-lg">
                          <svg className="w-6 h-6 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                          </svg>
                        </div>
                        <label className="text-lg font-semibold text-slate-900 flex items-center">
                          Komu bude infrastruktura určena?
                          <Tooltip text="Infrastruktura = celkové vybavení pro nabíjení (kabeláž, rozváděč, stanice). Účel použití ovlivňuje technické řešení — firemní flotila má jiné požadavky než veřejné nabíjení pro zákazníky." />
                        </label>
                      </div>
                      <div className="grid gap-3">
                        {[
                          { value: 'flotila', label: 'Flotila', desc: 'Firemní vozový park' },
                          { value: 'zamestnanci', label: 'Zaměstnanci', desc: 'Pro vlastní auta zaměstnanců' },
                          { value: 'klienti', label: 'Klienti', desc: 'Veřejné nabíjení pro zákazníky' },
                          { value: 'kombinace', label: 'Kombinace', desc: 'Různé skupiny uživatelů' }
                        ].map((opt) => (
                          <label
                            key={opt.value}
                            className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${
                              firemniData.targetAudience === opt.value
                                ? 'bg-white shadow-md border-2 border-violet-500'
                                : 'bg-white/50 border-2 border-transparent hover:bg-white hover:shadow'
                            }`}
                          >
                            <div className="flex items-center">
                              <input
                                type="radio"
                                name="targetAudience"
                                value={opt.value}
                                checked={firemniData.targetAudience === opt.value}
                                onChange={(e) => setFiremniData({...firemniData, targetAudience: e.target.value})}
                                className="w-5 h-5 text-violet-600"
                              />
                              <div className="ml-3">
                                <div className="text-slate-900 font-medium">{opt.label}</div>
                                <div className="text-sm text-slate-600">{opt.desc}</div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Počet aut k nabíjení */}
                    <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-2xl p-6 border border-blue-100">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                          </svg>
                        </div>
                        <label className="text-lg font-semibold text-slate-900">
                          Počet aut k nabíjení
                        </label>
                      </div>
                      <div className="grid gap-3">
                        {[
                          { value: '1-2', label: '1-2 auta', desc: 'Malá společnost' },
                          { value: '3-5', label: '3-5 aut', desc: 'Střední společnost' },
                          { value: '6-12', label: '6-12 aut', desc: 'Větší flotila' },
                          { value: '12+', label: '12+ aut', desc: 'Rozsáhlá flotila' }
                        ].map((opt) => (
                          <label
                            key={opt.value}
                            className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${
                              firemniData.carCount === opt.value
                                ? 'bg-white shadow-md border-2 border-blue-500'
                                : 'bg-white/50 border-2 border-transparent hover:bg-white hover:shadow'
                            }`}
                          >
                            <div className="flex items-center">
                              <input
                                type="radio"
                                name="carCount"
                                value={opt.value}
                                checked={firemniData.carCount === opt.value}
                                onChange={(e) => setFiremniData({...firemniData, carCount: e.target.value})}
                                className="w-5 h-5 text-blue-600"
                              />
                              <div className="ml-3">
                                <div className="text-slate-900 font-medium">{opt.label}</div>
                                <div className="text-sm text-slate-600">{opt.desc}</div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* DC rychlonabíjecí stanice */}
                    <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-2xl p-6 border border-emerald-100">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-emerald-100 rounded-lg">
                          <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <label className="text-lg font-semibold text-slate-900 flex items-center">
                          DC rychlonabíjecí stanice
                          <Tooltip text="DC (stejnosměrný proud) nabíjí přímo do baterie auta — je výrazně rychlejší než klasické AC nabíjení (wallbox). Hodí se, když auta stojí krátce (zákazníci, veřejné nabíjení). Pro noční nabíjení flotily stačí AC." />
                        </label>
                      </div>
                      <p className="text-sm text-slate-600 mb-4">Volitelné - pro rychlejší nabíjení flotily</p>
                      <div className="grid gap-3">
                        {[
                          { value: '', label: 'Bez DC stanice', desc: 'Pouze AC nabíjení' },
                          { value: '40-120', label: '40-120 kW', desc: 'Rychlé nabíjení' },
                          { value: '160-240', label: '160-240 kW', desc: 'Velmi rychlé nabíjení' },
                          { value: '400', label: '400 kW', desc: 'Ultra rychlé nabíjení' }
                        ].map((opt) => (
                          <label
                            key={opt.value}
                            className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${
                              firemniData.dcStation === opt.value
                                ? 'bg-white shadow-md border-2 border-emerald-500'
                                : 'bg-white/50 border-2 border-transparent hover:bg-white hover:shadow'
                            }`}
                          >
                            <div className="flex items-center">
                              <input
                                type="radio"
                                name="dcStation"
                                value={opt.value}
                                checked={firemniData.dcStation === opt.value}
                                onChange={(e) => setFiremniData({...firemniData, dcStation: e.target.value})}
                                className="w-5 h-5 text-emerald-600"
                              />
                              <div className="ml-3">
                                <div className="text-slate-900 font-medium">{opt.label}</div>
                                <div className="text-sm text-slate-600">{opt.desc}</div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Rozúčtování nákladů */}
                    <div className="bg-gradient-to-br from-amber-50 to-yellow-50 rounded-2xl p-6 border border-amber-100">
                      <label className="flex items-start p-4 rounded-xl bg-white/50 border-2 border-transparent hover:bg-white hover:shadow cursor-pointer transition-all">
                        <input
                          type="checkbox"
                          checked={firemniData.costAccounting}
                          onChange={(e) => setFiremniData({...firemniData, costAccounting: e.target.checked})}
                          className="mt-1 w-5 h-5 text-amber-600 rounded"
                        />
                        <div className="ml-3 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                            </svg>
                            <span className="text-slate-900 font-medium flex items-center">
                              Potřebuji přehledné rozúčtování spotřeby mezi uživatele
                              <Tooltip text="Mějte přesný přehled o tom, kdo, kdy a kolik nabíjel. Nabíjecí stanice umožňuje snadné rozdělení nákladů mezi zaměstnance, firemní vozidla i další uživatele." />
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">
                            Přesný přehled spotřeby a snadné rozdělení nákladů
                          </p>
                        </div>
                      </label>
                    </div>

                    {/* Stav přípravy objektu */}
                    <div className="bg-gradient-to-br from-rose-50 to-pink-50 rounded-2xl p-6 border border-rose-100">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-rose-100 rounded-lg">
                          <svg className="w-6 h-6 text-rose-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                        </div>
                        <label className="text-lg font-semibold text-slate-900">
                          Jaký je aktuální stav elektropřípravy
                        </label>
                      </div>
                      <div className="grid gap-3">
                        {[
                          { value: 'ready', label: 'Máme dostatečnou kapacitu a rezervovaný příkon' },
                          { value: 'other', label: 'Nejsme si jistí, potřebujeme posouzení' },
                          { value: 'capacity', label: 'Kapacita může být nedostatečná' }
                        ].map((opt) => (
                          <label
                            key={opt.value}
                            className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${
                              firemniData.preparationState === opt.value
                                ? 'bg-white shadow-md border-2 border-rose-500'
                                : 'bg-white/50 border-2 border-transparent hover:bg-white hover:shadow'
                            }`}
                          >
                            <div className="flex items-center">
                              <input
                                type="radio"
                                name="preparationState"
                                value={opt.value}
                                checked={firemniData.preparationState === opt.value}
                                onChange={(e) => setFiremniData({...firemniData, preparationState: e.target.value})}
                                className="w-5 h-5 text-rose-600"
                              />
                              <div className="ml-3">
                                <div className="text-slate-900 font-medium flex items-center">
                                  {opt.label}
                                  {opt.tooltip && <Tooltip text={opt.tooltip} />}
                                </div>
                                <div className="text-sm text-slate-600">{opt.desc}</div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Continue Button */}
                  <button
                    onClick={handleContinueToLead}
                    disabled={!isQuestionnaireComplete()}
                    className={`w-full py-5 px-8 rounded-2xl font-bold text-white text-lg transition-all duration-300 transform ${
                      isQuestionnaireComplete()
                        ? 'bg-gradient-to-r from-purple-600 via-violet-600 to-indigo-600 hover:shadow-2xl hover:scale-105 hover:from-purple-700 hover:via-violet-700 hover:to-indigo-700'
                        : 'bg-slate-300 cursor-not-allowed'
                    }`}
                  >
                    {isQuestionnaireComplete() ? (
                      <span className="flex items-center justify-center gap-2">
                        Pokračovat
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </span>
                    ) : 'Vyplňte všechny povinné údaje'}
                  </button>
                </div>
              )}

              {/* STEP 2: Questionnaire - Bytový dům */}
              {step === 'questionnaire' && segment === 'bytovy' && (
                <div className="space-y-8 animate-fadeIn">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <h2 className="text-3xl font-bold text-slate-900 mb-2">
                        Bytový dům
                      </h2>
                      <p className="text-slate-600">Odpovězte prosím na následující otázky</p>
                    </div>
                    <button
                      onClick={() => setStep('segment')}
                      className="text-slate-600 hover:text-slate-900 text-sm font-medium flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-slate-100 transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      Změnit typ
                    </button>
                  </div>

                  <div className="space-y-6">
                    {/* Vaše role v projektu */}
                    <div className="bg-gradient-to-br from-cyan-50 to-sky-50 rounded-2xl p-6 border border-cyan-100">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-cyan-100 rounded-lg">
                          <svg className="w-6 h-6 text-cyan-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </div>
                        <label className="text-lg font-semibold text-slate-900">
                          Vaše role v projektu?
                        </label>
                      </div>
                      <div className="grid gap-3">
                        {[
                          { value: 'predseda', label: 'Předseda SVJ', desc: 'Představitel společenství' },
                          { value: 'facility', label: 'Facility manager', desc: 'Správa nemovitosti' },
                          { value: 'vlastnik', label: 'Vlastník bytu', desc: 'Individuální vlastník' },
                          { value: 'jine', label: 'Jiné', desc: 'Jiná role' }
                        ].map((opt) => (
                          <label
                            key={opt.value}
                            className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${
                              bytovyData.role === opt.value
                                ? 'bg-white shadow-md border-2 border-cyan-500'
                                : 'bg-white/50 border-2 border-transparent hover:bg-white hover:shadow'
                            }`}
                          >
                            <div className="flex items-center">
                              <input
                                type="radio"
                                name="role"
                                value={opt.value}
                                checked={bytovyData.role === opt.value}
                                onChange={(e) => setBytovyData({...bytovyData, role: e.target.value})}
                                className="w-5 h-5 text-cyan-600"
                              />
                              <div className="ml-3">
                                <div className="text-slate-900 font-medium">{opt.label}</div>
                                <div className="text-sm text-slate-600">{opt.desc}</div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Kde budou stanice instalovány */}
                    <div className="bg-gradient-to-br from-indigo-50 to-blue-50 rounded-2xl p-6 border border-indigo-100">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-indigo-100 rounded-lg">
                          <svg className="w-6 h-6 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                        </div>
                        <label className="text-lg font-semibold text-slate-900">
                          Kde budou stanice instalovány?
                        </label>
                      </div>
                      <div className="grid gap-3">
                        {[
                          { value: 'garaze', label: 'Garáže', desc: 'Podzemní nebo nadzemní garáže' },
                          { value: 'venku', label: 'Venkovní parkoviště', desc: 'Venkovní parkovací stání' },
                          { value: 'nevim', label: 'Nevím', desc: 'Zatím není rozhodnuto' }
                        ].map((opt) => (
                          <label
                            key={opt.value}
                            className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${
                              bytovyData.installLocation === opt.value
                                ? 'bg-white shadow-md border-2 border-indigo-500'
                                : 'bg-white/50 border-2 border-transparent hover:bg-white hover:shadow'
                            }`}
                          >
                            <div className="flex items-center">
                              <input
                                type="radio"
                                name="installLocation"
                                value={opt.value}
                                checked={bytovyData.installLocation === opt.value}
                                onChange={(e) => setBytovyData({...bytovyData, installLocation: e.target.value})}
                                className="w-5 h-5 text-indigo-600"
                              />
                              <div className="ml-3">
                                <div className="text-slate-900 font-medium">{opt.label}</div>
                                <div className="text-sm text-slate-600">{opt.desc}</div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Stav schválení v domě */}
                    <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-2xl p-6 border border-green-100">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                        <label className="text-lg font-semibold text-slate-900">
                          Stav schválení v domě?
                        </label>
                      </div>
                      <div className="grid gap-3">
                        {[
                          { value: 'schvaleno', label: 'Schváleno', desc: 'Projekt byl schválen' },
                          { value: 'zvazujeme', label: 'Zvažujeme', desc: 'Probíhá diskuze' },
                          { value: 'nesouhlas', label: 'Je nesouhlas', desc: 'Existuje odpor' }
                        ].map((opt) => (
                          <label
                            key={opt.value}
                            className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${
                              bytovyData.approvalStatus === opt.value
                                ? 'bg-white shadow-md border-2 border-green-500'
                                : 'bg-white/50 border-2 border-transparent hover:bg-white hover:shadow'
                            }`}
                          >
                            <div className="flex items-center">
                              <input
                                type="radio"
                                name="approvalStatus"
                                value={opt.value}
                                checked={bytovyData.approvalStatus === opt.value}
                                onChange={(e) => setBytovyData({...bytovyData, approvalStatus: e.target.value})}
                                className="w-5 h-5 text-green-600"
                              />
                              <div className="ml-3">
                                <div className="text-slate-900 font-medium">{opt.label}</div>
                                <div className="text-sm text-slate-600">{opt.desc}</div>
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Počet nabíjecích stanic */}
                    <div className="bg-gradient-to-br from-purple-50 to-fuchsia-50 rounded-2xl p-6 border border-purple-100">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-purple-100 rounded-lg">
                          <svg className="w-6 h-6 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <label className="text-lg font-semibold text-slate-900">
                          Počet nabíjecích stanic
                        </label>
                      </div>
                      <div className="grid gap-3">
                        {[
                          { value: '1', label: '1 stanice' },
                          { value: '2', label: '2 stanice' },
                          { value: '3', label: '3 stanice' },
                          { value: '5', label: '5 stanic' },
                          { value: '10', label: '10 stanic' }
                        ].map((opt) => (
                          <label
                            key={opt.value}
                            className={`flex items-center justify-between p-4 rounded-xl cursor-pointer transition-all ${
                              bytovyData.stationCount === opt.value
                                ? 'bg-white shadow-md border-2 border-purple-500'
                                : 'bg-white/50 border-2 border-transparent hover:bg-white hover:shadow'
                            }`}
                          >
                            <div className="flex items-center">
                              <input
                                type="radio"
                                name="stationCount"
                                value={opt.value}
                                checked={bytovyData.stationCount === opt.value}
                                onChange={(e) => setBytovyData({...bytovyData, stationCount: e.target.value})}
                                className="w-5 h-5 text-purple-600"
                              />
                              <div className="ml-3">
                                <div className="text-slate-900 font-medium">{opt.label}</div>
                                {opt.desc && <div className="text-sm text-slate-600">{opt.desc}</div>}
                              </div>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Napájení ze společných prostorů */}
                    <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-2xl p-6 border border-orange-100">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="p-2 bg-orange-100 rounded-lg">
                          <svg className="w-6 h-6 text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
                          </svg>
                        </div>
                        <label className="text-lg font-semibold text-slate-900">
                          Napájení ze společných prostorů
                        </label>
                      </div>
                      <p className="text-sm text-slate-600 mb-4">
                        Budou nabíjecí stanice napájeny ze společných rozvodů objektu?
                      </p>
                      <div className="grid gap-3">
                        {[
                          { value: 'yes', label: 'Ano' },
                          { value: 'no', label: 'Ne' },
                          { value: 'unsure', label: 'Nevím, potřebuji poradit' }
                        ].map((opt) => (
                          <label
                            key={opt.value}
                            className={`flex items-center p-4 rounded-xl cursor-pointer transition-all ${
                              bytovyData.commonPower === opt.value
                                ? 'bg-white shadow-md border-2 border-orange-500'
                                : 'bg-white/50 border-2 border-transparent hover:bg-white hover:shadow'
                            }`}
                          >
                            <input
                              type="radio"
                              name="commonPower"
                              value={opt.value}
                              checked={bytovyData.commonPower === opt.value}
                              onChange={(e) => setBytovyData({...bytovyData, commonPower: e.target.value})}
                              className="w-5 h-5 text-orange-600"
                            />
                            <span className="ml-3 text-slate-900 font-medium">
                              {opt.label}
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Continue Button */}
                  <button
                    onClick={handleContinueToLead}
                    disabled={!isQuestionnaireComplete()}
                    className={`w-full py-5 px-8 rounded-2xl font-bold text-white text-lg transition-all duration-300 transform ${
                      isQuestionnaireComplete()
                        ? 'bg-gradient-to-r from-cyan-600 via-sky-600 to-blue-600 hover:shadow-2xl hover:scale-105 hover:from-cyan-700 hover:via-sky-700 hover:to-blue-700'
                        : 'bg-slate-300 cursor-not-allowed'
                    }`}
                  >
                    {isQuestionnaireComplete() ? (
                      <span className="flex items-center justify-center gap-2">
                        Pokračovat
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                        </svg>
                      </span>
                    ) : 'Vyplňte všechny povinné údaje'}
                  </button>
                </div>
              )}

              {/* STEP 3: Lead Form */}
              {step === 'lead' && (
                <div className="animate-fadeIn max-w-2xl mx-auto">
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center p-4 bg-gradient-to-br from-green-100 to-emerald-100 rounded-2xl mb-4">
                      <svg className="w-12 h-12 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <h2 className="text-3xl font-bold text-slate-900 mb-2">
                      Téměř hotovo!
                    </h2>
                    <p className="text-slate-600">
                      Pro zobrazení cenového odhadu vyplňte prosím vaše kontaktní údaje
                    </p>
                  </div>

                  <form onSubmit={handleLeadSubmit} className="space-y-6">
                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        E-mailová adresa *
                      </label>
                      <input
                        type="email"
                        required
                        value={leadData.email}
                        onChange={(e) => setLeadData(prev => ({...prev, email: e.target.value}))}
                        className="w-full px-5 py-4 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-lg"
                        placeholder="vas@email.cz"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-slate-700 mb-2">
                        Telefonní číslo *
                      </label>
                      <div className="flex gap-2">
                        <div className="relative flex-shrink-0">
                          <select
                            value={leadData.phoneCountry}
                            onChange={(e) => setLeadData(prev => ({...prev, phoneCountry: e.target.value}))}
                            className="appearance-none pl-3 pr-10 py-4 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-lg bg-white cursor-pointer"
                          >
                            <option value="+420">🇨🇿 +420</option>
                            <option value="+421">🇸🇰 +421</option>
                          </select>
                          <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                            <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                        <input
                          type="tel"
                          required
                          value={leadData.phoneNumber}
                          onChange={(e) => { setLeadData(prev => ({...prev, phoneNumber: e.target.value})); setFormError(null); }}
                          className="flex-1 px-5 py-4 rounded-xl border-2 border-slate-200 focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none transition-all text-lg"
                          placeholder="123 456 789"
                        />
                      </div>
                      {formError && (
                        <p className="mt-2 text-sm text-red-600">{formError}</p>
                      )}
                    </div>

                    <div className="space-y-3">
                      <label className={`flex items-start gap-3 p-4 rounded-xl border-2 cursor-pointer transition-colors ${leadData.consentData ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-slate-300'}`}>
                        <div className="relative flex-shrink-0 mt-0.5">
                          <input
                            type="checkbox"
                            required
                            checked={leadData.consentData}
                            onChange={(e) => setLeadData(prev => ({...prev, consentData: e.target.checked}))}
                            className="sr-only"
                          />
                          <div className={`w-5 h-5 rounded flex items-center justify-center border-2 transition-colors ${leadData.consentData ? 'bg-blue-600 border-blue-600' : 'border-slate-300 bg-white'}`}>
                            {leadData.consentData && (
                              <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                              </svg>
                            )}
                          </div>
                        </div>
                        <span className="text-sm text-slate-700 leading-relaxed">
                          Souhlasím se <span className="font-semibold text-slate-900">zpracováním osobních údajů</span> (jméno, e-mail, telefon) za účelem zaslání cenového odhadu. Údaje nebudou poskytnuty třetím stranám. *
                        </span>
                      </label>

                      <p className="text-xs text-slate-400 px-1">* Povinné pole. Svůj souhlas můžete kdykoli odvolat.</p>
                    </div>

                    <button
                      type="submit"
                      disabled={!leadData.consentData || isSubmitting}
                      className={`w-full font-bold py-5 px-8 rounded-2xl transition-all duration-300 text-lg ${leadData.consentData && !isSubmitting ? 'bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:via-indigo-700 hover:to-purple-700 text-white shadow-xl hover:shadow-2xl transform hover:scale-105' : 'bg-slate-200 text-slate-400 cursor-not-allowed'}`}
                    >
                      <span className="flex items-center justify-center gap-2">
                        {isSubmitting ? (
                          <>
                            <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                            Zpracovávám...
                          </>
                        ) : (
                          <>
                            Zobrazit cenový odhad
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                            </svg>
                          </>
                        )}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setStep('questionnaire')}
                      className="w-full text-slate-600 hover:text-slate-900 font-medium py-3 flex items-center justify-center gap-2 hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                      </svg>
                      Zpět na dotazník
                    </button>
                  </form>
                </div>
              )}

              {/* STEP 4: Result */}
              {step === 'result' && (
                <div className="animate-fadeIn">
                  <div className="text-center mb-8">
                    <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-green-400 to-emerald-500 rounded-full mb-6 shadow-xl animate-bounce">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                    <h2 className="text-4xl font-bold text-slate-900 mb-3">
                      Děkujeme za vyplnění!
                    </h2>
                    <p className="text-lg text-slate-600">
                      Váš cenový odhad je připraven
                    </p>
                  </div>

                  {/* Price Interval Display */}
                  <div className="relative overflow-hidden bg-gradient-to-br from-blue-600 via-indigo-600 to-purple-600 rounded-3xl p-10 mb-8 text-white shadow-2xl">
                    <div className="absolute inset-0 bg-grid-white/5"></div>
                    <div className="relative z-10 text-center">
                      <div className="text-blue-100 text-sm font-semibold mb-4 uppercase tracking-wider">
                        Odhadovaná cena instalace
                      </div>
                      <div className="text-5xl md:text-6xl font-bold mb-4">
                        {formatPrice(getPriceInterval(basePrice).lowerBound)} –{' '}
                        {formatPrice(getPriceInterval(basePrice).upperBound)} Kč
                      </div>
                      <div className="inline-flex items-center gap-2 text-blue-100 text-sm bg-white/10 px-4 py-2 rounded-full backdrop-blur-sm">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        Orientační cena bez DPH (±5%)
                      </div>
                    </div>
                  </div>

                  {/* Price Breakdown */}
                  <div className="bg-white rounded-2xl p-6 mb-6 border-2 border-slate-100 shadow-lg">
                    <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                      </svg>
                      Rozpad ceny
                    </h3>
                    <div className="space-y-3">
                      {getPriceBreakdown().map((item, index) => (
                        <div
                          key={index}
                          className="p-4 bg-gradient-to-r from-slate-50 to-blue-50 rounded-xl border border-slate-200 hover:shadow-md transition-shadow"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-3 mb-2">
                                <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0"></div>
                                <span className="text-slate-700 font-medium text-sm">{item.description}</span>
                              </div>
                              {item.features && item.features.length > 0 && (
                                <div className="ml-5 space-y-1">
                                  {item.features.map((feature, fidx) => (
                                    <div key={fidx} className="flex items-center gap-2">
                                      <span className="text-slate-500 text-xs">•</span>
                                      <span className="text-slate-600 text-xs">{feature}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                            <span className="text-slate-900 font-bold whitespace-nowrap text-sm pl-5 sm:pl-0 sm:mt-0">
                              {item.price === 0
                                ? <span className="text-green-600">zahrnuto</span>
                                : `${formatPrice(Math.round(item.price * 0.95))} – ${formatPrice(Math.round(item.price * 1.05))} Kč`
                              }
                            </span>
                          </div>
                        </div>
                      ))}

                      {/* Total */}
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 p-4 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-xl text-white shadow-lg mt-4">
                        <span className="font-bold text-lg">Celkem</span>
                        <span className="font-bold text-lg sm:text-xl whitespace-nowrap">
                          {formatPrice(getPriceInterval(basePrice).lowerBound)} – {formatPrice(getPriceInterval(basePrice).upperBound)} Kč
                        </span>
                      </div>

                      <div className="flex items-start gap-2 p-4 bg-amber-50 border border-amber-200 rounded-xl mt-3">
                        <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-sm text-amber-800">
                          <span className="font-semibold">Důležité:</span> Finální cena může být ovlivněna specifickými podmínkami místa instalace a bude upřesněna po osobní obhlídce.
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Summary */}
                  <div className="bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl p-6 mb-6 border border-slate-200">
                    <h3 className="text-xl font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      Shrnutí vaší konfigurace
                    </h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                        <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                        <span className="font-semibold text-slate-700">Typ:</span>
                        <span className="text-slate-900">
                          {segment === 'rodinny' ? 'Rodinný dům' :
                           segment === 'firemni' ? 'Firemní prostředí' :
                           'Bytový dům'}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                        <div className="w-2 h-2 bg-green-600 rounded-full"></div>
                        <span className="font-semibold text-slate-700">E-mail:</span>
                        <span className="text-slate-900">{leadData.email}</span>
                      </div>
                      <div className="flex items-center gap-3 p-3 bg-white rounded-lg">
                        <div className="w-2 h-2 bg-purple-600 rounded-full"></div>
                        <span className="font-semibold text-slate-700">Telefon:</span>
                        <span className="text-slate-900">{leadData.phoneCountry}{leadData.phoneNumber.replace(/[\s\-]/g, '')}</span>
                      </div>
                    </div>
                  </div>

                  {/* What's next */}
                  <div className="bg-white rounded-2xl p-6 mb-6 border-2 border-slate-100 shadow-lg">
                    <h3 className="text-xl font-bold text-slate-900 mb-6">
                      Co bude dál?
                    </h3>
                    <div className="space-y-4">
                      {[
                        {
                          num: 1,
                          title: 'Spojíme se s vámi do 24 hodin',
                          desc: 'Krátce s vámi projdeme Vaši poptávku a doplníme vše potřebné.',
                          cls: 'bg-blue-600'
                        },
                        {
                          num: 2,
                          title: 'Nabídneme prohlídku místa instalace',
                          desc: 'Nabídneme Vám osobní prohlídku technikem, který ověří technický stav elektroinstalace a představí Vám možné varianty instalace.',
                          cls: 'bg-purple-600'
                        },
                        {
                          num: 3,
                          title: 'Zašleme Vám nabídku na míru',
                          desc: 'Připravíme řešení přesně podle Vašich potřeb, včetně ceny a případného termínu realizace.',
                          cls: 'bg-green-600'
                        }
                      ].map((item) => (
                        <div key={item.num} className="flex items-start gap-4">
                          <div className={`flex-shrink-0 w-10 h-10 ${item.cls} rounded-full flex items-center justify-center text-white font-bold shadow-lg`}>
                            {item.num}
                          </div>
                          <div>
                            <div className="font-semibold text-slate-900">{item.title}</div>
                            <div className="text-sm text-slate-600">{item.desc}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={() => {
                      setStep('segment');
                      setSegment('');
                      setRodinnyData({
                        chargingLocation: '',
                        parkingSpace: '',
                        chargingSpeed: '',
                        distance: '',
                        smartFunctions: {
                          dynamicPower: false,
                          lowTariff: false,
                          planning: false,
                          rfid: false
                        }
                      });
                      setFiremniData({
                        targetAudience: '',
                        carCount: '',
                        dcStation: '',
                        costAccounting: false,
                        preparationState: ''
                      });
                      setBytovyData({
                        role: '',
                        installLocation: '',
                        approvalStatus: '',
                        stationCount: '',
                        commonPower: ''
                      });
                      setLeadData({ email: '', phone: '', consentData: false, consentContact: false });
                    }}
                    className="w-full border-2 border-slate-300 text-slate-700 hover:border-blue-600 hover:text-blue-600 hover:bg-blue-50 font-semibold py-4 px-6 rounded-2xl transition-all duration-200"
                  >
                    Vytvořit novou kalkulaci
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* Segment FAQ - only visible when segment is selected */}
      {(step === 'questionnaire' || step === 'lead' || step === 'result') && segment && segmentFaqs[segment] && (
        <section className="py-12 bg-slate-50 border-t border-slate-200 animate-fadeIn">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="mb-7">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-3 py-1.5 rounded-full mb-3">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Časté otázky pro váš typ instalace
              </div>
              <h2 className="text-2xl md:text-3xl font-bold text-slate-900">
                {segment === 'rodinny' && 'Otázky ke wallboxu pro rodinný dům'}
                {segment === 'firemni' && 'Otázky k firemní nabíjecí infrastruktuře'}
                {segment === 'bytovy' && 'Otázky k instalaci v bytovém domě'}
              </h2>
            </div>

            <div className="space-y-3">
              {segmentFaqs[segment].map((faq, idx) => (
                <details key={idx} className="bg-white border border-slate-200 rounded-xl group">
                  <summary className="cursor-pointer list-none flex items-center justify-between font-semibold text-base text-slate-900 px-6 py-4">
                    <span>{faq.q}</span>
                    <svg className="w-5 h-5 text-slate-400 flex-shrink-0 ml-4 transform group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>
                  <div className="px-6 pb-5 pt-1 text-slate-600 leading-relaxed text-sm border-t border-slate-100">
                    {faq.a}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {page === 'home' && <>
      {/* FAQ Section - general */}
      <section className="py-16 bg-white border-t border-slate-100">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h2 className="text-3xl md:text-4xl font-bold text-slate-900 mb-3">
              Obecné otázky o cenách instalací
            </h2>
            <p className="text-lg text-slate-600">
              Nejčastější otázky o tom, z čeho se cena skládá a jak kalkulátor funguje. Otázky ke konkrétnímu typu instalace najdete přímo v kalkulátoru.
            </p>
          </div>

          <div className="space-y-3">
            {[
              {
                q: 'Je výsledek kalkulátoru závazná nabídka?',
                a: 'Ne. Výsledek slouží jako orientační odhad pro porovnání variant a plánování rozpočtu. Přesná cena se stanovuje až podle konkrétních podmínek v místě instalace.'
              },
              {
                q: 'Co může finální cenu nejvíce ovlivnit?',
                a: 'Typicky jde o vzdálenost od rozvaděče, požadovaný výkon, počet stanic, stav stávající elektroinstalace, nutné úpravy rozvaděče a stavební práce.'
              },
              {
                q: 'Pro koho je kalkulátor určen?',
                a: 'Pro rodinné domy, firmy i bytové domy (včetně SVJ/BD), které chtějí získat rychlý orientační odhad instalačních nákladů před poptávkou konkrétní nabídky.'
              },
              {
                q: 'Musím se registrovat?',
                a: 'Ne. Kalkulátor můžete použít bez registrace a bez závazků.'
              },
              {
                q: 'Umíte i realizaci instalace?',
                a: 'Ano, kalkulátor slouží jako první krok. Pokud budete chtít, navážeme přesnější nabídkou a návrhem řešení podle konkrétního místa instalace.'
              }
            ].map((faq, idx) => (
              <details key={idx} className="border border-slate-200 rounded-xl group">
                <summary className="cursor-pointer list-none flex items-center justify-between font-semibold text-base text-slate-900 px-6 py-4">
                  <span>{faq.q}</span>
                  <svg className="w-5 h-5 text-slate-400 flex-shrink-0 ml-4 transform group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <div className="px-6 pb-5 pt-1 text-slate-600 leading-relaxed text-sm border-t border-slate-100">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-16 bg-blue-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Zjistěte cenu Vaší instalace
          </h2>
          <p className="text-blue-100 text-lg mb-8 max-w-xl mx-auto">
            Zdarma a bez závazků. Výsledek s rozpadem ceny získáte do 2 minut.
          </p>
          <button
            onClick={scrollToCalculator}
            className="bg-white text-blue-600 hover:bg-blue-50 font-bold py-4 px-10 rounded-xl transition-all duration-200 shadow-lg text-base"
          >
            Spočítat odhad
          </button>
        </div>
      </section>
      </>}

      {/* GDPR Modal */}
      {showGdprModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={() => setShowGdprModal(false)}>
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-slate-900 bg-opacity-75" />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full" onClick={(e) => e.stopPropagation()}>
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-2xl font-bold text-slate-900">Zásady zpracování osobních údajů</h3>
                  <button onClick={() => setShowGdprModal(false)} className="text-slate-400 hover:text-slate-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="mt-4 max-h-96 overflow-y-auto prose prose-sm max-w-none">
                  <iframe src="/gdpr.html" className="w-full h-96 border-0" title="Zásady zpracování osobních údajů"></iframe>
                </div>
              </div>
              <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button onClick={() => setShowGdprModal(false)} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg">
                  Zavřít
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Terms Modal */}
      {showTermsModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto" onClick={() => setShowTermsModal(false)}>
          <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
            <div className="fixed inset-0 transition-opacity bg-slate-900 bg-opacity-75" />

            <div className="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-4xl sm:w-full" onClick={(e) => e.stopPropagation()}>
              <div className="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
                <div className="flex justify-between items-start mb-4">
                  <h3 className="text-2xl font-bold text-slate-900">Podmínky použití kalkulátoru</h3>
                  <button onClick={() => setShowTermsModal(false)} className="text-slate-400 hover:text-slate-600">
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                <div className="mt-4 max-h-96 overflow-y-auto prose prose-sm max-w-none">
                  <iframe src="/terms.html" className="w-full h-96 border-0" title="Podmínky použití"></iframe>
                </div>
              </div>
              <div className="bg-slate-50 px-4 py-3 sm:px-6 sm:flex sm:flex-row-reverse">
                <button onClick={() => setShowTermsModal(false)} className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-6 rounded-lg">
                  Zavřít
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-slate-900 text-white py-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-2">
              <div className="text-lg font-bold text-white mb-2">
                Kalkulátor instalace nabíjecích stanic
              </div>
              <p className="text-slate-400 text-sm leading-relaxed max-w-xs">
                Orientační kalkulátor cen instalace nabíjecích stanic pro elektromobily v ČR. Ceny vycházejí z průměrných tržních dat pro rok 2026.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-slate-400">Typy instalací</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li>Rodinný dům (B2C)</li>
                <li>Firemní prostředí (B2B)</li>
                <li>Bytový dům</li>
                <li>DC rychlonabíjení</li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3 text-sm uppercase tracking-wider text-slate-400">Informace</h4>
              <ul className="space-y-2 text-slate-400 text-sm">
                <li>Jak kalkulátor funguje</li>
                <li>Metodika výpočtu cen</li>
                <li><button onClick={() => setShowGdprModal(true)} className="hover:text-white transition-colors">Ochrana osobních údajů</button></li>
                <li><button onClick={() => setShowTermsModal(true)} className="hover:text-white transition-colors">Podmínky použití</button></li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-6 flex flex-col md:flex-row justify-between items-center gap-3 text-slate-500 text-xs">
            <p>&copy; 2024 Kalkulátor instalace nabíjecích stanic. Všechna práva vyhrazena.</p>
            <p>Ceny jsou orientační a vycházejí z průměrných tržních dat pro rok 2026.</p>
          </div>
        </div>
      </footer>

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.5s ease-out;
        }

        @keyframes bounce {
          0%, 100% {
            transform: translateY(-5%);
            animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
          }
          50% {
            transform: translateY(0);
            animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
          }
        }

        .animate-bounce {
          animation: bounce 1s infinite;
        }

        .bg-grid-white\/5 {
          background-image:
            linear-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255, 255, 255, 0.05) 1px, transparent 1px);
          background-size: 20px 20px;
        }

        details summary::-webkit-details-marker {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default ChargingStationCalculator;