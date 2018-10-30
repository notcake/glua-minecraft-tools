import * as fs from "fs";
import * as request from "request-promise";

function parseRow(line: string): string[]
{
	if (!line.trim().endsWith("|"))
	{
		line += " |";
	}
	const parts = line.split("|");
	parts.shift();
	parts.pop();

	return parts.map(x => x.trim());
}

function parseTable(lines: string[], index: number): [number, string[][], number[]]
{
	const parts = lines[index].split("|");
	parts.shift();
	parts.pop();
	const columnWidths: number[] = parts.map(x => x.length - 2);

	const rows: string[][] = [];
	rows.push(parseRow(lines[index]));
	index++;
	index++;

	while (lines[index].indexOf("|") != -1)
	{
		rows.push(parseRow(lines[index]));
		index++;
	}

	return [index, rows, columnWidths];
}

function findModId(row: string[]): [string, string]|null
{
	for (let cell of row)
	{
		const match = cell.match(/https?:\/\/minecraft.curseforge.com\/projects\/([^\/]+)\//);
		if (match != null) { return ["curseforge", match[1]]; }
	}
	return null;
}

const versionMap = {
	"1.7":    "1738749986%3A5",
	// "1.7.10": "2020709689%3A4449",
	"1.7.10":    "1738749986%3A5",
	"1.10":   "1738749986%3A572",
	// "1.10.2": "2020709689%3A6170",
	"1.10.2":   "1738749986%3A572",
	"1.11":   "1738749986%3A599",
	"1.11.2": "2020709689%3A6452",
	"1.12":   "1738749986%3A628",
	"1.12.2": "1738749986%3A628"
};
async function getCurseforgeLinkForVersion(id: string, version: string): Promise<string|null>
{
	const body = await request.get("https://minecraft.curseforge.com/projects/" + id + "/files?filter-game-version=" + versionMap[version]);
	const regex = /\/projects\/[^\/]+\/files\/([0-9]+)\/download/;
	const match = body.match(regex);
	if (match == null) { return null; }
	return "https://minecraft.curseforge.com/projects/" + id + "/files/" + match[1];
}

async function getCurseforgeUrls(id: string, versions: string[]): Promise<{ [_: string]: string }>
{
	// Follow redirect
	const body = await request.get("https://minecraft.curseforge.com/projects/" + id);
	const regex = /<meta property="og:url" content="https:\/\/minecraft.curseforge.com\/projects\/([^"]+)" \/>/;
	const match = body.match(regex);
	if (match != null) { id = match[1]; }

	const tasks: { [_: string]: Promise<string|null> } = {};
	const urls: { [_: string]: string } = {};
	for (let version of versions)
	{
		tasks[version] = getCurseforgeLinkForVersion(id, version);
	}
	for (let version of versions)
	{
		const url = await tasks[version];
		if (url == null) { continue; }
		urls[version] = url;
	}
	return urls;
}

async function processMods(table: string[][]): Promise<string[][]>
{
	const versions: string[] = [];
	for (let i = 2; i < table[0].length; i++)
	{
		versions.push(table[0][i]);
	}

	for (let i = 1; i < table.length; i++)
	{
		const row = table[i];
		const urls: (string|null)[] = [];
		for (let j = 2; j < table[i].length; j++)
		{
			const cell = table[i][j];
			if (cell == "-")
			{
				urls.push(null);
			}
			else
			{
				const match = cell.match(/\[[^\]]+\]\(([^\)]+)\)/);
				urls.push(match ? match[1] : null);
			}
		}

		const result = findModId(row);
		if (result)
		{
			const [namespace, id] = result;
			switch (namespace)
			{
				case "curseforge":
					console.error("Processing " + namespace + ":" + id + "...");
					const newUrls = await getCurseforgeUrls(id, versions);
					for (let j = 0; j < versions.length; j++)
					{
						const version = versions[j];
						const previousUrl = urls[j];
						const nextUrl     = newUrls[version];
						if (previousUrl != nextUrl)
						{
							const previous = previousUrl ? previousUrl.match(/\/([0-9]+)$/)![1] : null;
							const next     = nextUrl ? nextUrl.match(/\/([0-9]+)$/)![1] : null;
							if (next != null && (previous ? parseInt(previous) : 0) <= parseInt(next))
							{
								console.error("    " + version + ": " + previous + " -> " + next);
								table[i][2 + j] = "[" + version + "](" + nextUrl + ")";
							}
							else
							{
								console.error("    !!! " + version + ": " + previous + " -> " + next);
							}
						}
					}
					break;
				default:
					console.error(row[0] + ": Unknown id " + namespace + ":" + id + ".");
					break;
			}
		}
		else
		{
			console.error(row[0] + ": No id found!");
		}
	}
	return table;
}

function padRight(s: string, n: number): string
{
	return s + " ".repeat(Math.max(0, n - s.length));
}

function formatModTable(table: string[][], columnWidths: number[]): string
{
	const lines: string[] = [];
	for (let row of table)
	{
		columnWidths[0] = Math.max(columnWidths[0], row[0].length);
	}
	
	const dataColumnWidths: number[] = columnWidths.slice();
	for (let row of table)
	{
		for (let i = 0; i < row.length; i++)
		{
			dataColumnWidths[i] = Math.max(dataColumnWidths[i], row[i].length);
		}
	}

	for (let i = 0; i < table.length; i++)
	{
		const row = table[i];
		let line = "| " + padRight(row[0], columnWidths[0]) + " |";
		line += " " + padRight(row[1], columnWidths[1]) + " |"
		for (let j = 2; j < row.length; j++)
		{
			line += " " + padRight(row[j], i > 0 ? dataColumnWidths[j] : columnWidths[j]) + " |";
		}
		lines.push(line);
	}
	lines.splice(1, 0, "|" + columnWidths.map(x => " " + "-".repeat(x) + " ").join("|") + "|");
	return lines.join("\n");
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

		const newTable = await processMods(table);
		newLines.push(formatModTable(newTable, columnWidths));
		i = nextI;
	}

	console.log(newLines.join("\n"));
}

main(process.argv.length, process.argv);

