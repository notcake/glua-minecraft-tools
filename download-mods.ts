import { Document } from "./libs/markdown";
import { downloadMods } from "./libs/download";
import { getModTables } from "./libs/mod-table";
import { parseArguments, readUri } from "./libs/utils";

async function main(argc: number, argv: string[])
{
	const [fixedArguments] = parseArguments(argc, argv);
	if (fixedArguments.length != 3)
	{
		console.error("Usage: ts-node download-mods.ts <directory> <minecraft-version> <mods.md>");
		process.exit(1);
	}

	const modsDirectory  = fixedArguments[0];
	const minecraftVersion = fixedArguments[1];
	const markdownUri      = fixedArguments[2];
	const markdownData = await readUri(markdownUri);
	if (markdownData == null)
	{
		console.error("Unable to read from " + markdownUri + "!");
		process.exit(1);
		return;
	}

	await downloadMods(
		getModTables(Document.fromString(markdownData)),
		minecraftVersion,
		modsDirectory,
		modsDirectory + "/glua-minecraft-tools-manifest.json",
		console.log
	);
}

main(process.argv.length, process.argv);
