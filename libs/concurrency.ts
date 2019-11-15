export class ConcurrentManager
{
	public readonly maxConcurrency: number;

	private readonly queuedTasks: (() => Promise<void>)[] = [];
	private activeTasks: number = 0;

	private completion: Promise<void> = (async () => {})();
	private resolveCompletion: () => void = () => {};

	public constructor(maxConcurrency: number = 10)
	{
		this.maxConcurrency = maxConcurrency;
	}

	public queueTask<T>(task: () => Promise<T>): Promise<T>
	{
		return new Promise<T>((resolve, reject) =>
		{
			if (this.queuedTasks.length == 0)
			{
				this.completion = new Promise<void>((resolve) =>
				{
					this.resolveCompletion = resolve;
				});
			}

			this.queuedTasks.push(async () =>
			{
				const promise = task();
				promise.then(resolve);
				promise.catch(reject);
				try { await promise; }
				catch (e) {}
			});

			if (this.activeTasks < this.maxConcurrency)
			{
				this.activeTasks++;
				(async () =>
				{
					while (this.queuedTasks.length > 0)
					{
						const task = this.queuedTasks.shift()!;
						await task();
					}
					this.activeTasks--;
					if (this.activeTasks == 0)
					{
						this.resolveCompletion();
					}
				})();
			}
		});
	}

	public join(): Promise<void>
	{
		return this.completion;
	}
}
