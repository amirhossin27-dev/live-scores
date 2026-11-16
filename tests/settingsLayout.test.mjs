import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

// .sp-settings is its own scroll container, so a sticky offset counts from its top, not from the screen edge.
// Adding the safe area there pushed the Done bar over the first settings (the notifications switch on the iPhone).
test('the Done bar of the settings has no offset that covers the first setting', () => {
 const css = readFileSync(new URL('../src/features/overview/sports.css', import.meta.url), 'utf8');
 const rules = [...css.matchAll(/\.sp-settings-exit\s*\{([^}]*)\}/g)].map((m) => m[1]);
 const sticky = rules.find((body) => /position:\s*sticky/.test(body));
 assert.ok(sticky, 'sticky rule exists');
 assert.match(sticky, /top:\s*0(px)?\s*;/);
});
