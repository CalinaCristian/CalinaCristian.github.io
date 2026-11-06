/*
 * Privacy-friendly analytics + game telemetry (PostHog Cloud EU).
 *
 *  - Loaded lazily (after the page has rendered and the browser is idle), so it never slows the first paint.
 *  - No cookies, no localStorage: `persistence: 'memory'`. Nothing is stored on the visitor's device.
 *    The anonymous id is handed from the landing page to the game through the "Play my CV" link (?ph=…)
 *    so one visit = one visitor across both pages.
 *  - Only sends from the production hosts below. Add `?track=1` to force it on (e.g. for a quick test),
 *    `?notrack` to force it off. Respects Do Not Track / Global Privacy Control.
 *  - No session recording, no surveys, no autocapture: only the explicit events sent via cvTelemetry.track().
 *
 *  Usage (classic script, defines window.cvTelemetry):
 *      <script src="./public/telemetry.js" data-page="landing" defer></script>
 *      cvTelemetry.track('play_cta_click', { placement: 'pill' });
 *      cvTelemetry.linkWithId(url)  -> url with ?ph=<anonymous id> for cross-page continuity
 */
(function () {
    'use strict';

    var CONFIG = {
        key: 'phc_B5YgYn2dDvf675FQzMpRwuznwQTJGQF6VGPkRSvSzYXZ', // public project key (safe to ship)
        apiHost: 'https://eu.i.posthog.com',
        uiHost: 'https://eu.posthog.com',
        productionHosts: ['cristiancalina.com', 'www.cristiancalina.com', 'calinacristian.github.io'],
        appVersion: '2026-11-06',
    };

    var script = document.currentScript;
    var page = (script && script.getAttribute('data-page')) || 'landing';
    var params = new URLSearchParams(location.search);
    var queue = [];
    var ready = false;

    function trackingAllowed() {
        if (params.has('notrack')) return false;
        if (params.get('track') === '1') return true;
        var dnt = navigator.doNotTrack === '1' || window.doNotTrack === '1' || navigator.globalPrivacyControl === true;
        if (dnt) return false;
        return CONFIG.productionHosts.indexOf(location.hostname) !== -1;
    }

    var enabled = trackingAllowed();

    var api = {
        enabled: enabled,
        page: page,
        /** queue-safe event capture (no-op when tracking is disabled) */
        track: function (event, props, options) {
            if (!enabled) return;
            if (ready && window.posthog) window.posthog.capture(event, props || {}, options);
            else queue.push([event, props || {}, options]);
        },
        /** use when the page is going away (pagehide): sends with navigator.sendBeacon */
        trackBeacon: function (event, props) { api.track(event, props, { transport: 'sendBeacon' }); },
        /** report a caught exception (also captured automatically for uncaught ones) */
        error: function (err, props) {
            if (!enabled) return;
            try {
                if (ready && window.posthog && window.posthog.captureException) window.posthog.captureException(err, props || {});
                else api.track('$exception', Object.assign({ message: String(err && err.message || err) }, props || {}));
            } catch (e) { /* never let telemetry break the page */ }
        },
        /** append the anonymous id to an internal link so landing -> game is one visitor */
        linkWithId: function (url) {
            try {
                if (!enabled || !ready || !window.posthog || !window.posthog.get_distinct_id) return url;
                var u = new URL(url, location.href);
                if (u.origin !== location.origin) return url;
                u.searchParams.set('ph', window.posthog.get_distinct_id());
                return u.pathname + u.search + u.hash;
            } catch (e) { return url; }
        },
    };
    window.cvTelemetry = api;
    if (!enabled) return;

    // id handed over from the previous page (then removed from the address bar)
    var handedId = params.get('ph');
    if (handedId) {
        params.delete('ph');
        var qs = params.toString();
        try { history.replaceState(history.state, '', location.pathname + (qs ? '?' + qs : '') + location.hash); } catch (e) { /* ignore */ }
    }

    function load() {
        /* Official PostHog snippet (stub that queues calls until array.js loads) */
        // eslint-disable-next-line
        !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host.replace(".i.posthog.com","-assets.i.posthog.com")+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],Object.defineProperty(u,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e}}),Object.defineProperty(u.people,"toString",{configurable:!0,enumerable:!0,writable:!0,value:function(){return u.toString(1)+".people (stub)"}}),o="init capture register register_once register_for_session unregister unregister_for_session getFeatureFlag getFeatureFlagResult isFeatureEnabled reloadFeatureFlags updateEarlyAccessFeatureEnrollment getEarlyAccessFeatures on onFeatureFlags onSessionId getSurveys getActiveMatchingSurveys renderSurvey canRenderSurvey getNextSurveyStep identify setPersonProperties group resetGroups setPersonPropertiesForFlags resetPersonPropertiesForFlags setGroupPropertiesForFlags resetGroupPropertiesForFlags reset get_distinct_id getGroups get_session_id get_session_replay_url alias set_config startSessionRecording stopSessionRecording sessionRecordingStarted captureException loadToolbar get_property getSessionProperty createPersonProfile opt_in_capturing opt_out_capturing has_opted_in_capturing has_opted_out_capturing clear_opt_in_out_capturing debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

        var options = {
            api_host: CONFIG.apiHost,
            ui_host: CONFIG.uiHost,
            defaults: '2026-08-30',
            persistence: 'memory',          // nothing stored on the device -> no cookie banner needed
            person_profiles: 'identified_only', // anonymous events only (we never call identify)
            autocapture: false,             // explicit events only
            capture_pageview: true,
            capture_pageleave: true,
            disable_session_recording: true,
            disable_surveys: true,
            enable_heatmaps: false,
            capture_dead_clicks: false,
            advanced_disable_flags: true,   // no feature flags -> skip the /flags request
            advanced_disable_decide: true,  // (older name of the same option)
            capture_exceptions: true,       // uncaught errors -> PostHog error tracking
            respect_dnt: true,
            loaded: function () {
                ready = true;
                while (queue.length) { var q = queue.shift(); window.posthog.capture(q[0], q[1], q[2]); }
            },
        };
        if (handedId) options.bootstrap = { distinctID: handedId };
        window.posthog.init(CONFIG.key, options);
        window.posthog.register({
            site_page: page,
            app_version: CONFIG.appVersion,
            viewport: window.innerWidth + 'x' + window.innerHeight,
            touch: ('ontouchstart' in window) || navigator.maxTouchPoints > 0,
        });
    }

    // load only after the page has rendered and the main thread is idle
    function schedule() {
        var go = function () { try { load(); } catch (e) { /* never break the page */ } };
        if ('requestIdleCallback' in window) requestIdleCallback(go, { timeout: 4000 });
        else setTimeout(go, 1500);
    }
    if (document.readyState === 'complete') schedule();
    else window.addEventListener('load', schedule, { once: true });
})();
