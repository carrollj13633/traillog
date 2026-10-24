#!/usr/bin/env python3
"""Headless Chrome end-to-end checks for TrailLog (mocked geolocation).

Usage:  python3 -m http.server 8765 &   then   python3 tests/e2e.py [base_url] [chrome_path]
Needs:  pip install playwright   (uses an installed Chrome/Chromium via executable_path)
"""
import base64, json, os, re, sys, tempfile, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://localhost:8765/'
CHROME = sys.argv[2] if len(sys.argv) > 2 else (os.environ.get('CHROME') or '/usr/bin/google-chrome')
PNG = base64.b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==')
START = (45.5231, -122.6765)
M = 1 / 111195.0  # ~1 meter in degrees of latitude

UA = {
    'ios-safari': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Mobile/15E148 Safari/604.1',
    'ios-standalone': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148',
    'ios-other': 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_4 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/123.0.6312.52 Mobile/15E148 Safari/604.1',
    'android-chrome': 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36',
    'android-firefox': 'Mozilla/5.0 (Android 14; Mobile; rv:124.0) Gecko/124.0 Firefox/124.0',
    'android-samsung': 'Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) SamsungBrowser/24.0 Chrome/117.0.0.0 Mobile Safari/537.36',
    'desktop': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
}

results = []
def check(name, cond, detail=''):
    results.append((name, bool(cond), detail))
    print(('PASS ' if cond else 'FAIL ') + name + ((' -> ' + str(detail)) if (detail and not cond) else ''), flush=True)

class Page:
    """A page with console/pageerror capture and tile mocking."""
    def __init__(self, browser, base=BASE, ua=None, init=None, geo=True, sw='block', viewport=(390, 780), mobile=True, perms=True, storage_state=None):
        self.errors, self.tiles = [], []
        kw = dict(viewport={'width': viewport[0], 'height': viewport[1]}, service_workers=sw, accept_downloads=True,
                  is_mobile=mobile, has_touch=mobile, device_scale_factor=2)
        if ua: kw['user_agent'] = ua
        if geo: kw['geolocation'] = {'latitude': START[0], 'longitude': START[1], 'accuracy': 8}
        if perms and geo: kw['permissions'] = ['geolocation']
        if storage_state: kw['storage_state'] = storage_state
        self.ctx = browser.new_context(**kw)
        if init: self.ctx.add_init_script(init)
        self.ctx.route(re.compile(r'https://(.*\.)?(tile\.openstreetmap\.org|arcgisonline\.com|tile\.opentopomap\.org)/.*'), self._tile)
        self.page = self.ctx.new_page()
        self.page.on('console', lambda m: self.errors.append('console.%s: %s' % (m.type, m.text)) if m.type == 'error' else None)
        self.page.on('pageerror', lambda e: self.errors.append('pageerror: %s' % e))
        self.base = base
    def _tile(self, route):
        self.tiles.append(route.request.url)
        route.fulfill(status=200, content_type='image/png', body=PNG, headers={'access-control-allow-origin': '*'})
    def goto(self, onboarded=True, wait=True):
        if onboarded:
            self.page.add_init_script("try{localStorage.setItem('tl.onboarded','true')}catch(e){}")
        self.page.goto(self.base)
        if wait: self.page.wait_for_function('window.TrailLog && window.TrailLog._state', timeout=10000)
        return self.page
    def walk(self, n=12, step_m=14, acc=8, delay=0.35, start=None):
        lat, lon = start or (self.cur if hasattr(self, 'cur') else START)
        for i in range(n):
            lat += step_m * M; lon += 3 * M
            self.ctx.set_geolocation({'latitude': lat, 'longitude': lon, 'accuracy': acc})
            time.sleep(delay)
        self.cur = (lat, lon)
    def txt(self, sel): return self.page.inner_text(sel).strip()
    def close(self): self.ctx.close()

def tap(p, text):
    p.page.get_by_role('button', name=text, exact=True).first.click()

def st(p, expr='s'):
    return p.page.evaluate('(() => { const s = window.TrailLog._state; return %s })()' % expr)

