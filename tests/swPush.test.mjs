import { test } from 'node:test';
import assert from 'node:assert/strict';
import { swPushSource } from '../src/swPush.mjs';

function fakeSelf(windows = []) {
 const listeners = {}; const shown = []; const opened = []; const focused = [];
 const self = {
  addEventListener: (type, fn) => { listeners[type] = fn; },
  registration: { scope: 'https://amirhossin27-dev.github.io/live-scores/', showNotification: async (title, options) => { shown.push({ title, options }); } },
  clients: {
   matchAll: async () => windows.map((url) => ({ url, focus: async () => { focused.push(url); } })),
   openWindow: async (url) => { opened.push(url); },
  },
 };
 new Function('self', swPushSource)(self);
 return { listeners, shown, opened, focused };
}

async function dispatch(listener, event) {
 const waits = [];
 listener({ ...event, waitUntil: (p) => waits.push(p) });
 await Promise.all(waits);
}

test('push shows the notification with tag, icon and target', async () => {
 const sw = fakeSelf();
 await dispatch(sw.listeners.push, { data: { json: () => ({ title: '⚽ Tor für Bayern', body: 'Bayern 1:0 Dortmund', tag: 't1', url: './' }) } });
 assert.deepEqual(sw.shown, [{ title: '⚽ Tor für Bayern', options: { body: 'Bayern 1:0 Dortmund', tag: 't1', icon: 'icons/icon-192.png', data: { url: './' } } }]);
});

test('push without readable data still shows something', async () => {
 const sw = fakeSelf();
 await dispatch(sw.listeners.push, { data: { json: () => { throw new Error('no json'); } } });
 assert.equal(sw.shown[0].title, 'Live Scores');
});

test('a tap focuses an open window of the app', async () => {
 const sw = fakeSelf(['https://amirhossin27-dev.github.io/live-scores/?x=1']);
 let closed = false;
 await dispatch(sw.listeners.notificationclick, { notification: { close: () => { closed = true; }, data: { url: './' } } });
 assert.equal(closed, true);
 assert.deepEqual(sw.focused, ['https://amirhossin27-dev.github.io/live-scores/?x=1']);
 assert.deepEqual(sw.opened, []);
});

test('a tap opens the app when no window is open', async () => {
 const sw = fakeSelf(['https://other.example/']);
 await dispatch(sw.listeners.notificationclick, { notification: { close: () => {}, data: { url: './' } } });
 assert.deepEqual(sw.opened, ['https://amirhossin27-dev.github.io/live-scores/']);
});
