// curseforge tools
// a common file containing the API to interact with the curseforge site
import * as request from "request-promise";
const fakeUserAgent = require("fake-useragent");

const versionMap : { [_: string]: string } = {
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

export function getCurseforgeFileId(url: string): string|null
{
	const match = url.match(/\/([0-9]+)$/);
	return match != null ? match[1] : null;
}

export class Mod
{
	public id: string;
	public urls: { [_: string]: string };

	public constructor(urls: { [_: string]: string })
	{
		this.urls = urls;
	}

	public isAvailableForVersion(version: string)
	{
		return !!this.urls[version];
	}

	private dependencies: { [_: string]: Mod[] } = {};
	public async getDependencies(version: string): Promise<Mod[]>
	{
		if (this.dependencies[version] === undefined)
		{
			const body: string = await request.get(`https://minecraft.curseforge.com/projects/${this.id}/relations/dependencies?filter-related-dependencies=3`);
			if (!body) { throw new Error(`Unable to resolve dependencies for ${this.id}.`); }

			// set this at the start so that circular dependencies don't cause a loop
			// (not sure if someone can set their own mod as a dependency of itself
			// but there shouldn't be any harm in doing this)
			this.dependencies[version] = [];
			const urls = body.match(/<a href="https:\/\/minecraft\.curseforge\.com\/projects\/([^"]+)">/g);
			if (!urls) { return []; } // No dependencies

			const ids: string[] = urls.map(url => url.match(/\/projects\/([^"]+)">$/)![1]);
			for (const id of ids)
			{
				// Retrieve the URL for the version that we're gathering dependencies for
				const dep: Mod = await Mod.fromID(id);
				const newUrl = await dep.getCurseforgeUrlForVersion(version);
				if (newUrl !== null)
				{
					dep.urls[version] = newUrl;
					this.dependencies[version].push(dep);
				}
			}
		}

		return this.dependencies[version];
	}

	private flattenedDependencies: { [_: string]: Mod[] } = {};
	public async getFlattenedDependencies(version: string): Promise<Mod[]>
	{
		if (this.flattenedDependencies[version] === undefined)
		{
			// set it to an empty array at the start so that
			// circular dependencies don't cause an infinite loop
			this.flattenedDependencies[version] = [];
			if (this.isAvailableForVersion(version))
			{
				for (let dependency of await this.getDependencies(version))
				{
					this.flattenedDependencies[version].push(dependency);
					let dependencies: Mod[] = await dependency.getFlattenedDependencies(version);
					this.flattenedDependencies[version].push(...dependencies);
				}
			}
		}

		return this.flattenedDependencies[version];
	}

	public async getCurseforgeUrlForVersion(version: string): Promise<string|null>
	{
		const body = await request.get(`https://minecraft.curseforge.com/projects/${this.id}/files?filter-game-version=${versionMap[version]}`);
		const regex = /\/projects\/[^\/]+\/files\/([0-9]+)\/download/;
		const match = body.match(regex);
		if (match === null) { return null; }
		return `https://minecraft.curseforge.com/projects/${this.id}/files/${match[1]}`;
	}

	public async getCurseforgeUrls(versions: string[]): Promise<{ [_: string]: string }>
	{
		const urls: { [_: string]: string } = {};
		for (const version in versions)
		{
			const url = await this.getCurseforgeUrlForVersion(version);
			if (url !== null) { urls[version] = url; }
		}
		return urls;
	}

	private async initialize(id: string): Promise<void>
	{
		// Follow redirect
		const body = await request.get(`https://minecraft.curseforge.com/projects/${id}`);
		if (!body) { throw new Error(`Invalid curseforge mod id: ${id}!`); }
		const regex = /<meta property="og:url" content="https:\/\/minecraft.curseforge.com\/projects\/([^"]+)" \/>/;
		const match = body.match(regex);
		if (match != null) { id = match[1]; }
		this.id = id;
	}

	private static readonly ModLUT: { [_: string]: Mod } = {};
	public static async fromID(id: string, existingUrls: { [_: string]: string } = {}) : Promise<Mod>
	{
		if (this.ModLUT[id] === undefined)
		{
			let mod = this.ModLUT[id] = new Mod(existingUrls);
			// also add with the mod's final ID in case we were redirected somewhere else
			this.ModLUT[mod.id] = mod;

			await mod.initialize(id);
		}

		return this.ModLUT[id];
	}
}
