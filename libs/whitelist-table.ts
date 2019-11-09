import { Document, ITable } from "./markdown";

export class WhitelistTable
{
	private table: ITable;

	private names: { [_: string]: boolean } = {};

	public constructor(table: ITable)
	{
		this.table = table;

		for (const row of this.table.rows)
		{
			let name = row.cells[0].text.trim();
			name = name.replace(/\\/g, "");
			while (name.startsWith("+ "))
			{
				name = name.substring(2);
			}
			const approved = row.cells[2].text.indexOf("✔") != -1;

			if (name == "_Name_") { continue; }
			if (name == "_Minecraft Name_") { continue; }

			this.names[name] = approved;
		}
	}

	public getWhitelistedNames(): string[]
	{
		const names: string[] = [];
		for (const name in this.names)
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
		for (const table of document.getTables())
		{
			if (table.header.cells.length >= 3 &&
			    (table.header.cells[0].text.trim().toLowerCase() == "name" ||
			     table.header.cells[0].text.trim().toLowerCase() == "minecraft name"))
			{
				return new WhitelistTable(table);
			}
		}

		return null;
	}
}
