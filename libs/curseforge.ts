// curseforge tools
// a common file containing the API to interact with the curseforge site
import * as request from "request-promise";
const fakeUserAgent = require("fake-useragent");

request.defaults({
	headers: {
		["User-Agent"]: fakeUserAgent(),
	}
})

const versionMap = {
	"1.7":	  "1738749986%3A5",
	"1.7.10": "2020709689%3A4449",
	"1.10":   "1738749986%3A572",
	"1.10.2": "2020709689%3A6170",
	"1.11":   "1738749986%3A599",
	"1.11.2": "2020709689%3A6452",
	"1.12":   "1738749986%3A628",
	"1.12.2": "2020709689%3A6756",
	"1.13":   "1738749986%3A55023",
	"1.13.2": "2020709689%3A7132",
	"1.14":   "1738749986%3a64806",
	"1.14.4": "2020709689%3A7469",
};
versionMap["1.7.10"] = versionMap["1.7"];
versionMap["1.10.2"] = versionMap["1.10"];
versionMap["1.11.2"] = versionMap["1.11"];
versionMap["1.12.2"] = versionMap["1.12"];
versionMap["1.13.2"] = versionMap["1.13"];
versionMap["1.14.4"] = versionMap["1.14"];

async function getCurseforgeLinkForVersion(id: string, version: string): Promise<string|null>
{
	const body = await request.get("https://www.curseforge.com/minecraft/mc-mods/" + id + "/files/all?filter-game-version=" + versionMap[version]);
	const regex = /\/minecraft\/mc\-mods\/[^\/]+\/download\/([0-9]+)"\s*class="button button\-\-hollow/;
	const match = body.match(regex);
	if (match == null) { return null; }
	return "https://www.curseforge.com/minecraft/mc-mods/" + id + "/download/" + match[1] + "/file";
}

export async function getCurseforgeUrls(id: string, versions: string[]): Promise<{ [_: string]: string }>
{
	// Follow redirect
	const body = await request.get("https://www.curseforge.com/minecraft/mc-mods/" + id);
	const regex = /<meta property="og:url" content="https:\/\/www.curseforge.com\/minecraft\/mc\-mods\/([^"]+)" \/>/;
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

export function getCurseforgeFileId(url: string): string|null
{
	if(url.match(/^https?:\/\/minecraft\.curseforge\.com/)) {
		const match = url.match(/\/([0-9]+)$/);
		return match != null ? match[1] : null;
	}
	else {
		const match = url.match(/\/([0-9]+)\/file$/);
		return match != null ? match[1] : null;
	}
}
