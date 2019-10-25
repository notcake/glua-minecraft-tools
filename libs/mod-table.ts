import { Document, ITable, TableCell } from "./markdown";
import { IModRepository } from "./imodrepository";
import { ModRepositories } from "./modrepositories";

const modRepositories = new ModRepositories();

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

	public getModId(index: number): [IModRepository, string]|null
	{
		const row = this.table.rows[index];
		if (row == null) { return null; }

		for (let x = 0; x < row.cells.length; x++)
		{
			const match = row.cells[x].text.match(/\[[^\]]+\]\(([^)]+)\)/);
			if (match == null) { continue; }

			const url = match[1];

			const result = modRepositories.parseModUrl(url);
			if (result != null && result[0].name != "url")
			{
				return result;
			}
		}

		return [modRepositories.get("url")!, this.getModName(index)!];
	}

	public getModReleaseId(index: number, version: string): [IModRepository, string, string]|null
	{
		const url = this.getModReleaseUrl(index, version);
		if (url == null) { return null; }

		return modRepositories.parseModReleaseUrl(url);
	}

	public getModReleaseUrl(index: number, version: string): string|null
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

	public setModReleaseId(index: number, version: string, modRepository: IModRepository, id: string, releaseId: string): boolean
	{
		const url = modRepository.getModReleaseUrl(id, releaseId);
		return this.setModReleaseUrl(index, version, url);
	}

	public setModReleaseUrl(index: number, version: string, url: string | null): boolean
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
