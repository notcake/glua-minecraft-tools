import * as fs from "fs";

import * as request from "request-promise";

import { download } from "./download";
import { exec, sanitizeFileName } from "./utils";

export function isForgeInstalled(directory: string, minecraftVersion: string): boolean
{
	return fs.existsSync(directory + "/minecraft_server." + minecraftVersion + ".jar");
}

export async function getLatestForgeVersion(minecraftVersion: string): Promise<string|null>
{
	const url = "https://files.minecraftforge.net/maven/net/minecraftforge/forge/index_" + minecraftVersion + ".html";
	const data = await request.get(url);
	const urlMatch = data.match(/https?:\/\/files.minecraftforge.net\/[^"]+forge-([^"]+)-installer\.jar/);
	if (urlMatch == null) { return null; }

	return urlMatch[1];
}

export function getInstalledForgeVersion(directory: string): string|null
{
	const fileName = getInstalledForgeFileName(directory);
	if (fileName == null) { return null; }

	const match = fileName.match(/forge-(.+?)-universal\.jar/);
	return match != null ? match[1] : null;
}

export function getInstalledForgeFileName(directory: string): string|null
{
	const files = fs.readdirSync(directory);
	for (let fileName of files)
	{
		const match = fileName.match(/forge-.+?-universal\.jar/);
		if (match == null) { continue; }

		return match[0];
	}

	return null;
}

export function getInstalledMinecraftVersion(directory: string): string|null
{
	const files = fs.readdirSync(directory);
	for (let fileName of files)
	{
		const match = fileName.match(/minecraft_server\.(.+?)\.jar/);
		if (match == null) { continue; }

		return match[1];
	}

	return null;
}

export async function installForge(directory: string, minecraftVersion: string, forgeVersion: string|null, log: (_: string) => void): Promise<string|null>
{
	if (!fs.existsSync(directory))
	{
		log("Creating " + directory + "...");
		fs.mkdirSync(directory);
	}

	if (forgeVersion == null)
	{
		forgeVersion = await getLatestForgeVersion(minecraftVersion);
		if (forgeVersion == null)
		{
			log("Failed to find forge installer jar for Minecraft " + minecraftVersion + "!");
			return null;
		}
	}

	const installerUrl = "https://files.minecraftforge.net/maven/net/minecraftforge/forge/" + forgeVersion + "/forge-" + forgeVersion + "-installer.jar";
	log("Downloading " + installerUrl + "...");
	let [installerJar, fileName] = await download(installerUrl);
	fileName = sanitizeFileName(fileName);
	fs.writeFileSync(directory + "/" + fileName, installerJar);
	
	log("Running " + fileName + "...");
	await exec("java", ["-jar", fileName, "--installServer"], { cwd: directory });

	if (!fs.existsSync(directory + "/start.sh"))
	{
		fs.writeFileSync(directory + "/start.sh",
			"#!/bin/bash\n" +
			"curdir=\"${0%/*}\"\n" +
			"\n" +
			"java -Xmx28672M -Xms28672M -jar \"${curdir}/`ls ${curdir} | grep universal.jar`\"\n"
		);
		fs.chmodSync(directory + "/start.sh", 0o744);
	}

	return forgeVersion;
}

