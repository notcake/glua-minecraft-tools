import { ConcurrentManager } from "./libs/concurrency";
import { Document } from "./libs/markdown";
import { getModTables, ModTable } from "./libs/mod-table";
import { packModId, parseArguments, readUri } from "./libs/utils";

async function updateMods(modTable: ModTable): Promise<void>
{
	const concurrency = new ConcurrentManager(15);

	const versions = modTable.getVersions();

	for (let i = 0; i < modTable.getModCount(); i++)
	{
		const [modRepository, id] = modTable.getModId(i)!;
		const modName = modTable.getModName(i)!;
		if (modRepository.name == "url")
		{
			console.error(modName + ": Skipping raw URLs.");
		}
		else
		{
			concurrency.queueThread(async () =>
			{
				const output: string[] = [];
				output.push("Processing " + packModId(modRepository.name, id) + "...");
				for (const version of versions)
				{
					const previousUrl = modTable.getModReleaseUrl(i, version);
					const previousRelease = modTable.getModReleaseId(i, version);
					const [modRepositoryOverride, idOverride, previousReleaseId] = previousRelease ? previousRelease : [modRepository, id, null];
					const nextReleaseId = await modRepositoryOverride.getLatestModReleaseId(idOverride, version);
					const nextUrl = nextReleaseId != null ? modRepositoryOverride.getModReleaseUrl(idOverride, nextReleaseId) : null;

					if (previousUrl != nextUrl)
					{
						let nextAfterPrevious = true;
						if (modRepositoryOverride.name == "curseforge")
						{
							nextAfterPrevious = (previousReleaseId != null ? parseInt(previousReleaseId) : 0) <= (nextReleaseId != null ? parseInt(nextReleaseId) : 0);
						}

						if (nextReleaseId != null && nextAfterPrevious)
						{
							if (previousReleaseId != nextReleaseId)
							{
								// Note that the outer check is for url equality, not release ID equality
								output.push(" " + version + ": " + previousReleaseId + " -> " + nextReleaseId);
							}
							modTable.setModReleaseUrl(i, version, nextUrl);
						}
						else
						{
							// The "latest" release is older than the existing release.
							// Do not update the table.
							output.push(" !!! " + version + ": " + previousReleaseId + " -> " + nextReleaseId + ", rejected!");
						}
					}
				}

				console.error(output.join("\n"));
			});
		}
	}

	await concurrency.defer();

	modTable.getTable().formatWidths();
}

async function main(argc: number, argv: string[])
{
	const [fixedArguments, ] = parseArguments(argc, argv);
	if (fixedArguments.length < 2 ||
            (!(fixedArguments[0] == "update" && fixedArguments.length == 2) &&
             !(fixedArguments[0] == "add-version" && fixedArguments.length == 3) &&
             !(fixedArguments[0] == "remove-version" && fixedArguments.length == 3)))
	{
		console.error("Usage: ts-node mods-md update <mods.md file or url> > output.md");
		console.error("       ts-node mods-md add-version <mods.md file or url> <minecraft version> > output.md");
		console.error("       ts-node mods-md remove-version <mods.md file or url> <minecraft version> > output.md");
		process.exit(1);
	}

	const markdownUri = fixedArguments[1];
	const data = await readUri(markdownUri);
	if (data == null)
	{
		console.error("Unable to read from " + markdownUri + "!");
		process.exit(1);
		return;
	}


	const document = Document.fromString(data);

	const action = fixedArguments[0];
	switch (action)
	{
		case "update":
			for (const table of getModTables(document))
			{
				await updateMods(new ModTable(table));
			}
			break;
		case "add-version":
		{
			const version = fixedArguments[2];
			for (const table of getModTables(document))
			{
				const modTable = new ModTable(table);
				modTable.addVersion(version);
			}
			break;
		}
		case "remove-version":
		{
			const version = fixedArguments[2];
			for (const table of getModTables(document))
			{
				const modTable = new ModTable(table);
				modTable.removeVersion(version);
			}
			break;
		}
	}

	let markdown = document.toString();
	if (markdown.endsWith("\n"))
	{
		// Strip trailing line break because console.log will re-add it
		markdown = markdown.substring(0, markdown.length - 1);
	}
	console.log(markdown);
}

main(process.argv.length, process.argv);
