import * as request from "request-promise";

const requestProgress = require("request-progress");

import { ITable } from "./markdown";
import { ModManifest } from "./mod-manifest";
import { getModTables, ModTable } from "./mod-table";

export interface IDownloadProgress {
	percent: number,            // Overall percent (between 0 to 1)
	speed: number,              // The download speed in bytes/sec
	size: {
		total: number,      // The total payload size in bytes
		transferred: number // The transferred payload size in bytes
	},
	time: {
		elapsed: number,    // The total elapsed seconds since the start (3 decimals)
		remaining: number   // The remaining seconds to finish (3 decimals)
	}
}

export async function download(url: string, progressCallback: ((_: IDownloadProgress) => void)|null = null): Promise<[Buffer, string]>
{
	return new Promise<[Buffer, string]>((resolve, reject) =>
		{
			let reqState = request(
				url,
				{ encoding: null },
				(err, result, body) =>
				{
					if(err) { reject(err); return; }

					if (result.statusCode !== 200) { reject("Non-200 status code returned"); return; }

					const fileName = result.request.uri.href.split("/").pop() as string;
					resolve([body, fileName]);
				}
			);

			if (progressCallback != null)
			{
				requestProgress(reqState).on("progress", progressCallback);
			}

			reqState.catch(reject);
		}
	);
}

export async function downloadMods(modTables: ITable[], version: string, modDirectory: string, manifestPath: string, log: (_: string) => void): Promise<void>
{
	const manifest = ModManifest.fromFile(manifestPath) || new ModManifest();

	for (let table of modTables)
	{
		const modTable = new ModTable(table);
		for (let i = 0; i < modTable.getModCount(); i++)
		{
			const [namespace, id] = modTable.getModId(i)!;
		}
	}
}
