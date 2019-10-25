import { CurseforgeModRepository } from "./curseforgemodrepository";

test("getMinecraftVersions", async () =>
{
	const modRepository = new CurseforgeModRepository();
	const minecraftVersions = await modRepository.getMinecraftVersions();
	expect(minecraftVersions).toContain("1.7.10");
	expect(minecraftVersions).toContain("1.10.2");
	expect(minecraftVersions).toContain("1.11.2");
	expect(minecraftVersions).toContain("1.12.2");
	expect(minecraftVersions).toContain("1.14.4");
});

test("getModUrl", async () =>
{
	const modRepository = new CurseforgeModRepository();
	expect(modRepository.getModUrl("mekanism")).toBe("https://www.curseforge.com/minecraft/mc-mods/mekanism");
});

test("parseModUrl", async () =>
{
	const modRepository = new CurseforgeModRepository();
	expect(modRepository.parseModUrl("http://minecraft.curseforge.com/projects/mekanism")).toBe("mekanism");
	expect(modRepository.parseModUrl("https://minecraft.curseforge.com/projects/mekanism")).toBe("mekanism");
	expect(modRepository.parseModUrl("http://minecraft.curseforge.com/projects/mekanism/files/2572881")).toBe("mekanism");
	expect(modRepository.parseModUrl("https://minecraft.curseforge.com/projects/mekanism/files/2572881")).toBe("mekanism");
	expect(modRepository.parseModUrl("http://curseforge.com/minecraft/mc-mods/mekanism")).toBe("mekanism");
	expect(modRepository.parseModUrl("https://curseforge.com/minecraft/mc-mods/mekanism")).toBe("mekanism");
	expect(modRepository.parseModUrl("http://curseforge.com/minecraft/mc-mods/mekanism/files/2572881")).toBe("mekanism");
	expect(modRepository.parseModUrl("https://curseforge.com/minecraft/mc-mods/mekanism/files/2572881")).toBe("mekanism");
	expect(modRepository.parseModUrl("http://www.curseforge.com/minecraft/mc-mods/mekanism")).toBe("mekanism");
	expect(modRepository.parseModUrl("https://www.curseforge.com/minecraft/mc-mods/mekanism")).toBe("mekanism");
	expect(modRepository.parseModUrl("http://www.curseforge.com/minecraft/mc-mods/mekanism/files/2572881")).toBe("mekanism");
	expect(modRepository.parseModUrl("https://www.curseforge.com/minecraft/mc-mods/mekanism/files/2572881")).toBe("mekanism");
});

test("getLatestModReleaseId", async () =>
{
	const modRepository = new CurseforgeModRepository();
	expect(await modRepository.getLatestModReleaseId("mekanism", "1.7.10")).toBe("2475797");
});

test("getModReleaseUrl", async () =>
{
	const modRepository = new CurseforgeModRepository();
	expect(modRepository.getModReleaseUrl("mekanism", "2572881")).toBe("https://www.curseforge.com/minecraft/mc-mods/mekanism/files/2572881");
});

test("getModReleaseDownloadUrl", async () =>
{
	const modRepository = new CurseforgeModRepository();
	expect(await modRepository.getModReleaseDownloadUrl("mekanism", "2572881")).toBe("https://edge.forgecdn.net/files/2572/881/Mekanism-1.12.2-9.4.13.349.jar");
});

test("parseModReleaseUrl", async () =>
{
	const modRepository = new CurseforgeModRepository();
	expect(modRepository.parseModReleaseUrl("http://minecraft.curseforge.com/projects/mekanism/files/2572881")).toStrictEqual(["mekanism", "2572881"]);
	expect(modRepository.parseModReleaseUrl("https://minecraft.curseforge.com/projects/mekanism/files/2572881")).toStrictEqual(["mekanism", "2572881"]);
	expect(modRepository.parseModReleaseUrl("http://curseforge.com/minecraft/mc-mods/mekanism/files/2572881")).toStrictEqual(["mekanism", "2572881"]);
	expect(modRepository.parseModReleaseUrl("https://curseforge.com/minecraft/mc-mods/mekanism/files/2572881")).toStrictEqual(["mekanism", "2572881"]);
	expect(modRepository.parseModReleaseUrl("http://www.curseforge.com/minecraft/mc-mods/mekanism/files/2572881")).toStrictEqual(["mekanism", "2572881"]);
	expect(modRepository.parseModReleaseUrl("https://www.curseforge.com/minecraft/mc-mods/mekanism/files/2572881")).toStrictEqual(["mekanism", "2572881"]);
});

test("getMinecraftGameId", async () =>
{
	const modRepository = new CurseforgeModRepository();
	expect(await modRepository.getMinecraftGameId()).toBe("432");
});

test("getSlugId", async () =>
{
	const modRepository = new CurseforgeModRepository();
	expect(await modRepository.getSlugId("mekanism")).toBe("268560");
});
