// curseforge tools
// a common file containing the API to interact with the curseforge site
import * as request from "request-promise";

const versionMap = {
	"1.7":    "1738749986%3A5",
	// "1.7.10": "2020709689%3A4449",
	"1.7.10":    "1738749986%3A5",
	"1.10":   "1738749986%3A572",
	// "1.10.2": "2020709689%3A6170",
	"1.10.2":   "1738749986%3A572",
	"1.11":   "1738749986%3A599",
	"1.11.2": "2020709689%3A6452",
	"1.12":   "1738749986%3A628",
	"1.12.2": "1738749986%3A628"
};
async function getCurseforgeLinkForVersion(id: string, version: string): Promise<string|null>
{
	const body = await request.get("https://minecraft.curseforge.com/projects/" + id + "/files?filter-game-version=" + versionMap[version]);
	const regex = /\/projects\/[^\/]+\/files\/([0-9]+)\/download/;
	const match = body.match(regex);
	if (match == null) { return null; }
	return "https://minecraft.curseforge.com/projects/" + id + "/files/" + match[1];
}

export async function getCurseforgeUrls(id: string, versions: string[]): Promise<{ [_: string]: string }>
{
	// Follow redirect
	const body = await request.get("https://minecraft.curseforge.com/projects/" + id);
	const regex = /<meta property="og:url" content="https:\/\/minecraft.curseforge.com\/projects\/([^"]+)" \/>/;
	const match = body.match(regex);
	if (match != null) { id = match[1]; }

	const tasks: { [_: string]: Promise<string|null> } = {};
	const urls: { [_: string]: string } = {};
	for (let version of versions)
	{
		tasks[version] = getCurseforgeLinkForVersion(id, version);
	}
	for (let version of versions)
	{
		const url = await tasks[version];
		if (url == null) { continue; }
		urls[version] = url;
	}
	return urls;
}
