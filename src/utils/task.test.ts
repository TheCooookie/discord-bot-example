import { test } from 'node:test';
import assert from 'node:assert/strict';
import taskRunner from './task';

test('a slow task never overlaps itself, even with runImmediately', async () => {
    let running = 0;
    let maxRunning = 0;
    taskRunner.scheduleTask('slow', 50, async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise(r => setTimeout(r, 120));
        running--;
    }, true);
    await new Promise(r => setTimeout(r, 200));
    taskRunner.stopAllTasks();
    assert.equal(maxRunning, 1);
});
