import { test } from 'node:test';
import assert from 'node:assert/strict';
import { componentKey } from './customId';

test('a customId routes to the handler named before the first colon', () => {
    assert.equal(componentKey('announce'), 'announce');
    assert.equal(componentKey('announce:ack'), 'announce');
    assert.equal(componentKey('poll:vote:42'), 'poll');
});
