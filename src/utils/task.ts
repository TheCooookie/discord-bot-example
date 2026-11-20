interface ScheduledTask {
    id: NodeJS.Timeout;
    name: string;
    intervalMs: number;
    taskFunction: () => void | Promise<void>;
    lastRun?: Date;
}

/** Runs named functions on a fixed interval. A run is skipped while the previous one is still going. */
class TaskRunner {
    private scheduledTasks: Map<string, ScheduledTask>;
    // Keyed by name, not by entry, so a re-scheduled task still waits for its old run to finish.
    private running = new Set<string>();

    constructor() {
        this.scheduledTasks = new Map();
        console.log('[TaskRunner] Initialized.');
    }

    /** Schedules `taskFunction` every `intervalMs`. Replaces any task with the same name. */
    public scheduleTask(
        name: string,
        intervalMs: number,
        taskFunction: () => void | Promise<void>,
        runImmediately: boolean = false
    ): void {
        if (intervalMs <= 0) {
            console.error(`[TaskRunner] Interval for task "${name}" must be greater than 0.`);
            return;
        }

        if (this.scheduledTasks.has(name)) {
            this.stopTask(name);
        }

        const taskWrapper = async () => {
            if (this.running.has(name)) return;
            this.running.add(name);
            try {
                await taskFunction();
                const task = this.scheduledTasks.get(name);
                if (task) task.lastRun = new Date();
            } catch (error) {
                console.error(`[TaskRunner] Error during execution of task "${name}":`, error);
            } finally {
                this.running.delete(name);
            }
        };

        const timerId = setInterval(taskWrapper, intervalMs);

        this.scheduledTasks.set(name, {
            id: timerId,
            name,
            intervalMs,
            taskFunction,
        });

        if (runImmediately) {
            taskWrapper();
        }

        console.log(`[TaskRunner] Task "${name}" scheduled to run every ${intervalMs / 1000} seconds.`);
    }

    /** Stops one task. Returns false if no task has that name. */
    public stopTask(name: string): boolean {
        const task = this.scheduledTasks.get(name);
        if (task) {
            clearInterval(task.id);
            this.scheduledTasks.delete(name);
            console.log(`[TaskRunner] Task "${name}" stopped.`);
            return true;
        }
        console.warn(`[TaskRunner] Attempted to stop a non-existent task: "${name}".`);
        return false;
    }

    /** Stops every task. */
    public stopAllTasks(): void {
        this.scheduledTasks.forEach((task) => clearInterval(task.id));
        this.scheduledTasks.clear();
        console.log('[TaskRunner] All scheduled tasks stopped.');
    }
}

const taskRunner = new TaskRunner();
export default taskRunner;
