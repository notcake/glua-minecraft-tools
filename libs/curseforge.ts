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

	public availableForVersion(version: string)
	{
		return !!this.urls[version];
	}

	private dependencies: { [_: string]: Mod[] } = {};
	public async getDependencies(version: string): Promise<Mod[]>
	{
		if(this.dependencies[version] === undefined)
		{
			const body: string = await request.get(`https://minecraft.curseforge.com/projects/${this.id}/relations/dependencies?filter-related-dependencies=3`);
			if(!body) { throw new Error(`Unable to resolve dependencies for ${this.id}.`); }

			this.dependencies[version] = [];
			const urls = body.match(/<a href="https:\/\/minecraft\.curseforge\.com\/projects\/([^"]+)">/g);
			if(!urls) { return []; } // No dependencies

			const ids: string[] = urls.map(url => url.match(/\/projects\/([^"]+)">$/)![1]);
			for(let id of ids)
			{
				let dep: Mod|null = await Mod.fromID(id, [version]);
				// null is returned when there are circular dependencies
				if(dep !== null && dep.availableForVersion(version))
				{
					this.dependencies[version].push(dep);
				}
			}
		}

		return this.dependencies[version];
	}

	private flattenedDependencies: { [_: string]: Mod[] } = {};
	public async getFlattenedDependencies(version: string): Promise<Mod[]>
	{
		if(this.flattenedDependencies[version] === undefined)
		{
			this.flattenedDependencies[version] = [];
			if(this.availableForVersion(version))
			{
				for(let dependency of await this.getDependencies(version))
				{
					this.flattenedDependencies[version].push(dependency);
					let dependencies: Mod[] = await dependency.getFlattenedDependencies(version);
					this.flattenedDependencies[version].push(...dependencies);
				}
			}
		}

		return this.flattenedDependencies[version];
	}


	private async initialize(id: string, versions: string[]): Promise<void>
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

		// Resolve all urls
		this.urls = {};
		for (let version of versions)
		{
			const body = await request.get(`https://minecraft.curseforge.com/projects/${this.id}/files?filter-game-version=${versionMap[version]}`);
			const regex = /\/projects\/[^\/]+\/files\/([0-9]+)\/download/;
			const match = body.match(regex);
			if (match === null){ continue; }
			this.urls[version] = `https://minecraft.curseforge.com/projects/${this.id}/files/${match[1]}`;
		}
	}

	private static readonly ModLUT: { [_: string]: Mod|null } = {};
	public static async fromID(id: string, versions: string[]) : Promise<Mod|null>
	{
		if(this.ModLUT[id] === undefined)
		{
			// circular dependencies (I'm looking at you Tesla Core Lib)
			this.ModLUT[id] = null;
			let mod = this.ModLUT[id] = new Mod();
			// also add with the mod's final ID in case we were redirected somewhere else
			this.ModLUT[mod.id] = mod;

			await mod.initialize(id, versions);
		}
		else if(this.ModLUT[id] === null)
			return null;
		return this.ModLUT[id];
	}
}
