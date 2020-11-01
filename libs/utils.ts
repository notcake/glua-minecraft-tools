import * as crypto from "crypto";
import * as fs from "fs";
import * as request from "request-promise";

import * as child_process from "child-process-promise";

export async function exec(command: string, argv: string[], options: { [_: string]: any } = {}): Promise<void>
{
	options = { maxBuffer: 1024 * 1024 * 20, ...options };
	const p = child_process.execFile(command, argv, options);
	p.childProcess.stdout.on("data", x => process.stdout.write(x));
	p.childProcess.stderr.on("data", x => process.stderr.write(x));
	await p;
}

export function hash(hash: string, data: Buffer|string): string
{
	return crypto.createHash(hash).update(data).digest("hex");
}

export function md5(data: Buffer|string): string
{
	return hash("md5", data);
}

export function sha256(data: Buffer|string): string
{
	return hash("sha256", data);
}

export function packModId(namespace: string, id: string): string
{
	return namespace + ":" + id;
}

export function unpackModId(id: string): [string, string]
{
	return [id.substring(0, id.indexOf(":")), id.substring(id.indexOf(":") + 1)];
}

export function parseArguments(argc: number, argv: string[]): [string[], { [_: string]: string }]
{
	const fixedArguments: string[] = [];
	const mapArguments: { [_: string]: string } = {};

	let i = 2;
	while (i < argc)
	{
		if (argv[i].startsWith("-"))
		{
			let key = argv[i];
			if (key.startsWith("-")) { key = key.substring(1); }
			if (key.startsWith("-")) { key = key.substring(1); }
			i++;

			mapArguments[key] = argv[i];
			i++;
		}
		else
		{
			fixedArguments.push(argv[i]);
			i++;
		}
	}

	return [fixedArguments, mapArguments];
}

export async function readUri(uri: string): Promise<string|null>
{
	try
	{
		if (uri.toLowerCase().startsWith("http://") ||
                    uri.toLowerCase().startsWith("https://"))
		{
			return await request.get(uri);
		}
		else
		{
			return fs.readFileSync(uri, "utf-8");
		}
	}
	catch (e)
	{
		return null;
	}
}

export function sanitizeFileName(fileName: string): string
{
	return fileName.replace(/[<>:"/\\|?*]/g, "_");
}

export function toSet(strings: string[]): { [_: string]: true }
{
	const set: { [_: string]: true } = {};
	for (const item of strings)
	{
		set[item] = true;
	}

	return set;
}