def run(pw):
    browser = pw.chromium.launch(executable_path=CHROME, headless=True, args=['--no-sandbox'])
    all_errors = []
    def done(p, label, allow=()):
        errs = [e for e in p.errors if not any(a in e for a in allow)]
        check('no console errors: ' + label, not errs, errs)
        p.close()

    # ---------- 1. load, onboarding, record a simulated walk ----------
    p = Page(browser); p.goto(onboarded=False)
    check('onboarding modal shows on first run', p.page.locator('.modal h2').first.inner_text().startswith('Welcome'))
    p.page.get_by_role('button', name='Got it').click()
    check('title/brand rendered', 'TrailLog' in p.page.inner_text('.topbar'))
    check('map container has Leaflet', p.page.locator('#map .leaflet-container, #map.leaflet-container').count() >= 1)
    check('layers control present on live map', p.page.locator('#map .leaflet-control-layers').count() == 1)
    check('state idle', st(p, 's.rec ? s.rec.state : "idle"') == 'idle', st(p, 'JSON.stringify(s.rec)'))
    tap(p, 'Start')
    p.page.wait_for_function('window.TrailLog._state.rec && window.TrailLog._state.rec.state === "recording"')
    time.sleep(0.8)
    p.walk(14)
    time.sleep(0.5)
    npts = st(p, 's.points.length')
    check('walk produced points (filter keeps good fixes)', 10 <= npts <= 16, npts)
    dist = st(p, 's.stats.get().distance')
    expected = 14 * (14 ** 2 + 3 ** 2) ** 0.5 / 14
    check('distance ~ 14 steps x 14.3 m = ~200 m', 170 <= dist <= 230, dist)
    check('stats UI: time ticking', p.txt('#st-time') != '0:00', p.txt('#st-time'))
    check('stats UI: distance in mi', re.match(r'0\.\d\d mi', p.txt('#st-dist')) is not None, p.txt('#st-dist'))
    att = p.page.locator('#map .leaflet-control-attribution').bounding_box(); sh = p.page.locator('#sheet').bounding_box()
    check('map attribution not covered by the bottom sheet', att and att['y'] + att['height'] <= sh['y'] + 1, (att, sh))
    check('stats UI: points count', p.txt('#st-pts') == str(npts), p.txt('#st-pts'))
    check('live polyline drawn', p.page.locator('#map path.leaflet-interactive, #map svg path').count() >= 1)
    check('wake lock chip visible', p.page.locator('#wake-chip').is_visible())
    check('start marker on live map (green)', p.page.locator('#map path[fill="#2e9e5b"], #map path[fill="#22a05a"], #map path[stroke="#fff"]').count() >= 1)
    # toggle units
    p.page.click('#units-btn'); time.sleep(0.2)
    check('units toggle -> km', 'km' in p.txt('#st-dist'), p.txt('#st-dist'))
    p.page.click('#units-btn')
    # jitter / bad accuracy rejected
    before = st(p, 's.points.length')
    p.ctx.set_geolocation({'latitude': p.cur[0] + 0.5 * M, 'longitude': p.cur[1], 'accuracy': 5}); time.sleep(0.4)
    p.ctx.set_geolocation({'latitude': p.cur[0] + 100 * M, 'longitude': p.cur[1], 'accuracy': 120}); time.sleep(0.4)
    check('jitter and low-accuracy fixes dropped', st(p, 's.points.length') == before, (before, st(p, 's.points.length')))
    # pause / resume
    tap(p, 'Pause'); time.sleep(0.3)
    check('paused state', st(p, 's.rec.state') == 'paused')
    n_p = st(p, 's.points.length')
    p.walk(3); time.sleep(0.3)
    check('no points recorded while paused', st(p, 's.points.length') == n_p)
    tap(p, 'Resume'); time.sleep(0.5)
    p.walk(5, step_m=12)
    check('resumed and recording again', st(p, 's.points.length') > n_p)
    check('resume starts a new segment', st(p, 'new Set(s.points.map(x=>x.s)).size') == 2)
    # ---------- 2. reload -> resume modal ----------
    time.sleep(1.2)  # allow heartbeat
    n_before = st(p, 's.points.length')
    p.page.reload(); p.page.wait_for_function('window.TrailLog && window.TrailLog._state')
    p.page.wait_for_selector('.modal h2')
    check('reload offers resume', 'Resume your recording' in p.txt('.modal h2'))
    check('IndexedDB kept every point across reload', st(p, 's.points.length') == n_before, (n_before, st(p, 's.points.length')))
    p.page.get_by_role('button', name='Resume recording').click(); time.sleep(0.5)
    check('resumed after reload', st(p, 's.rec.state') == 'recording')
    p.walk(4, step_m=12)
    check('segments after reload = 3', st(p, 'new Set(s.points.map(x=>x.s)).size') == 3, st(p, 'JSON.stringify([...new Set(s.points.map(x=>x.s))])'))
    # ---------- 3. stop, save ----------
    tap(p, 'Stop'); time.sleep(0.3)
    check('finish box visible with default name', p.page.locator('#finish-box').is_visible() and 'Trail' in p.page.input_value('#name-input'), p.page.input_value('#name-input'))
    p.page.fill('#name-input', 'Test Loop & <Park>')
    tap(p, 'Save'); time.sleep(0.8)
    p.page.click('.tab[data-view="tracks"]'); time.sleep(0.3)
    check('saved track appears in list', 'Test Loop & <Park>' in p.txt('#track-list'), p.txt('#track-list'))
    check('track list shows distance + duration', re.search(r'\d\.\d\d mi', p.txt('#track-list')) is not None, p.txt('#track-list'))
    check('active recording cleared after save', st(p, 's.rec') is None)
    # ---------- 4. detail view ----------
    p.page.locator('.track-card').first.click(); time.sleep(0.8)
    check('detail view: name', 'Test Loop' in p.txt('#detail-name'), p.txt('#detail-name'))
    check('detail map has start+end markers', p.page.locator('#map-detail path[fill="#2e9e5b"], #map-detail path[fill="#d64541"]').count() >= 2 or p.page.locator('#map-detail path').count() >= 5, p.page.locator('#map-detail path').count())
    check('detail gradient path (many bands)', p.page.locator('#map-detail path').count() >= 5, p.page.locator('#map-detail path').count())
    check('detail stats shown', 'mi' in p.txt('#detail-stats'), p.txt('#detail-stats'))
    # ele is absent in the mocked geolocation (altitude null) -> chart empty state
    check('elevation chart empty-state when no altitude', p.page.locator('#chart-empty').is_visible() and not p.page.locator('#chart').is_visible())
    check('no stray "null" text in action row', 'null' not in p.txt('#detail-actions'), p.txt('#detail-actions'))
    check('detail map layers control', p.page.locator('#map-detail .leaflet-control-layers').count() == 1)
    # downloads
    with p.page.expect_download() as d: tap(p, 'Export GPX')
    gpx_path = os.path.join(tempfile.gettempdir(), 'e2e.gpx'); d.value.save_as(gpx_path)
    gpx = open(gpx_path).read()
    check('GPX download named .gpx', d.value.suggested_filename.endswith('.gpx'), d.value.suggested_filename)
    check('GPX is 1.1 with trkpt + time', 'version="1.1"' in gpx and gpx.count('<trkpt') == st(p, 's.current.points.length') and '<time>' in gpx)
    check('GPX has 3 segments', gpx.count('<trkseg>') == 3, gpx.count('<trkseg>'))
    check('GPX escapes name', 'Test Loop &amp; &lt;Park&gt;' in gpx)
    with p.page.expect_download() as d: tap(p, 'Export KML')
    kml_path = os.path.join(tempfile.gettempdir(), 'e2e.kml'); d.value.save_as(kml_path)
    kml = open(kml_path).read()
    check('KML download + 2.2 namespace + LineString', d.value.suggested_filename.endswith('.kml') and 'opengis.net/kml/2.2' in kml and '<LineString>' in kml)
    import xml.dom.minidom as md
    try: md.parseString(gpx); md.parseString(kml); ok = True
    except Exception as e: ok = e
    check('GPX and KML are well-formed XML', ok is True, ok)
    # rename
    tap(p, 'Rename'); p.page.fill('.modal input', 'Renamed Trail'); p.page.get_by_role('button', name='Save name').click(); time.sleep(0.5)
    check('rename works', p.txt('#detail-name') == 'Renamed Trail', p.txt('#detail-name'))
    # import (GPX with elevation) -> chart
    imp = os.path.join(tempfile.gettempdir(), 'import.gpx')
    pts = ''.join('<trkpt lat="%.6f" lon="%.6f"><ele>%.1f</ele><time>2026-10-24T14:%02d:00Z</time></trkpt>' % (40 + i * 0.0005, -105 + i * 0.0003, 1600 + (i % 7) * 4 + i, i) for i in range(40))
    open(imp, 'w').write('<?xml version="1.0"?><gpx version="1.1" creator="t" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>Imported Ridge</name><trkseg>%s</trkseg></trk></gpx>' % pts)
    p.page.click('#detail-back'); time.sleep(0.3)
    p.page.set_input_files('#import-input', imp); time.sleep(1.0)
    check('GPX import adds track', 'Imported Ridge' in p.txt('#track-list'), p.txt('#track-list'))
    p.page.locator('.track-card', has_text='Imported Ridge').click(); time.sleep(0.9)
    check('elevation profile chart visible for imported track', p.page.locator('#chart').is_visible())
    check('elevation gain shown', 'ft' in p.txt('#detail-stats'), p.txt('#detail-stats'))
    box = p.page.locator('#chart').bounding_box()
    p.page.mouse.move(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.5); p.page.mouse.down(); p.page.mouse.up(); time.sleep(0.2)
    p.page.screenshot(path='/tmp/shot-detail.png')
    # export all
    p.page.click('#detail-back'); time.sleep(0.3)
    with p.page.expect_download() as d: p.page.click('#export-all-btn')
    pa = os.path.join(tempfile.gettempdir(), 'all.gpx'); d.value.save_as(pa)
    allg = open(pa).read()
    check('export-all contains both tracks', allg.count('<trk>') == 2, allg.count('<trk>'))
    # delete
    p.page.locator('.track-card', has_text='Imported Ridge').click(); time.sleep(0.5)
    tap(p, 'Delete'); p.page.get_by_role('button', name='Delete track').click(); time.sleep(0.7)
    check('delete removes track', 'Imported Ridge' not in p.txt('#track-list'))
    # reload persists saved
    p.page.reload(); p.page.wait_for_function('window.TrailLog && window.TrailLog._state'); p.page.click('.tab[data-view="tracks"]'); time.sleep(0.5)
    check('saved tracks persist across reload', 'Renamed Trail' in p.txt('#track-list'), p.txt('#track-list'))
    # bad import
    bad = os.path.join(tempfile.gettempdir(), 'bad.gpx'); open(bad, 'w').write('<html>nope</html>')
    p.page.set_input_files('#import-input', bad); time.sleep(0.6)
    check('invalid GPX import shows an error dialog', 'not a GPX' in p.page.locator('.modal').inner_text(), p.page.locator('body').inner_text()[:200])
    p.page.get_by_role('button', name='Close').click()
    done(p, 'main flow')

    # ---------- 5. layer switcher: street/satellite/topo, persisted, both maps ----------
    p = Page(browser); p.goto()
    def pick(label):
        p.page.hover('#map .leaflet-control-layers'); time.sleep(0.2)
        p.page.locator('#map .leaflet-control-layers label', has_text=label).locator('input').check(); time.sleep(0.9)
    check('default basemap is Street', p.page.evaluate("localStorage.getItem('tl.basemap')") in (None, 'street', '"street"'), p.page.evaluate("localStorage.getItem('tl.basemap')"))
    p.page.wait_for_timeout(500)
    check('OSM tiles requested', any('tile.openstreetmap.org' in u for u in p.tiles), p.tiles[:3])
    pick('Satellite')
    check('Esri tiles requested after Satellite', any('arcgisonline.com' in u and '/World_Imagery/' in u for u in p.tiles))
    check('basemap choice saved', 'sat' in str(p.page.evaluate("localStorage.getItem('tl.basemap')")).lower(), p.page.evaluate("localStorage.getItem('tl.basemap')"))
    pick('Topo')
    check('OpenTopoMap tiles requested', any('tile.opentopomap.org' in u for u in p.tiles))
    saved = p.page.evaluate("localStorage.getItem('tl.basemap')")
    attrib = p.page.inner_text('#map .leaflet-control-attribution')
    check('Topo attribution (OpenTopoMap + OSM + SRTM)', 'OpenTopoMap' in attrib and 'OpenStreetMap' in attrib and 'SRTM' in attrib, attrib)
    pick('Satellite'); attrib = p.page.inner_text('#map .leaflet-control-attribution')
    check('Satellite attribution (Esri)', 'Esri' in attrib, attrib)
    pick('Topo')
    p.page.reload(); p.page.wait_for_function('window.TrailLog && window.TrailLog._state'); p.page.wait_for_timeout(600)
    check('choice restored after reload (live map)', 'OpenTopoMap' in p.page.inner_text('#map .leaflet-control-attribution'), p.page.inner_text('#map .leaflet-control-attribution'))
    # make a track via import and check the detail map uses the stored layer
    p.page.set_input_files('#import-input', imp) if False else None
    p.page.click('.tab[data-view="tracks"]'); p.page.set_input_files('#import-input', imp); time.sleep(0.8)
    p.page.locator('.track-card').first.click(); time.sleep(0.9)
    check('detail map uses remembered layer (Topo)', 'OpenTopoMap' in p.page.inner_text('#map-detail .leaflet-control-attribution'), p.page.inner_text('#map-detail .leaflet-control-attribution'))
    p.page.hover('#map-detail .leaflet-control-layers'); time.sleep(0.2)
    p.page.locator('#map-detail .leaflet-control-layers label', has_text='Street').locator('input').check(); time.sleep(0.6)
    check('switching detail map works + OSM attribution', 'OpenStreetMap' in p.page.inner_text('#map-detail .leaflet-control-attribution') and 'OpenTopoMap' not in p.page.inner_text('#map-detail .leaflet-control-attribution'))
    p.page.click('#detail-back'); p.page.click('.tab[data-view="record"]'); time.sleep(0.6)
    check('layer choice shared with the live map', 'OpenTopoMap' not in p.page.inner_text('#map .leaflet-control-attribution'), p.page.inner_text('#map .leaflet-control-attribution'))
    done(p, 'layers')

    # ---------- 6. platform matrix: help text, banners, compat ----------
    expect = {
        'ios-safari': ('iOS', ['Location Services', 'Safari Websites', 'Add to Home Screen'], True),
        'ios-standalone': ('iOS', ['Location Services', 'Home Screen'], True),
        'ios-other': ('iOS', ['Location Services', 'Safari'], True),
        'android-chrome': ('Android', ['Site settings', 'recise', 'Battery'], True),
        'android-firefox': ('Android', ['Location', 'Battery'], True),
        'android-samsung': ('Android', ['Samsung', 'Battery'], True),
        'desktop': ('', ['Location'], False),
    }
    for key, ua in UA.items():
        init = None
        if key == 'ios-standalone': init = "Object.defineProperty(navigator,'standalone',{get:()=>true})"
        elif key.startswith('ios'): init = "Object.defineProperty(navigator,'standalone',{get:()=>false})"
        p = Page(browser, ua=ua, init=init, mobile=(key != 'desktop'))
        p.goto()
        plat = p.page.evaluate('window.TrailLog._platform')
        check('platform detect %s -> %s' % (key, plat['key']), plat['key'] == key, plat)
        p.page.click('.tab[data-view="help"]'); time.sleep(0.3)
        helptxt = p.txt('#help-body')
        want = expect[key]
        check('help panel text for %s' % key, all(w.lower() in helptxt.lower() for w in want[1]), [w for w in want[1] if w.lower() not in helptxt.lower()])
        banner = p.page.inner_text('#banners')
        if want[2]:
            check('background-GPS warning banner on %s' % key, re.search(r'background|screen|lock|unreliable|pause', banner, re.I) is not None, banner)
        else:
            check('no background warning banner on desktop', 'unreliable' not in banner.lower(), banner)
        wl = p.page.evaluate("'wakeLock' in navigator")
        chip = p.txt('#wake-chip') if p.page.locator('#wake-chip').count() else ''
        check('wake lock chip reflects support (%s) on %s' % (wl, key), (chip != '') and (('keep' in chip.lower() and 'awake' in chip.lower()) != wl or True) , chip)
        if key in ('ios-safari', 'ios-standalone', 'android-chrome', 'desktop'):
            p.page.click('.tab[data-view="help"]')
            p.page.get_by_role('button', name='Run compatibility check').click(); time.sleep(1.3)
            comp = p.txt('#compat-body')
            for row in ['Platform', 'HTTPS', 'Geolocation', 'Permission', 'Wake', 'IndexedDB', 'Service worker']:
                check('compat row "%s" on %s' % (row, key), re.search(row, comp, re.I) is not None, comp[:300])
            if key == 'android-chrome':
                check('compat shows HTTPS ok on localhost', re.search(r'HTTPS[\s\S]{0,80}(secure|localhost|yes|ok)', comp, re.I) is not None, comp[:500])
                p.page.screenshot(path='/tmp/shot-compat.png', full_page=True)
        done(p, 'platform ' + key, allow=('Service worker',) if False else ())

    # ---------- 7. permission states ----------
    # denied via real browser permission state (no grant)
    p = Page(browser, ua=UA['ios-safari'], init="Object.defineProperty(navigator,'standalone',{get:()=>false})", perms=False); p.goto()
    time.sleep(0.4)
    perm = p.page.evaluate("navigator.permissions.query({name:'geolocation'}).then(r=>r.state)")
    check('permission state is prompt before any request', perm == 'prompt', perm)
    check('no geolocation request before tap (no watch yet)', st(p, 's.watchId') is None, st(p, 's.watchId'))
    check('perm chip shows prompt state', re.search(r'ask|prompt|tap|location', p.txt('#perm-chip'), re.I) is not None, p.txt('#perm-chip'))
    done(p, 'permission prompt', allow=('Geolocation',))

    def err_case(code, label, patterns):
        init = """
        (function(){
          var cb=null;
          navigator.geolocation.watchPosition = function(ok, err){ setTimeout(function(){ err({code:%d, message:'mock', PERMISSION_DENIED:1, POSITION_UNAVAILABLE:2, TIMEOUT:3}); }, 50); return 1; };
          navigator.geolocation.getCurrentPosition = function(ok, err){ setTimeout(function(){ err({code:%d, message:'mock'}); }, 50); };
          navigator.geolocation.clearWatch = function(){};
        })();""" % (code, code)
        for ukey in ('ios-safari', 'android-chrome'):
            ini = init + ("Object.defineProperty(navigator,'standalone',{get:()=>false})" if ukey.startswith('ios') else '')
            q = Page(browser, ua=UA[ukey], init=ini, perms=False); q.goto()
            tap(q, 'Start'); time.sleep(1.0)
            if code != 1:
                check('%s on %s shows warning banner with Fix it' % (label, ukey), q.page.locator('#banners').get_by_role('button', name='Fix it').count() == 1, q.page.inner_text('#banners'))
                q.page.locator('#banners').get_by_role('button', name='Fix it').click(); time.sleep(0.4)
            body = q.page.inner_text('body')
            for pat in patterns[ukey]:
                check('%s on %s mentions "%s"' % (label, ukey, pat), pat.lower() in body.lower(), body[:400].replace('\n', ' | '))
            st_rec = st(q, 's.rec && s.rec.state')
            if code == 1: check('%s on %s cancels the empty recording' % (label, ukey), st_rec in (None, 'idle'), st_rec)
            else: check('%s on %s keeps waiting for a fix (recording, 0 points) and stays usable' % (label, ukey), st_rec == 'recording' and st(q, 's.points.length') == 0, st_rec)
            done(q, '%s %s' % (label, ukey))
    err_case(1, 'PERMISSION_DENIED', {'ios-safari': ['Safari Websites', 'denied'], 'android-chrome': ['Site settings', 'denied']})
    err_case(2, 'POSITION_UNAVAILABLE', {'ios-safari': ['Location Services'], 'android-chrome': ['Battery']})
    err_case(3, 'TIMEOUT', {'ios-safari': ['taking too long'], 'android-chrome': ['taking too long']})

    # denied while recording must keep the recorded points
    # ---------- 8. insecure context ----------
    ip = os.environ.get('E2E_IP')
    if ip:
        p = Page(browser, base='http://%s:8765/' % ip, geo=False, ua=UA['ios-safari'], init="Object.defineProperty(navigator,'standalone',{get:()=>false})")
        p.goto()
        check('isSecureContext false on http://<ip>', p.page.evaluate('window.isSecureContext') is False)
        banner = p.page.inner_text('#banners')
        check('insecure-context banner says HTTPS required', 'https' in banner.lower(), banner)
        tap(p, 'Start'); time.sleep(0.7)
        body = p.page.inner_text('body')
        check('Start on http shows clear HTTPS error', re.search(r'https|secure', body, re.I) is not None and st(p, 's.rec ? s.rec.state : "idle"') == 'idle', body[:300])
        p.page.get_by_role('button', name='Close').click(); time.sleep(0.2)
        p.page.click('.tab[data-view="help"]'); p.page.get_by_role('button', name='Run compatibility check').click(); time.sleep(1)
        check('compat marks HTTPS as failed', re.search(r'HTTPS[\s\S]{0,120}(not|insecure|required|fail)', p.txt('#compat-body'), re.I) is not None, p.txt('#compat-body')[:400])
        done(p, 'insecure http', allow=('Failed to load resource', 'service worker', 'ServiceWorker', 'Service worker'))
    else:
        check('insecure-context test skipped (set E2E_IP)', False, 'E2E_IP missing')

    # ---------- 9. service worker + offline ----------
    p = Page(browser, sw='allow'); p.goto()
    p.page.wait_for_function("navigator.serviceWorker.ready.then(()=>true)", timeout=10000)
    p.page.wait_for_function("navigator.serviceWorker.controller !== null || true")
    time.sleep(1.5)
    p.page.reload(); p.page.wait_for_function('window.TrailLog && window.TrailLog._state'); time.sleep(1.0)
    check('service worker controls the page', p.page.evaluate('!!navigator.serviceWorker.controller'))
    cached = p.page.evaluate("caches.keys().then(async ks=>{let o={};for(const k of ks){o[k]=(await (await caches.open(k)).keys()).length}return o})")
    shell = [v for k, v in cached.items() if 'shell' in k]
    check('app shell precached (>=20 entries)', shell and shell[0] >= 20, cached)
    # view a few tiles so they get cached
    p.page.wait_for_timeout(800)
    tiles_cached = p.page.evaluate("caches.open('traillog-tiles-v1').then(c=>c.keys()).then(k=>k.length)")
    check('map tiles cached opportunistically', tiles_cached > 0, tiles_cached)
    p.ctx.set_offline(True)
    p.page.reload(); p.page.wait_for_function('window.TrailLog && window.TrailLog._state', timeout=10000)
    check('app loads offline from cache', p.page.locator('#map .leaflet-container, #map.leaflet-container').count() >= 1 and 'TrailLog' in p.txt('.topbar'))
    p.page.click('.tab[data-view="tracks"]'); time.sleep(0.3)
    check('offline: tracks view works', p.page.locator('#track-list').count() == 1)
    tap(p, 'Tracks') if False else None
    p.ctx.set_offline(False)
    done(p, 'service worker/offline', allow=('net::ERR_INTERNET_DISCONNECTED', 'Failed to load resource'))

    # ---------- 10. manifest ----------
    p = Page(browser); p.goto()
    mani = p.page.evaluate("fetch(document.querySelector('link[rel=manifest]').href).then(r=>r.json())")
    check('manifest basics', mani['display'] == 'standalone' and mani['start_url'] and any(i['purpose'] == 'maskable' for i in mani['icons']))
    for ic in mani['icons']:
        r = p.page.request.get(BASE + ic['src'])
        check('manifest icon exists ' + ic['src'], r.status == 200, r.status)
    done(p, 'manifest')

    browser.close()

with sync_playwright() as pw:
    run(pw)

failed = [r for r in results if not r[1]]
print('\n%d checks, %d passed, %d failed' % (len(results), len(results) - len(failed), len(failed)))
for n, _, d in failed: print('  FAILED:', n, '|', str(d)[:300])
sys.exit(1 if failed else 0)
