import { sanitizeFileName } from "./utils";

test("sanitizeFileName", () =>
{
	expect(sanitizeFileName("<<")).toBe("__");
	expect(sanitizeFileName(">>")).toBe("__");
	expect(sanitizeFileName("::")).toBe("__");
	expect(sanitizeFileName("\"\"")).toBe("__");
	expect(sanitizeFileName("//")).toBe("__");
	expect(sanitizeFileName("\\\\")).toBe("__");
	expect(sanitizeFileName("||")).toBe("__");
	expect(sanitizeFileName("??")).toBe("__");
	expect(sanitizeFileName("**")).toBe("__");
});
