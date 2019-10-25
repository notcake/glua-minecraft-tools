import { UrlModRepository } from "./urlmodrepository";

test("getMinecraftVersions", async () =>
{
	const modRepository = new UrlModRepository();
	const minecraftVersions = await modRepository.getMinecraftVersions();
	expect(minecraftVersions).toContain("1.7.10");
	expect(minecraftVersions).toContain("1.10.2");
	expect(minecraftVersions).toContain("1.11.2");
	expect(minecraftVersions).toContain("1.12.2");
	expect(minecraftVersions).toContain("1.14.4");
});

test("getModUrl", async () =>
{
	const modRepository = new UrlModRepository();
	const id = "https://ci.micdoodle8.com/job/Galacticraft-1.12/";
	expect(modRepository.getModUrl(id)).toBe(id);
});

test("parseModUrl", async () =>
{
	const modRepository = new UrlModRepository();
	const url = "https://ci.micdoodle8.com/job/Galacticraft-1.12/";
	expect(modRepository.parseModUrl(url)).toBe(url);
});

test("getLatestModReleaseId", async () =>
{
	const modRepository = new UrlModRepository();
	const id = "https://ci.micdoodle8.com/job/Galacticraft-1.12/lastSuccessfulBuild/artifact/Forge/build/libs/GalacticraftCore-1.12.2-4.0.1.181.jar";
	expect(await modRepository.getLatestModReleaseId(id, "1.12.2")).toBe(id);
});

test("getModReleaseUrl", async () =>
{
	const modRepository = new UrlModRepository();
	const id = "https://ci.micdoodle8.com/job/Galacticraft-1.12/lastSuccessfulBuild/artifact/Forge/build/libs/GalacticraftCore-1.12.2-4.0.1.181.jar";
	expect(modRepository.getModReleaseUrl("", id)).toBe(id);
});

test("getModReleaseDownloadUrl", async () =>
{
	const modRepository = new UrlModRepository();
	const id = "https://ci.micdoodle8.com/job/Galacticraft-1.12/lastSuccessfulBuild/artifact/Forge/build/libs/GalacticraftCore-1.12.2-4.0.1.181.jar";
	expect(await modRepository.getModReleaseDownloadUrl(id, id)).toBe(id);
});

test("parseModReleaseUrl", async () =>
{
	const modRepository = new UrlModRepository();
	const url = "https://ci.micdoodle8.com/job/Galacticraft-1.12/lastSuccessfulBuild/artifact/Forge/build/libs/GalacticraftCore-1.12.2-4.0.1.181.jar";
	expect(modRepository.parseModReleaseUrl(url)).toStrictEqual([url, url]);
});
