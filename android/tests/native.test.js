// Tests for www/js/native.js using a fake Capacitor object (no device needed).
const test = require('node:test');
const assert = require('node:assert/strict');
const { create } = require('../www/js/native.js');

function fakeCapacitor(overrides) {
  const calls = [];
  const plugins = {};
  const cap = {
    isNativePlatform: () => true,
    getPlatform: () => 'android',
    registerPlugin: (name) => {
      if (!plugins[name]) {
        plugins[name] = new Proxy({}, {
          get: (_t, method) => (...args) => {
            calls.push({ plugin: name, method, args });
            const handler = cap.handlers && cap.handlers[name + '.' + method];
            return handler ? handler(...args) : Promise.resolve({});
          }
        });
      }
      return plugins[name];
    }
  };
  Object.assign(cap, overrides || {});
  cap.calls = calls;
  return cap;
}

test('in a normal browser the bridge is inert', () => {
  assert.deepEqual(create(undefined), { native: false });
  assert.deepEqual(create({ isNativePlatform: () => false }), { native: false });
  assert.deepEqual(create({ isNativePlatform: () => true, getPlatform: () => 'ios' }), { native: false });
});

test('native flag is true only for Android Capacitor', () => {
  assert.equal(create(fakeCapacitor()).native, true);
});

test('toPosition maps plugin locations to the browser GeolocationPosition shape', () => {
  const nb = create(fakeCapacitor());
  const pos = nb.toPosition({ latitude: 40.1, longitude: -105.2, accuracy: 6.5, altitude: 1650, altitudeAccuracy: 3, bearing: 90, speed: 1.4, time: 1700000000000 });
  assert.deepEqual(pos.coords, { latitude: 40.1, longitude: -105.2, accuracy: 6.5, altitude: 1650, altitudeAccuracy: 3, heading: 90, speed: 1.4 });
  assert.equal(pos.timestamp, 1700000000000);
  const nulls = nb.toPosition({ latitude: 1, longitude: 2, accuracy: null, altitude: null, speed: null, time: 5 });
  assert.equal(nulls.coords.altitude, null);
  assert.equal(nulls.coords.speed, null);
});

test('toGeoError maps plugin errors to GeolocationPositionError codes', () => {
  const nb = create(fakeCapacitor());
  assert.equal(nb.toGeoError({ code: 'NOT_AUTHORIZED', message: 'Permission denied.' }).code, 1);
  assert.equal(nb.toGeoError({ code: 'NOT_AUTHORIZED', message: 'Location services disabled.' }).code, 2);
  assert.equal(nb.toGeoError({ message: 'boom' }).code, 2);
  assert.equal(nb.toGeoError(null).code, 2);
});

test('startWatch: background option adds the notification text, and never asks for permissions itself', () => {
  const cap = fakeCapacitor();
  const nb = create(cap);
  nb.startWatch({ background: true }, () => {}, () => {});
  nb.startWatch({ background: false }, () => {}, () => {});
  const adds = cap.calls.filter((c) => c.method === 'addWatcher');
  assert.equal(adds.length, 2);
  assert.equal(adds[0].args[0].requestPermissions, false);
  assert.equal(adds[0].args[0].backgroundMessage, nb.NOTIFICATION_TEXT);
  assert.equal(adds[0].args[0].backgroundTitle, nb.NOTIFICATION_TITLE);
  assert.equal(adds[1].args[0].backgroundMessage, undefined);
  assert.equal(adds[1].args[0].requestPermissions, false);
});

