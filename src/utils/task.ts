interface ScheduledTask {
    id: NodeJS.Timeout;
    name: string;
    intervalMs: number;
    taskFunction: () => void | Promise<void>;
    lastRun?: Date;
    isRunning?: boolean;
}

class TaskRunner {
    private scheduledTasks: Map<string, ScheduledTask>;

    constructor() {
        this.scheduledTasks = new Map();
        console.log('[TaskRunner] Initialized.');
    }

    /**
     * Schedules a new task to run at regular intervals.
     * If a task with the same name already exists, it will be overwritten.
     * @param name Unique name of the task.
     * @param intervalMs Interval in milliseconds between each execution.
     * @param taskFunction The function to execute.
     * @param runImmediately If true, the task runs immediately after being scheduled, then at the defined interval.
     */
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

        // Stop and remove an existing task with the same name
        if (this.scheduledTasks.has(name)) {
            this.stopTask(name);
        }

        const taskWrapper = async () => {
            const task = this.scheduledTasks.get(name);
            if (task && task.isRunning) {
                // console.debug(`[TaskRunner] Task "${name}" is already running, skipping this iteration.`);
                return;
            }
            if (task) task.isRunning = true;

            // console.debug(`[TaskRunner] Executing task: ${name}`);
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

    /**
     * Stops a specific scheduled task.
     * @param name Name of the task to stop.
     */
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

    /**
     * Stops all scheduled tasks.
     */
    public stopAllTasks(): void {
        this.scheduledTasks.forEach((task) => clearInterval(task.id));
        this.scheduledTasks.clear();
        console.log('[TaskRunner] All scheduled tasks stopped.');
    }
}

const taskRunner = new TaskRunner();
export default taskRunner;