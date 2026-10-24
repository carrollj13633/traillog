/* TrailLog – main app. Plain JS, no build step. */
(function () {
  'use strict';
  var G = window.Geo, P = window.Platform, DB = window.TLDb;

  /* ================= helpers ================= */
  function $(id) { return document.getElementById(id); }
  function h(tag, attrs) {
    var el = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      var v = attrs[k];
      if (v == null || v === false) return;
      if (k === 'class') el.className = v;
      else if (k.slice(0, 2) === 'on' && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    });
    for (var i = 2; i < arguments.length; i++) append(el, arguments[i]);
    return el;
  }
  function append(el, kid) {
    if (kid == null || kid === false) return;
    if (Array.isArray(kid)) { kid.forEach(function (k) { append(el, k); }); return; }
    el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('tl.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('tl.' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } }
  };
  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function slug(s) { return (String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'track'); }
  function fmtDate(t) {
    if (!t) return 'Unknown date';
    return new Date(t).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
  }
  function list(items) { return h('ol', null, items.map(function (s) { return h('li', null, s); })); }

  function toast(msg, opts) {
    opts = opts || {};
    var el = h('div', { class: 'toast', role: 'status' }, h('span', null, msg));
    if (opts.action) el.append(h('button', { type: 'button', onclick: function () { el.remove(); opts.action.onClick(); } }, opts.action.label));
    $('toasts').append(el);
    if (!opts.sticky) setTimeout(function () { el.remove(); }, opts.ms || 4000);
    return el;
  }

  function modal(o) {
    var overlay = h('div', { class: 'overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': o.title });
    var box = h('div', { class: 'modal' });
    overlay.append(box);
    function close() { overlay.remove(); if (o.onClose) o.onClose(); }
    box.append(h('h2', null, o.title));
    if (o.body) append(box, o.body);
    var acts = h('div', { class: 'm-actions' });
    (o.actions || [{ label: 'Close', kind: 'alt' }]).forEach(function (a) {
      var b = h('button', { type: 'button', class: 'btn ' + (a.kind || 'alt'), onclick: function () {
        var r = a.onClick ? a.onClick(api) : undefined;
        if (r !== false) close();
      } }, a.label);
      acts.append(b);
    });
    box.append(acts);
    if (o.dismissible !== false) overlay.addEventListener('click', function (e) { if (e.target === overlay) close(); });
    document.body.append(overlay);
    var api = { close: close, el: box };
    var first = box.querySelector('input,button');
    if (first && o.focus !== false) setTimeout(function () { try { first.focus({ preventScroll: true }); } catch (e) { /* ignore */ } }, 30);
    return api;
  }

  /* ================= state ================= */
  var S = {
    units: store.get('units', 'mi'),
    theme: store.get('theme', 'auto'),
    maxAcc: store.get('maxAcc', 30),
    secure: (typeof window.isSecureContext === 'boolean') ? window.isSecureContext : (location.protocol === 'https:' || /^(localhost|127\.|\[::1\])/.test(location.hostname)),
    perm: 'unknown',        // granted | prompt | denied | unsupported | unknown
    watchId: null,
    lastFix: null, lastFixAt: 0, geoErr: null,
    follow: true, centered: false,
    rec: null, points: [], stats: null, segLatLngs: [], rejected: 0,
    wake: 'off', wakeSentinel: null,
    tracks: [], current: null,
    view: 'record', installEvt: null, dbInfo: { persistent: true }
  };
  var PLAT = P.detectPlatform(readEnv());

  function readEnv() {
    function mm(q) { try { return !!(window.matchMedia && window.matchMedia(q).matches); } catch (e) { return false; } }
    var uad = navigator.userAgentData;
    return {
      ua: navigator.userAgent || '',
      maxTouchPoints: navigator.maxTouchPoints || 0,
      navStandalone: navigator.standalone,
      displayStandalone: mm('(display-mode: standalone)') || mm('(display-mode: fullscreen)') || mm('(display-mode: minimal-ui)'),
      uaData: uad ? { platform: uad.platform, mobile: uad.mobile, brands: uad.brands } : null
    };
  }

  function filterOpts() { return { maxAccuracy: S.maxAcc }; }
  function applyTheme() { document.documentElement.setAttribute('data-theme', S.theme); }

  /* ================= banners ================= */
  var banners = {};
  function setBanner(id, o) {
    clearBanner(id);
    var el = h('div', { class: 'banner ' + (o.type || 'info'), role: o.type === 'error' ? 'alert' : 'status' },
      h('div', { class: 'msg' }, o.title ? h('strong', null, o.title) : null, o.text));
    (o.actions || []).forEach(function (a) { el.append(h('button', { type: 'button', onclick: a.onClick }, a.label)); });
    if (o.dismissible) el.append(h('button', { type: 'button', class: 'x', 'aria-label': 'Dismiss', onclick: function () { clearBanner(id); if (o.onDismiss) o.onDismiss(); } }, '×'));
    banners[id] = el;
    $('banners').append(el);
  }
  function clearBanner(id) { if (banners[id]) { banners[id].remove(); delete banners[id]; } }

  function refreshStaticBanners() {
    if (!S.secure) {
      setBanner('insecure', { type: 'error', title: 'HTTPS required for GPS',
        text: 'This page is not served over HTTPS, so your phone will block location access. Open the https:// address instead.',
        actions: [{ label: 'Details', onClick: function () { showErrorModal('insecure'); } }] });
    } else clearBanner('insecure');
    if (PLAT.backgroundRisk !== 'low' && !sessionStorage.getItem('tl.bgDismissed')) {
      setBanner('bg', { type: 'warn',
        title: PLAT.os === 'ios' ? 'iPhone/iPad: keep the screen on' : 'Android: keep the screen on',
        text: P.getGuide(PLAT).background,
        dismissible: true, onDismiss: function () { try { sessionStorage.setItem('tl.bgDismissed', '1'); } catch (e) { /* ignore */ } } });
    }
    if (S.perm === 'denied') {
      setBanner('perm', { type: 'error', title: 'Location is blocked', text: 'Allow location for this site to record tracks.',
        actions: [{ label: 'How to fix', onClick: function () { showErrorModal(1); } }] });
    } else clearBanner('perm');
    if (!S.dbInfo.persistent) {
      setBanner('storage', { type: 'warn', title: 'Storage unavailable',
        text: 'This browser blocked local storage, so recordings are kept in memory only and will be lost if you close the page. Export your track before leaving.' });
    }
  }

  function showErrorModal(code, extraActions) {
    var help = P.errorHelp(code, PLAT);
    var actions = (extraActions || []).concat([{ label: 'Close', kind: 'alt' }]);
    modal({ title: help.title, body: [h('p', null, help.message), list(help.steps), h('p', { class: 'note' }, 'Detected: ' + PLAT.label)], actions: actions });
  }

  /* ================= maps ================= */
  var OSM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';
  var BASES = [
    { id: 'street', name: 'Street', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', opts: { maxZoom: 19, attribution: OSM_ATTR } },
    { id: 'satellite', name: 'Satellite', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      opts: { maxZoom: 19, attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community' } },
    { id: 'topo', name: 'Topo', url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
      opts: { maxZoom: 17, subdomains: 'abc', attribution: 'Map data: ' + OSM_ATTR + ', <a href="https://viewfinder.rdd.nasa.gov/">SRTM</a> | Map style: &copy; <a href="https://opentopomap.org">OpenTopoMap</a> (<a href="https://creativecommons.org/licenses/by-sa/3.0/">CC-BY-SA</a>)' } }
  ];
  var maps = {};  // name -> {map, layers:{id:TileLayer}, current:id}
  var map, detailMap;
  var me = { dot: null, circle: null };
  var live = { casing: null, line: null, start: null };
  var detailLayers = null, scrubMarker = null;

  function createMap(name, elId, view, zoom) {
    var m = L.map(elId, { zoomControl: true, attributionControl: true, tap: true }).setView(view, zoom);
    var entry = { map: m, layers: {}, current: null, name: name };
    var baseObj = {};
    BASES.forEach(function (b) {
      entry.layers[b.id] = L.tileLayer(b.url, b.opts);
      baseObj[b.name] = entry.layers[b.id];
    });
    var id = store.get('basemap', 'street');
    if (!entry.layers[id]) id = 'street';
    entry.layers[id].addTo(m);
    entry.current = id;
    L.control.layers(baseObj, null, { position: 'topright', collapsed: true }).addTo(m);
    m.getContainer().classList.toggle('dark-tiles', id !== 'satellite');
    m.on('baselayerchange', function (e) {
      var found = BASES.filter(function (b) { return entry.layers[b.id] === e.layer; })[0];
      if (!found) return;
      entry.current = found.id;
      store.set('basemap', found.id);
      m.getContainer().classList.toggle('dark-tiles', found.id !== 'satellite');
    });
    maps[name] = entry;
    return m;
  }
  /** Keep both maps on the user's saved layer choice (call when a map becomes visible). */
  function syncBase(name) {
    var e = maps[name]; if (!e) return;
    var id = store.get('basemap', 'street');
    if (!e.layers[id] || e.current === id) return;
    e.map.removeLayer(e.layers[e.current]);
    e.layers[id].addTo(e.map);
    e.current = id;
    e.map.getContainer().classList.toggle('dark-tiles', id !== 'satellite');
  }

  function initMap() {
    var last = store.get('lastPos', null);
    map = createMap('live', 'map', last ? [last[0], last[1]] : [39.5, -98.35], last ? 15 : 4);
    live.casing = L.polyline([], { color: '#fff', weight: 9, opacity: .85, interactive: false, lineJoin: 'round' }).addTo(map);
    live.line = L.polyline([], { color: '#ff6b2c', weight: 5, opacity: .95, interactive: false, lineJoin: 'round', lineCap: 'round' }).addTo(map);
    map.on('dragstart', function () { S.follow = false; $('locate-btn').classList.remove('on'); });
  }

  function pinMarker(latlng, color, label) {
    return L.circleMarker(latlng, { radius: 9, color: '#fff', weight: 3, fillColor: color, fillOpacity: 1, opacity: 1 }).bindTooltip(label, { direction: 'top', offset: [0, -8] });
  }

  function updateMe(fix) {
    var ll = [fix.lat, fix.lon];
    if (!me.dot) {
      me.circle = L.circle(ll, { radius: fix.acc || 10, color: '#2f80ed', weight: 1, fillColor: '#2f80ed', fillOpacity: .15, interactive: false }).addTo(map);
      me.dot = L.marker(ll, {
        icon: L.divIcon({ className: 'me-dot', html: '<span class="me-pulse"></span><span class="me-core"></span>', iconSize: [22, 22], iconAnchor: [11, 11] }),
        interactive: false, keyboard: false, zIndexOffset: 1000
      }).addTo(map);
    } else {
      me.dot.setLatLng(ll);
      me.circle.setLatLng(ll).setRadius(fix.acc || 10);
    }
    store.set('lastPos', ll);
    if (S.view === 'record' && S.follow) {
      if (!S.centered) { map.setView(ll, Math.max(map.getZoom(), 16), { animate: false }); S.centered = true; }
      else map.panTo(ll, { animate: true, duration: .5 });
    }
  }

  function redrawLive() {
    var segs = S.segLatLngs.filter(function (s) { return s.length; });
    live.casing.setLatLngs(segs);
    live.line.setLatLngs(segs);
    var first = S.points[0];
    if (first && !live.start) live.start = pinMarker([first.lat, first.lon], '#1e8e4e', 'Start').addTo(map);
    if (!first && live.start) { map.removeLayer(live.start); live.start = null; }
  }

  /* Gradient colors: green (start) -> yellow -> red (end). */
  function colorAt(f) { return 'hsl(' + Math.round(130 * (1 - f)) + ',85%,45%)'; }
  function drawTrack(m, pts, group) {
    group.clearLayers();
    if (!pts.length) return;
    var segs = [], cur = null, curS = null;
    pts.forEach(function (p) { if (cur === null || p.s !== curS) { cur = []; segs.push(cur); curS = p.s; } cur.push([p.lat, p.lon]); });
    L.polyline(segs, { color: '#fff', weight: 9, opacity: .85, interactive: false, lineJoin: 'round' }).addTo(group);
    var n = pts.length;
    if (n > 1) {
      var bands = Math.min(150, n - 1), line = null, band = -1;
      var flush = function () {
        if (line && line.length > 1) L.polyline(line, { color: colorAt((band + .5) / bands), weight: 5, opacity: 1, interactive: false, lineJoin: 'round', lineCap: 'round' }).addTo(group);
        line = null;
      };
      for (var i = 1; i < n; i++) {
        var a = pts[i - 1], b = pts[i];
        if (a.s !== b.s) { flush(); band = -1; continue; }
        var bd = Math.min(bands - 1, Math.floor((i - 1) / (n - 1) * bands));
        if (!line || bd !== band) { flush(); line = [[a.lat, a.lon]]; band = bd; }
        line.push([b.lat, b.lon]);
      }
      flush();
    }
    pinMarker([pts[0].lat, pts[0].lon], '#1e8e4e', 'Start').addTo(group);
    if (n > 1) pinMarker([pts[n - 1].lat, pts[n - 1].lon], '#c62828', 'End').addTo(group);
    var bounds = L.latLngBounds(pts.map(function (p) { return [p.lat, p.lon]; }));
    m.invalidateSize();
    m.fitBounds(bounds, { padding: [30, 30], maxZoom: 18, animate: false });
  }

  /* ================= geolocation ================= */
  function queryPermission() {
    if (!navigator.permissions || !navigator.permissions.query) { S.perm = 'unsupported'; return Promise.resolve(); }
    return navigator.permissions.query({ name: 'geolocation' }).then(function (st) {
      S.perm = st.state;
      st.onchange = function () { S.perm = st.state; onPermChange(); };
    }).catch(function () { S.perm = 'unsupported'; });
  }
  function onPermChange() {
    if (S.perm === 'granted' && S.watchId == null && !document.hidden) startWatch();
    if (S.perm === 'denied') { stopWatch(); }
    refreshStaticBanners(); updateChips();
    if (S.view === 'compat') renderCompat();
  }

  function startWatch() {
    if (S.watchId != null) return true;
    if (!S.secure || !('geolocation' in navigator)) return false;
    S.watchWanted = true;
    S.watchId = navigator.geolocation.watchPosition(onFix, onGeoError, { enableHighAccuracy: true, maximumAge: 0, timeout: 30000 });
    updateChips();
    return true;
  }
  function stopWatch(keepWanted) {
    if (S.watchId != null) { navigator.geolocation.clearWatch(S.watchId); S.watchId = null; }
    if (!keepWanted) S.watchWanted = false;
    updateChips();
  }

  function onFix(pos) {
    var c = pos.coords;
    var fix = {
      lat: c.latitude, lon: c.longitude, acc: c.accuracy,
      ele: isFinite(c.altitude) && c.altitude !== null ? c.altitude : null,
      spd: (c.speed !== null && isFinite(c.speed) && c.speed >= 0) ? c.speed : null,
      t: pos.timestamp > 1e12 ? pos.timestamp : Date.now()
    };
    S.lastFix = fix; S.lastFixAt = Date.now(); S.geoErr = null;
    clearBanner('geo');
    if (S.perm !== 'granted') { S.perm = 'granted'; refreshStaticBanners(); }
    updateMe(fix);
    if (S.rec && S.rec.state === 'recording') recordFix(fix);
    updateChips(); updateStats();
  }

  function onGeoError(err) {
    var code = err && err.code;
    S.geoErr = code;
    if (code === 1) {
      stopWatch();
      S.perm = 'denied';
      var aborted = false;
      if (S.rec && S.rec.state === 'recording') {
        if (S.points.length === 0) { aborted = true; discardActive(true); }
        else pauseRecording();
      }
      refreshStaticBanners();
      showErrorModal(1, [{ label: 'Try again', kind: 'start', onClick: function () { tryAgain(); } }]);
      if (aborted) toast('Recording cancelled: location is blocked.');
    } else {
      var help = P.errorHelp(code === 3 ? 3 : 2, PLAT);
      setBanner('geo', { type: 'warn', title: help.title, text: help.message,
        actions: [{ label: 'Fix it', onClick: function () { showErrorModal(code === 3 ? 3 : 2); } }] });
    }
    updateChips();
  }
  function tryAgain() {
    stopWatch();
    if (startWatch()) toast('Trying again…');
  }

  /** Checks that must pass before we ask for location; returns false after showing a tailored error. */
  function preflight(afterRetry) {
    if (!S.secure) { showErrorModal('insecure'); return false; }
    if (!('geolocation' in navigator)) { showErrorModal('unsupported'); return false; }
    if (S.perm === 'denied') {
      showErrorModal(1, [{ label: 'Try again', kind: 'start', onClick: function () { tryAgain(); if (afterRetry) afterRetry(); } }]);
      return false;
    }
    return true;
  }

  /* ================= recording ================= */
  function elapsedMs() {
    var r = S.rec; if (!r) return 0;
    return r.elapsedBase + (r.state === 'recording' ? Date.now() - r.runStart : 0);
  }
  function saveMeta() {
    if (!S.rec) return Promise.resolve();
    S.rec.heartbeat = Date.now();
    return DB.setActiveMeta(Object.assign({}, S.rec)).catch(function (e) { console.warn('meta save failed', e); });
  }
  var timers = { tick: null, beat: null };
  function startTimers() {
    stopTimers();
    timers.tick = setInterval(function () { updateStats(); updateChips(); }, 1000);
    timers.beat = setInterval(saveMeta, 5000);
  }
  function stopTimers() { clearInterval(timers.tick); clearInterval(timers.beat); timers.tick = timers.beat = null; }

  function onStart() {
    if (!preflight(function () { /* user can tap Start again once allowed */ })) return;
    var now = Date.now();
    S.rec = { id: uid(), name: '', startedAt: now, state: 'recording', seg: 0, elapsedBase: 0, runStart: now, heartbeat: now };
    S.points = []; S.stats = G.createStats(); S.segLatLngs = [[]]; S.rejected = 0;
    redrawLive();
    DB.clearActive().then(saveMeta);
    startWatch();
    acquireWakeLock();
    startTimers();
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(function () { /* ignore */ });
    S.follow = true; $('locate-btn').classList.add('on');
    if (S.lastFix) map.setView([S.lastFix.lat, S.lastFix.lon], Math.max(map.getZoom(), 16));
    renderAll();
    if (!S.lastFix || Date.now() - S.lastFixAt > 15000) toast('Acquiring GPS…');
  }

  function recordFix(fix) {
    var r = S.rec;
    var prev = S.points.length ? S.points[S.points.length - 1] : null;
    if (prev && prev.s !== r.seg) prev = null;
    var cand = { lat: fix.lat, lon: fix.lon, acc: fix.acc, t: fix.t, ele: fix.ele, s: r.seg };
    var res = G.acceptFix(prev, cand, filterOpts());
    if (!res.ok) { S.rejected++; return; }
    if (prev && fix.t - prev.t > 60000) toast('GPS had a gap of ' + G.formatDuration(fix.t - prev.t) + '. A straight line connects the points.');
    var p = { lat: fix.lat, lon: fix.lon, ele: fix.ele, t: fix.t, acc: fix.acc, s: r.seg };
    S.points.push(p);
    S.stats.add(p);
    var seg = S.segLatLngs[r.seg] || (S.segLatLngs[r.seg] = []);
    seg.push([p.lat, p.lon]);
    redrawLive();
    DB.addActivePoint(p).catch(function (e) { console.warn('point save failed', e); });
  }

  function pauseRecording() {
    var r = S.rec; if (!r || r.state !== 'recording') return;
    r.elapsedBase = elapsedMs(); r.state = 'paused';
    releaseWakeLock(); saveMeta(); renderAll();
  }
  function resumeRecording() {
    var r = S.rec; if (!r || r.state === 'recording') return;
    if (!preflight()) return;
    r.seg++; r.runStart = Date.now(); r.state = 'recording';
    S.segLatLngs[r.seg] = [];
    startWatch(); acquireWakeLock(); startTimers(); saveMeta(); renderAll();
  }
  function stopRecording() {
    var r = S.rec; if (!r) return;
    r.elapsedBase = elapsedMs(); r.state = 'stopped';
    if (!r.name) r.name = G.defaultName(new Date(r.startedAt));
    releaseWakeLock(); stopTimers(); saveMeta(); renderAll();
    if (S.points.length < 2) toast('Too few GPS points to save. Discard or go back and resume.', { ms: 5000 });
  }
  function reopenRecording() { // from review back to paused so the user can continue
    if (S.rec && S.rec.state === 'stopped') { S.rec.state = 'paused'; saveMeta(); renderAll(); }
  }
  function saveRecording() {
    var r = S.rec;
    if (!r || S.points.length < 2) { toast('Need at least 2 GPS points to save.'); return; }
    var name = ($('name-input').value || '').trim() || G.defaultName(new Date(r.startedAt));
    var sum = G.summarize(S.points, r.elapsedBase);
    var track = Object.assign({ id: r.id, name: name, source: 'recorded', points: S.points.slice() }, sum);
    track.startedAt = r.startedAt; track.endedAt = r.startedAt + r.elapsedBase;
    DB.putTrack(track).then(function () { return DB.clearActive(); }).then(function () {
      resetRecording();
      toast('Saved “' + name + '”');
      return refreshTracks().then(function () { go('tracks'); openTrack(track.id); });
    }).catch(function (e) { toast('Could not save: ' + (e && e.message ? e.message : e)); });
  }
  function discardActive(silent) {
    var go_ = function () { DB.clearActive(); resetRecording(); if (!silent) toast('Recording discarded'); };
    go_();
  }
  function confirmDiscard() {
    modal({ title: 'Discard this recording?', body: h('p', null, 'The recorded path (' + S.points.length + ' points) will be deleted permanently.'),
      actions: [{ label: 'Discard recording', kind: 'danger', onClick: function () { discardActive(); } }, { label: 'Keep it', kind: 'alt' }] });
  }
  function resetRecording() {
    S.rec = null; S.points = []; S.stats = null; S.segLatLngs = []; S.rejected = 0;
    stopTimers(); releaseWakeLock(); redrawLive(); renderAll();
    if (!document.hidden && S.perm !== 'granted' && S.watchId != null && !S.lastFix) stopWatch();
  }

  /** Restore an in-progress recording after a reload/crash. */
  function restoreActive() {
    return DB.getActiveMeta().then(function (meta) {
      if (!meta || !meta.id) return;
      return DB.getActivePoints().then(function (pts) {
        if (meta.state === 'recording') {
          meta.elapsedBase += Math.max(0, (meta.heartbeat || meta.runStart) - meta.runStart);
          meta.state = 'paused';
        }
        S.rec = meta; S.points = pts || [];
        S.stats = G.createStats(); S.segLatLngs = [[]];
        S.points.forEach(function (p) { S.stats.add(p); (S.segLatLngs[p.s] || (S.segLatLngs[p.s] = [])).push([p.lat, p.lon]); });
        for (var i = 0; i < S.segLatLngs.length; i++) if (!S.segLatLngs[i]) S.segLatLngs[i] = [];
        redrawLive();
        if (S.points.length) {
          var b = L.latLngBounds(S.points.map(function (p) { return [p.lat, p.lon]; }));
          map.fitBounds(b, { padding: [30, 30], maxZoom: 17, animate: false });
          S.centered = true; S.follow = false;
        }
        saveMeta();
        renderAll();
        if (meta.state === 'stopped') { toast('You have an unsaved recording ready to save.', { ms: 6000 }); return; }
        var st = S.stats.get();
        modal({
          title: 'Resume your recording?',
          body: [h('p', null, 'TrailLog found an unfinished recording from ' + fmtDate(meta.startedAt) + ' (' + S.points.length + ' points, ' + G.formatDistance(st.distance, S.units) + ', ' + G.formatDuration(meta.elapsedBase) + ').'),
            h('p', { class: 'note' }, 'Nothing was lost. Resuming starts a new segment; the gap while the page was closed is not counted.')],
          dismissible: false,
          actions: [
            { label: 'Resume recording', kind: 'start', onClick: function () { resumeRecording(); } },
            { label: 'Review & save', kind: 'alt', onClick: function () { stopRecording(); } },
            { label: 'Discard', kind: 'danger', onClick: function () { setTimeout(confirmDiscard, 0); } }
          ]
        });
      });
    });
  }

  /* ================= wake lock ================= */
  var wakeSupported = 'wakeLock' in navigator;
  function acquireWakeLock() {
    if (!wakeSupported) { S.wake = 'unsupported'; updateChips(); return Promise.resolve(); }
    if (S.wakeSentinel && !S.wakeSentinel.released) return Promise.resolve();
    return navigator.wakeLock.request('screen').then(function (s) {
      S.wakeSentinel = s; S.wake = 'on';
      s.addEventListener('release', function () {
        if (S.wakeSentinel === s) S.wakeSentinel = null;
        S.wake = (S.rec && S.rec.state === 'recording') ? 'lost' : 'off';
        updateChips();
      });
      updateChips();
    }).catch(function (e) { S.wake = 'failed'; S.wakeErr = e && e.name; updateChips(); });
  }
  function releaseWakeLock() {
    if (S.wakeSentinel) { try { S.wakeSentinel.release(); } catch (e) { /* ignore */ } S.wakeSentinel = null; }
    S.wake = wakeSupported ? 'off' : 'unsupported';
    updateChips();
  }

  document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
      if (S.rec) saveMeta();
      if (!S.rec || S.rec.state !== 'recording') stopWatch(true); // save battery when idle in background
    } else {
      if (S.watchWanted || S.perm === 'granted') startWatch();
      if (S.rec && S.rec.state === 'recording') {
        acquireWakeLock();
        if (Date.now() - S.lastFixAt > 30000) toast('Welcome back. GPS may have paused while the app was in the background.', { ms: 5000 });
      }
      updateChips(); updateStats();
    }
  });
  window.addEventListener('pagehide', function () { if (S.rec) saveMeta(); });

  /* ================= record UI ================= */
  function updateChips() {
    var g = $('gps-chip'), cls = 'chip', txt;
    if (S.watchId == null) txt = 'GPS off';
    else if (!S.lastFix) { txt = 'Searching for GPS…'; cls += ' warn'; }
    else if (Date.now() - S.lastFixAt > 20000) { txt = 'No recent GPS fix'; cls += ' warn'; }
    else {
      var a = S.lastFix.acc, m = S.units === 'km' ? a : a * G.FT_PER_M;
      txt = 'GPS ±' + Math.round(m) + (S.units === 'km' ? ' m' : ' ft');
      if (a > S.maxAcc) { txt += ' (weak, filtered)'; cls += ' warn'; } else cls += ' ok';
    }
    g.className = cls; g.textContent = txt;

    var pc = $('perm-chip'), pm = { granted: ['Location allowed', 'ok'], prompt: ['Location: will ask', ''], denied: ['Location blocked', 'bad'], unsupported: ['Location: asks on Start', ''], unknown: ['Location: –', ''] }[S.perm] || ['Location: –', ''];
    pc.className = 'chip ' + pm[1]; pc.textContent = pm[0];

    var w = $('wake-chip'), wm;
    if (!wakeSupported) wm = ['Screen: keep awake manually', 'warn'];
    else if (S.wake === 'on') wm = ['Screen awake (lock on)', 'ok'];
    else if (S.wake === 'lost') wm = ['Wake lock lost', 'warn'];
    else if (S.wake === 'failed') wm = ['Wake lock denied', 'warn'];
    else wm = ['Wake lock: off', ''];
    w.className = 'chip ' + wm[1]; w.textContent = wm[0];
  }

  function updateStats() {
    var u = S.units, r = S.rec;
    var st = S.stats ? S.stats.get() : { distance: 0, gain: 0, hasEle: false, count: 0 };
    var el = elapsedMs();
    $('st-time').textContent = G.formatDuration(el);
    $('st-dist').textContent = G.formatDistance(st.distance, u);
    var cur = null;
    if (r && r.state === 'recording' && S.lastFix && Date.now() - S.lastFixAt < 15000) {
      cur = S.lastFix.spd !== null ? S.lastFix.spd : G.recentSpeed(S.points, 15000);
    }
    $('st-speed').textContent = G.formatSpeed(cur, u);
    $('st-avg').textContent = (r && el > 5000 && st.distance > 0) ? G.formatSpeed(st.distance / (el / 1000), u) : '–';
    $('st-gain').textContent = st.hasEle ? G.formatElevation(st.gain, u) : '–';
    $('st-pts').textContent = String(S.points.length);
    $('st-pts').title = S.rejected + ' noisy fixes dropped';
  }

  function renderControls() {
    var c = $('controls'); c.replaceChildren();
    var st = S.rec ? S.rec.state : 'idle';
    if (st === 'idle') c.append(h('button', { type: 'button', class: 'btn huge start', onclick: onStart }, 'Start'));
    else if (st === 'recording') c.append(
      h('button', { type: 'button', class: 'btn huge pause', onclick: pauseRecording }, 'Pause'),
      h('button', { type: 'button', class: 'btn huge stop', onclick: stopRecording }, 'Stop'));
    else if (st === 'paused') c.append(
      h('button', { type: 'button', class: 'btn huge start', onclick: resumeRecording }, 'Resume'),
      h('button', { type: 'button', class: 'btn huge stop', onclick: stopRecording }, 'Stop'));
    else c.append(
      h('button', { type: 'button', class: 'btn huge start', id: 'save-btn', disabled: S.points.length < 2, onclick: saveRecording }, 'Save'),
      h('button', { type: 'button', class: 'btn huge danger', onclick: confirmDiscard }, 'Discard'));
    $('rec-note').hidden = !(st === 'recording' || st === 'paused');
    var fb = $('finish-box'); fb.hidden = st !== 'stopped';
    if (st === 'stopped') {
      var inp = $('name-input');
      if (inp.dataset.for !== S.rec.id) { inp.value = S.rec.name; inp.dataset.for = S.rec.id; }
      if (!$('resume-link')) {
        var rl = h('button', { type: 'button', id: 'resume-link', class: 'btn small ghost', onclick: reopenRecording }, 'Not done? Keep recording');
        fb.append(rl);
      }
    } else if ($('resume-link')) $('resume-link').remove();
  }

  function renderAll() { renderControls(); updateStats(); updateChips(); }

  /* ================= tracks ================= */
  function refreshTracks() {
    return DB.getAllTracks().then(function (arr) {
      S.tracks = (arr || []).sort(function (a, b) { return (b.startedAt || 0) - (a.startedAt || 0); });
      renderTrackList();
    });
  }
  function renderTrackList() {
    var ul = $('track-list'); ul.replaceChildren();
    $('export-all-btn').disabled = !S.tracks.length;
    if (!S.tracks.length) {
      var ic = h('div', { 'aria-hidden': 'true' });
      ic.innerHTML = '<svg viewBox="0 0 24 24" width="56" height="56"><path fill="currentColor" d="M2 20 9 7l4 7 2-3 7 9z"/></svg>';
      ul.append(h('li', { class: 'empty' }, ic,
        h('p', null, 'No saved tracks yet.'),
        h('p', null, 'Record a trail on the Record tab, or import a GPX file.')));
      return;
    }
    S.tracks.forEach(function (t) {
      ul.append(h('li', null, h('button', { type: 'button', class: 'track-card', onclick: function () { openTrack(t.id); } },
        h('span', { class: 't-name' }, t.name || 'Untitled', t.source === 'imported' ? h('span', { class: 'tag' }, 'imported') : null),
        h('span', { class: 't-date' }, fmtDate(t.startedAt)),
        h('span', { class: 't-stats' }, h('span', null, G.formatDistance(t.distance, S.units)), h('span', null, G.formatDuration(t.duration)),
          t.hasEle ? h('span', null, '▲ ' + G.formatElevation(t.gain, S.units)) : null))));
    });
  }

  function openTrack(id) {
    var t = S.tracks.filter(function (x) { return x.id === id; })[0];
    if (!t) return;
    S.current = t;
    go('detail', { push: true });
    renderDetail();
  }

  function renderDetail() {
    var t = S.current; if (!t) return;
    var u = S.units;
    $('detail-name').textContent = t.name || 'Untitled';
    $('detail-sub').textContent = fmtDate(t.startedAt) + (t.source === 'imported' ? ' · imported' : '');
    var avg = t.duration > 0 ? t.distance / (t.duration / 1000) : null;
    var cells = [['Distance', G.formatDistance(t.distance, u)], ['Duration', G.formatDuration(t.duration)], ['Avg speed', G.formatSpeed(avg, u)],
      ['Elev. gain', t.hasEle ? G.formatElevation(t.gain, u) : '–'], ['Elev. loss', t.hasEle ? G.formatElevation(t.loss, u) : '–'],
      ['Max elev.', t.hasEle ? G.formatElevation(t.maxEle, u) : '–'], ['Min elev.', t.hasEle ? G.formatElevation(t.minEle, u) : '–'], ['Points', String(t.count)]];
    var ds = $('detail-stats'); ds.replaceChildren();
    cells.forEach(function (c) { ds.append(h('div', { class: 'stat' }, h('span', { class: 'lbl' }, c[0]), h('span', { class: 'val' }, c[1]))); });

    if (!detailMap) {
      detailMap = createMap('detail', 'map-detail', [0, 0], 2);
      detailLayers = L.layerGroup().addTo(detailMap);
    }
    syncBase('detail');
    if (scrubMarker) { detailMap.removeLayer(scrubMarker); scrubMarker = null; }
    setTimeout(function () { drawTrack(detailMap, t.points, detailLayers); }, 30);
    drawChart();

    var acts = $('detail-actions'); acts.replaceChildren();
    append(acts, [
      h('button', { type: 'button', class: 'btn alt', onclick: renameCurrent }, 'Rename'),
      navigator.share ? h('button', { type: 'button', class: 'btn alt', onclick: function () { shareTrack(t); } }, 'Share') : null,
      h('button', { type: 'button', class: 'btn', onclick: function () { downloadText(slug(t.name) + '.gpx', G.buildGpx([t]), 'application/gpx+xml'); } }, 'Export GPX'),
      h('button', { type: 'button', class: 'btn', onclick: function () { downloadText(slug(t.name) + '.kml', G.buildKml([t]), 'application/vnd.google-earth.kml+xml'); } }, 'Export KML'),
      h('button', { type: 'button', class: 'btn danger', onclick: deleteCurrent }, 'Delete')]);
  }

  function renameCurrent() {
    var t = S.current; if (!t) return;
    var inp = h('input', { type: 'text', maxlength: '80', value: t.name || '', 'aria-label': 'Track name' });
    modal({ title: 'Rename track', body: inp, actions: [
      { label: 'Save name', kind: 'start', onClick: function () {
        var v = inp.value.trim(); if (!v) { inp.focus(); return false; }
        t.name = v; DB.putTrack(t).then(function () { renderDetail(); renderTrackList(); toast('Renamed'); });
      } }, { label: 'Cancel', kind: 'alt' }] });
    inp.addEventListener('keydown', function (e) { if (e.key === 'Enter') e.target.closest('.modal').querySelector('.btn.start').click(); });
  }
  function deleteCurrent() {
    var t = S.current; if (!t) return;
    modal({ title: 'Delete “' + (t.name || 'Untitled') + '”?', body: h('p', null, 'This permanently removes the track from this device. Export it first if you want a backup.'),
      actions: [{ label: 'Delete track', kind: 'danger', onClick: function () {
        DB.deleteTrack(t.id).then(refreshTracks).then(function () { S.current = null; go('tracks'); toast('Track deleted'); });
      } }, { label: 'Cancel', kind: 'alt' }] });
  }

  /* ---- elevation chart ---- */
  var chartData = null;
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function drawChart(cursor) {
    var t = S.current, cv = $('chart');
    var prof = t ? G.elevationProfile(t.points) : [];
    $('chart-empty').hidden = prof.length >= 2; cv.hidden = prof.length < 2; $('chart-tip').hidden = prof.length < 2;
    if (prof.length < 2) { chartData = null; return; }
    var u = S.units, dpr = window.devicePixelRatio || 1;
    var w = cv.clientWidth || 300, hh = cv.clientHeight || 170;
    cv.width = Math.round(w * dpr); cv.height = Math.round(hh * dpr);
    var ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    var pts = G.downsample(prof, 400);
    var total = prof[prof.length - 1].d || 1;
    var vals = pts.map(function (p) { return G.elevationValue(p.ele, u); });
    var min = Math.min.apply(null, vals), max = Math.max.apply(null, vals);
    if (max - min < 10) { var mid = (max + min) / 2; min = mid - 5; max = mid + 5; }
    var pad = (max - min) * .08; min -= pad; max += pad;
    var L_ = 48, R_ = 10, T_ = 8, B_ = 22, pw = w - L_ - R_, ph = hh - T_ - B_;
    var X = function (d) { return L_ + (d / total) * pw; };
    var Y = function (v) { return T_ + (1 - (v - min) / (max - min)) * ph; };
    ctx.clearRect(0, 0, w, hh);
    ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = cssVar('--muted'); ctx.strokeStyle = cssVar('--border'); ctx.lineWidth = 1;
    ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
    for (var i = 0; i <= 3; i++) {
      var v = min + (max - min) * i / 3, y = Y(v);
      ctx.beginPath(); ctx.moveTo(L_, y); ctx.lineTo(w - R_, y); ctx.stroke();
      ctx.fillText(Math.round(v).toLocaleString('en-US'), L_ - 6, y);
    }
    ctx.textBaseline = 'top'; ctx.textAlign = 'left'; ctx.fillText('0', L_, hh - B_ + 6);
    ctx.textAlign = 'right'; ctx.fillText(G.distanceValue(total, u).toFixed(2) + ' ' + G.distanceUnit(u), w - R_, hh - B_ + 6);
    var grad = ctx.createLinearGradient(0, T_, 0, T_ + ph);
    grad.addColorStop(0, 'rgba(46,139,87,.55)'); grad.addColorStop(1, 'rgba(46,139,87,.05)');
    ctx.beginPath(); ctx.moveTo(X(pts[0].d), T_ + ph);
    pts.forEach(function (p, k) { ctx.lineTo(X(p.d), Y(vals[k])); });
    ctx.lineTo(X(pts[pts.length - 1].d), T_ + ph); ctx.closePath(); ctx.fillStyle = grad; ctx.fill();
    ctx.beginPath(); pts.forEach(function (p, k) { if (k) ctx.lineTo(X(p.d), Y(vals[k])); else ctx.moveTo(X(p.d), Y(vals[k])); });
    ctx.strokeStyle = '#2e8b57'; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.stroke();
    chartData = { prof: prof, total: total, L: L_, pw: pw, w: w };
    if (cursor != null) {
      var cx = X(cursor.d); ctx.strokeStyle = cssVar('--accent'); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(cx, T_); ctx.lineTo(cx, T_ + ph); ctx.stroke();
      ctx.fillStyle = cssVar('--accent'); ctx.beginPath(); ctx.arc(cx, Y(G.elevationValue(cursor.ele, u)), 5, 0, 6.3); ctx.fill();
    }
  }
  function scrub(e) {
    if (!chartData || !S.current) return;
    var rect = $('chart').getBoundingClientRect();
    var f = Math.min(1, Math.max(0, (e.clientX - rect.left - chartData.L) / chartData.pw));
    var d = f * chartData.total, prof = chartData.prof, lo = 0, hi = prof.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (prof[m].d < d) lo = m; else hi = m; }
    var pt = Math.abs(prof[lo].d - d) < Math.abs(prof[hi].d - d) ? prof[lo] : prof[hi];
    $('chart-tip').textContent = G.distanceValue(pt.d, S.units).toFixed(2) + ' ' + G.distanceUnit(S.units) + ' · ' + G.formatElevation(pt.ele, S.units);
    drawChart(pt);
    var p = S.current.points[pt.i];
    if (detailMap && p) {
      if (!scrubMarker) scrubMarker = L.circleMarker([p.lat, p.lon], { radius: 7, color: '#fff', weight: 3, fillColor: '#ff6b2c', fillOpacity: 1, interactive: false }).addTo(detailMap);
      else scrubMarker.setLatLng([p.lat, p.lon]);
    }
  }

  /* ---- export / import / share ---- */
  function downloadText(name, text, mime) {
    var blob = new Blob([text], { type: mime + ';charset=utf-8' });
    var url = URL.createObjectURL(blob);
    var a = h('a', { href: url, download: name, style: 'display:none' });
    document.body.append(a); a.click();
    setTimeout(function () { a.remove(); URL.revokeObjectURL(url); }, 4000);
    toast('Exported ' + name);
  }
  function shareTrack(t) {
    var summary = (t.name || 'Track') + ' – ' + G.formatDistance(t.distance, S.units) + ' in ' + G.formatDuration(t.duration);
    var file;
    try { file = new File([G.buildGpx([t])], slug(t.name) + '.gpx', { type: 'application/gpx+xml' }); } catch (e) { file = null; }
    var p;
    if (file && navigator.canShare && navigator.canShare({ files: [file] })) p = navigator.share({ files: [file], title: t.name, text: summary });
    else if (navigator.share) { p = navigator.share({ title: t.name, text: summary }).then(function () { toast('Shared a summary. Use Export GPX to send the file itself.', { ms: 5000 }); }); }
    else { downloadText(slug(t.name) + '.gpx', G.buildGpx([t]), 'application/gpx+xml'); return; }
    p.catch(function (e) {
      if (e && e.name === 'AbortError') return;
      downloadText(slug(t.name) + '.gpx', G.buildGpx([t]), 'application/gpx+xml');
    });
  }
  function exportAll() {
    if (!S.tracks.length) return;
    var d = new Date(), ymd = d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
    downloadText('traillog-all-' + ymd + '.gpx', G.buildGpx(S.tracks, { name: 'TrailLog export' }), 'application/gpx+xml');
  }
  function importFiles(files) {
    var total = 0, errors = [];
    var chain = Promise.resolve();
    Array.prototype.forEach.call(files, function (f) {
      chain = chain.then(function () { return f.text(); }).then(function (txt) {
        var parsed = G.parseGpx(txt);
        var base = f.name.replace(/\.[^.]+$/, '');
        var puts = parsed.tracks.map(function (tr, i) {
          var sum = G.summarize(tr.points, null);
          var t = Object.assign({ id: uid() + i, name: tr.name || (parsed.tracks.length > 1 ? base + ' ' + (i + 1) : base), source: 'imported', points: tr.points }, sum);
          if (!t.startedAt) t.startedAt = Date.now();
          total++;
          return DB.putTrack(t);
        });
        return Promise.all(puts);
      }).catch(function (e) { errors.push(f.name + ': ' + (e && e.message ? e.message : e)); });
    });
    chain.then(refreshTracks).then(function () {
      if (total) toast('Imported ' + total + ' track' + (total === 1 ? '' : 's'));
      if (errors.length) modal({ title: 'Import problem', body: errors.map(function (e) { return h('p', null, e); }) });
    });
  }

  /* ================= help / settings ================= */
  function seg(options, value, onChange) {
    var wrap = h('div', { class: 'seg', role: 'group' });
    options.forEach(function (o) {
      wrap.append(h('button', { type: 'button', 'aria-pressed': String(o[0] === value), onclick: function () { onChange(o[0]); } }, o[1]));
    });
    return wrap;
  }
  function guideSections(sections) {
    return sections.map(function (s) { return [h('h3', null, s.h), list(s.steps)]; });
  }
  function renderHelp() {
    var g = P.getGuide(PLAT), b = $('help-body'); b.replaceChildren();
    b.append(
      h('div', { class: 'help-section' }, h('h2', null, 'Your device'),
        h('p', null, h('span', { class: 'platform-badge' }, PLAT.label)),
        !S.secure ? h('p', null, h('strong', null, 'This page is not HTTPS, so GPS will be blocked.')) : null,
        h('div', { class: 'row' },
          h('button', { type: 'button', class: 'btn small', onclick: function () { go('compat', { push: true }); } }, 'Run compatibility check'),
          h('button', { type: 'button', class: 'btn small alt', onclick: showOnboarding }, 'Show intro'),
          S.installEvt ? h('button', { type: 'button', class: 'btn small start', onclick: promptInstall }, 'Install app') : null)),
      h('div', { class: 'help-section' }, h('h2', null, 'Setup guide for this device'), guideSections(g.setup)),
      h('div', { class: 'help-section' }, h('h2', null, 'If location is blocked or denied'), list(g.denied)),
      h('div', { class: 'help-section' }, h('h2', null, 'Background GPS limits'), h('p', null, g.background),
        h('p', { class: 'note' }, 'Websites cannot track in the background the way native apps can. If the screen locks, expect gaps; TrailLog joins them with a straight line.')),
      h('div', { class: 'help-section' }, h('h2', null, 'Settings'),
        h('div', { class: 'setting' }, h('span', null, 'Units'), seg([['mi', 'Miles'], ['km', 'Kilometers']], S.units, setUnits)),
        h('div', { class: 'setting' }, h('span', null, 'Theme'), seg([['auto', 'Auto'], ['light', 'Light'], ['dark', 'Dark']], S.theme, function (v) { S.theme = v; store.set('theme', v); applyTheme(); renderHelp(); })),
        h('div', { class: 'setting' }, h('label', { for: 'acc-select' }, 'Ignore fixes less accurate than'),
          (function () {
            var sel = h('select', { id: 'acc-select', onchange: function (e) { S.maxAcc = +e.target.value; store.set('maxAcc', S.maxAcc); updateChips(); } });
            [10, 20, 30, 50, 100].forEach(function (v) { sel.append(h('option', { value: v, selected: v === S.maxAcc }, v + ' m (' + Math.round(v * G.FT_PER_M) + ' ft)')); });
            return sel;
          })())),
      h('div', { class: 'help-section' }, h('h2', null, 'About'),
        h('p', null, 'TrailLog stores everything on this device (IndexedDB). There is no account and no server. Map tiles come from OpenStreetMap, Esri, and OpenTopoMap and are cached as you browse so recently viewed areas work offline.'),
        h('p', { class: 'note' }, 'Version 1.0.0')));
  }
  function setUnits(u) {
    S.units = u; store.set('units', u);
    $('units-btn').textContent = u;
    renderHelp(); renderTrackList(); updateStats(); updateChips();
    if (S.view === 'detail') renderDetail();
  }

  function showOnboarding() {
    var g = P.getGuide(PLAT);
    var body = [h('p', null, 'Record a path on demand from your phone’s GPS. Everything stays on your device.'),
      h('p', null, h('span', { class: 'platform-badge' }, PLAT.label)),
      !S.secure ? h('p', null, h('strong', null, 'Heads up: this page is not HTTPS, so location will be blocked.')) : null,
      h('p', null, 'Location is only requested when you tap Start (or the locate button).'),
      guideSections(g.setup), h('p', { class: 'note' }, g.background)];
    modal({ title: 'Welcome to TrailLog', body: body, actions: [
      { label: 'Got it', kind: 'start', onClick: function () { store.set('onboarded', true); } },
      { label: 'Run compatibility check', kind: 'alt', onClick: function () { store.set('onboarded', true); go('compat', { push: true }); } }] });
  }

  function promptInstall() {
    var e = S.installEvt; if (!e) return;
    e.prompt(); e.userChoice.finally(function () { S.installEvt = null; renderHelp(); });
  }

  /* ================= compatibility check ================= */
  function compatRows() {
    var rows = [], ok = 'ok', warn = 'warn', fail = 'fail', info = 'info';
    rows.push(['Platform', info, PLAT.label + ' (engine: ' + PLAT.engine + '). Detected via ' + PLAT.evidence.join(', ') + '.']);
    rows.push(['Display mode', PLAT.standalone ? ok : (PLAT.os === 'ios' ? warn : info),
      PLAT.standalone ? 'Running as an installed app.' : 'Running in a browser tab.' + (PLAT.os === 'ios' ? ' Adding to the Home Screen is recommended.' : ' You can install it from the browser menu.')]);
    rows.push(['HTTPS / secure context', S.secure ? ok : fail,
      S.secure ? 'Secure (' + location.protocol + '//' + location.host + '). Location, service workers, and wake lock are allowed.' : 'Not secure (' + location.protocol + '//' + location.host + '). Browsers block GPS, the service worker, and wake lock here. Use https://.']);
    rows.push(['Geolocation API', 'geolocation' in navigator ? ok : fail, 'geolocation' in navigator ? 'Available.' : 'Not available in this browser.']);
    var pm = { granted: [ok, 'Granted. Tracking can start without a prompt.'], prompt: [info, 'Not decided yet. The browser will ask when you tap Start.'], denied: [fail, 'Denied. Open Help for the fix for your device.'],
      unsupported: [info, 'This browser cannot report the permission state (common on iOS Safari). You will be asked when you tap Start.'], unknown: [info, 'Checking…'] }[S.perm] || [info, S.perm];
    rows.push(['Location permission', pm[0], pm[1]]);
    rows.push(['Screen Wake Lock', wakeSupported ? (S.secure ? ok : warn) : warn,
      wakeSupported ? 'Supported. The screen is kept awake while recording' + (S.wake === 'on' ? ' (currently holding a lock).' : '.') : 'Not supported. Keep the screen on manually (iOS: Settings > Display & Brightness > Auto-Lock).']);
    rows.push(['Background GPS', PLAT.backgroundRisk === 'high' ? warn : PLAT.backgroundRisk === 'medium' ? warn : ok, P.getGuide(PLAT).background]);
    rows.push(['Web Share', navigator.share ? (navigator.canShare ? ok : info) : info, navigator.share ? 'Available. Files can be shared where the OS allows it.' : 'Not available. Use Export GPX/KML to save files.']);
    return rows;
  }
  function renderCompat() {
    var body = $('compat-body'); body.replaceChildren();
    var card = h('div', { class: 'help-section' });
    body.append(card);
    var asyncRows = {};
    function paint() {
      card.replaceChildren();
      var rows = compatRows();
      rows.splice(7, 0, asyncRows.idb || ['IndexedDB', 'info', 'Testing…'], asyncRows.sw || ['Service worker (offline)', 'info', 'Checking…'], asyncRows.storage || ['Persistent storage', 'info', 'Checking…']);
      var sym = { ok: '✓', warn: '!', fail: '×', info: 'i' };
      rows.forEach(function (r) {
        card.append(h('div', { class: 'compat-row' }, h('span', { class: 'compat-ic ' + r[1], 'aria-label': r[1] }, sym[r[1]]),
          h('div', null, h('div', { class: 'c-label' }, r[0]), h('div', { class: 'c-detail' }, r[2]))));
      });
      compatReport = rows.map(function (r) { return '[' + r[1].toUpperCase() + '] ' + r[0] + ': ' + r[2]; }).join('\n');
    }
    var compatReport = '';
    paint();
    var actions = h('div', { class: 'row' },
      h('button', { type: 'button', class: 'btn small', onclick: renderCompat }, 'Re-run'),
      h('button', { type: 'button', class: 'btn small alt', onclick: function () {
        var txt = 'TrailLog compatibility report\n' + navigator.userAgent + '\n' + compatReport;
        (navigator.clipboard ? navigator.clipboard.writeText(txt) : Promise.reject()).then(function () { toast('Report copied'); }, function () {
          modal({ title: 'Compatibility report', body: h('pre', { style: 'white-space:pre-wrap;font-size:.8rem' }, txt) });
        });
      } }, 'Copy report'));
    body.append(actions);

    DB.selfTest().then(function (okk) { asyncRows.idb = ['IndexedDB', okk ? 'ok' : 'fail', okk ? 'Working. In-progress recordings are saved continuously.' : 'Read/write test failed.']; },
      function (e) { asyncRows.idb = ['IndexedDB', 'fail', 'Unavailable (' + (e && e.message ? e.message : e) + '). Recordings will be kept in memory only.']; }).then(paint);
    (function () {
      if (!S.secure) { asyncRows.sw = ['Service worker (offline)', 'fail', 'Needs HTTPS. Offline mode is unavailable on this page.']; paint(); return; }
      if (!('serviceWorker' in navigator)) { asyncRows.sw = ['Service worker (offline)', 'fail', 'Not supported by this browser.']; paint(); return; }
      navigator.serviceWorker.getRegistration().then(function (reg) {
        asyncRows.sw = ['Service worker (offline)', navigator.serviceWorker.controller ? 'ok' : 'warn',
          navigator.serviceWorker.controller ? 'Active. The app works offline.' : (reg ? 'Installed. Reload once so it takes control.' : 'Not registered yet. Reload once.')];
        paint();
      });
    })();
    if (navigator.storage && navigator.storage.persisted) {
      navigator.storage.persisted().then(function (p) {
        asyncRows.storage = ['Persistent storage', p ? 'ok' : 'info', p ? 'Granted. The browser will not evict your tracks.' : 'Not granted. Browsers may clear data for sites you rarely visit; export tracks you care about. Installing to the Home Screen helps.'];
        paint();
      });
    } else { asyncRows.storage = ['Persistent storage', 'info', 'Not supported by this browser.']; paint(); }
  }

  /* ================= navigation ================= */
  var PARENT = { detail: 'tracks', compat: 'help' };
  function go(view, opts) {
    S.view = view;
    Array.prototype.forEach.call(document.querySelectorAll('.view'), function (v) { v.classList.toggle('active', v.id === 'view-' + view); });
    var tab = PARENT[view] || view;
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) { t.classList.toggle('active', t.dataset.view === tab); });
    if (opts && opts.push) { try { history.pushState({ v: view }, ''); } catch (e) { /* ignore */ } }
    if (view === 'record') { syncBase('live'); setTimeout(function () { map.invalidateSize(); }, 30); }
    if (view === 'tracks') renderTrackList();
    if (view === 'help') renderHelp();
    if (view === 'compat') renderCompat();
    if (view === 'detail' && detailMap) setTimeout(function () { detailMap.invalidateSize(); }, 30);
  }
  window.addEventListener('popstate', function () {
    if (PARENT[S.view]) go(PARENT[S.view]);
  });
  function back() { if (history.state && history.state.v === S.view) history.back(); else go(PARENT[S.view] || 'record'); }

  /* ================= service worker ================= */
  function registerSW() {
    if (!S.secure || !('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('sw.js').then(function (reg) {
      reg.addEventListener('updatefound', function () {
        var nw = reg.installing; if (!nw) return;
        nw.addEventListener('statechange', function () {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            toast('A new version is ready.', { sticky: true, action: { label: 'Reload', onClick: function () { S.updating = true; nw.postMessage('SKIP_WAITING'); } } });
          }
        });
      });
    }).catch(function (e) { console.warn('SW registration failed', e); });
    navigator.serviceWorker.addEventListener('controllerchange', function () { if (S.updating) location.reload(); });
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); S.installEvt = e; if (S.view === 'help') renderHelp(); });
  window.addEventListener('appinstalled', function () { S.installEvt = null; toast('TrailLog installed'); });

  /* ================= init ================= */
  function onLocate() {
    if (!preflight()) return;
    S.follow = true; $('locate-btn').classList.add('on');
    if (S.watchId == null) { startWatch(); toast('Finding your location…'); }
    if (S.lastFix) map.setView([S.lastFix.lat, S.lastFix.lon], Math.max(map.getZoom(), 16));
  }

  function init() {
    applyTheme();
    $('units-btn').textContent = S.units;
    $('units-btn').addEventListener('click', function () { setUnits(S.units === 'mi' ? 'km' : 'mi'); });
    $('help-btn').addEventListener('click', function () { go('help'); });
    Array.prototype.forEach.call(document.querySelectorAll('.tab'), function (t) { t.addEventListener('click', function () { go(t.dataset.view); }); });
    $('detail-back').addEventListener('click', back);
    $('compat-back').addEventListener('click', back);
    $('locate-btn').addEventListener('click', onLocate);
    $('import-btn').addEventListener('click', function () { $('import-input').click(); });
    $('import-input').addEventListener('change', function (e) { if (e.target.files.length) importFiles(e.target.files); e.target.value = ''; });
    $('export-all-btn').addEventListener('click', exportAll);
    $('name-input').addEventListener('input', function (e) { if (S.rec) S.rec.name = e.target.value; });
    $('name-input').addEventListener('change', saveMeta);
    var ch = $('chart');
    ch.addEventListener('pointerdown', scrub); ch.addEventListener('pointermove', function (e) { if (e.buttons || e.pointerType === 'touch') scrub(e); });
    window.addEventListener('resize', function () { if (S.view === 'detail') drawChart(); if (map) map.invalidateSize(); });

    if (typeof L === 'undefined') { setBanner('leaflet', { type: 'error', title: 'Map library failed to load', text: 'Reload the page. If this persists, the Leaflet files are missing.' }); return; }
    initMap();
    refreshStaticBanners();
    updateChips();
    renderControls();

    DB.init().then(function (info) { S.dbInfo = info; if (!info.persistent) refreshStaticBanners(); })
      .then(restoreActive).then(refreshTracks).catch(function (e) { console.error(e); });
    queryPermission().then(function () {
      refreshStaticBanners(); updateChips();
      if (S.perm === 'granted' && S.secure) startWatch(); // no prompt can appear when already granted
    });
    registerSW();
    if (!store.get('onboarded', false)) setTimeout(showOnboarding, 400);
  }

  window.TrailLog = { _state: S, _go: go, _platform: PLAT };
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
