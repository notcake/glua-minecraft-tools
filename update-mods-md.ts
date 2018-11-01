import * as fs from "fs";

import { updateModIDs, formatModTable, parseTable } from "./md-tools";

async function main(argc: number, argv: string[])
{
	if (argc != 3)
	{
		console.error("Usage: ts-node update-mods-md <mods.md> > output.md");
		process.exit(1);
	}

	const data = fs.readFileSync(process.argv[2], "utf-8");
	const lines = data.split("\n");
	const newLines: string[] = [];

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

		const newTable = await updateModIDs(table);
		newLines.push(formatModTable(newTable, columnWidths));
		i = nextI;
	}

	console.log(newLines.join("\n"));
}

main(process.argv.length, process.argv);

