import { Document, Section, ISection, Table, ITable, IElementCollection } from "./markdown";

export class WhitelistTable
{
	private table: ITable;

	private names: { [_: string]: boolean } = {};

	public constructor(table: ITable)
	{
		this.table = table;

		for (let y = 0; y < this.table.getRowCount(); y++)
		{
			const row = this.table.getRow(y)!;
			let name = row.getCell(0)!.trim();
			name = name.replace("\\", "");
			while (name.startsWith("+ "))
			{
				name = name.substring(2);
			}
			const approved = row.getCell(2)!.indexOf("✔") != -1;

			if (name == "_Name_") { continue; }

			this.names[name] = approved;
		}
	}

	public getWhitelistedNames(): string[]
	{
		const names: string[] = [];
		for (let name in this.names)
		{
			if (this.names[name])
			{
				names.push(name);
			}
		}
		return names;
	}

	public static fromDocument(document: Document): WhitelistTable|null
	{
		for (let table of document.getTables())
		{
			if (table.getHeader().getCellCount() >= 3 &&
			    table.getHeader().getCell(0)!.trim().toLowerCase() == "name")
			{
				return new WhitelistTable(table);
			}
		}

		return null;
	}
}

