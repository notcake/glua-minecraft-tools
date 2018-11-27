// curseforge tools
// a common file containing the API to interact with the curseforge site
import * as request from "request-promise";
const fakeUserAgent = require("fake-useragent");

import { download, IDownloadProgress } from "./download";

export interface IDownloadedMod
{
	url: string;
	filename: string;
	contents: Buffer;
}

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
	"1.12.2": "1738749986%3A628"
};
versionMap["1.7.10"] = versionMap["1.7"];
versionMap["1.10.2"] = versionMap["1.10"];
versionMap["1.11.2"] = versionMap["1.11"];
versionMap["1.12.2"] = versionMap["1.12"];

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

export function getCurseforgeFileId(url: string): string|null
{
	const match = url.match(/\/([0-9]+)$/);
	return match != null ? match[1] : null;
}

export function getFileURLFromCurseforge(curseforgeURL: string)
{
	// try and get rid of any trailing forwardslashes
	const match = curseforgeURL.match(/(^[\s\S]+?[^\/]+)\/*$/)
	if (match != null) { curseforgeURL = match[1]; }
	
	return `${curseforgeURL}/download`;
}

interface IRequestProgress {
	percent: number,		   	// Overall percent (between 0 to 1)
	speed: number,			  // The download speed in bytes/sec
	size: {
		total: number,			// The total payload size in bytes
		transferred: number   	// The transferred payload size in bytes
	},
	time: {
		elapsed: number,		// The total elapsed seconds since the start (3 decimals)
		remaining: number	   // The remaining seconds to finish (3 decimals)
	}
}

export function downloadModFromCurseforge(curseforgeUrl: string, progressCallback: ((_: IDownloadProgress) => void)|null = null): Promise<[Buffer, string]>
{
	return download(getFileURLFromCurseforge(curseforgeUrl), progressCallback);
}
