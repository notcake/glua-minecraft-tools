/*
  Note: This is shitcode just meant to get the job done, I'm not learning typescript...

  Reads the manifest.json from download-mods and re-structures in solder mods-dir format

  This will zip up the .jar files into a mods/mod.jar format then place them in:
    mods/mod-slug/mod-slug-version.zip

  This will also create a .sql file for initially importing into the solder DB

  (Yes yes this could be async but idgaf; This only runs once to populate the initial solder db/fs)
*/

// Usage: solder-package [params] <mods_dir> <output_dir>

let fs = require('fs');
let util = require('util');
let path = require('path');
let crypto = require('crypto');
let mkdirp = require('mkdirp');
let printf = require('printf');
let spawnSync = require('child_process').spawnSync;
let JSZip = require("jszip");
let dJSON = require('dirty-json');
let SqlString = require('sqlstring');
let ArgumentParser = require('argparse').ArgumentParser;
let parser = new ArgumentParser({ addHelp: true });
parser.addArgument(
  [ '-s', '--sql' ], {
    action: 'storeTrue',
    help: 'Generate SQL file (You must generate zips first).'
  }
);
parser.addArgument(
  'mods_dir', {
    help: 'Directory containing the mod jars and manifest.json'
  }
);
parser.addArgument(
  'output_dir', {
    help: 'Directory to output the formatted mod zips and folders.'
  }
);
let args = parser.parseArgs();

function getMCMOD(jar_path) {
  // Read mcmod.info or fallback to info in filename
  let unzip = spawnSync('unzip', ['-p', jar_path, 'mcmod.info']);
  if (!unzip.error && unzip.stdout) {
    try {
      // let escaped_json = unzip.stdout.toString().replace('\n', '\\n');
      // Some mods think its okay to have raw newlines in their strings...
      var mcmod_json = dJSON.parse(unzip.stdout);
    } catch(e) {
      return {};
    };

    if (Array.isArray(mcmod_json)) {
      return mcmod_json[0];
    } else if (mcmod_json.modList) {
      return mcmod_json.modList[0];
    } else {
      return mcmod_json;
    }
  } else {
    console.log(jar_path + " has no mcmod.info!");
  }
  return {};
}

export interface IModInfo {
  jar_name: string,
  jar_path: string,
  mod_slug: string,
  mod_ver: string,
  zip_name: string,
  zip_path: string,
  manifest: object,
  mcmod: any,
};

let to_package: IModInfo[] = []; // Will contain the mods that need to be packaged
let manifest = require(args.mods_dir + '/manifest.json');
for (let section in manifest) {
  for (let mod_id in manifest[section]) {
    let mod_slug = mod_id.split(':')[1];
    let mod_mani = manifest[section][mod_id];
    let jar_path = util.format("%s/%s/%s", args.mods_dir, section, mod_mani.filename);

    // Holy shit getting a clean mod version is such a pain...
    let mod_ver: string | undefined = undefined;
    let mcmod_json = getMCMOD(jar_path);
    if (mcmod_json && (mcmod_json.version || mcmod_json.mcversion)) {
      let strip_re = /[^A-Za-z0-9\.\-]*/g; // Strip out all non-version-like
      let version_re = /.*?\-?([A-Za-z0-9\.\-]+[0-9A-Za-z])/; // Match only version-like without trail/head `-.`
      let clean_ver = mcmod_json.version ? mcmod_json.version.replace(strip_re, '') : undefined;
      let clean_mcver = mcmod_json.mcversion ? mcmod_json.mcversion.replace(strip_re, '') : undefined;
      if ((mcmod_json.version && mcmod_json.version.includes('$')) || (mcmod_json.mcversion && mcmod_json.mcversion.includes('$'))) {
        // Developer forgot to populate their ${version} letiables in the mcmod.info...
        // Just get the version from the filename
      } else if (clean_ver && clean_ver.includes(clean_mcver)) { // Sometimes devs put the mc ver inside the regular ver
        mod_ver = clean_ver;
      } else {
        mod_ver = (clean_ver ? clean_ver : '') + (clean_mcver ? '-' + clean_mcver : '');
      }
    }
    if (mod_ver === undefined) { // Fallback to version found in filename
      console.error(mod_slug, " missing/improper mcmod.info");
      let filename = path.basename(jar_path);
      let version_re = /.+?([0-9\.\-]+).*?\.jar/;
      let version = version_re.exec(filename);
      if (version && version[1]) {
        mod_ver = version[1].replace(/^[\-\.]*|[\-\.]*$/g, ''); // trim - and .
      } else {
        mod_ver = 'undefinedbecausetrashmod';
      }
    }

    let zip_name = util.format("%s-%s.zip", mod_slug, mod_ver);
    let zip_path = util.format("%s/mods/%s/%s", args.output_dir, mod_slug, zip_name);
    let todo: IModInfo = {
      jar_name: mod_mani.filename,
      jar_path: jar_path,
      mod_slug: mod_slug,
      mod_ver: mod_ver,
      zip_name: zip_name,
      zip_path: zip_path,
      manifest: mod_mani,
      mcmod: mcmod_json
    };
    to_package.push(todo);
  }
}

