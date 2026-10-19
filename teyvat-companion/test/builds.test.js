import test from 'node:test';
import assert from 'node:assert/strict';
import { CHARACTER_BUILD_GUIDES } from '../src/builds.js';

const validCategories = new Set(['Main DPS', 'Sub DPS', 'Support']);

test('every character build has a consistent role category and source reference', () => {
  const entries = Object.entries(CHARACTER_BUILD_GUIDES);
  assert.ok(entries.length >= 100, 'expected the full character build catalogue');
  for (const [key, profile] of entries) {
    assert.ok(profile.role, key + ': role is required');
    assert.ok(validCategories.has(profile.buildCategory), key + ': buildCategory must be Main DPS, Sub DPS, or Support');
    assert.ok(Array.isArray(profile.artifacts) && profile.artifacts.length > 0, key + ': artifact options are required');
    assert.ok(profile.stats?.sands && profile.stats?.goblet && profile.stats?.circlet, key + ': all three main-stat slots are required');
    assert.ok(Array.isArray(profile.substats) && profile.substats.length > 0, key + ': substat priority is required');
    assert.ok(Array.isArray(profile.weapons) && profile.weapons.length > 0, key + ': weapon options are required');
    assert.ok(Array.isArray(profile.talentOrder) && profile.talentOrder.length > 0, key + ': talent priority is required');
    assert.ok(/^https:\/\//.test(profile.sourceUrl), key + ': source URL is required');
  }
});
