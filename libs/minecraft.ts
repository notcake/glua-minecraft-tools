import * as fs from "fs";
import * as request from "request-promise";

export async function getUserUuid(name: string): Promise<string|null>
{
	const url = "https://api.mojang.com/users/profiles/minecraft/" + name;
	const response = await request.get(url);
	if (response == "") { return null; }

	const json = JSON.parse(response);
	const match = json["id"].match(/(........)(....)(....)(....)(............)/);
	if (match == null) { return null; }

	return match[1] + "-" + match[2] + "-" + match[3] + "-" + match[4] + "-" + match[5];
}

export class Whitelist
{
	private nameUuids: { [_: string]: string } = {};

	public constructor()
	{
	}

	public async addUser(name: string): Promise<boolean>
	{
		if (this.containsUser(name)) { return true; }

		const uuid = await getUserUuid(name);
		if (uuid == null) { return false; }

		this.nameUuids[name] = uuid;

		return true;
	}

	public containsUser(name: string): boolean
	{
		return this.nameUuids[name] != null;
	}

	public getUsers(): string[]
	{
		const users: string[] = [];
		for (const name in this.nameUuids)
		{
			users.push(name);
		}
		return users;
	}

	public getUserUuid(name: string): string|null
	{
		return this.nameUuids[name];
	}

	public save(path: string)
	{
		const json: { uuid: string, name: string }[] = [];
		for (const name in this.nameUuids)
		{
			json.push({ uuid: this.nameUuids[name], name: name });
		}
		fs.writeFileSync(path, JSON.stringify(json, null, 4));
	}

	public static fromFile(path: string): Whitelist|null
	{
		try
		{
			const json = fs.readFileSync(path, "utf-8");
			return Whitelist.fromJson(json);
		}
		catch (e)
		{
			if (e.code == "ENOENT") { return null; }

			throw e;
		}
	}

	public static fromJson(json: string): Whitelist
	{
		const whitelist = new Whitelist();

		for (const entry of JSON.parse(json))
		{
			whitelist.nameUuids[entry["name"]] = entry["uuid"];
		}
		return whitelist;
	}
}

export class ServerProperties
{
	private orderedProperties: string[] = [];
	private properties: { [_: string]: string } = {};

	public constructor()
	{
	}

	public get(key: string): string|null
	{
		return this.properties[key];
	}

	public set(key: string, value: string)
	{
		if (this.properties[key] == null)
		{
			this.orderedProperties.push(key);
		}

		this.properties[key] = value;
	}

	public save(path: string)
	{
		const data = this.orderedProperties.map(x => x + "=" + this.properties[x] + "\n").join("");
		fs.writeFileSync(path, data);
	}

	public static fromFile(path: string): ServerProperties|null
	{
		try
		{
			const data = fs.readFileSync(path, "utf-8");
			return ServerProperties.fromBlob(data);
		}
		catch (e)
		{
			if (e.code == "ENOENT") { return null; }

			throw e;
		}
	}

	public static fromBlob(blob: string): ServerProperties
	{
		const serverProperties = new ServerProperties();
		const lines = blob.split("\n");

		for (let line of lines)
		{
			if (line.indexOf("#") != -1)
			{
				line = line.substring(0, line.indexOf("#"));
			}
			line = line.trim();

			if (line == "") { continue; }

			if (line.indexOf("=") == -1)
			{
				console.error("Failed to parse \"" + line + "\" in server.properties!");
				continue;
			}

			serverProperties.set(line.substring(0, line.indexOf("=")), line.substring(line.indexOf("=") + 1));
		}

		return serverProperties;
	}
}

