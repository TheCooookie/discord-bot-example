interface ScheduledTask {
    id: NodeJS.Timeout;
    name: string;
    intervalMs: number;
    taskFunction: () => void | Promise<void>;
    lastRun?: Date;
    isRunning?: boolean;
}

/** Runs named functions on a fixed interval. A run is skipped while the previous one is still going. */
class TaskRunner {
    private scheduledTasks: Map<string, ScheduledTask>;

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
            const task = this.scheduledTasks.get(name);
            if (task && task.isRunning) {
                return;
            }
            if (task) task.isRunning = true;

            try {
                await taskFunction();
                if (task) task.lastRun = new Date();
            } catch (error) {
                console.error(`[TaskRunner] Error during execution of task "${name}":`, error);
            } finally {
                if (task) task.isRunning = false;
            }
        };

        const timerId = setInterval(taskWrapper, intervalMs);

        // Register before the first run so the isRunning guard sees this task.
        this.scheduledTasks.set(name, {
            id: timerId,
            name,
            intervalMs,
            taskFunction,
            isRunning: false,
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
