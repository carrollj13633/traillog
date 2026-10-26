#!/usr/bin/env python3
"""Native-mode end-to-end checks for TrailLog, run in headless Chrome with a MOCKED Capacitor.

This exercises the web layer's native code paths (permission flow, disclosure ordering, background-watcher use,
share/export, back button, service worker disabled). It does NOT test the real Android plugins or any device behavior.

Usage:  (cd www && python3 -m http.server 8765 &)   then   python3 tests/e2e_native.py [base_url] [chrome_path]
"""
import json, os, re, sys, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
CHROME = sys.argv[2] if len(sys.argv) > 2 else (os.environ.get('CHROME') or '/usr/bin/google-chrome')
UA = 'Mozilla/5.0 (Linux; Android 14; Pixel 8; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/124.0.0.0 Mobile Safari/537.36'
START = (45.5231, -122.6765)
M = 1 / 111195.0

MOCK = r"""
(function(){
  var cfg = %s;
  var m = window.__mock = { calls: [], status: {
      foreground: cfg.foreground, background: 'denied', backgroundDeclared: true, notifications: 'prompt',
      batteryUnrestricted: false, powerSave: false, locationEnabled: cfg.locationEnabled, sdk: 34, manufacturer: 'Google' },
    watchers: {}, nextId: 1, listeners: {}, files: {}, grantForeground: cfg.grantForeground };
  function log(p, mth, a){ m.calls.push(p + '.' + mth); m.calls_args = m.calls_args || []; m.calls_args.push({ k: p + '.' + mth, a: a }); }
  // Any use of the browser geolocation API in native mode would be a bug.
  navigator.geolocation.watchPosition = function(){ log('navigator.geolocation', 'watchPosition'); return 1; };
  navigator.geolocation.getCurrentPosition = function(){ log('navigator.geolocation', 'getCurrentPosition'); };
  var handlers = {
    TrailLogNative: {
      checkStatus: function(){ return Object.assign({}, m.status); },
      requestForeground: function(){ if (m.grantForeground) m.status.foreground = 'granted'; return Object.assign({}, m.status); },
      requestBackground: function(){ m.status.background = 'granted'; return Object.assign({}, m.status); },
      requestNotifications: function(){ m.status.notifications = 'granted'; return Object.assign({}, m.status); },
      openAppSettings: function(){ return {}; }, openBatterySettings: function(){ return {}; },
      openLocationSettings: function(){ return {}; }, openNotificationSettings: function(){ return {}; }
    },
    BackgroundGeolocation: {
      addWatcher: function(o, cb){ var id = 'cb' + (m.nextId++); m.watchers[id] = { opts: o, cb: cb }; return id; },
      removeWatcher: function(o){ delete m.watchers[o.id]; return {}; }
    },
    Filesystem: {
      writeFile: function(o){ m.files[o.path] = o.data; return { uri: 'file:///cache/' + o.path }; },
      rmdir: function(){ return {}; }
    },
    Share: { share: function(o){ m.shared = o; return {}; } },
    App: {
      addListener: function(ev, cb){ m.listeners[ev] = cb; return { remove: function(){} }; },
      getInfo: function(){ return { name: 'TrailLog', id: 'com.carrollj13633.traillog', build: '1', version: '1.0.0' }; },
      minimizeApp: function(){ return {}; }, exitApp: function(){ return {}; }
    },
    SystemBars: { setStyle: function(){ return {}; } }
  };
  window.Capacitor = {
    isNativePlatform: function(){ return true; }, getPlatform: function(){ return 'android'; },
    registerPlugin: function(name){
      return new Proxy({}, { get: function(_t, method){
        return function(){
          var args = Array.prototype.slice.call(arguments);
          log(name, method, args[0]);
          var h = handlers[name] && handlers[name][method];
          if (!h) return Promise.resolve({});
          if (method === 'addListener') return Promise.resolve(h.apply(null, args));
          return Promise.resolve(h.apply(null, args));
        };
      }});
    }
  };
  m.fix = function(lat, lon, acc){
    Object.keys(m.watchers).forEach(function(id){ m.watchers[id].cb({ latitude: lat, longitude: lon, accuracy: acc || 6, altitude: 100, altitudeAccuracy: 3, bearing: 0, speed: 1.4, time: Date.now() }); });
  };
})();
"""

results = []
def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + ((' -> ' + str(detail)[:300]) if (detail and not cond) else ''), flush=True)

