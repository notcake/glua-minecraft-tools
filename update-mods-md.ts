import { ConcurrentManager } from "./libs/concurrency";
import { getCurseforgeUrls } from "./libs/curseforge-tools";
import { Document, Section, ISection, Table, ITable, IElementCollection } from "./libs/markdown";
import { isModTable, getModTables, getModId, getModName, getModUrls, getTableVersions } from "./libs/mod-table";
import { readUri } from "./libs/utils";

async function processTable(table: ITable): Promise<void>
{
	if (!isModTable(table)) { return; }

	const concurrency = new ConcurrentManager(15);

	const versions = getTableVersions(table);

	for (let y = 0; y < table.getRowCount(); y++)
	{
		const row = table.getRow(y)!;
		const modId = getModId(row);
		if (modId == null) { continue; }

		const [namespace, id] = modId;
		const modName = getModName(row);
		const previousUrls = getModUrls(row);
		switch (namespace)
		{
			case "curseforge":
				concurrency.queueThread(async () =>
					{
						const newUrls = await getCurseforgeUrls(id, versions);

						console.error("Processing " + namespace + ":" + id + "...");
						for (let i = 0; i < versions.length; i++)
						{
							const version = versions[i];

							const previousUrl = previousUrls[i];
							const nextUrl	  = newUrls[version];

							if (previousUrl != nextUrl)
							{
								const previous = previousUrl ? previousUrl.match(/\/([0-9]+)$/)![1] : null;
								const next     = nextUrl     ? nextUrl.match(/\/([0-9]+)$/)![1]     : null;
								if (next != null && (previous ? parseInt(previous) : 0) <= parseInt(next))
								{
									console.error(" " + version + ": " + previous + " -> " + next);
									row.setCell(2 + i, " [" + version + "](" + nextUrl + ")");
								}
								else
								{
									console.error(" !!! " + version + ": " + previous + " -> " + next);
								}
							}
						}
					}
				);
				break;
			case "url":
				console.error(modName + ": Skipping raw URLs.");
				break;
			default:
				console.error(modName + ": Unknown id " + namespace + ":" + id + ".");
				break;
		}
	}

	await concurrency.defer();

	table.formatWidths();
}

async function main(argc: number, argv: string[])
{
	if (argc != 3)
	{
		console.error("Usage: ts-node update-mods-md <mods.md file or url> > output.md");
		process.exit(1);
	}

	const data = await readUri(process.argv[2]);
	if (data == null)
	{
		console.error("Unable to read from " + process.argv[2] + "!");
		process.exit(1);
		return;
	}


	const document = Document.fromString(data);
	for (let table of getModTables(document))
	{
		await processTable(table);
	}

	let markdown = document.toString();
	if (markdown.endsWith("\n"))
	{
		markdown = markdown.substring(0, markdown.length - 1);
	}
	console.log(markdown);
}

main(process.argv.length, process.argv);
