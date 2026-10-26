/* TrailLog – native bridge for the Android app (Capacitor).
 *
 * In a normal browser (website / PWA) `window.Capacitor` does not exist, so NativeBridge.native is false and
 * nothing in this file does anything. Inside the Android app it wraps:
 *   - @capacitor-community/background-geolocation  (foreground-service location, works with the screen off)
 *   - TrailLogNative (local plugin)                (permission prompts, status, settings shortcuts)
 *   - @capacitor/filesystem + @capacitor/share     (GPX/KML export; blob downloads do not work in WebViews)
 *   - @capacitor/app                               (back button, minimize, version)
 *   - SystemBars                                   (status/navigation bar icon colors)
 *
 * Written as a factory so Node tests can inject a fake Capacitor object.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = { create: factory };
  else root.NativeBridge = factory(root.Capacitor);
})(typeof self !== 'undefined' ? self : this, function create(cap) {
  'use strict';

  var isNative = false;
  try {
    isNative = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform() &&
      (typeof cap.getPlatform !== 'function' || cap.getPlatform() === 'android'));
  } catch (e) { isNative = false; }

  var api = { native: isNative };
  if (!isNative) return api;

  var cache = {};
  function plugin(name) {
    if (!cache[name]) cache[name] = cap.registerPlugin(name);
    return cache[name];
  }

  /* ---------- notification text shown while recording (Android requires it) ---------- */
  api.NOTIFICATION_TITLE = 'TrailLog is recording';
  api.NOTIFICATION_TEXT = 'Recording your trail. Tap to open TrailLog.';

  /* ---------- permissions & settings ---------- */
  api.checkStatus = function () { return plugin('TrailLogNative').checkStatus(); };
  api.requestForeground = function () { return plugin('TrailLogNative').requestForeground(); };
  api.requestBackground = function () { return plugin('TrailLogNative').requestBackground(); };
  api.requestNotifications = function () { return plugin('TrailLogNative').requestNotifications(); };
  api.openAppSettings = function () { return plugin('TrailLogNative').openAppSettings(); };
  api.openBatterySettings = function () { return plugin('TrailLogNative').openBatterySettings(); };
  api.openLocationSettings = function () { return plugin('TrailLogNative').openLocationSettings(); };
  api.openNotificationSettings = function () { return plugin('TrailLogNative').openNotificationSettings(); };

  /* ---------- location watching ---------- */
  /** Convert the plugin's location object into the shape of a browser GeolocationPosition. */
  api.toPosition = function (loc) {
    return {
      coords: {
        latitude: loc.latitude, longitude: loc.longitude, accuracy: loc.accuracy,
        altitude: loc.altitude, altitudeAccuracy: loc.altitudeAccuracy,
        heading: loc.bearing, speed: loc.speed
      },
      timestamp: loc.time || Date.now()
    };
  };
  /** Convert a plugin error into a browser-style GeolocationPositionError (1 = denied, 2 = unavailable). */
  api.toGeoError = function (err) {
    var msg = (err && err.message) || 'Location unavailable';
    if (err && err.code === 'NOT_AUTHORIZED') {
      return { code: /disabled/i.test(msg) ? 2 : 1, message: msg };
    }
    return { code: 2, message: msg };
  };

  var handles = {}, nextHandle = 1;
  /**
   * Start a watcher. With opts.background the plugin runs a foreground service with a persistent notification,
   * so fixes keep arriving with the screen off. Permissions are NOT requested here (the app does that first,
   * after showing its disclosure). Returns a handle string for stopWatch().
   * The plugin's service binds a moment after launch; if it is not ready yet we retry for a few seconds.
   */
  api.startWatch = function (opts, onPosition, onError) {
    opts = opts || {};
    var o = { requestPermissions: false, stale: false, distanceFilter: 0 };
    if (opts.background) {
      o.backgroundTitle = api.NOTIFICATION_TITLE;
      o.backgroundMessage = api.NOTIFICATION_TEXT;
    }
    var hd = { stopped: false, pluginId: null, tries: 0 };
    var key = 'w' + (nextHandle++);
    handles[key] = hd;
    function attempt() {
      if (hd.stopped) return;
      hd.tries++;
      plugin('BackgroundGeolocation').addWatcher(o, function (loc, err) {
        if (hd.stopped) return;
        if (err) {
          if (/Service not running/i.test(err.message || '') && hd.tries < 25) { setTimeout(attempt, 200); return; }
          if (onError) onError(api.toGeoError(err));
          return;
        }
        if (loc && typeof loc.latitude === 'number') onPosition(api.toPosition(loc));
      }).then(function (id) {
        if (hd.stopped) { plugin('BackgroundGeolocation').removeWatcher({ id: id }).catch(function () { /* ignore */ }); }
        else hd.pluginId = id;
      }, function (e) { if (!hd.stopped && onError) onError(api.toGeoError(e)); });
    }
    attempt();
    return key;
  };
  api.stopWatch = function (key) {
    var hd = handles[key]; delete handles[key];
    if (!hd) return Promise.resolve();
    hd.stopped = true;
    if (hd.pluginId == null) return Promise.resolve();
    return plugin('BackgroundGeolocation').removeWatcher({ id: hd.pluginId }).catch(function () { /* ignore */ });
  };

  /* ---------- export / share ---------- */
  function safeName(name) {
    var n = String(name || 'track').replace(/[^A-Za-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
    return n || 'track';
  }
  /** Write text to the app cache folder, then open the Android share sheet with that file. */
  api.shareFile = function (o) {
    var fs = plugin('Filesystem'), sh = plugin('Share');
    var filename = safeName(o.filename);
    return fs.writeFile({ path: 'exports/' + filename, data: o.text, directory: 'CACHE', encoding: 'utf8', recursive: true })
      .then(function (res) {
        return sh.share({ title: o.title || filename, text: o.summary || undefined, files: [res.uri], dialogTitle: o.dialogTitle || 'Export track' });
      });
  };
  /** Remove files left over from earlier exports. */
  api.cleanupExports = function () {
    return plugin('Filesystem').rmdir({ path: 'exports', directory: 'CACHE', recursive: true }).catch(function () { /* none yet */ });
  };

  /* ---------- app shell ---------- */
  api.onBack = function (handler) { return plugin('App').addListener('backButton', handler); };
  api.minimize = function () { return plugin('App').minimizeApp(); };
  api.exit = function () { return plugin('App').exitApp(); };
  api.appInfo = function () { return plugin('App').getInfo(); };
  api.onAppStateChange = function (handler) { return plugin('App').addListener('appStateChange', handler); };
  /** Status bar sits on the always-green top bar (light icons). Navigation bar follows the page theme. */
  api.setSystemBars = function (dark) {
    var sb = plugin('SystemBars');
    return Promise.all([
      sb.setStyle({ bar: 'StatusBar', style: 'DARK' }),
      sb.setStyle({ bar: 'NavigationBar', style: dark ? 'DARK' : 'LIGHT' })
    ]).catch(function () { /* cosmetic only */ });
  };

  return api;
});
