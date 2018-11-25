import { ITable, ITableRow } from "./markdown";

export function isModTable(table: ITable): boolean
{
	const text = table.getHeader().getCell(0);
	return text != null ? text.trim().toLowerCase() == "mod name" : false;
}

export function getModId(row: ITableRow): [string, string]|null
{
	for (let x = 0; x < row.getCellCount(); x++)
	{
		const match = row.getCell(x)!.match(/\[[^\]]+\]\(([^)]+)\)/);
		if (match == null) { continue; }

		const url = match[1];

		const curseforgeMatch = url.match(/https?:\/\/minecraft.curseforge.com\/projects\/([^\/]+)\//);
		if (curseforgeMatch != null) { return ["curseforge", curseforgeMatch[1]]; }

		return ["url", url];
	}

	return null;
}

export function getModName(row: ITableRow): string|null
{
	const text = row.getCell(0);
	return text != null ? text.trim() : null;
}

export function getModUrls(row: ITableRow): (string|null)[]
{
	const urls: (string|null)[] = [];
	for (let x = 2; x < row.getCellCount(); x++)
	{
		const cell = row.getCell(x)!;
		const match = cell.match(/\[[^\]]+\]\(([^\)]+)\)/);

		urls.push(match ? match[1] : null);
	}

	return urls;
}

export function getTableVersions(table: ITable): string[]
{
	const versions: string[] = [];
	const header = table.getHeader();
	for (let x = 2; x < header.getCellCount(); x++)
	{
		versions.push(header.getCell(x)!.trim());
	}
	return versions;
}
