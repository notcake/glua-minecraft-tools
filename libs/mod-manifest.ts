import * as fs from "fs";

export type ModEntry = {
	fileName: string;
	url:      string;
	version:  string;
	md5:      string;
	sha256:   string;
}

export class ModManifest
{
	private mods: { [_: string]: ModEntry } = {};

	public constructor()
	{
	}
	
	public addMod(namespace: string, id: string, fileName: string, url: string, version: string, md5: string, sha256: string)
	{
		this.updateMod(namespace, id, fileName, url, version, md5, sha256);
	}
	
	public containsMod(namespace: string, id: string): boolean
	{
		return this.mods[namespace + ":" + id] != null;
	}

	public getMod(namespace: string, id: string): ModEntry|null
	{
		return this.mods[namespace + ":" + id];
	}
	
	public removeMod(namespace: string, id: string)
	{
		delete this.mods[namespace + ":" + id];
	}
	
	public updateMod(namespace: string, id: string, fileName: string, url: string, version: string, md5: string, sha256: string)
	{
		this.mods[namespace + ":" + id] = {
			fileName: fileName,
			url: url,
			version: version,
			md5: md5,
			sha256: sha256
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
		for (let fullId in mods)
		{
			const namespace = fullId.substring(0, fullId.indexOf(":"));
			const id        = fullId.substring(fullId.indexOf(":") + 1);

			manifest.addMod(
				namespace,
				id,
				mods[fullId]["fileName"],
				mods[fullId]["url"],
				mods[fullId]["version"],
				mods[fullId]["md5"],
				mods[fullId]["sha256"]
			);
		}

		return manifest;
	}
}