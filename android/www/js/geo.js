/* TrailLog – pure geo / stats / GPX logic. Works in the browser (window.Geo) and in Node (module.exports). */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Geo = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var EARTH_R = 6371008.8; // mean Earth radius in meters
  var M_PER_MI = 1609.344;
  var FT_PER_M = 3.280839895;

  var DEFAULTS = {
    maxAccuracy: 30,   // meters: drop fixes with a worse (larger) accuracy radius
    minDistance: 3,    // meters: jitter floor
    maxJitter: 10,     // meters: cap for the accuracy-scaled jitter threshold
    maxSpeed: 60,      // m/s (~134 mph): faster than this between fixes is a GPS spike
    eleThreshold: 3    // meters: hysteresis for elevation gain/loss
  };

  function toRad(d) { return d * Math.PI / 180; }

  /** Great-circle distance in meters between two lat/lon pairs (degrees). */
  function haversine(lat1, lon1, lat2, lon2) {
    var dLat = toRad(lat2 - lat1);
    var dLon = toRad(lon2 - lon1);
    var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
    return 2 * EARTH_R * Math.asin(Math.min(1, Math.sqrt(a)));
  }

  function isNum(n) { return typeof n === 'number' && isFinite(n); }

  /**
   * Decide whether to keep a new GPS fix.
   * prev: last ACCEPTED point in the same segment (or null). fix: {lat, lon, acc, t}.
   * Returns {ok: boolean, reason?: string, dist?: number}
   */
  function acceptFix(prev, fix, options) {
    var o = Object.assign({}, DEFAULTS, options || {});
    if (!fix || !isNum(fix.lat) || !isNum(fix.lon) || Math.abs(fix.lat) > 90 || Math.abs(fix.lon) > 180) {
      return { ok: false, reason: 'invalid' };
    }
    if (isNum(fix.acc) && fix.acc > o.maxAccuracy) return { ok: false, reason: 'accuracy' };
    if (!prev) return { ok: true, dist: 0 };
    var d = haversine(prev.lat, prev.lon, fix.lat, fix.lon);
    var dt = (fix.t - prev.t) / 1000;
    if (isNum(dt) && dt > 0 && d > 20 && d / dt > o.maxSpeed) return { ok: false, reason: 'spike', dist: d };
    var thr = o.minDistance;
    if (isNum(fix.acc)) thr = Math.min(o.maxJitter, Math.max(o.minDistance, fix.acc / 2));
    if (d < thr) return { ok: false, reason: 'jitter', dist: d };
    return { ok: true, dist: d };
  }

  /** Incremental stats accumulator (distance, elevation gain/loss, min/max elevation). */
  function createStats(options) {
    var o = Object.assign({}, DEFAULTS, options || {});
    var dist = 0, gain = 0, loss = 0, count = 0;
    var last = null, ref = null, minE = null, maxE = null, hasEle = false;
    return {
      add: function (p) {
        if (last && last.s === p.s) dist += haversine(last.lat, last.lon, p.lat, p.lon);
        if (isNum(p.ele)) {
          hasEle = true;
          if (minE === null || p.ele < minE) minE = p.ele;
          if (maxE === null || p.ele > maxE) maxE = p.ele;
          if (ref === null) ref = p.ele;
          else if (p.ele - ref >= o.eleThreshold) { gain += p.ele - ref; ref = p.ele; }
          else if (ref - p.ele >= o.eleThreshold) { loss += ref - p.ele; ref = p.ele; }
        }
        last = p;
        count++;
      },
      get: function () {
        return { distance: dist, gain: gain, loss: loss, minEle: minE, maxEle: maxE, hasEle: hasEle, count: count };
      }
    };
  }

  function computeStats(points, options) {
    var st = createStats(options);
    for (var i = 0; i < points.length; i++) st.add(points[i]);
    return st.get();
  }

  /** Average speed (m/s) over the last windowMs of the same segment; null if not enough data. */
  function recentSpeed(points, windowMs) {
    windowMs = windowMs || 15000;
    var n = points.length;
    if (n < 2) return null;
    var end = points[n - 1];
    var d = 0, i = n - 1, startT = end.t;
    while (i > 0) {
      var a = points[i - 1], b = points[i];
      if (a.s !== b.s) break;
      d += haversine(a.lat, a.lon, b.lat, b.lon);
      startT = a.t;
      i--;
      if (end.t - startT >= windowMs) break;
    }
    var dt = (end.t - startT) / 1000;
    return dt > 0 ? d / dt : null;
  }

  /** Elevation profile: [{d: cumulative meters, ele}] for points that have altitude. */
  function elevationProfile(points) {
    var out = [], d = 0;
    for (var i = 0; i < points.length; i++) {
      var p = points[i];
      if (i > 0 && points[i - 1].s === p.s) d += haversine(points[i - 1].lat, points[i - 1].lon, p.lat, p.lon);
      if (isNum(p.ele)) out.push({ d: d, ele: p.ele, i: i });
    }
    return out;
  }

  function downsample(arr, max) {
    if (arr.length <= max) return arr.slice();
    var out = [], step = (arr.length - 1) / (max - 1);
    for (var i = 0; i < max; i++) out.push(arr[Math.round(i * step)]);
    return out;
  }

  /** Summary stored with a track. */
  function summarize(points, durationMs) {
    var s = computeStats(points);
    var t0 = null, t1 = null;
    for (var i = 0; i < points.length; i++) {
      if (isNum(points[i].t)) { if (t0 === null) t0 = points[i].t; t1 = points[i].t; }
    }
    return {
      distance: s.distance, gain: s.gain, loss: s.loss, minEle: s.minEle, maxEle: s.maxEle,
      hasEle: s.hasEle, count: s.count,
      duration: isNum(durationMs) ? durationMs : (t0 !== null ? t1 - t0 : 0),
      startedAt: t0, endedAt: t1
    };
  }

  /* ---------- formatting ---------- */
  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function formatDuration(ms) {
    var s = Math.max(0, Math.floor((ms || 0) / 1000));
    var h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    return h > 0 ? h + ':' + pad2(m) + ':' + pad2(sec) : m + ':' + pad2(sec);
  }
  function distanceValue(m, units) {
    return units === 'km' ? m / 1000 : m / M_PER_MI;
  }
  function distanceUnit(units) { return units === 'km' ? 'km' : 'mi'; }
  function formatDistance(m, units) {
    return distanceValue(m || 0, units).toFixed(2) + ' ' + distanceUnit(units);
  }
  function speedValue(mps, units) { return units === 'km' ? mps * 3.6 : mps * 3600 / M_PER_MI; }
  function speedUnit(units) { return units === 'km' ? 'km/h' : 'mph'; }
  function formatSpeed(mps, units) {
    if (!isNum(mps)) return '–';
    return speedValue(mps, units).toFixed(1) + ' ' + speedUnit(units);
  }
  function elevationValue(m, units) { return units === 'km' ? m : m * FT_PER_M; }
  function elevationUnit(units) { return units === 'km' ? 'm' : 'ft'; }
  function formatElevation(m, units) {
    if (!isNum(m)) return '–';
    return Math.round(elevationValue(m, units)).toLocaleString('en-US') + ' ' + elevationUnit(units);
  }

  function defaultName(date) {
    var h = date.getHours();
    var part = h < 5 ? 'Night' : h < 12 ? 'Morning' : h < 17 ? 'Afternoon' : h < 21 ? 'Evening' : 'Night';
    var day = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][date.getDay()];
    return day + ' ' + part + ' Trail';
  }

  /* ---------- GPX ---------- */
  function xmlEscape(s) {
    return String(s == null ? '' : s)
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;');
  }
  function xmlUnescape(s) {
    return String(s)
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, function (_, c) { return c.replace(/&/g, '&#38;'); })
      .replace(/&#x([0-9a-fA-F]+);/g, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCodePoint(parseInt(d, 10)); })
      .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&amp;/g, '&');
  }

  function trackToXml(track) {
    var out = ['  <trk>', '    <name>' + xmlEscape(track.name || 'Track') + '</name>'];
    var pts = track.points || [];
    var curSeg = null, open = false;
    for (var i = 0; i < pts.length; i++) {
      var p = pts[i];
      var s = p.s || 0;
      if (!open || s !== curSeg) {
        if (open) out.push('    </trkseg>');
        out.push('    <trkseg>');
        open = true; curSeg = s;
      }
      var line = '      <trkpt lat="' + p.lat.toFixed(7) + '" lon="' + p.lon.toFixed(7) + '">';
      if (isNum(p.ele)) line += '<ele>' + p.ele.toFixed(1) + '</ele>';
      if (isNum(p.t)) line += '<time>' + new Date(p.t).toISOString() + '</time>';
      line += '</trkpt>';
      out.push(line);
    }
    if (open) out.push('    </trkseg>');
    out.push('  </trk>');
    return out.join('\n');
  }

  /** Build a GPX 1.1 document for one or more tracks ({name, points:[{lat,lon,ele,t,s}]}). */
  function buildGpx(tracks, options) {
    options = options || {};
    var creator = options.creator || 'TrailLog';
    var first = null;
    tracks.forEach(function (t) { (t.points || []).forEach(function (p) { if (first === null && isNum(p.t)) first = p.t; }); });
    var metaName = options.name || (tracks.length === 1 ? tracks[0].name : 'TrailLog export');
    var xml = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<gpx version="1.1" creator="' + xmlEscape(creator) + '" xmlns="http://www.topografix.com/GPX/1/1" ' +
      'xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ' +
      'xsi:schemaLocation="http://www.topografix.com/GPX/1/1 http://www.topografix.com/GPX/1/1/gpx.xsd">',
      '  <metadata>',
      '    <name>' + xmlEscape(metaName) + '</name>'];
    if (first !== null) xml.push('    <time>' + new Date(first).toISOString() + '</time>');
    xml.push('  </metadata>');
    tracks.forEach(function (t) { xml.push(trackToXml(t)); });
    xml.push('</gpx>');
    return xml.join('\n') + '\n';
  }

  function attr(s, name) {
    var m = new RegExp('\\b' + name + '\\s*=\\s*("([^"]*)"|\'([^\']*)\')').exec(s);
    return m ? (m[2] !== undefined ? m[2] : m[3]) : null;
  }
  function inner(s, tag) {
    var m = new RegExp('<' + tag + '\\b[^>]*>([\\s\\S]*?)</' + tag + '>').exec(s);
    return m ? xmlUnescape(m[1]).trim() : null;
  }

  function parsePoints(block, ptTag, segIndex, points) {
    var re = new RegExp('<' + ptTag + '\\b([^>]*?)(?:/>|>([\\s\\S]*?)</' + ptTag + '>)', 'g');
    var m;
    while ((m = re.exec(block))) {
      var lat = parseFloat(attr(m[1], 'lat')), lon = parseFloat(attr(m[1], 'lon'));
      if (!isNum(lat) || !isNum(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) continue;
      var body = m[2] || '';
      var ele = parseFloat(inner(body, 'ele'));
      var ts = inner(body, 'time');
      var t = ts ? Date.parse(ts) : NaN;
      points.push({ lat: lat, lon: lon, ele: isNum(ele) ? ele : null, t: isNum(t) ? t : null, acc: null, s: segIndex });
    }
  }

  /** Parse GPX text (tracks, falling back to routes). Throws Error on invalid input. */
  function parseGpx(text) {
    if (typeof text !== 'string') throw new Error('Not a GPX file.');
    text = text.replace(/^\uFEFF/, '').replace(/<!--[\s\S]*?-->/g, '');
    if (!/<gpx\b/i.test(text)) throw new Error('This file is not a GPX file.');
    var tracks = [], m;
    var trkRe = /<trk\b[^>]*>([\s\S]*?)<\/trk>/g;
    while ((m = trkRe.exec(text))) {
      var block = m[1];
      var pre = block.split(/<trkseg\b/)[0];
      var points = [];
      var segRe = /<trkseg\b[^>]*>([\s\S]*?)<\/trkseg>/g, sm, si = 0;
      while ((sm = segRe.exec(block))) { parsePoints(sm[1], 'trkpt', si, points); si++; }
      if (points.length) tracks.push({ name: inner(pre, 'name') || '', points: points });
    }
    if (!tracks.length) {
      var rteRe = /<rte\b[^>]*>([\s\S]*?)<\/rte>/g;
      while ((m = rteRe.exec(text))) {
        var pts = [];
        parsePoints(m[1], 'rtept', 0, pts);
        if (pts.length) tracks.push({ name: inner(m[1].split(/<rtept\b/)[0], 'name') || '', points: pts });
      }
    }
    if (!tracks.length) throw new Error('No track points found in this GPX file.');
    return { tracks: tracks };
  }

  /* ---------- KML 2.2 ---------- */
  function kmlCoord(p) {
    var c = p.lon.toFixed(7) + ',' + p.lat.toFixed(7);
    return isNum(p.ele) ? c + ',' + p.ele.toFixed(1) : c;
  }
  /** Build a KML 2.2 document (one Placemark per track, LineString per segment, plus Start/End points). */
  function buildKml(tracks, options) {
    options = options || {};
    var docName = options.name || (tracks.length === 1 ? tracks[0].name : 'TrailLog export');
    var out = ['<?xml version="1.0" encoding="UTF-8"?>',
      '<kml xmlns="http://www.opengis.net/kml/2.2">',
      '<Document>',
      '  <name>' + xmlEscape(docName) + '</name>',
      '  <Style id="trail"><LineStyle><color>ff2c6bff</color><width>4</width></LineStyle></Style>',
      '  <Style id="startPt"><IconStyle><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/grn-circle.png</href></Icon></IconStyle></Style>',
      '  <Style id="endPt"><IconStyle><scale>1.1</scale><Icon><href>http://maps.google.com/mapfiles/kml/paddle/red-circle.png</href></Icon></IconStyle></Style>'];
    tracks.forEach(function (t) {
      var pts = t.points || [];
      if (!pts.length) return;
      var segs = [], cur = null, curS = null;
      pts.forEach(function (p) {
        var s = p.s || 0;
        if (cur === null || s !== curS) { cur = []; segs.push(cur); curS = s; }
        cur.push(p);
      });
      segs = segs.filter(function (sg) { return sg.length >= 2; });
      var name = xmlEscape(t.name || 'Track');
      var lines = segs.map(function (sg) {
        return '      <LineString><tessellate>1</tessellate><coordinates>' + sg.map(kmlCoord).join(' ') + '</coordinates></LineString>';
      });
      if (lines.length) {
        out.push('  <Placemark>', '    <name>' + name + '</name>', '    <styleUrl>#trail</styleUrl>');
        if (lines.length === 1) out.push(lines[0].replace(/^ {2}/, ''));
        else out.push('    <MultiGeometry>', lines.join('\n'), '    </MultiGeometry>');
        out.push('  </Placemark>');
      }
      var a = pts[0], b = pts[pts.length - 1];
      out.push('  <Placemark><name>' + name + ' – Start</name><styleUrl>#startPt</styleUrl><Point><coordinates>' + kmlCoord(a) + '</coordinates></Point></Placemark>');
      out.push('  <Placemark><name>' + name + ' – End</name><styleUrl>#endPt</styleUrl><Point><coordinates>' + kmlCoord(b) + '</coordinates></Point></Placemark>');
    });
    out.push('</Document>', '</kml>');
    return out.join('\n') + '\n';
  }

  return {
    DEFAULTS: DEFAULTS, M_PER_MI: M_PER_MI, FT_PER_M: FT_PER_M,
    haversine: haversine, acceptFix: acceptFix, createStats: createStats, computeStats: computeStats,
    recentSpeed: recentSpeed, elevationProfile: elevationProfile, downsample: downsample, summarize: summarize,
    formatDuration: formatDuration, formatDistance: formatDistance, distanceValue: distanceValue, distanceUnit: distanceUnit,
    formatSpeed: formatSpeed, speedValue: speedValue, speedUnit: speedUnit,
    formatElevation: formatElevation, elevationValue: elevationValue, elevationUnit: elevationUnit,
    defaultName: defaultName, buildGpx: buildGpx, buildKml: buildKml, parseGpx: parseGpx, xmlEscape: xmlEscape
  };
});
