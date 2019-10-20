import { Document } from "./markdown";

test("markdown table parsing", () =>
{
	const document = Document.fromString(
		"| a | b | c |\n" +
		"|---|---|---|\n" +
		"| d | e | f |"
	);
	expect(document.elements.length).toBe(1);

	const table = document.elements[0];
	expect(table.type).toBe("table");
	if (table.type != "table") { return; }
	expect(table.header.cells.length).toBe(3);
	expect(table.header.cells[0].text).toBe(" a ");
	expect(table.header.cells[1].text).toBe(" b ");
	expect(table.header.cells[2].text).toBe(" c ");

	expect(table.rows.length).toBe(1);
	expect(table.rows[0].cells.length).toBe(3);
	expect(table.rows[0].cells[0].text).toBe(" d ");
	expect(table.rows[0].cells[1].text).toBe(" e ");
	expect(table.rows[0].cells[2].text).toBe(" f ");
});

test("markdown table column addition", () =>
{
	const document = Document.fromString(
		"| a | b |\n" +
		"|---|---|\n" +
		"| d | e |"
	);
	expect(document.elements.length).toBe(1);

	const table = document.elements[0];
	expect(table.type).toBe("table");
	if (table.type != "table") { return; }

	table.addColumn(" c ", " f ");

	expect(table.header.cells.length).toBe(3);
	expect(table.header.cells[0].text).toBe(" a ");
	expect(table.header.cells[1].text).toBe(" b ");
	expect(table.header.cells[2].text).toBe(" c ");

	expect(table.rows.length).toBe(1);
	expect(table.rows[0].cells.length).toBe(3);
	expect(table.rows[0].cells[0].text).toBe(" d ");
	expect(table.rows[0].cells[1].text).toBe(" e ");
	expect(table.rows[0].cells[2].text).toBe(" f ");
});

test("markdown table column removal", () =>
{
	const document = Document.fromString(
		"| a | b | c |\n" +
		"|---|---|---|\n" +
		"| d | e | f |"
	);
	expect(document.elements.length).toBe(1);

	const table = document.elements[0];
	expect(table.type).toBe("table");
	if (table.type != "table") { return; }

	table.removeColumn(1);

	expect(table.header.cells.length).toBe(2);
	expect(table.header.cells[0].text).toBe(" a ");
	expect(table.header.cells[1].text).toBe(" c ");

	expect(table.rows.length).toBe(1);
	expect(table.rows[0].cells.length).toBe(2);
	expect(table.rows[0].cells[0].text).toBe(" d ");
	expect(table.rows[0].cells[1].text).toBe(" f ");
});

test("markdown section parsing", () =>
{
	const document = Document.fromString(
		"# Title 1\n" +
		"## Subtitle 1\n" +
		"# Title 2\n"
	);
	expect(document.elements.length).toBe(2);

	const title1 = document.elements[0];
	expect(title1.type).toBe("section");
	if (title1.type != "section") { return; }
	expect(title1.title).toBe("Title 1");
	expect(title1.level).toBe(1);
	expect(title1.elements.length).toBe(1);

	const subtitle1 = title1.elements[0];
	expect(subtitle1.type).toBe("section");
	if (subtitle1.type != "section") { return; }
	expect(subtitle1.title).toBe("Subtitle 1");
	expect(subtitle1.level).toBe(2);
	expect(subtitle1.elements.length).toBe(0);

	const title2 = document.elements[1];
	expect(title2.type).toBe("section");
	if (title2.type != "section") { return; }
	expect(title2.title).toBe("Title 2");
	expect(title2.level).toBe(1);
	expect(title2.elements.length).toBe(1);

	const lines = title2.elements[0];
	expect(lines.type).toBe("lines");
	if (lines.type != "lines") { return; }
	expect(lines.lines.length).toBe(1);
	expect(lines.lines[0]).toBe("");
});
