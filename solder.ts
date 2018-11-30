import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";

import * as https from "https";

const express = require("express");

import { getInstalledForgeFileName, getInstalledMinecraftVersion } from "./libs/forgemod";
import { ModManifest } from "./libs/mod-manifest";
import { exec, md5, sha256, parseArguments } from "./libs/utils";

export type ModEntry = {
	name:     string;
	version:  string;
	md5:      string;
	filesize: string;
	url:      string;
};

export class Modpack
{
	private id: string;
	private name: string;

	private baseUrl: string;

	private serverDirectory: string;
	private manifestPath: string;

	private manifestTimestamp: Date|null = null;
	private minecraftVersion: string|null;
	private mods: ModEntry[] = [];
	private blobs: { [_: string]: Buffer } = {};
	private version: string;

	public constructor(id: string, name: string, baseUrl: string, serverDirectory: string)
	{
		this.id   = id;
		this.name = name;

		this.baseUrl = baseUrl;

		this.serverDirectory = serverDirectory;
		this.manifestPath = this.serverDirectory + "/glua-minecraft-tools-manifest.json";
	}
	
	public getInfo(): { [_: string]: any }
	{
		return {
			name:           this.id,
			display_name:   this.name,
			url:            null,
			icon:           null,
			icon_md5:       null,
			logo:           null,
			logo_md5:       null,
			background:     "https://i.imgur.com/Qg9LfeK.png",
			background_md5: null,
			recommended:    this.version,
			latest:         this.version,
			builds:         [this.version]
		};
	}

	public getVersion(): string
	{
		return this.version;
	}

	public getMinecraftVersion(): string|null
	{
		return this.minecraftVersion;
	}

	public getBlob(sha256: string): Buffer|null
	{
		return this.blobs[sha256];
	}
	
	public getMods(): ModEntry[]
	{
		return this.mods;
	}

	private updateTask: Promise<void>|null = null;
	public async update(): Promise<void>
	{
		const manifestInfo = fs.statSync(this.manifestPath);
		if (this.manifestTimestamp != null &&
		    manifestInfo.mtime.getTime() == this.manifestTimestamp.getTime()) { return; }

		if (this.updateTask == null)
		{
			this.updateTask = this._update();
		}

		await this.updateTask;
		this.updateTask = null;
	}

	private async _update(): Promise<void>
	{
		const manifestInfo = fs.statSync(this.manifestPath);
		const manifestTimestamp = manifestInfo.mtime;
		
		console.log("Updating modpack...");
		this.minecraftVersion = getInstalledMinecraftVersion(this.serverDirectory);

		const tempDirectory = fs.mkdtempSync(os.tmpdir() + "/glua_solder_");
		try
		{
			const versionHash = crypto.createHash("sha256");
			const mods: ModEntry[] = [];
			const blobs: { [_: string]: Buffer } = {};

			// Mods
			const manifest = ModManifest.fromFile(this.manifestPath)!;
			for (let [namespace, id] of manifest.getMods())
			{
				const fileName = manifest.getModFileName(namespace, id)!;
				const sha256   = manifest.getModFileSHA256(namespace, id)!;
				versionHash.update(sha256);

				if (this.blobs[sha256] == null)
				{
					const zipPath = tempDirectory + "/" + sha256 + ".zip";
					await exec("zip", [zipPath, "mods/" + fileName], { cwd: this.serverDirectory });

					blobs[sha256] = fs.readFileSync(zipPath);
					fs.unlinkSync(zipPath);
				}
				else
				{
					blobs[sha256] = this.blobs[sha256];
				}

				mods.push({
					name:     namespace + "_" + id,
					version:  sha256.substring(0, 16),
					md5:      md5(blobs[sha256]),
					filesize: blobs[sha256].length.toString(),
					url:      this.baseUrl + "download/" + sha256 + ".zip"
				});
			}

			// Forge
			{
				const forgePath = this.serverDirectory + "/" + getInstalledForgeFileName(this.serverDirectory);
				fs.mkdirSync(tempDirectory + "/bin");
				fs.copyFileSync(forgePath, tempDirectory + "/bin/modpack.jar");

				await exec("unzip", ["modpack.jar", "version.json"], { cwd: tempDirectory + "/bin" });

				const zipPath = tempDirectory + "/forge.zip";
				await exec("zip", ["-r", zipPath, "bin/"], { cwd: tempDirectory });

				fs.unlinkSync(tempDirectory + "/bin/modpack.jar");
				fs.unlinkSync(tempDirectory + "/bin/version.json");
				fs.rmdirSync(tempDirectory + "/bin");

				const blob = fs.readFileSync(zipPath);
				fs.unlinkSync(zipPath);
				const forgeSHA256 = sha256(blob);

				blobs[forgeSHA256] = blob;
				mods.push({
					name:     "_forge",
					version:  forgeSHA256.substring(0, 16),
					md5:      md5(blobs[forgeSHA256]),
					filesize: blobs[forgeSHA256].length.toString(),
					url:      this.baseUrl + "download/" + forgeSHA256 + ".zip"
				});
			}

			// Config
			if (fs.existsSync(this.serverDirectory + "/config"))
			{
				await exec("cp", ["-r", this.serverDirectory + "/config", tempDirectory + "/config"]);
				await exec("rm", ["-rf", tempDirectory + "/config/shadowfacts/DiscordChat"]);
				const zipPath = tempDirectory + "/config.zip";
				await exec("zip", ["-r", zipPath, "config"], { cwd: tempDirectory });
				await exec("rm", ["-rf", tempDirectory + "/config"]);

				const blob = fs.readFileSync(zipPath);
				fs.unlinkSync(zipPath);
				const configSHA256 = sha256(blob);

				blobs[configSHA256] = blob;
				mods.push({
					name:     "_config",
					version:  configSHA256.substring(0, 16),
					md5:      md5(blobs[configSHA256]),
					filesize: blobs[configSHA256].length.toString(),
					url:      this.baseUrl + "download/" + configSHA256 + ".zip"
				});
			}

			// Commit
			this.version = versionHash.digest("hex").substring(0, 16);
			this.manifestTimestamp = manifestTimestamp;
			this.mods    = mods;
			this.blobs   = blobs;
		}
		finally
		{
			fs.rmdirSync(tempDirectory);
		}
		console.log("Updated to version " + this.version + ".");
	}
}

