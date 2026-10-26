/* TrailLog – IndexedDB storage with an in-memory fallback (e.g., blocked storage in private modes). */
(function (root) {
  'use strict';
  var DB_NAME = 'traillog', VERSION = 1;
  var dbPromise = null;
  var memory = false;
  var mem = { tracks: new Map(), active: new Map(), pts: [] };
  var lastError = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!root.indexedDB) { reject(new Error('IndexedDB is not available')); return; }
      var req;
      try { req = root.indexedDB.open(DB_NAME, VERSION); } catch (e) { reject(e); return; }
      req.onupgradeneeded = function () {
        var db = req.result;
        db.createObjectStore('tracks', { keyPath: 'id' });
        db.createObjectStore('active');
        db.createObjectStore('activePts', { autoIncrement: true });
      };
      req.onsuccess = function () {
        req.result.onversionchange = function () { req.result.close(); };
        resolve(req.result);
      };
      req.onerror = function () { reject(req.error || new Error('IndexedDB open failed')); };
      req.onblocked = function () { reject(new Error('IndexedDB open blocked')); };
    }).catch(function (e) { memory = true; lastError = e; return null; });
    return dbPromise;
  }

  function req2p(r) {
    return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; });
  }
  function run(store, mode, fn) {
    return open().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve, reject) {
        var tx = db.transaction(store, mode), out;
        try { out = fn(tx.objectStore(store)); } catch (e) { reject(e); return; }
        tx.oncomplete = function () { Promise.resolve(out).then(resolve, reject); };
        tx.onerror = function () { reject(tx.error); };
        tx.onabort = function () { reject(tx.error || new Error('Transaction aborted')); };
      });
    });
  }
  // Helper that resolves request results after the transaction completes.
  function runReq(store, mode, fn) {
    var holder = {};
    return run(store, mode, function (s) { holder.r = fn(s); return null; })
      .then(function (x) { return holder.r ? holder.r.result : undefined; });
  }

  var API = {
    /** Open the database; resolves {persistent: boolean, error?: string}. */
    init: function () {
      return open().then(function (db) { return { persistent: !!db, error: lastError ? String(lastError.message || lastError) : null }; });
    },
    putTrack: function (t) {
      return runReq('tracks', 'readwrite', function (s) { return s.put(t); }).then(function () { if (memory) mem.tracks.set(t.id, t); });
    },
    getAllTracks: function () {
      return open().then(function (db) {
        if (!db) return Array.from(mem.tracks.values());
        return runReq('tracks', 'readonly', function (s) { return s.getAll(); });
      });
    },
    deleteTrack: function (id) {
      return runReq('tracks', 'readwrite', function (s) { return s.delete(id); }).then(function () { mem.tracks.delete(id); });
    },
    setActiveMeta: function (m) {
      return runReq('active', 'readwrite', function (s) { return s.put(m, 'meta'); }).then(function () { if (memory) mem.active.set('meta', m); });
    },
    getActiveMeta: function () {
      return open().then(function (db) {
        if (!db) return mem.active.get('meta') || null;
        return runReq('active', 'readonly', function (s) { return s.get('meta'); }).then(function (v) { return v || null; });
      });
    },
    addActivePoint: function (p) {
      return open().then(function (db) {
        if (!db) { mem.pts.push(p); return; }
        return runReq('activePts', 'readwrite', function (s) { return s.add(p); });
      });
    },
    getActivePoints: function () {
      return open().then(function (db) {
        if (!db) return mem.pts.slice();
        return runReq('activePts', 'readonly', function (s) { return s.getAll(); });
      });
    },
    clearActive: function () {
      mem.active.clear(); mem.pts = [];
      return open().then(function (db) {
        if (!db) return;
        return new Promise(function (resolve, reject) {
          var tx = db.transaction(['active', 'activePts'], 'readwrite');
          tx.objectStore('active').clear();
          tx.objectStore('activePts').clear();
          tx.oncomplete = function () { resolve(); };
          tx.onerror = function () { reject(tx.error); };
          tx.onabort = function () { reject(tx.error); };
        });
      });
    },
    /** Write/read/delete a probe value to prove IndexedDB really works. */
    selfTest: function () {
      var key = '__selftest__', val = String(Date.now());
      return open().then(function (db) {
        if (!db) throw (lastError || new Error('IndexedDB unavailable'));
        return runReq('active', 'readwrite', function (s) { return s.put(val, key); })
          .then(function () { return runReq('active', 'readonly', function (s) { return s.get(key); }); })
          .then(function (got) {
            return runReq('active', 'readwrite', function (s) { return s.delete(key); }).then(function () { return got === val; });
          });
      });
    },
    isPersistent: function () { return !memory; }
  };
  root.TLDb = API;
})(typeof self !== 'undefined' ? self : this);
