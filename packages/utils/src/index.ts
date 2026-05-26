// ============================================
// LOGGER
// ============================================

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
    private context: string;

    constructor(context: string) {
        this.context = context;
    }

    private log(level: LogLevel, message: string, ...args: unknown[]): void {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase().padEnd(5)}] [${this.context}]`;

        const colors: Record<LogLevel, string> = {
            debug: '\x1b[36m', // Cyan
            info: '\x1b[32m',  // Green
            warn: '\x1b[33m',  // Yellow
            error: '\x1b[31m'  // Red
        };
        const reset = '\x1b[0m';

        const color = process.env.NODE_ENV === 'development' ? colors[level] : '';
        const output = `${color}${prefix}${reset} ${message}`;

        switch (level) {
            case 'debug':
                if (process.env.NODE_ENV === 'development') {
                    console.debug(output, ...args);
                }
                break;
            case 'info':
                console.info(output, ...args);
                break;
            case 'warn':
                console.warn(output, ...args);
                break;
            case 'error':
                console.error(output, ...args);
                break;
        }
    }

    debug(message: string, ...args: unknown[]): void {
        this.log('debug', message, ...args);
    }

    info(message: string, ...args: unknown[]): void {
        this.log('info', message, ...args);
    }

    warn(message: string, ...args: unknown[]): void {
        this.log('warn', message, ...args);
    }

    error(message: string, ...args: unknown[]): void {
        this.log('error', message, ...args);
    }
}

// ============================================
// ASYNC QUEUE
// ============================================

export class AsyncQueue<T> {
    private queue: T[] = [];
    private processing = false;
    private processor: (item: T) => Promise<void>;

    constructor(processor: (item: T) => Promise<void>) {
        this.processor = processor;
    }

    async enqueue(item: T): Promise<void> {
        this.queue.push(item);
        if (!this.processing) {
            await this.process();
        }
    }

    private async process(): Promise<void> {
        this.processing = true;

        while (this.queue.length > 0) {
            const item = this.queue.shift();
            if (item) {
                try {
                    await this.processor(item);
                } catch (error) {
                    console.error('Queue processing error:', error);
                }
            }
        }

        this.processing = false;
    }

    clear(): void {
        this.queue = [];
    }

    peek(): T | undefined {
        return this.queue[0];
    }

    get length(): number {
        return this.queue.length;
    }

    get items(): ReadonlyArray<T> {
        return [...this.queue];
    }

    get isProcessing(): boolean {
        return this.processing;
    }
}

// ============================================
// HELPERS
// ============================================

export function sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export function generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

export function formatCurrency(amount: number, currency: string): string {
    return new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: currency
    }).format(amount);
}

export class Debouncer<T> {
    private timeout: NodeJS.Timeout | null = null;

    constructor(
        private delay: number,
        private fn: (value: T) => void
    ) { }

    debounce(value: T): void {
        if (this.timeout) {
            clearTimeout(this.timeout);
        }
        this.timeout = setTimeout(() => {
            this.fn(value);
            this.timeout = null;
        }, this.delay);
    }
}