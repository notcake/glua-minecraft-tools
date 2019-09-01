import { Document, ITable, ITableRow } from "./markdown";

export function isModTable(table: ITable): boolean
{
	const text = table.getHeader().getCell(0);
	return text != null ? text.trim().toLowerCase() == "mod name" : false;
}

export function getModTables(document: Document): ITable[]
{
	return document.getTables().filter(isModTable);
}

export class ModTable
{
	private table: ITable;
	private versions: { [_: string]: number } = {};

	public constructor(table: ITable)
	{
		this.table = table;

		const header = table.getHeader();
		for (let x = 2; x < header.getCellCount(); x++)
		{
			this.versions[header.getCell(x)!.trim()] = x;
		}
	}

	public getTable(): ITable
	{
		return this.table;
	}

	public getVersions(): string[]
	{
		return Object.keys(this.versions);
	}

	public getModCount(): number
	{
		return this.table.getRowCount();
	}

	public getModName(index: number): string|null
	{
		const row = this.table.getRow(index);
		if (row == null) { return null; }

		let name = row.getCell(0)!.trim();
		while (name.startsWith("+ "))
		{
			name = name.substring(2);
		}

		return name;
	}

	public getModId(index: number): [string, string]|null
	{
		const row = this.table.getRow(index);
		if (row == null) { return null; }
		
		for (let x = 0; x < row.getCellCount(); x++)
		{
			const match = row.getCell(x)!.match(/\[[^\]]+\]\(([^)]+)\)/);
			if (match == null) { continue; }

			const url = match[1];

			const curseforgeMatchOld = url.match(/https?:\/\/minecraft.curseforge.com\/projects\/([^\/]+)\//);
			if (curseforgeMatchOld != null) { return ["curseforge-legacy", curseforgeMatchOld[1]]; }

			const curseforgeMatchWWW = url.match(/https?:\/\/www.curseforge.com\/minecraft\/mc\-mods\/([^\/]+)\//);
			if (curseforgeMatchWWW != null) { return ["curseforge", curseforgeMatchWWW[1]]; }

			const curseforgeMatch = url.match(/https?:\/\/curseforge.com\/minecraft\/mc\-mods\/([^\/]+)\//);
			if (curseforgeMatch != null) { return ["curseforge", curseforgeMatch[1]]; }
		}

		return ["url", this.getModName(index)!];
	}

	public getModUrl(index: number, version: string): string|null
	{
		const column = this.versions[version];
		if (column == null) { return null; }

		const row = this.table.getRow(index);
		if (row == null) { return null; }

		const cell = row.getCell(column);
		if (cell == null) { return null; }

		const match = cell.match(/\[[^\]]+\]\(([^\)]+)\)/);
		return match ? match[1] : null;
	}
	
	public isModEnabled(index: number): boolean
	{
		const row = this.table.getRow(index);
		if (row == null) { return false; }

		return row.getCell(1)!.indexOf("✔") != -1;
	}

	public setModUrl(index: number, version: string, url: string | null): boolean
	{
		const row = this.table.getRow(index);
		if (row == null) { return false; }

		const column = this.versions[version];
		if (column == null) { return false; }

		if(url == null) {
			row.setCell(column, " -");
		}
		else {
			row.setCell(column, " [" + version + "](" + url + ")");
		}

		return true;
	}
}
