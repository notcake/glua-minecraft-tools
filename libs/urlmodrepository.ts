import { IModRepository } from "./imodrepository";

export class UrlModRepository implements IModRepository
{
	public readonly name = "url";

	public constructor()
	{
	}

	// IModRepository
	public async getMinecraftVersions(): Promise<string[]>
	{
		return ["1.7.10", "1.10.2", "1.11.2", "1.12.2", "1.14.4"];
	}

	public getModUrl(id: string): string
	{
		return id;
	}

	public parseModUrl(url: string): string|null
	{
		return url;
	}

	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	public async getLatestModReleaseId(id: string, minecraftVersion: string): Promise<string|null>
	{
		return id;
	}

	public getModReleaseUrl(id: string, releaseId: string): string
	{
		return releaseId;
	}

	public async getModReleaseDownloadUrl(slug: string, releaseId: string): Promise<string|null>
	{
		return releaseId;
	}

	public parseModReleaseUrl(url: string): [string, string]|null
	{
		return [url, url];
	}
}
