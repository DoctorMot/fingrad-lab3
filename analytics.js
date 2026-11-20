(() => {
  'use strict';

  const config = window.FINGRAD_ANALYTICS || {};
  const ga4Id = String(config.ga4Id || '').trim().toUpperCase();
  const metrikaNumber = String(config.metrikaId || '').trim();
  const metrikaId = Number(metrikaNumber);
  const hasGa4 = /^G-[A-Z0-9]+$/.test(ga4Id);
  const hasMetrika = /^[1-9][0-9]*$/.test(metrikaNumber) && Number.isSafeInteger(metrikaId);
  const consentKey = 'fingrad-analytics-consent';
  const qaKey = 'fingrad-qa-session';
  const qaCampaign = {
    utm_source: 'qa',
    utm_medium: 'internal',
    utm_campaign: 'finlab3_qa',
  };
  const url = new URL(window.location.href);
  const qaFromUrl = Object.entries(qaCampaign).every(([key, value]) => url.searchParams.get(key) === value);
  const isQa = qaFromUrl || readStorage('sessionStorage', qaKey) === '1';
  if (qaFromUrl) writeStorage('sessionStorage', qaKey, '1');

  const enabled = hasGa4 || hasMetrika || isQa;
  const traffic = isQa ? 'qa' : 'participant';
  const rows = new Set(['revenue', 'costs', 'gross_profit', 'personnel', 'rent', 'operating_profit']);
  let consent = readStorage('localStorage', consentKey);
  let pageCounted = false;
  let ga4Loaded = false;
  let metrikaActive = false;
  let metrikaLoaded = false;
  const qaPanel = document.querySelector('[data-qa-panel]');
  const qaStatus = document.querySelector('[data-qa-status]');
  const qaOutput = document.querySelector('[data-qa-output]');
  if (isQa && qaPanel) {
    qaPanel.hidden = false;
    if (qaStatus) {
      qaStatus.textContent = hasGa4 || hasMetrika
        ? 'На странице заданы идентификаторы счётчиков. Приём событий проверьте в их отчётах.'
        : 'Локальная проверка. Идентификаторы счётчиков ещё не заданы.';
    }
  }

  function readStorage(storage, key) {
    try {
      return window[storage].getItem(key);
    } catch {
      return null;
    }
  }

  function writeStorage(storage, key, value) {
    try {
      window[storage].setItem(key, value);
    } catch {
      // The visitor's choice still applies to the current page.
    }
  }

  function loadScript(src) {
    const script = document.createElement('script');
    script.async = true;
    script.referrerPolicy = 'no-referrer';
    script.src = src;
    document.head.append(script);
  }

  function getPageLocation() {
    const page = new URL(url.origin);
    page.pathname = url.pathname;
    if (isQa) {
      page.search = new URLSearchParams(qaCampaign).toString();
      return page.href;
    }

    for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term']) {
      const value = url.searchParams.get(key);
      if (value && /^[a-z0-9_-]{1,64}$/i.test(value)) page.searchParams.set(key, value);
    }
    return page.href;
  }

  function getReferrer() {
    try {
      const referrer = new URL(document.referrer);
      return /^https?:$/.test(referrer.protocol) ? `${referrer.origin}/` : '';
    } catch {
      return '';
    }
  }

  function emitQa(name, parameters) {
    if (isQa) {
      if (qaOutput) {
        const item = document.createElement('li');
        item.textContent = parameters.row ? name + ' (' + parameters.row + ')' : name;
        qaOutput.append(item);
      }
      document.dispatchEvent(new CustomEvent('fingrad:analytics', {
        bubbles: true,
        detail: { name, parameters: { ...parameters } },
      }));
    }
  }

  function startGa4() {
    window[`ga-disable-${ga4Id}`] = false;
    const consentSettings = {
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied',
      analytics_storage: 'granted',
    };

    if (!ga4Loaded) {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () {
        window.dataLayer.push(arguments);
      };
      window.gtag('consent', 'default', { ...consentSettings, analytics_storage: 'denied' });
      window.gtag('consent', 'update', consentSettings);
      window.gtag('js', new Date());
      window.gtag('config', ga4Id, {
        send_page_view: false,
        allow_google_signals: false,
        allow_ad_personalization_signals: false,
        lab_traffic: traffic,
        page_location: getPageLocation(),
        page_referrer: getReferrer(),
        ...(isQa ? { campaign_source: 'qa', campaign_medium: 'internal', campaign_name: 'finlab3_qa' } : {}),
      });
      loadScript(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(ga4Id)}`);
      ga4Loaded = true;
    } else {
      window.gtag('consent', 'update', consentSettings);
    }
  }

  function startMetrika() {
    if (metrikaActive) return;
    if (!metrikaLoaded) {
      window.ym = window.ym || function () {
        (window.ym.a = window.ym.a || []).push(arguments);
      };
      window.ym.l = Date.now();
      loadScript('https://mc.yandex.ru/metrika/tag.js');
      metrikaLoaded = true;
    }
    window.ym(metrikaId, 'init', {
      defer: true,
      clickmap: false,
      trackLinks: false,
      accurateTrackBounce: false,
      webvisor: false,
      ecommerce: false,
      disableYtm: true,
    });
    metrikaActive = true;
  }

  function enable() {
    if (hasGa4) startGa4();
    if (hasMetrika) startMetrika();
    if (pageCounted) return;

    const parameters = { lab_traffic: traffic };
    if (hasGa4) {
      window.gtag('event', 'page_view', { ...parameters, page_location: getPageLocation() });
    }
    if (hasMetrika) {
      window.ym(metrikaId, 'hit', getPageLocation(), { referer: getReferrer(), params: parameters });
    }
    pageCounted = true;
    emitQa('page_view', parameters);
  }

  function disable() {
    if (ga4Loaded) {
      window[`ga-disable-${ga4Id}`] = true;
      window.gtag('consent', 'update', { analytics_storage: 'denied' });
    }
    if (metrikaActive) {
      window.ym(metrikaId, 'destruct');
      metrikaActive = false;
    }
  }

  function track(name, details = {}) {
    if (!enabled || consent !== 'granted') return false;
    const parameters = { lab_traffic: traffic };
    if (name === 'demo_row_expand' && rows.has(details?.row)) {
      parameters.report = 'pnl';
      parameters.row = details.row;
    } else if (name !== 'demo_open') {
      return false;
    }

    if (hasGa4) window.gtag('event', name, parameters);
    if (metrikaActive) window.ym(metrikaId, 'reachGoal', name, parameters);
    emitQa(name, parameters);
    return true;
  }

  window.finAnalytics = Object.freeze({ track });

  const banner = document.querySelector('[data-consent-banner]');
  const settingsButtons = document.querySelectorAll('[data-consent-settings]');
  const acceptButton = document.querySelector('[data-consent-accept]');
  const declineButton = document.querySelector('[data-consent-decline]');
  let activeSettingsButton;

  function choose(value) {
    if (consent !== value) {
      consent = value;
      writeStorage('localStorage', consentKey, value);
      if (value === 'granted') enable();
      else disable();
    }
    if (banner) banner.hidden = true;
    activeSettingsButton?.focus();
  }

  if (banner) banner.hidden = !enabled || consent === 'granted' || consent === 'denied';
  for (const button of settingsButtons) {
    button.hidden = !enabled;
    button.addEventListener('click', () => {
      activeSettingsButton = button;
      if (banner) banner.hidden = false;
      acceptButton?.focus();
    });
  }

  acceptButton?.addEventListener('click', () => choose('granted'));
  declineButton?.addEventListener('click', () => choose('denied'));
  window.addEventListener('storage', (event) => {
    if (event.key !== consentKey || event.newValue === consent) return;
    consent = event.newValue;
    if (consent === 'granted' && enabled) enable();
    else disable();
    if (banner) banner.hidden = !enabled || consent === 'granted' || consent === 'denied';
  });

  if (enabled && consent === 'granted') enable();
})();
