import * as fs from "fs";
import * as os from "os";
import * as path from "path";

import { Document } from "./libs/markdown";
import { downloadMods } from "./libs/download";
import { isForgeInstalled, installForge, installLauncher, getInstalledForgeVersion, getLatestForgeVersion, uninstallServer } from "./libs/forgemod";
import { getModTables } from "./libs/mod-table";
import { WhitelistTable } from "./libs/whitelist-table";
import { ServerProperties, Whitelist } from "./libs/minecraft";
import { exec, parseArguments, readUri, toSet } from "./libs/utils";
import { SemanticVersion } from "./libs/semanticversioning";

async function applyConfig(serverDirectory: string, configDirectory: string): Promise<void>
{
	if (configDirectory.indexOf("://") != -1)
	{
		const tempDirectory = fs.mkdtempSync(os.tmpdir() + "/glua-minecraft-config_");
		try
		{
			await exec("git", ["clone", configDirectory, tempDirectory], { env: { GIT_TERMINAL_PROMPT: 0 } });
			await exec("rsync", ["-v", "-r", "--exclude=.*", tempDirectory + "/", serverDirectory + "/"]);
			console.log("Config: Wrote config.");
		}
		finally
		{
			await exec("rm", ["-rf", tempDirectory]);
		}
	}
	else
	{
		await exec("rsync", ["-v", "-r", "--exclude=.*", configDirectory + "/", serverDirectory + "/"]);
	}
}

