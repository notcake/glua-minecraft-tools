import * as fs from "fs";

import { packModId, unpackModId } from "./utils";

export type ModEntry = {
	fileName: string;
	url:      string;
	version:  string;
	sha256:   string;
}

export class ModManifest
{
	private mods: { [_: string]: ModEntry } = {};

	public constructor()
	{
	}

	public addMod(namespace: string, id: string, fileName: string, url: string, version: string, sha256: string)
	{
		this.updateMod(namespace, id, fileName, url, version, sha256);
	}

	public containsMod(namespace: string, id: string): boolean
	{
		return this.mods[packModId(namespace, id)] != null;
	}

	public getMods(): [string, string][]
	{
		return Object.keys(this.mods).map(x => unpackModId(x));
	}

	public getModFileName(namespace: string, id: string): string|null
	{
		const modEntry = this.mods[packModId(namespace, id)];
		return modEntry != null ? modEntry.fileName : null;
	}

	public getModVersion(namespace: string, id: string): string|null
	{
		const modEntry = this.mods[packModId(namespace, id)];
		return modEntry != null ? modEntry.version : null;
	}

	public getModFileSHA256(namespace: string, id: string): string|null
	{
		const modEntry = this.mods[packModId(namespace, id)];
		return modEntry != null ? modEntry.sha256 : null;
	}

	public removeMod(namespace: string, id: string)
	{
		delete this.mods[packModId(namespace, id)];
	}

	public updateMod(namespace: string, id: string, fileName: string, url: string, version: string, sha256: string)
	{
		this.mods[packModId(namespace, id)] = {
			fileName: fileName,
			url:      url,
			version:  version,
			sha256:   sha256
		};
	}

	public save(path: string)
	{
		fs.writeFileSync(path, JSON.stringify(this.mods, null, 4));
	}

	public static fromFile(path: string): ModManifest|null
	{
		try
		{
			const json = fs.readFileSync(path, "utf-8");
			return ModManifest.fromJson(json);
		}
		catch (e)
		{
			if (e.code == "ENOENT") { return null; }

			throw e;
		}
	}

	public static fromJson(json: string): ModManifest
	{
		const manifest = new ModManifest();

		const mods = JSON.parse(json);
		for (const fullId in mods)
		{
			const [namespace, id] = unpackModId(fullId);

			manifest.addMod(
				namespace,
				id,
				mods[fullId]["fileName"],
				mods[fullId]["url"],
				mods[fullId]["version"],
				mods[fullId]["sha256"]
			);
		}

		return manifest;
	}
}