async function main(argc: number, argv: string[])
{
	const [fixedArguments, mapArguments] = parseArguments(argc, argv);
	if (fixedArguments.length != 4)
	{
		console.error("Usage: ts-node solder.ts <modpack-id> <modpack-name> <base-url> <server-directory> --port <port> [--key <host.key> --cert <host.crt>]");
		process.exit(1);
	}

	const modpackId        = fixedArguments[0];
	const modpackName      = fixedArguments[1];
	let baseUrl            = fixedArguments[2];
	const serverDirectory  = fixedArguments[3];

	if (!baseUrl.endsWith("/"))
	{
		baseUrl += "/";
	}

	const modpack = new Modpack(modpackId, modpackName, baseUrl, serverDirectory);
	
	const app = express();
	app.set("json spaces", 4);
	app.use((request, response, next) =>
		{
			console.log(request.method + " " + request.url);

			next();
		}
	);

	app.get("/api/", (request, response) =>
		{
			response.json({
				api:     "TechnicSolder",
				version: "v0.7.4.0",
				stream:  "DEV"
			});
		}
	);

	app.get("/api/verify/:apiKey([0-9a-fA-F]+)", (request, response) =>
		{
			response.json({
				valid: "Key validated."
			});
		}
	);

	app.get("/api/modpack/", async (request, response) =>
		{
			if (request.query["include"] == "full")
			{
				await modpack.update();

				response.json({
					modpacks: { [modpackId]: modpack.getInfo() },
					mirror_url: baseUrl
				});
			}
			else
			{
				response.json({
					modpacks: { [modpackId]: modpackName },
					mirror_url: baseUrl
				});
			}
		}
	);

	app.get("/api/modpack/" + modpackId + "/", async (request, response) =>
		{
			await modpack.update();

			response.json(modpack.getInfo());
		}
	);

	app.get("/api/modpack/" + modpackId + "/:version([0-9a-fA-F]+)", async (request, response) =>
		{
			await modpack.update();

			const version = request.params["version"];
			if (version != modpack.getVersion())
			{
				response.json({
					error: "Build does not exist"
				});
				return;
			}

			response.json({
				minecraft: modpack.getMinecraftVersion(),
				java:      "1.8",
				memory:    "0",
				forge:     null,
				mods:      modpack.getMods()
			});
		}
	);

	app.get("/download/:sha256([0-9a-fA-F]+).zip", (request, response) =>
		{
			const sha256 = request.params["sha256"];
			if (modpack.getBlob(sha256) == null)
			{
				response.status(404);
				response.end();
				return;
			}

			response.end(modpack.getBlob(sha256));
		}
	);

	await modpack.update();

	if (mapArguments["key"] != null &&
	    mapArguments["cert"] != null)
	{
		const port = mapArguments["port"] || 443;

		const httpsOptions = {
			key:  fs.readFileSync(mapArguments["key"]),
			cert: fs.readFileSync(mapArguments["cert"])
		};
		https.createServer(httpsOptions, app).listen(port);
		console.log("Listening on port " + port.toString() + " (https) ...");
	}
	else
	{
		const port = mapArguments["port"] || 80;
		app.listen(port);
		console.log("Listening on port " + port.toString() + " (http) ...");
	}
}

main(process.argv.length, process.argv);
