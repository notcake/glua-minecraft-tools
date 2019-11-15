import { ConcurrentManager } from "./concurrency";

test("ConcurrentManager with 0 tasks", async () =>
{
	const concurrency = new ConcurrentManager();
	await concurrency.join();
});

test("ConcurrentManager with single thread", async () =>
{
	const concurrency = new ConcurrentManager(1);
	const task1 = jest.fn(async () => {});
	const task2 = jest.fn(async () => {});
	concurrency.queueTask(task1);
	concurrency.queueTask(task2);

	expect(task1).toHaveBeenCalledTimes(1);
	expect(task2).toHaveBeenCalledTimes(0);

	await concurrency.join();

	expect(task1).toHaveBeenCalledTimes(1);
	expect(task2).toHaveBeenCalledTimes(1);
});
