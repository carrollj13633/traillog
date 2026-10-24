const test = require('node:test');
const assert = require('node:assert/strict');
const G = require('../js/geo.js');

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, (msg || '') + ` expected ${a} ≈ ${b} (±${tol})`);

test('haversine: known distances', () => {
  assert.equal(G.haversine(10, 20, 10, 20), 0);
  near(G.haversine(0, 0, 0, 1), 111195, 5, '1° of longitude at the equator');
  near(G.haversine(0, 0, 1, 0), 111195, 5, '1° of latitude');
  // New York City -> London ≈ 5,570 km
  near(G.haversine(40.7128, -74.006, 51.5074, -0.1278) / 1000, 5570, 15, 'NYC-London km');
  // symmetry
  near(G.haversine(48.85, 2.35, 35.68, 139.69), G.haversine(35.68, 139.69, 48.85, 2.35), 1e-6);
  // antimeridian
  near(G.haversine(0, 179.5, 0, -179.5), 111195, 5, 'across the antimeridian');
});

test('acceptFix: accuracy, jitter, spike, invalid', () => {
  const a = { lat: 40, lon: -74, t: 0, s: 0 };
  assert.equal(G.acceptFix(null, { lat: 40, lon: -74, acc: 50, t: 0 }).reason, 'accuracy');
  assert.equal(G.acceptFix(null, { lat: 40, lon: -74, acc: 10, t: 0 }).ok, true);
  assert.equal(G.acceptFix(null, { lat: 99, lon: 0, acc: 5, t: 0 }).reason, 'invalid');
  assert.equal(G.acceptFix(null, { lat: NaN, lon: 0, acc: 5, t: 0 }).reason, 'invalid');
  // 1 m move -> jitter
  assert.equal(G.acceptFix(a, { lat: 40 + 1 / 111195, lon: -74, acc: 5, t: 1000 }).reason, 'jitter');
  // 10 m move with good accuracy -> accepted
  assert.equal(G.acceptFix(a, { lat: 40 + 10 / 111195, lon: -74, acc: 5, t: 5000 }).ok, true);
  // poor accuracy (28 m) raises the jitter threshold to 10 m: 8 m is dropped
  assert.equal(G.acceptFix(a, { lat: 40 + 8 / 111195, lon: -74, acc: 28, t: 5000 }).reason, 'jitter');
  // 1 km in 1 s -> spike
  assert.equal(G.acceptFix(a, { lat: 40 + 1000 / 111195, lon: -74, acc: 5, t: 1000 }).reason, 'spike');
  // custom accuracy limit
  assert.equal(G.acceptFix(null, { lat: 1, lon: 1, acc: 40, t: 0 }, { maxAccuracy: 50 }).ok, true);
});

test('createStats: distance across segments, elevation hysteresis', () => {
  const st = G.createStats();
  const deg = 1 / 111195; // ~1 m of latitude
  [0, 100, 200].forEach((m, i) => st.add({ lat: m * deg, lon: 0, ele: 100 + i * 10, s: 0, t: i * 1000 }));
  // new segment far away: the jump must not count
  st.add({ lat: 5, lon: 5, ele: 130, s: 1, t: 5000 });
  st.add({ lat: 5 + 50 * deg, lon: 5, ele: 120, s: 1, t: 6000 });
  const r = st.get();
  near(r.distance, 250, 1, 'distance excludes the gap between segments');
  near(r.gain, 30, 1e-9, 'gain 100→130');
  near(r.loss, 10, 1e-9, 'loss 130→120');
  assert.equal(r.minEle, 100); assert.equal(r.maxEle, 130); assert.equal(r.count, 5);
  // noise below the threshold is ignored
  const noisy = G.computeStats([100, 101, 99.5, 101.5, 100.2, 101].map((e, i) => ({ lat: i * deg * 5, lon: 0, ele: e, s: 0, t: i })));
  assert.equal(noisy.gain, 0); assert.equal(noisy.loss, 0);
  assert.equal(G.computeStats([{ lat: 0, lon: 0, ele: null, s: 0, t: 0 }]).hasEle, false);
});

test('recentSpeed and elevationProfile', () => {
  const deg = 1 / 111195;
  const pts = [];
  for (let i = 0; i <= 30; i++) pts.push({ lat: i * 2 * deg, lon: 0, ele: 10 + i, s: 0, t: i * 1000 }); // 2 m/s
  near(G.recentSpeed(pts, 10000), 2, 0.01, 'recent speed');
  assert.equal(G.recentSpeed(pts.slice(0, 1)), null);
  const prof = G.elevationProfile(pts);
  assert.equal(prof.length, 31);
  near(prof[30].d, 60, 0.1, 'profile distance');
  assert.equal(G.downsample(prof, 10).length, 10);
});

test('formatters (American English units)', () => {
  assert.equal(G.formatDuration(0), '0:00');
  assert.equal(G.formatDuration(65000), '1:05');
  assert.equal(G.formatDuration(3725000), '1:02:05');
  assert.equal(G.formatDistance(1609.344, 'mi'), '1.00 mi');
  assert.equal(G.formatDistance(1500, 'km'), '1.50 km');
  assert.equal(G.formatSpeed(1.34112, 'mi'), '3.0 mph');
  assert.equal(G.formatSpeed(10, 'km'), '36.0 km/h');
  assert.equal(G.formatSpeed(null, 'mi'), '–');
  assert.equal(G.formatElevation(100, 'mi'), '328 ft');
  assert.equal(G.formatElevation(100, 'km'), '100 m');
  assert.match(G.defaultName(new Date(2026, 9, 24, 18, 0)), /^Saturday Evening Trail$/);
});