test('startWatch forwards fixes and errors, and stopWatch removes the native watcher', async () => {
  const cap = fakeCapacitor();
  let cb;
  cap.handlers = { 'BackgroundGeolocation.addWatcher': (_o, c) => { cb = c; return Promise.resolve('cb-1'); } };
  const nb = create(cap);
  const got = [], errs = [];
  const key = nb.startWatch({ background: true }, (p) => got.push(p), (e) => errs.push(e));
  await new Promise((r) => setImmediate(r));
  cb({ latitude: 10, longitude: 20, accuracy: 5, time: 111 });
  cb(null, { code: 'NOT_AUTHORIZED', message: 'Permission denied.' });
  assert.equal(got.length, 1);
  assert.equal(got[0].coords.latitude, 10);
  assert.equal(errs[0].code, 1);
  await nb.stopWatch(key);
  const rm = cap.calls.filter((c) => c.method === 'removeWatcher');
  assert.deepEqual(rm[0].args[0], { id: 'cb-1' });
  // Fixes after stop are ignored.
  cb({ latitude: 11, longitude: 21, accuracy: 5, time: 112 });
  assert.equal(got.length, 1);
});

test('startWatch retries while the plugin service is still binding', async () => {
  const cap = fakeCapacitor();
  let attempts = 0;
  cap.handlers = {
    'BackgroundGeolocation.addWatcher': (_o, c) => {
      attempts++;
      if (attempts < 3) setImmediate(() => c(null, { message: 'Service not running.' }));
      else setImmediate(() => c({ latitude: 1, longitude: 2, accuracy: 3, time: 4 }));
      return Promise.resolve('cb-' + attempts);
    }
  };
  const nb = create(cap);
  const got = [], errs = [];
  nb.startWatch({}, (p) => got.push(p), (e) => errs.push(e));
  await new Promise((r) => setTimeout(r, 700));
  assert.equal(attempts, 3);
  assert.equal(errs.length, 0);
  assert.equal(got.length, 1);
});

test('shareFile writes into the cache folder, then shares that file', async () => {
  const cap = fakeCapacitor();
  cap.handlers = { 'Filesystem.writeFile': () => Promise.resolve({ uri: 'file:///cache/exports/my-hike.gpx' }) };
  const nb = create(cap);
  await nb.shareFile({ filename: 'My Hike.gpx', text: '<gpx/>', title: 'My Hike' });
  const w = cap.calls.find((c) => c.method === 'writeFile').args[0];
  assert.equal(w.directory, 'CACHE');
  assert.equal(w.encoding, 'utf8');
  assert.equal(w.path, 'exports/My-Hike.gpx');
  assert.equal(w.recursive, true);
  assert.equal(w.data, '<gpx/>');
  const s = cap.calls.find((c) => c.method === 'share').args[0];
  assert.deepEqual(s.files, ['file:///cache/exports/my-hike.gpx']);
});

test('permission and settings calls go to the local TrailLogNative plugin', async () => {
  const cap = fakeCapacitor();
  const nb = create(cap);
  await nb.checkStatus(); await nb.requestForeground(); await nb.requestBackground(); await nb.requestNotifications();
  await nb.openAppSettings(); await nb.openBatterySettings(); await nb.openLocationSettings(); await nb.openNotificationSettings();
  assert.deepEqual(cap.calls.map((c) => c.plugin + '.' + c.method), [
    'TrailLogNative.checkStatus', 'TrailLogNative.requestForeground', 'TrailLogNative.requestBackground', 'TrailLogNative.requestNotifications',
    'TrailLogNative.openAppSettings', 'TrailLogNative.openBatterySettings', 'TrailLogNative.openLocationSettings', 'TrailLogNative.openNotificationSettings']);
});

test('setSystemBars: status bar always DARK style (light icons on the green bar); navigation bar follows theme', async () => {
  const cap = fakeCapacitor();
  const nb = create(cap);
  await nb.setSystemBars(false);
  await nb.setSystemBars(true);
  const styles = cap.calls.filter((c) => c.plugin === 'SystemBars').map((c) => c.args[0]);
  assert.deepEqual(styles, [
    { bar: 'StatusBar', style: 'DARK' }, { bar: 'NavigationBar', style: 'LIGHT' },
    { bar: 'StatusBar', style: 'DARK' }, { bar: 'NavigationBar', style: 'DARK' }]);
});
