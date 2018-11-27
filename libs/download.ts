import * as crypto from "crypto";
import * as fs from "fs";
import * as request from "request-promise";

const requestProgress = require("request-progress");

import { ITable } from "./markdown";
import { ModManifest } from "./mod-manifest";
import { CurseforgeMod } from "./curseforge";
import { ModTable } from "./mod-table";
import { packModId, sanitizeFileName } from "./utils";

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

function hashFile(hash: string, path: fs.PathLike): Promise<string>
{
	return new Promise((resolve, fail) =>
	{
		const hashInstance = crypto.createHash(hash);
		const stream = fs.createReadStream(path);
		stream.on('end', _ =>
		{
			stream.close();
			resolve(hashInstance.digest('hex'));
		});
		stream.pipe(hashInstance);
	});
}

async function downloadCurseforgeMod(enabledMods: { [_: string]: true }, manifestPath: string, manifest: ModManifest, minecraftVersion: string, namespace: string, mod: CurseforgeMod, modDirectory: string, progress: string, log: (_: string) => void)
{
	// Download new version
	const version = mod.urls[minecraftVersion]!.fileId;
	const downloadUrl = mod.urls[minecraftVersion]!.downloadURL;
	const isDependency = progress.lastIndexOf('[') !== 0;

	if(isDependency)
		enabledMods[packModId(namespace, mod.id)] = true;

	const existingFileName = manifest.getModFileName(namespace, mod.id);
	if (mod.hasBeenDownloaded || manifest.getModVersion(namespace, mod.id) != version ||
		(existingFileName != null && (!fs.existsSync(modDirectory + "/" + existingFileName) ||
			await hashFile("sha256", `${modDirectory}/${existingFileName}`) != manifest.getModFileSHA256(namespace, mod.id))))
	{
		// Remove existing jar
		if (existingFileName != null)
		{
			try
			{
				fs.unlinkSync(modDirectory + "/" + existingFileName);
				log(progress + " - " + packModId(namespace, mod.id) + " " + existingFileName);
			}
			catch (e)
			{
				if (e.code != "ENOENT") { throw e; }
			}
		}

		// Download new jar
		let [data, fileName] = await download(mod.urls[minecraftVersion]!.downloadURL);
		fileName = sanitizeFileName(fileName);
		fs.writeFileSync(modDirectory + "/" + fileName, data);
		log(progress + " + " + packModId(namespace, mod.id) + " " + fileName);

		manifest.updateMod(namespace, mod.id, fileName, downloadUrl, version, hash("md5", data), hash("sha256", data));
		manifest.save(manifestPath);
	}
	else
	{
		log(progress + "   " + packModId(namespace, mod.id) + " " + existingFileName);
	}

	// Check for dependencies (just in case™)
	const dependencies = mod.dependencies[minecraftVersion];
	if(dependencies && dependencies.length > 0)
	{
		log(progress + "   " + packModId(namespace, mod.id) + ": Downloading dependencies.");
		const dependencyCount = dependencies.length;
		for(let i = 0; i < dependencyCount; i++)
		{
			let dependencyProgress = (i + 1).toString();
			dependencyProgress = " ".repeat(Math.max(0, dependencyCount.toString().length - dependencyProgress.length)) + dependencyProgress;
			dependencyProgress = `${progress}[${dependencyProgress}/${dependencyCount}]`;

			await downloadCurseforgeMod(enabledMods, manifestPath, manifest, minecraftVersion, namespace, dependencies[i], modDirectory, dependencyProgress, log);
		}
	}
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

			switch (namespace)
			{
				case "curseforge":
				{
					const mod = (await CurseforgeMod.fromID(id, [minecraftVersion]))!;
					const url = mod.urls[minecraftVersion];
					if(!url)
					{
						log(`${progress} ! ${packModId(namespace, id)}: No download URL for Minecraft ${minecraftVersion} found!`);
						continue;
					}

					await downloadCurseforgeMod(enabledMods, manifestPath, manifest, minecraftVersion, namespace, mod, modDirectory, progress, log);
					break;
				}
				case "url":
				{
					// Get download URL
					const url = modTable.getModUrl(i, minecraftVersion);
					if (url == null)
					{
						log(progress + " ! " + packModId(namespace, id) + ": No download URL for Minecraft " + minecraftVersion + " found!");
						continue;
					}
					let downloadUrl = url;
					let version = url;

					// Bail if no download URL found
					if (downloadUrl == null || version == null)
					{
						log(progress + " ! " + packModId(namespace, id) + ": Unable to download!");
						continue;
					}

					// Download new version
					const existingFileName = manifest.getModFileName(namespace, id);
					if (manifest.getModVersion(namespace, id) != version ||
						(existingFileName != null && (!fs.existsSync(`${modDirectory}/${existingFileName}`) ||
							await hashFile("sha256", `${modDirectory}/${existingFileName}`) != manifest.getModFileSHA256(namespace, id))))
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

						manifest.updateMod(namespace, id, fileName, downloadUrl, version, hash("md5", data), hash("sha256", data));
						manifest.save(manifestPath);
					}
					else
					{
						log(progress + "   " + packModId(namespace, id) + " " + existingFileName);
					}
					break;
				}
				default:
					log(progress + " ! " + packModId(namespace, id) + ": Cannot derive download URL!");
					break;
			}
		}
	}

	// Remove disabled non-dependency mods
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
			log(" - " + packModId(namespace, id) + " " + fileName);
			manifest.removeMod(namespace, id);
			manifest.save(manifestPath);
		}
	}
}
