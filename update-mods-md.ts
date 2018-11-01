import * as fs from "fs";

import { formatModTable, parseTable, getListedVersions, forEachMod } from "./md-tools";
import { getCurseforgeUrls } from "./curseforge-tools";
import { ConcurrentManager } from "./concurrency";

export function updateModIDs(concurrency: ConcurrentManager,table: string[][]): Promise<string[][]>
{
	const versions = getListedVersions(table);

	return forEachMod(table,async (row,namespace,id,urls) => {
		concurrency.queueThread(async () => {
			switch (namespace)
			{
				case "curseforge":
					const newUrls = await getCurseforgeUrls(id, versions);
					console.error("Processing " + namespace + ":" + id + "...");
					for (let j = 0; j < versions.length; j++)
					{
						const version = versions[j];
						const previousUrl = urls[j];
						const nextUrl	 = newUrls[version];
						if (previousUrl != nextUrl)
						{
							const previous = previousUrl ? previousUrl.match(/\/([0-9]+)$/)![1] : null;
							const next	 = nextUrl ? nextUrl.match(/\/([0-9]+)$/)![1] : null;
							if (next != null && (previous ? parseInt(previous) : 0) <= parseInt(next))
							{
								console.error("	" + version + ": " + previous + " -> " + next);
								row[2 + j] = "[" + version + "](" + nextUrl + ")";
							}
							else
							{
								console.error("	!!! " + version + ": " + previous + " -> " + next);
							}
						}
					}
					break;
				default:
					console.error(row[0] + ": Unknown id " + namespace + ":" + id + ".");
					break;
			}
		});

		return;
	});
}

async function main(argc: number, argv: string[])
{
	if (argc != 3)
	{
		console.error("Usage: ts-node update-mods-md <mods.md> > output.md");
		process.exit(1);
	}

	const data = fs.readFileSync(process.argv[2], "utf-8");
	const lines = data.split("\n");
	const newLines: (string | [number,string[][],number[]])[] = [];

	const concurrency = new ConcurrentManager(15);

	let i = 0;
	while (i < lines.length)
	{
		const line = lines[i];

		if (line.indexOf("|") == -1) {
			newLines.push(line);
			i++;
			continue;
		}
		
		const [nextI, table, columnWidths] = parseTable(lines, i);
		if (table[0][0].toLowerCase() != "mod name")
		{
			for (let j = i; j < nextI; j++)
			{
				newLines.push(lines[j]);
			}
			i = nextI;
			continue;
		}

		updateModIDs(concurrency,table);
		newLines.push([nextI, table, columnWidths]);
		i = nextI;
	}

	await concurrency.defer();

	for(let i=0; i < newLines.length;i++) {
		let line = newLines[i];

		if(typeof line === "string") {
			// no changes needed
		}
		else {
			// render this line
			newLines[i] = formatModTable(line[1],line[2]);
		}
	}

	console.log(newLines.join("\n"));
}

main(process.argv.length, process.argv);