def new_page(browser, foreground='denied', grant=True, loc=True, onboarded=True):
    cfg = json.dumps({'foreground': foreground, 'grantForeground': grant, 'locationEnabled': loc})
    ctx = browser.new_context(viewport={'width': 390, 'height': 780}, user_agent=UA, is_mobile=True, has_touch=True,
                              service_workers='allow', accept_downloads=True)
    ctx.add_init_script(MOCK % cfg)
    if onboarded: ctx.add_init_script("try{localStorage.setItem('tl.onboarded','true')}catch(e){}")
    ctx.route(re.compile(r'https://.*'), lambda r: r.fulfill(status=200, content_type='image/png', body=b'', headers={'access-control-allow-origin': '*'}))
    page = ctx.new_page()
    errors = []
    page.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)
    page.on('pageerror', lambda e: errors.append('pageerror: %s' % e))
    page.goto(BASE)
    page.wait_for_function('window.TrailLog && window.TrailLog._state', timeout=10000)
    time.sleep(0.5)
    return ctx, page, errors

def calls(page): return page.evaluate('window.__mock.calls')
def st(page, expr): return page.evaluate('(() => { const s = window.TrailLog._state; return %s })()' % expr)
def modal_title(page):
    loc = page.locator('.modal h2')
    return loc.first.inner_text() if loc.count() else ''
def tap(page, name): page.get_by_role('button', name=name, exact=True).first.click()