async function main(argc: number, argv: string[])
{
	const [fixedArguments, mapArguments] = parseArguments(argc, argv);
	if (fixedArguments.length != 3 ||
	    mapArguments["config"] == null)
	{
		console.error("Usage: ts-node setup-server.ts <server-directory> <minecraft-version> <mods-and-players.md> --config <config-directory or git url> [--forge-version version]");
		process.exit(1);
	}

	const serverDirectory  = fixedArguments[0];
	const minecraftVersion = fixedArguments[1];
	const markdownUri      = fixedArguments[2];
	const configDirectory1  = mapArguments["config"];
	const configDirectory2  = mapArguments["config-2"];
	let targetAmalgamatedForgeVersion: string|null = mapArguments["forge-version"];

	const markdownData = await readUri(markdownUri);
	if (markdownData == null)
	{
		console.error("Unable to read from " + markdownUri + "!");
		process.exit(1);
		return;
	}

	const document = Document.fromString(markdownData);
	const whitelistTable = WhitelistTable.fromDocument(document);

	// forge install
	if (!isForgeInstalled(serverDirectory, minecraftVersion))
	{
		console.log("Forge: Installing forge at " + serverDirectory + "...");
		targetAmalgamatedForgeVersion = await installForge(serverDirectory, minecraftVersion, targetAmalgamatedForgeVersion, x => console.log("Forge: " + x));
	}
	else
	{
		let installedAmalgamatedForgeVersion = getInstalledForgeVersion(serverDirectory) || "0.0.0-0.0.0-unknown";

		console.log("Forge: Already installed v" + installedAmalgamatedForgeVersion + " at " + serverDirectory + ".");
		console.log("Forge: Checking for updates...");

		// NB: Forge has not introduced alphabets or additional hyphens into their version strings since 1.7.10-pre4
		// so I believe it is safe to extract version numbers like so:
		let installedVersionExtraction = installedAmalgamatedForgeVersion.match(/^([\d\.]+)\-([\d\.]+)$/);

		if (installedVersionExtraction)
		{
			let installedMinecraftVersion = SemanticVersion.fromString(installedVersionExtraction[1]);
			let installedForgeVersion     = SemanticVersion.fromString(installedVersionExtraction[2], true);

			if (!targetAmalgamatedForgeVersion)
			{
				// no version supplied via cli arguments
				// try and grab the altest
				targetAmalgamatedForgeVersion = await getLatestForgeVersion(minecraftVersion);
			}

			let needsUpdate = false;

			if (targetAmalgamatedForgeVersion)
			{
				// only update if we are able to figure out a candidate target version

				let targetVersionExtraction = targetAmalgamatedForgeVersion.match(/^([\d\.]+)\-([\d\.]+)$/);
				if (targetVersionExtraction)
				{
					let targetMinecraftVersion = SemanticVersion.fromString(targetVersionExtraction[1]);
					let targetForgeVersion     = SemanticVersion.fromString(targetVersionExtraction[2], true);
		
					// using isEqual instead of isAhead in case we want to rewind versions
					if (!targetMinecraftVersion.isEqual(installedMinecraftVersion) || !targetForgeVersion.isEqual(installedForgeVersion))
					{
						needsUpdate = true;
						
						let isUpgrade = targetMinecraftVersion.isAhead(installedMinecraftVersion) || targetForgeVersion.isAhead(installedForgeVersion);
						console.log(`Forge: Version discrepancy detected. ${isUpgrade ? "Upgrading" : "Downgrading"} to version ${targetAmalgamatedForgeVersion}.`);
					}
				}
			}

			if (needsUpdate)
			{
				console.log("Forge: Uninstalling existing versions of Forge...");

				let uninstallSuccess = uninstallServer(serverDirectory, x => console.log("Forge: " + x));

				if (uninstallSuccess)
				{
					console.log("Forge: Re-installing forge at " + serverDirectory + "...");
					targetAmalgamatedForgeVersion = await installForge(serverDirectory, minecraftVersion, targetAmalgamatedForgeVersion, x => console.log("Forge: " + x));

					console.log("Forge: Update complete!")
				}
				else
				{
					console.log("Forge: Aborting update.")
				}
			}
			else
			{
				console.log("Forge: Installation is up-to-date!");
			}
		}
		else
		{
			// NB: updater should auto abort if we were unable to parse the amaglamated Forge version
			console.log("Forge: Unable to extract version data. Aborting Forge update.");
		}
	}

	// launcher
	await installLauncher(serverDirectory, x => console.log("Launcher: " + x));

	// eula.txt
	if (!fs.existsSync(serverDirectory + "/eula.txt") ||
	    fs.readFileSync(serverDirectory + "/eula.txt", "utf-8").indexOf("eula=true\n") == -1)
	{
		console.log("EULA: Writing eula.txt...");
		fs.writeFileSync(serverDirectory + "/eula.txt", "eula=true\n");
	}
	else
	{
		console.log("EULA: eula.txt is already configured.");
	}

	// whitelist
	if (whitelistTable != null)
	{
		const whitelistPath = serverDirectory + "/whitelist.json";
		const whitelist = Whitelist.fromFile(whitelistPath) || new Whitelist();
		const whitelistNames = whitelistTable.getWhitelistedNames();
		for (let name of whitelistNames)
		{
			if (whitelist.containsUser(name))
			{
				console.log("Whitelist: " + whitelist.getUserUuid(name) + ": " + name + " already present.");
				continue;
			}

			const success = await whitelist.addUser(name);
			if (!success)
			{
				console.error("Whitelist: Could not resolve user " + name + "!");
				continue;
			}

			console.log("Whitelist: " + whitelist.getUserUuid(name) + ": " + name + " added.");
		}

		const whitelistNamesSet = toSet(whitelistNames);
		for (let name of whitelist.getUsers())
		{
			if (whitelistNamesSet[name] == null)
			{
				console.log("Whitelist: User " + name + " is whitelisted but not present in the markdown!");
			}
		}
		whitelist.save(whitelistPath);
		console.log("Whitelist: Wrote " + whitelistPath);
	}

	// server.properties
	const serverPropertiesPath = serverDirectory + "/server.properties";
	const serverProperties = ServerProperties.fromFile(serverPropertiesPath) || new ServerProperties();
	let serverPropertiesNeedsSaving = false;
	function set(key: string, value: string)
	{
		if (serverProperties.get(key) == value)
		{
			console.log("Properties: " + key + " already set to " + value);
			return;
		}

		serverProperties.set(key, value);
		console.log("Properties: Setting " + key + " to " + value);
		serverPropertiesNeedsSaving = true;
	}
	set("max-tick-time", "120000");
	set("allow-flight", "true");
	set("level-type", "BIOMESOP");
        set("max-players", "30");
	set("white-list", "true");

	// disable spawn protection
	set("spawn-protection", "0");

	if (serverPropertiesNeedsSaving)
	{
		serverProperties.save(serverPropertiesPath);
		console.log("Properties: Wrote " + serverPropertiesPath);
	}

	// mods
	await downloadMods(getModTables(document), minecraftVersion, serverDirectory + "/mods", serverDirectory + "/glua-minecraft-tools-manifest.json", x => console.log("Mods: " + x));

	// config
	await applyConfig(serverDirectory, configDirectory1);
	if (configDirectory2 != null)
	{
		await applyConfig(serverDirectory, configDirectory2);
	}

	let setup = "ts-node setup-server.ts \"" + path.resolve(serverDirectory) + "\" " + minecraftVersion + " \"" + markdownUri + "\" --config \"" + configDirectory1 + "\"";
	if (configDirectory2 != null)
	{
		setup += " --config-2 \"" + configDirectory2 + "\"";
	}
	setup += " --forge-version " + targetAmalgamatedForgeVersion;
	console.log("");
	console.log("To repeat this install, run");
	console.log("    " + setup);
	fs.writeFileSync(serverDirectory + "/glua-minecraft-tools-command", setup + "\n");
}

main(process.argv.length, process.argv);
