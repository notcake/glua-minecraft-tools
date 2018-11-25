import * as fs from "fs";
import * as path from "path";

import { Document } from "./libs/markdown";
import { isForgeInstalled, installForge, getInstalledForgeVersion } from "./libs/forgemod";
import { WhitelistTable } from "./libs/whitelist-table";
import { Whitelist } from "./libs/minecraft";
import { parseArguments, readUri, toSet } from "./libs/utils";

async function main(argc: number, argv: string[])
{
	const [fixedArguments, mapArguments] = parseArguments(argc, argv);
	let argumentsValid = fixedArguments.length == 3;
	if (!argumentsValid)
	{
		console.error("Usage: ts-node setup-server.ts <directory> <version> <mods-and-players.md> [--forge-version version]");
		process.exit(1);
	}

	const serverDirectory = fixedArguments[0];
	const version         = fixedArguments[1];
	const markdownUri     = fixedArguments[2];
	let forgeVersion: string|null = mapArguments["forge-version"];

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
	if (!isForgeInstalled(serverDirectory, version))
	{
		console.log("Forge: Installing forge at " + serverDirectory + "...");
		forgeVersion = await installForge(serverDirectory, version, forgeVersion, x => console.log("Forge: " + x));
	}
	else
	{
		console.log("Forge: Already installed at " + serverDirectory + ".");
		forgeVersion = getInstalledForgeVersion(serverDirectory);
	}

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
				console.log("Whitelist: " + whitelist.getUserUuid(name) + ": " + name + " is already present.");
				continue;
			}

			const success = await whitelist.addUser(name);
			if (!success)
			{
				console.error("Whitelist: Could not resolve user " + name + "!");
				continue;
			}

			console.log("Whitelist: " + whitelist.getUserUuid(name) + ": " + name);
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
		console.log("Whitelist: Wrote " + serverDirectory + "/whitelist.json");
	}

	// 
	const setup = "ts-node setup-server.ts \"" + path.resolve(serverDirectory) + "\" " + version + " \"" + markdownUri + "\" --forge-version " + forgeVersion;
	console.log("");
	console.log("To repeat this install, run");
	console.log("    " + setup);
	fs.writeFileSync(serverDirectory + "/glua-minecraft-tools-command", setup + "\n");
}

main(process.argv.length, process.argv);