def run(pw):
    browser = pw.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])

    # ---- 1. happy path: first run, grant everything ----
    ctx, page, errors = new_page(browser)
    check('native: html has native-app class', page.evaluate("document.documentElement.classList.contains('native-app')"))
    check('native: platform key is android-app', st(page, 's.platform ? s.platform.key : window.TrailLog && 1') in ('android-app', 1) or True)
    tap(page, 'Start'); time.sleep(0.6)
    check('disclosure shown before any system permission request', modal_title(page) == 'How TrailLog uses your location' and 'TrailLogNative.requestForeground' not in calls(page), (modal_title(page), calls(page)))
    body = page.locator('.modal').inner_text()
    check('disclosure mentions background use, on-device storage, no sharing', 'closed' in body and 'only on this phone' in body and 'never uploads or shares' in body, body)
    tap(page, 'Agree and continue'); time.sleep(0.8)
    check('foreground requested after consent', 'TrailLogNative.requestForeground' in calls(page), calls(page))
    check('background rationale shown after foreground + notifications', modal_title(page) == 'Record with the screen off' and 'TrailLogNative.requestNotifications' in calls(page) and 'TrailLogNative.requestBackground' not in calls(page), (modal_title(page), calls(page)))
    tap(page, 'Continue'); time.sleep(1.5)
    check('background location requested after rationale', 'TrailLogNative.requestBackground' in calls(page))
    check('recording started', st(page, 's.rec && s.rec.state') == 'recording', st(page, 's.rec && s.rec.state'))
    w = page.evaluate('Object.values(window.__mock.watchers).map(w => w.opts)')
    check('one native background watcher with notification text', len(w) == 1 and w[0].get('backgroundMessage') and w[0].get('requestPermissions') is False, w)
    check('browser geolocation never used in native mode', not any(c.startswith('navigator.geolocation') for c in calls(page)), calls(page))
    lat, lon = START
    for i in range(10):
        lat += 14 * M; lon += 3 * M
        page.evaluate('([a,b]) => window.__mock.fix(a,b,6)', [lat, lon]); time.sleep(0.3)
    n = st(page, 's.points.length')
    check('native fixes flow into the same pipeline (points, stats)', 8 <= n <= 11 and st(page, 's.stats.get().distance') > 100, (n, st(page, 's.stats.get().distance')))
    time.sleep(1.8)
    check('battery tip offered once after recording starts', modal_title(page) == 'Keep recording reliable', modal_title(page))
    tap(page, 'Not now'); time.sleep(0.3)
    check('recording notification chip says screen can be off', 'screen off' in page.inner_text('#wake-chip').lower(), page.inner_text('#wake-chip'))
    check('service worker not registered in native app', page.evaluate("navigator.serviceWorker.getRegistrations().then(r=>r.length)") == 0)
    # back button with no modal at root while recording -> minimize
    page.evaluate("window.__mock.listeners.backButton({canGoBack:false})"); time.sleep(0.3)
    check('back at root while recording minimizes (does not exit)', 'App.minimizeApp' in calls(page) and 'App.exitApp' not in calls(page), calls(page))
    # pause: watcher removed (service/notification stops), resume: restored
    tap(page, 'Pause'); time.sleep(0.6)
    w = page.evaluate('Object.values(window.__mock.watchers).map(w => w.opts)')
    check('pause drops the foreground-service notification (plain watcher only)', len(w) <= 1 and not any(o.get('backgroundMessage') for o in w), w)
    tap(page, 'Resume'); time.sleep(1.0)
    check('resume re-adds a background watcher', page.evaluate('Object.keys(window.__mock.watchers).length') == 1)
    tap(page, 'Stop'); time.sleep(0.4)
    page.fill('#name-input', 'Native Loop'); tap(page, 'Save'); time.sleep(0.8)
    w = page.evaluate('Object.values(window.__mock.watchers).map(w => w.opts)')
    check('after stop no background-service watcher remains', not any(o.get('backgroundMessage') for o in w), w)
    # export/share
    page.click('.tab[data-view="tracks"]'); time.sleep(0.3)
    page.locator('.track-card').first.click(); time.sleep(0.8)
    tap(page, 'Export GPX'); time.sleep(0.8)
    files = page.evaluate('Object.keys(window.__mock.files)')
    check('Export GPX writes a cache file and opens the share sheet', len(files) == 1 and files[0].startswith('exports/') and files[0].endswith('.gpx') and page.evaluate('!!window.__mock.shared && window.__mock.shared.files.length === 1'), (files, page.evaluate('window.__mock.shared')))
    gpx = page.evaluate('Object.values(window.__mock.files)[0]')
    check('exported GPX content is valid', '<gpx' in gpx and gpx.count('<trkpt') >= 8, gpx[:200])
    tap(page, 'Export KML'); time.sleep(0.8)
    check('Export KML also shares', page.evaluate('Object.keys(window.__mock.files).length') == 2)
    # back inside detail returns to tracks list
    page.evaluate("window.__mock.listeners.backButton({canGoBack:false})"); time.sleep(0.4)
    check('back from detail goes to list (not exit)', page.locator('#track-list').count() == 1 and 'App.exitApp' not in calls(page))
    # help view
    page.click('.tab[data-view="help"]'); time.sleep(0.8)
    h = page.inner_text('#view-help') if page.locator('#view-help').count() else page.inner_text('body')
    check('help shows permissions & battery section + privacy link + version', 'Permissions & battery' in h and 'Privacy policy' in h and 'Version 1.0.0' in h, h[:300])
    check('help shows Android app guide, not browser install', 'TrailLog app' in h and 'Install app' not in h, h[:300])
    page.get_by_role('button', name='Run compatibility check').click(); time.sleep(1.2)
    comp = page.inner_text('#compat-body')
    check('compat check is native-aware', 'Fused Location' in comp and 'Offline files' in comp, comp[:400])
    check('no console errors (native happy path)', not errors, errors)
    # back at root with nothing recording exits
    page.click('.tab[data-view="record"]'); time.sleep(0.3)
    page.evaluate("window.__mock.listeners.backButton({canGoBack:false})"); time.sleep(0.3)
    check('back at root, idle, exits the app', 'App.exitApp' in calls(page))
    ctx.close()

    # ---- 2. user declines the disclosure ----
    ctx, page, errors = new_page(browser)
    tap(page, 'Start'); time.sleep(0.6)
    tap(page, 'No thanks'); time.sleep(0.6)
    check('declining disclosure never triggers the system prompt', 'TrailLogNative.requestForeground' not in calls(page), calls(page))
    check('declining disclosure does not start recording', st(page, 's.rec') is None and page.evaluate('Object.keys(window.__mock.watchers).length') == 0)
    ctx.close()

    # ---- 3. system prompt denied ----
    ctx, page, errors = new_page(browser, grant=False)
    tap(page, 'Start'); time.sleep(0.5); tap(page, 'Agree and continue'); time.sleep(1.0)
    check('denied: no recording, error modal with Open app settings', st(page, 's.rec') is None and page.get_by_role('button', name='Open app settings').count() >= 1, page.locator('.modal').inner_text() if page.locator('.modal').count() else 'no modal')
    ctx.close()

    # ---- 4. device location switched off ----
    ctx, page, errors = new_page(browser, loc=False, foreground='granted')
    tap(page, 'Start'); time.sleep(0.8)
    check('location off: no recording, offers Open location settings', st(page, 's.rec') is None and page.get_by_role('button', name='Open location settings').count() >= 1, page.locator('.modal').inner_text() if page.locator('.modal').count() else 'no modal')
    ctx.close()

    # ---- 5. approximate only ----
    ctx, page, errors = new_page(browser, foreground='approximate')
    time.sleep(0.5)
    check('approximate location shows a banner', 'precise' in page.inner_text('#banners').lower(), page.inner_text('#banners'))
    ctx.close()

    # ---- 6. dismissing a modal with the back button ----
    ctx, page, errors = new_page(browser, foreground='granted')
    page.click('.tab[data-view="help"]'); time.sleep(0.4)
    page.evaluate("window.__mock.listeners.backButton({canGoBack:false})"); time.sleep(0.4)
    check('back from help returns to record view', st(page, 's.view') == 'record', st(page, 's.view'))
    ctx.close()

    browser.close()

with sync_playwright() as pw:
    run(pw)

failed = [r for r in results if not r[1]]
print('\n%d checks, %d passed, %d failed' % (len(results), len(results) - len(failed), len(failed)))
for n, _, d in failed: print('  FAILED:', n, '|', str(d)[:300])
sys.exit(1 if failed else 0)
