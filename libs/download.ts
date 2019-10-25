import * as fs from "fs";
import * as request from "request-promise";

const requestProgress = require("request-progress");

import { ITable } from "./markdown";
import { ModManifest } from "./mod-manifest";
import { ModTable } from "./mod-table";
import { sha256, packModId, sanitizeFileName } from "./utils";
import { ConcurrentManager } from "./concurrency";

export interface IDownloadProgress {
	percent: number,            // Overall percent (between 0 to 1)
	speed: number,              // The download speed in bytes/sec
	size: {
		total: number,      // The total payload size in bytes
		transferred: number // The transferred payload size in bytes
	},
	time: {
		elapsed: number,    // The total elapsed seconds since the start (3 decimals)
		remaining: number   // The remaining seconds to finish (3 decimals)
	}
}

export async function download(url: string, progressCallback: ((_: IDownloadProgress) => void)|null = null): Promise<[Buffer, string]>
{
	return new Promise<[Buffer, string]>((resolve, reject) =>
	{
		const reqState = request(
			url,
			{ encoding: null },
			(err, result, body) =>
			{
				if (err) { reject(err); return; }

				if (result.statusCode !== 200) { reject("Non-200 status code returned"); return; }

				let fileName;

				// Try content-disposition first
				const contentDisposition: string = <any> (result.headers["content-disposition"] || result.headers["Content-Disposition"]);
				if (contentDisposition)
				{
					const fileMatch = contentDisposition.match(/filename\*?=(?:(?:['"]([^'"]+))|(?:(\S+)))/);

					if (fileMatch && (fileMatch[1] || fileMatch[2]))
					{
						fileName = (fileMatch[1] || fileMatch[2]) as string;
					}
				}

				// and fallback to last entry in URL
				if (!fileName)
				{
					fileName = result.request.uri.pathname.split("/").pop() as string;
				}

				resolve([body, decodeURIComponent(fileName)]);
			}
		);

		if (progressCallback != null)
		{
			requestProgress(reqState).on("progress", progressCallback);
		}

		reqState.catch(reject);
	}
	);
}

export async function downloadMods(modTables: ITable[], minecraftVersion: string, modDirectory: string, manifestPath: string, log: (_: string) => void): Promise<void>
{
	const concurrency = new ConcurrentManager(5);

	const manifest = ModManifest.fromFile(manifestPath) || new ModManifest();

	// Create mods/ directory
	if (!fs.existsSync(modDirectory))
	{
		log("Creating " + modDirectory + "...");
		fs.mkdirSync(modDirectory);
	}

	const enabledMods: { [_: string]: true } = {};

	for (const table of modTables)
	{
		const modTable = new ModTable(table);
		const modCount = modTable.getModCount();
		for (let i = 0; i < modCount; i++)
		{
			let progress = (i + 1).toString();
			progress = " ".repeat(Math.max(0, modCount.toString().length - progress.length)) + progress;
			progress = "[" + progress + "/" + modCount.toString() + "]";

			const [modRepository, id] = modTable.getModId(i)!;

			// Check if enabled
			if (!modTable.isModEnabled(i))
			{
				log(progress + "   " + packModId(modRepository.name, id) + ": Skipping.");
				continue;
			}

			enabledMods[packModId(modRepository.name, id)] = true;

			// Get download URL
			const release = modTable.getModReleaseId(i, minecraftVersion);
			if (release == null)
			{
				log(progress + " ! " + packModId(modRepository.name, id) + ": No download URL for Minecraft " + minecraftVersion + " found!");
				continue;
			}

			const [modRepositoryOverride, idOverride, releaseId] = release;
			const downloadUrl = await modRepositoryOverride.getModReleaseDownloadUrl(idOverride, releaseId);

			// Bail if no download URL found
			if (downloadUrl == null)
			{
				log(progress + " ! " + packModId(modRepository.name, id) + ": Unable to download!");
				continue;
			}

			// Download new version
			const existingFileName = manifest.getModFileName(modRepository.name, id);
			if (manifest.getModVersion(modRepository.name, id) != releaseId ||
			    (existingFileName != null && !fs.existsSync(modDirectory + "/" + existingFileName)))
			{
				// Remove existing jar
				if (existingFileName != null)
				{
					try
					{
						fs.unlinkSync(modDirectory + "/" + existingFileName);
						log(progress + " - " + packModId(modRepository.name, id) + " " + existingFileName);
					}
					catch (e)
					{
						if (e.code != "ENOENT") { throw e; }
					}
				}

				// Download new jar
				concurrency.queueThread(async () =>
				{
					try
					{
						let [data, fileName] = await download(downloadUrl);
						fileName = sanitizeFileName(fileName);
						fs.writeFileSync(modDirectory + "/" + fileName, data);
						log(progress + " + " + packModId(modRepository.name, id) + " " + fileName);

						manifest.updateMod(modRepository.name, id, fileName, downloadUrl, releaseId, sha256(data));
						manifest.save(manifestPath);
					}
					catch (err)
					{
						if (err == "Non-200 status code returned")
						{
							log(progress + " + " + packModId(modRepository.name, id) + " failed to download. Has the file been deleted from the source?");
						}
						else
						{
							log(progress + " + " + packModId(modRepository.name, id) + " failed to download. " + err.toString());
						}
					}
				}
				);
			}
			else
			{
				log(progress + "   " + packModId(modRepository.name, id) + " " + existingFileName);
			}
		}
	}

	await concurrency.defer();

	// Remove disabled mods
	for (const [namespace, id] of manifest.getMods())
	{
		if (!enabledMods[packModId(namespace, id)])
		{
			const fileName = manifest.getModFileName(namespace, id);
			try
			{
				fs.unlinkSync(modDirectory + "/" + fileName);
			}
			catch (e)
			{
				if (e.code != "ENOENT") { throw e; }
			}
			log("- " + packModId(namespace, id) + " " + fileName);
			manifest.removeMod(namespace, id);
			manifest.save(manifestPath);
		}
	}
}
