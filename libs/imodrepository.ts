export interface IModRepository
{
	readonly name: string;

	getMinecraftVersions(): Promise<string[]>;

	getModUrl(id: string): string;
	parseModUrl(url: string): string|null;

	getLatestModReleaseId(id: string, minecraftVersion: string): Promise<string|null>;
	getModReleaseUrl(id: string, releaseId: string): string;
	getModReleaseDownloadUrl(id: string, releaseId: string): Promise<string|null>;
	parseModReleaseUrl(url: string): [string, string]|null;
}
