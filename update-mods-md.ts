import { ConcurrentManager } from "./libs/concurrency";
import { CurseforgeMod, CurseforgeLink } from "./libs/curseforge";
import { Document, Section, ISection, Table, ITable, IElementCollection } from "./libs/markdown";
import { getModTables, ModTable } from "./libs/mod-table";
import { packModId, readUri } from "./libs/utils";

async function processTable(modTable: ModTable): Promise<void>
{
	const concurrency = new ConcurrentManager(15);

	const versions = modTable.getVersions();

	for (let i = 0; i < modTable.getModCount(); i++)
	{
		const [namespace, id] = modTable.getModId(i)!;
		const modName = modTable.getModName(i)!;
		switch (namespace)
		{
			case "curseforge":
				concurrency.queueThread(async () =>
					{
						try
						{
							const mod = (await CurseforgeMod.fromID(id, versions, false))!;
							const newUrls = mod.urls;

							console.error("Processing " + packModId(namespace, id) + "...");
							for (let j = 0; j < versions.length; j++)
							{
								const version = versions[j];

								const previousUrl = modTable.getModUrl(i, version);
								const nextUrl	  = newUrls[version];

								if (previousUrl != nextUrl)
								{
									const previous = previousUrl ? CurseforgeLink.getFileId(previousUrl) : null;
									const next     = nextUrl     ? nextUrl.fileId                        : null;
									if (next != null && (previous ? parseInt(previous) : 0) <= parseInt(next))
									{
										console.error(" " + version + ": " + previous + " -> " + next);
										modTable.setModUrl(i, version, nextUrl!.url);
									}
									else
									{
										console.error(" !!! " + version + ": " + previous + " -> " + next);
									}
								}
							}
						}
						catch(e)
						{
							console.error(" !!! " + modName + ": " + e );
						}
					}
				);
				break;
			case "url":
				console.error(modName + ": Skipping raw URLs.");
				break;
			default:
				console.error(modName + ": Unknown id " + packModId(namespace, id) + ".");
				break;
		}
	}

	await concurrency.defer();

	modTable.getTable().formatWidths();
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
		await processTable(new ModTable(table));
	}

	let markdown = document.toString();
	if (markdown.endsWith("\n"))
	{
		markdown = markdown.substring(0, markdown.length - 1);
	}
	console.log(markdown);
}

main(process.argv.length, process.argv);
