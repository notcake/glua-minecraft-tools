import { getUserUuid } from "./minecraft";

test("getUserUuid", async () =>
{
	expect(await getUserUuid("_cake")).toBe("5d6e215a-5ee4-4609-8695-44d79d2cc130");
});
