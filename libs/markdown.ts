export interface IElement
{
}

export interface ITable extends IElement
{
	getHeader(): ITableRow;
	getRow(index: number): ITableRow|null;
	getRowCount(): number;

	formatWidths();
}

export interface ITableRow extends IElement
{
	getCell(index: number): string|null;
	getCellCount(): number;
	getCellWidth(index: number): number|null;
	setCell(index: number, text: string);
	setCellWidth(index: number, width: number);
}

export interface IElementCollection
{
	get(index: number): IElement|null;
	getCount(): number;
}

export interface ISection extends IElementCollection, IElement
{
	getTitle(): string;
	getLevel(): number;
}

export interface ILines extends IElement
{
}

export interface IDocument extends IElementCollection
{
}

export class ElementCollection implements IElementCollection
{
	protected elements: IElement[] = [];

	public constructor()
	{
	}

	// IElementCollection
	public get(index: number): IElement|null
	{
		return this.elements[index];
	}

	public getCount(): number
	{
		return this.elements.length;
	}

	// ElementCollection
	public add(element: IElement)
	{
		this.elements.push(element);
	}
}

export class TableRow implements ITableRow
{
	private cells:      string[] = [];
	private cellWidths: number[] = [];

	public constructor(line: string)
	{
		if (!line.trim().endsWith("|"))
		{
			line += "|";
		}

		const cells = line.split("|");
		cells.shift();
		cells.pop();
		this.cellWidths = cells.map(x => x.length);
		this.cells = cells;
	}

	public toString()
	{
		let row = "|";
		for (let i = 0; i < this.cells.length; i++)
		{
			row += this.cells[i] + " ".repeat(Math.max(0, this.cellWidths[i] - 2 - this.cells[i].length)) + "|";
		}
		return row;
	}

	// ITableRow
	public getCell(index: number): string|null
	{
		return this.cells[index];
	}

	public getCellCount(): number
	{
		return this.cells.length;
	}

	public getCellWidth(index: number): number|null
	{
		return this.cellWidths[index];
	}

	public setCell(index: number, text: string)
	{
		this.cells[index] = text;
		this.cellWidths[index] = Math.max(this.cellWidths[index], text.length);
	}

	public setCellWidth(index: number, width: number)
	{
		this.cellWidths[index] = width;
	}

	// TableRow
	public addCell(text: string)
	{
		this.cells.push(text);
		this.cellWidths.push(text.length);
	}
}

export class Table implements ITable
{
	private header: ITableRow;
	private rows: ITableRow[] = [];

	public constructor(header: ITableRow)
	{
		this.header = header;
	}

	public toString(): string
	{
		const header = this.header.toString();
		let separator = "|";
		for (let i = 0; i < this.header.getCellCount(); i++)
		{
			separator += " " + "-".repeat(this.header.getCellWidth(i)! - 2) + " |";
		}
		return header + "\n" + separator + "\n" + this.rows.map(x => x.toString()).join("\n");
	}

	// ITable
	public getHeader(): ITableRow
	{
		return this.header;
	}

	public getRow(index: number): ITableRow|null
	{
		return this.rows[index];
	}

	public getRowCount(): number
	{
		return this.rows.length;
	}

	public formatWidths()
	{
		const widths: number[] = [];
		for (let y = 0; y < this.rows.length; y++)
		{
			const row = this.rows[y];

			while (widths.length < row.getCellCount())
			{
				widths.push(0);
			}

			for (let x = 0; x < row.getCellCount(); x++)
			{
				widths[x] = Math.max(widths[x], Math.max(2 + row.getCell(x)!.length, row.getCellWidth(x)!));
			}
		}

		for (let y = 0; y < this.rows.length; y++)
		{
			const row = this.rows[y];
			for (let x = 0; x < row.getCellCount(); x++)
			{
				row.setCellWidth(x, widths[x]);
			}
		}
	}

	// Table
	public addRow(row: ITableRow)
	{
		this.rows.push(row);
	}
}

export class Section extends ElementCollection implements ISection
{
	private title: string;
	private level: number;

	public constructor(title: string, level: number)
	{
		super();

		this.title = title;
		this.level = level;
	}

	public toString(): string
	{
		const title = "#".repeat(this.level) + " " + this.title;
		if (this.elements.length == 0) { return title; }

		return title + "\n" + this.elements.map(x => x.toString()).join("\n");
	}

	// ISection
	public getTitle(): string
	{
		return this.title;
	}

	public getLevel(): number
	{
		return this.level;
	}

	// Section
}

export class Lines implements ILines
{
	private lines: string[] = [];

	public constructor()
	{
	}

	public toString(): string
	{
		return this.lines.join("\n");
	}

	// ILines
	public getLine(index: number): string|null
	{
		return this.lines[index];
	}

	public getLineCount(): number
	{
		return this.lines.length;
	}

	// Lines
	public addLine(line: string)
	{
		this.lines.push(line);
	}
}

export class Document extends ElementCollection implements IDocument
{
	public constructor(document: string)
	{
		super();

		const lines = document.split("\n");

		let i = 0;
		let section: ElementCollection = this;
		let linesElement: Lines|null = null;
		while (i < lines.length)
		{
			if (lines[i].startsWith("#"))
			{
				linesElement = null;

				let level = 0;
				while (lines[i][level] == "#")
				{
					level++;
				}

				const title = lines[i].substring(level).trim();
				section = new Section(title, level);
				this.add(section);
				i++;
			}
			else if (lines[i].indexOf("|") != -1)
			{
				linesElement = null;

				const header = new TableRow(lines[i]);
				i++;
				i++;
				const table = new Table(header);
				section.add(table);
				while (lines[i].indexOf("|") != -1)
				{
					table.addRow(new TableRow(lines[i]));
					i++;
				}
			}
			else
			{
				if (linesElement == null)
				{
					linesElement = new Lines();
					section.add(linesElement);
				}

				linesElement.addLine(lines[i]);
				i++;
			}
		}
	}

	public toString(): string
	{
		return this.elements.map(x => x.toString()).join("\n");
	}

	// Document
	public static fromString(string: string): Document
	{
		return new Document(string);
	}
}

