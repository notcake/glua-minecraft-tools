// curseforge tools
// a common file containing the API to interact with the curseforge site
import * as request from "request-promise";
const fakeUserAgent = require("fake-useragent");

import { download, IDownloadProgress } from "./download";

type StringMap<V> = {[_: string]: V};


const versionMap : StringMap<string> = {
	"1.7":	  "1738749986%3A5",
	"1.7.10": "2020709689%3A4449",
	"1.10":   "1738749986%3A572",
	"1.10.2": "2020709689%3A6170",
	"1.11":   "1738749986%3A599",
	"1.11.2": "2020709689%3A6452",
	"1.12":   "1738749986%3A628",
	"1.12.2": "1738749986%3A628"
};

request.defaults({
	headers: {
		["User-Agent"]: fakeUserAgent(),
	}
})

export function getCurseforgeFileID(url: string): string|null
{
	const match = url.match(/\/([0-9]+)$/);
	return match != null ? match[1] : null;
}

	public constructor(url: string)
	{
		this.url = url.replace(/[\\\/]*$/, '');
		this.downloadURL = this.url + '/download';
		const id = CurseforgeLink.getFileId(this.url);
		if(id === null)
			throw new Error("Invalid curseforge mod url: " + url + ".")
		this.fileId = id;
	}

	public static getFileId(url: string): string|null
	{
		const match = url.replace(/[\\\/]*$/, '').match(/\/([0-9]+)$/);
		if(match === null)
			return null;
		return match[1];
	}
}

export class CurseforgeMod
{
	public readonly versions: string[];
	public id: string;
	public urls: StringMap<CurseforgeLink|null>;
	public dependencies: StringMap<CurseforgeMod[]>;

	private _hasBeenDownloaded: boolean;

	public get hasBeenDownloaded(): boolean {
		return this._hasBeenDownloaded;
	}

	public availableForVersion(version: string) {
		return this.versions.indexOf(version) !== -1 && !!this.urls[version];
	}

	private constructor(versions: string[])
	{
		this.versions = versions;
	}

	// I think swad or cake added this for a reason so I'm keeping it
	private async resolveID(id: string): Promise<void>
	{
		// Follow redirect
		const body = await request.get("https://minecraft.curseforge.com/projects/" + id);
		if(!body)
		{
			throw new Error("Invalid curseforge mod id: " + id + "!");
		}
		const regex = /<meta property="og:url" content="https:\/\/minecraft.curseforge.com\/projects\/([^"]+)" \/>/;
		const match = body.match(regex);
		if (match != null) { id = match[1]; }
		this.id = id;
	}

	private async getVersionLink(version: string): Promise<CurseforgeLink|null>
	{
		const body = await request.get(`https://minecraft.curseforge.com/projects/${this.id}/files?filter-game-version=${versionMap[version]}`);
		const regex = /\/projects\/[^\/]+\/files\/([0-9]+)\/download/;
		const match = body.match(regex);
		if (match == null)
		{
			return null;
		}
		return new CurseforgeLink(`https://minecraft.curseforge.com/projects/${this.id}/files/${match[1]}`);
	}

	private async resolveURLs(): Promise<void>
	{
		this.urls = {};
		for (let version of this.versions)
		{
			const url = await this.getVersionLink(version);
			if (url !== null)
			{
				this.urls[version] = url;
			}
		}
	}

	private async resolveDependencies(): Promise<void>
	{
		this.dependencies = {};
		for(let version of this.versions)
			this.dependencies[version] = [];

		const body: string = await request.get(`https://minecraft.curseforge.com/projects/${this.id}/relations/dependencies`);
		if(!body)
		{
			console.error(`Couldn't resolve dependencies for ${this.id}.`);
			return;
		}
		const urls = body.match(/<a href="https:\/\/minecraft\.curseforge\.com\/projects\/([^"]+)">/g);
		if(!urls)
		{
			return; // No dependencies
		}
		const ids: string[] = urls
			.map(url => url.match(/<a href="https:\/\/minecraft\.curseforge\.com\/projects\/([^"]+)">/)![1]);

		for(let id of ids)
		{
			let dep: CurseforgeMod|null = await CurseforgeMod.fromID(id, this.versions);
			if(dep !== null) // fucking circular dependencies (I'm looking at you Tesla Core Lib)
			{
				for(let version of this.versions)
				{
					if(dep.availableForVersion(version))
					{
						this.dependencies[version].push(dep);
					}
				}
			}
		}
	}

	private async resolveEverything(id: string, resolveDependencies: boolean): Promise<this>
	{
		await this.resolveID(id);
		await this.resolveURLs();
		if(resolveDependencies)
		{
			await this.resolveDependencies();
		}
		return this;
	}

	public async download(version: string, progressCallback: (((_: IDownloadProgress) => void)|null) = null): Promise<[Buffer, string]>
	{
		const url = this.urls[version];
		if(!url || !this.availableForVersion(version))
			throw new Error("Cannot download a non-existent version of a mod.");
		this._hasBeenDownloaded = true;
		return download(url.downloadURL, progressCallback);
	}

	private static readonly ModLUT: StringMap<CurseforgeMod|null> = {};
	public static async fromID(id: string, versions: string[], resolveDependencies: boolean = true) : Promise<CurseforgeMod|null>
	{
		if(this.ModLUT[id] === undefined)
		{
			this.ModLUT[id] = null; // fucking circular dependencies (I'm looking at you Tesla Core Lib)
			let mod = this.ModLUT[id] = await new CurseforgeMod(versions).resolveEverything(id, resolveDependencies);
			this.ModLUT[mod.id] = mod; // in case we were redirected somewhere else?
		}
		else if(this.ModLUT[id] === null)
			return null;
		return this.ModLUT[id];
	}
}
