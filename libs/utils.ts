import * as fs from "fs";
import * as request from "request-promise";

export async function readUri(uri: string): Promise<string|null>
{
        try
        {
                if (uri.toLowerCase().startsWith("http://") ||
                    uri.toLowerCase().startsWith("https://"))
                {
                        return await request.get(uri);
                }
                else
                {
                        return fs.readFileSync(uri, "utf-8");
                }
        }
        catch (e)
        {
                return null;
        }
}

