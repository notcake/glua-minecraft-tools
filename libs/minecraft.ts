import * as fs from "fs";
import * as request from "request-promise";

export async function getUserUuid(name: string): Promise<string|null>
{
	const url = "https://api.mojang.com/users/profiles/minecraft/" + name;
	const response = await request.get(url);
	if (response == "") { return null; }

	const json = JSON.parse(response);
	const match = json["id"].match(/(........)(....)(....)(....)(............)/);
	if (match == null) { return null }

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
		for (let name in this.nameUuids)
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
		for (let name in this.nameUuids)
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

		for (let entry of JSON.parse(json))
		{
			whitelist.nameUuids[entry["name"]] = entry["uuid"];
		}
		return whitelist;
	}
}

