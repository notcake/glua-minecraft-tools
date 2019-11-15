import { ConcurrentManager } from "./concurrency";

test("ConcurrentManager with 0 tasks", async () =>
{
	const concurrency = new ConcurrentManager();
	await concurrency.defer();
});
