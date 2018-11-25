import * as fs from "fs";
import * as request from "request-promise";

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
	return fileName.replace("/", "_");
}

export function toSet(strings: string[]): { [_: string]: true }
{
	const set: { [_: string]: true } = {};
	for (let item of strings)
	{
		set[item] = true;
	}

	return set;
}