// Recursively write our packaged jar mods
let nindex = 0;
function package_mod(index) {
  nindex += 1;
  let mod_info = to_package[index];
  if (!mod_info) { return; }
  let zip = new JSZip();
  let jar_data = fs.readFileSync(mod_info.jar_path);
  mkdirp.sync(path.dirname(mod_info.zip_path));
  zip.file('mods/' + mod_info.jar_name, jar_data);
  zip.generateNodeStream({type:'nodebuffer',streamFiles:true})
  .pipe(fs.createWriteStream(mod_info.zip_path))
  .on('finish', function () {
      console.log(mod_info.zip_path + " written.");
      package_mod(nindex);
  });
}

if (args.sql) {
  console.log('Generating SQL import script for mod zips...');
  // Create SQL file for importing into DB
  let generateModSQL = (mod_slug, desc, author, url, pretty_name) => `\
  INSERT OR IGNORE INTO mods (name, description, author, link, created_at, updated_at, pretty_name) VALUES\
  ('${mod_slug}', ${SqlString.escape(desc)}, ${SqlString.escape(author)}, ${SqlString.escape(url)}, \
  DATETIME('NOW'), DATETIME('NOW'), ${SqlString.escape(pretty_name)});\n`;

  let generateModVersionSQL = (mod_slug, mod_version, mod_md5, bytes) => `\
  INSERT OR IGNORE INTO modversions (mod_id, version, md5, created_at, updated_at, filesize) SELECT \
  (SELECT id FROM mods WHERE name = '${mod_slug}'), '${mod_version}', '${mod_md5}', DATETIME('NOW'), DATETIME('NOW'), ${bytes} \
  WHERE NOT EXISTS (SELECT * FROM modversions WHERE mod_id = (SELECT id FROM mods WHERE name = '${mod_slug}') AND version = '${mod_version}');\n\n`;

  // Hold this one-liner for adding all mods to a modpack build
  // INSERT INTO build_modversion (modversion_id, build_id, created_at, updated_at) SELECT id, PACK_BUILD_ID, DATETIME('NOW'), DATETIME('NOW') FROM mods;

  let sql_filepath = args.output_dir + '/import.sql';
  try {
    fs.unlinkSync(sql_filepath); // Delete previous import.sql
  } catch(e) {}
  for (let key in to_package) {
    let mod = to_package[key];
    if (!mod || !mod.mod_slug) { continue; }
    let mod_zip_stat = fs.statSync(mod.zip_path);
    let writeOptions = {
      encoding: null,
      mode: null,
      flag: 'a'
    }
    let desc = (mod.mcmod && mod.mcmod.description) ? mod.mcmod.description.replace(/\'/g, '') : '';
    let url = (mod.mcmod && mod.mcmod.url) ? mod.mcmod.url.replace(/\'/g, '') : '';
    let pretty_name = (mod.mcmod && mod.mcmod.name) ? mod.mcmod.name.replace(/\'/g, '') : mod.mod_slug;
    let author = (mod.mcmod && Array.isArray(mod.mcmod.authorList)) ? mod.mcmod.authorList.join().replace(/\'/g, '') : undefined;
    let zip_md5 = crypto.createHash("md5").update(fs.readFileSync(mod.zip_path)).digest("hex");
    if (!author) {
      (mod.mcmod && Array.isArray(mod.mcmod.authors)) ? mod.mcmod.authors.join().replace(/\'/g, '') : '';
    }
    fs.writeFileSync(sql_filepath, generateModSQL(mod.mod_slug, desc, author, url, pretty_name), writeOptions);
    fs.writeFileSync(sql_filepath, generateModVersionSQL(mod.mod_slug, mod.mod_ver, zip_md5, mod_zip_stat.size), writeOptions);
  }
} else {
  package_mod(0);
  console.log('Packaging mod jars into zips...');
}
