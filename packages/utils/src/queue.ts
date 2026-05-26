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

    get length(): number {
        return this.queue.length;
    }

    get items(): ReadonlyArray<T> {
        return [...this.queue];
    }
}
