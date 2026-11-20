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

test('re-scheduling a running task does not start a second run', async () => {
    let running = 0;
    let maxRunning = 0;
    const slow = async () => {
        running++;
        maxRunning = Math.max(maxRunning, running);
        await new Promise(r => setTimeout(r, 120));
        running--;
    };
    taskRunner.scheduleTask('resched', 50, slow, true);
    taskRunner.scheduleTask('resched', 50, slow);
    await new Promise(r => setTimeout(r, 100));
    taskRunner.stopAllTasks();
    assert.equal(maxRunning, 1);
});
