type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export class Logger {
    constructor(private readonly context: string) { }

    private log(level: LogLevel, message: string, ...args: unknown[]): void {
        const timestamp = new Date().toISOString();
        const prefix = `[${timestamp}] [${level.toUpperCase()}] [${this.context}]`;

        switch (level) {
            case 'debug':
                if (process.env.NODE_ENV === 'development') {
                    console.debug(prefix, message, ...args);
                }
                break;
            case 'info':
                console.info(prefix, message, ...args);
                break;
            case 'warn':
                console.warn(prefix, message, ...args);
                break;
            case 'error':
                console.error(prefix, message, ...args);
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
