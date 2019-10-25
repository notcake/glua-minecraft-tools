import { Document, ITable, TableCell } from "./markdown";

export function isModTable(table: ITable): boolean
{
	const text = table.header.cells[0].text;
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

		const header = table.header;
		for (let x = 2; x < header.cells.length; x++)
		{
			this.versions[header.cells[x].text.trim()] = x;
		}
	}

	public addVersion(version: string)
	{
		if (version in this.versions) { return; }

		this.versions[version] = this.table.header.cells.length;
		this.table.addColumn(" " + version + " ", " - ");
	}

	public containsVersion(version: string): boolean
	{
		return version in this.versions;
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
		return this.table.rows.length;
	}

	public getModName(index: number): string|null
	{
		const row = this.table.rows[index];
		if (row == null) { return null; }

		let name = row.cells[0].text.trim();
		while (name.startsWith("+ "))
		{
			name = name.substring(2);
		}

		return name;
	}

	public getModId(index: number): [string, string]|null
	{
		const row = this.table.rows[index];
		if (row == null) { return null; }

		for (let x = 0; x < row.cells.length; x++)
		{
			const match = row.cells[x].text.match(/\[[^\]]+\]\(([^)]+)\)/);
			if (match == null) { continue; }

			const url = match[1];

			const curseforgeMatchOld = url.match(/https?:\/\/minecraft.curseforge.com\/projects\/([^/]+)\//);
			if (curseforgeMatchOld != null) { return ["curseforge-legacy", curseforgeMatchOld[1]]; }

			const curseforgeMatchWWW = url.match(/https?:\/\/www.curseforge.com\/minecraft\/mc-mods\/([^/]+)\//);
			if (curseforgeMatchWWW != null) { return ["curseforge", curseforgeMatchWWW[1]]; }

			const curseforgeMatch = url.match(/https?:\/\/curseforge.com\/minecraft\/mc-mods\/([^/]+)\//);
			if (curseforgeMatch != null) { return ["curseforge", curseforgeMatch[1]]; }
		}

		return ["url", this.getModName(index)!];
	}

	public getModUrl(index: number, version: string): string|null
	{
		const column = this.versions[version];
		if (column == null) { return null; }

		const row = this.table.rows[index];
		if (row == null) { return null; }

		const cell = row.cells[column];
		if (cell == null) { return null; }

		const match = cell.text.match(/\[[^\]]+\]\(([^)]+)\)/);
		return match ? match[1] : null;
	}

	public isModEnabled(index: number): boolean
	{
		const row = this.table.rows[index];
		if (row == null) { return false; }

		return row.cells[1].text.indexOf("✔") != -1;
	}

	public removeVersion(version: string)
	{
		if (!(version in this.versions)) { return; }

		const index = this.versions[version];
		this.table.removeColumn(index);

		delete this.versions[version];
		for (const version in this.versions)
		{
			if (this.versions[version] > index)
			{
				this.versions[version]--;
			}
		}
	}

	public setModUrl(index: number, version: string, url: string | null): boolean
	{
		const row = this.table.rows[index];
		if (row == null) { return false; }

		const column = this.versions[version];
		if (column == null) { return false; }

		const text = url == null ? " - " : (" [" + version + "](" + url + ") ");
		row.cells[column] = row.cells[column] || new TableCell(text);
		row.cells[column].text = text;

		return true;
	}
}
