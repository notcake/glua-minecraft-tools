import * as crypto from "crypto";
import * as fs from "fs";
import * as request from "request-promise";

const requestProgress = require("request-progress");

import { ITable } from "./markdown";
import { ModManifest } from "./mod-manifest";
import { getCurseforgeFileId } from "./curseforge";
import { getModTables, ModTable } from "./mod-table";
import { packModId, unpackModId, sanitizeFileName } from "./utils";

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
			let reqState = request(
				url,
				{ encoding: null },
				(err, result, body) =>
				{
					if(err) { reject(err); return; }

					if (result.statusCode !== 200) { reject("Non-200 status code returned"); return; }

					const fileName = result.request.uri.href.split("/").pop() as string;
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

function hash(hash: string, data: Buffer): string
{
	return crypto.createHash(hash).update(data).digest("hex");
}

export async function downloadMods(modTables: ITable[], minecraftVersion: string, modDirectory: string, manifestPath: string, log: (_: string) => void): Promise<void>
{
	const manifest = ModManifest.fromFile(manifestPath) || new ModManifest();

	// Create mods/ directory
	if (!fs.existsSync(modDirectory))
	{
		log("Creating " + modDirectory + "...");
		fs.mkdirSync(modDirectory);
	}

	const enabledMods: { [_: string]: true } = {};

	for (let table of modTables)
	{
		const modTable = new ModTable(table);
		const modCount = modTable.getModCount();
		for (let i = 0; i < modCount; i++)
		{
			let progress = (i + 1).toString();
			progress = " ".repeat(Math.max(0, modCount.toString().length - progress.length)) + progress;
			progress = "[" + progress + "/" + modCount.toString() + "]";
			
			const [namespace, id] = modTable.getModId(i)!;
			
			// Check if enabled
			if (!modTable.isModEnabled(i))
			{
				log(progress + "   " + packModId(namespace, id) + ": Skipping.");
				continue;
			}

			enabledMods[packModId(namespace, id)] = true;

			// Get download URL
			const url = modTable.getModUrl(i, minecraftVersion);
			if (url == null)
			{
				log(progress + " ! " + packModId(namespace, id) + ": No download URL for Minecraft " + minecraftVersion + " found!");
				continue;
			}

			let downloadUrl: string|null = null;
			let version: string|null = null;
			switch (namespace)
			{
				case "curseforge":
					downloadUrl = url + "/download";
					version = getCurseforgeFileId(url);
					break;
				case "url":
					downloadUrl = url;
					version = url;
					break;
				default:
					log(progress + " ! " + packModId(namespace, id) + ": Cannot derive download URL!");
					break;
			}

			// Bail if no download URL found
			if (downloadUrl == null || version == null)
			{
				log(progress + " ! " + packModId(namespace, id) + ": Unable to download!");
				continue;
			}

			// Download new version
			const existingFileName = manifest.getModFileName(namespace, id);
			if (manifest.getModVersion(namespace, id) != version ||
			    (existingFileName != null && !fs.existsSync(modDirectory + "/" + existingFileName)))
			{
				// Remove existing jar
				if (existingFileName != null)
				{
					try
					{
						fs.unlinkSync(modDirectory + "/" + existingFileName);
						log(progress + " - " + packModId(namespace, id) + " " + existingFileName);
					}
					catch (e)
					{
						if (e.code != "ENOENT") { throw e; }
					}
				}
				
				// Download new jar
				let [data, fileName] = await download(downloadUrl);
				fileName = sanitizeFileName(fileName);
				fs.writeFileSync(modDirectory + "/" + fileName, data);
				log(progress + " + " + packModId(namespace, id) + " " + fileName);
				
				manifest.updateMod(namespace, id, fileName, downloadUrl, version, hash("sha256", data));
				manifest.save(manifestPath);
			}
			else
			{
				log(progress + "   " + packModId(namespace, id) + " " + existingFileName);
			}
		}
	}

	// Remove disabled mods
	for (let [namespace, id] of manifest.getMods())
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