const sample = [
  { name: 'Morning & <Loop> "A"', points: [
    { lat: 40.0, lon: -105.0, ele: 1600.25, t: Date.UTC(2026, 9, 24, 12, 0, 0), s: 0 },
    { lat: 40.001, lon: -105.001, ele: 1605.5, t: Date.UTC(2026, 9, 24, 12, 0, 30), s: 0 },
    { lat: 40.002, lon: -105.002, ele: null, t: Date.UTC(2026, 9, 24, 12, 5, 0), s: 1 },
    { lat: 40.003, lon: -105.003, ele: 1610, t: Date.UTC(2026, 9, 24, 12, 5, 30), s: 1 }] },
  { name: 'Second', points: [{ lat: -33.8, lon: 151.2, ele: 5, t: Date.UTC(2026, 9, 25, 1, 0, 0), s: 0 }, { lat: -33.801, lon: 151.2, ele: 6, t: Date.UTC(2026, 9, 25, 1, 1, 0), s: 0 }] }
];

test('buildGpx: valid GPX 1.1 structure', () => {
  const x = G.buildGpx(sample);
  assert.match(x, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
  assert.match(x, /<gpx version="1.1" creator="TrailLog" xmlns="http:\/\/www.topografix.com\/GPX\/1\/1"/);
  assert.equal((x.match(/<trk>/g) || []).length, 2);
  assert.equal((x.match(/<trkseg>/g) || []).length, 3, 'segments preserved');
  assert.equal((x.match(/<trkpt /g) || []).length, 6);
  assert.match(x, /<name>Morning &amp; &lt;Loop&gt; &quot;A&quot;<\/name>/);
  assert.match(x, /<trkpt lat="40.0000000" lon="-105.0000000"><ele>1600.3<\/ele><time>2026-10-24T12:00:00.000Z<\/time><\/trkpt>/);
  assert.match(x, /<trkpt lat="40.0020000" lon="-105.0020000"><time>/, 'ele omitted when unknown');
  assert.match(x, /<metadata>\s*<name>TrailLog export<\/name>\s*<time>2026-10-24T12:00:00.000Z<\/time>/);
});

test('GPX round trip', () => {
  const back = G.parseGpx(G.buildGpx(sample));
  assert.equal(back.tracks.length, 2);
  assert.equal(back.tracks[0].name, 'Morning & <Loop> "A"');
  const p = back.tracks[0].points;
  assert.equal(p.length, 4);
  near(p[0].lat, 40, 1e-7); near(p[1].lon, -105.001, 1e-7); near(p[0].ele, 1600.3, 0.051);
  assert.equal(p[2].ele, null);
  assert.equal(p[0].t, sample[0].points[0].t);
  assert.deepEqual(p.map((q) => q.s), [0, 0, 1, 1]);
  near(G.computeStats(p).distance, G.computeStats(sample[0].points).distance, 0.5, 'distance preserved');
});

test('parseGpx: external GPX variants and errors', () => {
  const ext = `<?xml version="1.0"?>\n<!-- c --><gpx version="1.1" creator="x" xmlns="http://www.topografix.com/GPX/1/1">
    <wpt lat="1" lon="1"><name>wp</name></wpt>
    <trk><name><![CDATA[Ridge & Lake]]></name><trkseg>
      <trkpt lat='45.5' lon='-122.5'><ele>10</ele><time>2020-01-01T00:00:00Z</time><extensions><x>1</x></extensions></trkpt>
      <trkpt lon="-122.6" lat="45.6"/>
      <trkpt lat="bad" lon="1"/>
    </trkseg></trk></gpx>`;
  const r = G.parseGpx(ext);
  assert.equal(r.tracks.length, 1);
  assert.equal(r.tracks[0].name, 'Ridge & Lake');
  assert.equal(r.tracks[0].points.length, 2);
  assert.equal(r.tracks[0].points[1].lat, 45.6);
  assert.equal(r.tracks[0].points[0].t, Date.parse('2020-01-01T00:00:00Z'));
  const rte = G.parseGpx('<gpx><rte><name>R</name><rtept lat="1" lon="2"/><rtept lat="1.1" lon="2"/></rte></gpx>');
  assert.equal(rte.tracks[0].points.length, 2);
  assert.throws(() => G.parseGpx('<html></html>'), /not a GPX/);
  assert.throws(() => G.parseGpx('<gpx></gpx>'), /No track points/);
  assert.throws(() => G.parseGpx(null));
});

test('buildKml: KML 2.2 LineString', () => {
  const k = G.buildKml([sample[0]]);
  assert.match(k, /<kml xmlns="http:\/\/www.opengis.net\/kml\/2.2">/);
  assert.match(k, /<name>Morning &amp; &lt;Loop&gt; &quot;A&quot;<\/name>/);
  assert.equal((k.match(/<LineString>/g) || []).length, 2, 'one LineString per segment');
  assert.match(k, /<MultiGeometry>/);
  assert.match(k, /<coordinates>-105.0000000,40.0000000,1600.3 -105.0010000,40.0010000,1605.5<\/coordinates>/, 'lon,lat,ele order');
  assert.equal((k.match(/<Placemark>/g) || []).length, 3, 'track + start + end');
  const single = G.buildKml([sample[1]]);
  assert.doesNotMatch(single, /MultiGeometry/);
});
