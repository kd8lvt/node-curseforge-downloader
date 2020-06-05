log = console.log;
console.log = (msg) => {
	if (verbose) log(msg);
}

let curse = require('mc-curseforge-api');
let fs = require('fs');
let path = require('path');

let download = true;
let verbose = false;
let argSearch = {
	"v": {
		"description": "Whether or not to log debug information (DEFAULT: false)",
		"func": verbosity
	},
	"verbosity": {
		"description": "Whether or not to log debug information (DEFAULT: false)",
		"func": verbosity
	},
	"verbose": {
		"description": "Whether or not to log debug information (DEFAULT: false)",
		"func": verbosity
	},
	"verb": {
		"description": "Whether or not to log debug information (DEFAULT: false)",
		"func": verbosity
	},
	"dry": {
		"description": "If true, don't download any mods.  (DEFAULT: true)",
		"func": drymode
	},
	"nodownload": {
		"description": "If true, don't download any mods.  (DEFAULT: true)",
		"func": drymode
	},
	"nodl": {
		"description": "If true, don't download any mods.  (DEFAULT: true)",
		"func": drymode
	},
	"preset": {
		"description": "The preset to download.",
		"func": parsePreset
	},
	"mod": {
		"description": "The mod to download.",
		"func": parseMod
	},
	"cat": {
		"description": "This will output the names of presets in any given category, if any.",
		"func": category
	},
	"category": {
		"description": "This will output the names of presets in any given category, if any.",
		"func": category
	},
	"list": {
		"description": "This will output the names of presets in any given category, if any.",
		"func": category
	},
	"version": {
		"description": "This will output the names of presets created for any given version, if any.",
		"func": version
	},
	"ver": {
		"description": "This will output the names of presets created for any given version, if any.",
		"func": version
	},
	"info": {
		"description": "This will output the description and version data of a given preset, if it exists.",
		"func": info
	},
	"i": {
		"description": "This will output the description and version data of a given preset, if it exists.",
		"func": info
	},
	"help": {
		"description": "Output this message.",
		"func": help
	},
	"h": {
		"description": "Output this message.",
		"func": help
	},
	"gameVersion": {
		"description": "Use this to choose the game version for the 'mod' argument.",
		"func":()=>{}
	}
}

function parseArgs() {
	let args = process.argv.splice(2);
	for (arg of args) {
		split = arg.split('=');
		for (k of Object.keys(argSearch)) {
			if (!argSearch.hasOwnProperty(k)) continue;
			if (split[0].toLowerCase() == k.toLowerCase()) {
				v = argSearch[k]
				v.func(split[1],args);
			}
		}
	}
}

parseArgs();


function info(presetName,args) {
	let presets = JSON.parse(fs.readFileSync('presets.json','utf-8')).presets;
	let preset = presets[presetName];
	if (preset == null || preset == undefined) return log('No modpack found named "'+presetName+'".');
	log('Preset Version: '+preset.version);
	log('Game Version: '+preset.mcversion);
	log('Preset Description: '+preset.description);
	(preset.presets != undefined ? log('Sub-presets: '+preset.presets) : null);
}

function help(arg,args) {
	let prevArg = '';
	let multipleCount = 0;
	log('--------------');
	log("HELP DATA: ");
	for (key of Object.keys(argSearch)) {
		if (!(argSearch.hasOwnProperty(key))) continue;
		if (prevArg == argSearch[key].description) {
			if (multipleCount == 0) log('Aliases: ');
			log("    "+key);
			multipleCount++;
		} else {
			multipleCount = 0;
			log('--------------')
			log(key+': '+argSearch[key].description);
			prevArg = argSearch[key].description;
		}
	}
	log('--------------');
	log('To properly use an argument, use the following syntax: `arg=value`')
}

function category(argValue,args) {
	let categories = JSON.parse(fs.readFileSync('presets.json','utf-8')).categorylisting;
	if (categories[argValue] != null && categories[argValue] != undefined) {
		log('Presets found with category tag "'+argValue+'": '+JSON.stringify(categories[argValue]));
	} else {
		log('No presets found with category tag "'+argValue+'".');
	}
}


function version(argValue,args) {
	let versions = JSON.parse(fs.readFileSync('presets.json','utf-8')).versionlisting;
	if (versions[argValue] != null && versions[argValue] != undefined) {
		log('Presets found with version tag "'+argValue+'": '+JSON.stringify(versions[argValue]));
	} else {
		log('No presets found with version tag "'+argValue+'".');
	}
}

function drymode(setValue,args) {
	let value = false;
	if (setValue.toLowerCase() == "true" || setValue.toLowerCase() == "yes" || setValue.toLowerCase() == 'enabled') value = true;
	download = !value;
}

function verbosity(setValue,args) {
	let value = false;
	if (setValue.toLowerCase() == "true" || setValue.toLowerCase() == "yes" || setValue.toLowerCase() == 'enabled') value = true;
	verbose = value;
}

function parseMod(modSearch,args) {
	cont = (version) => {
		if (version == '') return log('ERORR: You didn\'t specify a game version for your mod download! Please use `gameVersion=1.12.2` (for example) to choose a game version!');
		downloadMod(modSearch,version);
	}
	for (arg of args) {
		split = arg.split('=');
		if (split[0] == 'gameVersion') { return cont(split[1]); }
	}
	return log('ERORR: You didn\'t specify a game version for your mod download! Please use `gameVersion=1.12.2` (for example) to choose a game version!');
}

async function parsePreset(presetName,args) {
	let presets = await JSON.parse(fs.readFileSync('presets.json','utf-8')).presets;
	let preset = presets[presetName];
	console.log('/////////////////////////////////////////');
	let modsToDownload = await parsePresetWorker(presetName,presets);
	downloadList(modsToDownload,preset);
}

function downloadList(modsToDownload,preset) {
	for (mod of modsToDownload) {
	 	downloadMod(mod,preset.mcversion).then(deps => {
	 		downloadIDList(deps,preset);
	 	}).catch(err=>{
	 		//Catch any errors... hopefully...
			if (verbose) console.log(err);
		});;
	}
}

function parsePresetWorker(presetName,presets) {
	let preset = presets[presetName];
	let gameVersion = preset.mcversion || "1.12.2";
	let modsToDownload = [];
	if (preset.mods != null) {
		if (preset.mods.length > 0) {
			for (let mod of preset.mods) {
				modsToDownload.push(mod);
			}
		}
	}
	if (preset.presets != null) {
		if (preset.presets.length > 0) {
			for (let childPreset of preset.presets) {
				for (mod of parsePresetWorker(childPreset,presets)) {
					modsToDownload.push(mod);
				}
			}
		}
	}
	console.log('Mods to download from preset "'+presetName+'"'+(preset.presets != null ? ' (Including mods from: '+preset.presets.reduce((a,b,idx)=>{return a+='"'+b+'"'+(idx != preset.presets.length-1 ? ',' : '')},'')+')' : '')+': '+modsToDownload);
	console.log('/////////////////////////////////////////');
	return modsToDownload;
}

function downloadIDList(modIds,preset) {
	//TODO: load a mod from an id 
	for (mod of modIds) {
		console.log("MOD ID: "+mod);
		curse.getMod(mod).then((modData)=>{
			console.log(modData.name);
	 		downloadMod(modData.name,preset.mcversion).then(deps => {
	 			if (deps.length > 0) {
	 				downloadIDList(deps,preset);
		 		}
	 		}).catch(err=>{
				if (verbose) console.log(err);
			});
	 	});
	}
}

function downloadMod(modName,gameVersion) {
	let returnValue = null;
	return new Promise((res,rej)=>{
		curse.getMods({"gameVersion":gameVersion,"searchFilter":modName}).then(mods=>{
			console.log('Getting file listing for "'+modName+'"...');
			let modCanidate;
			for (mod of mods) {
				(mod.name == null || mod.name == undefined ? console.log(mod) : null);
				console.log('Found canidate "'+mod.name+'" for mod search "'+modName+'"');
				if (mod.name.toLowerCase() == modName.toLowerCase() || mod.name.toLowerCase().includes(modName.toLowerCase()) || mod.name.toLowerCase().includes(modName.toLowerCase().replace('and','&'))) {
					modCanidate = mod;
					break;
				}
			}
			modCanidate.getFiles().then(files => {
				let canidates = [];
				for (file of files) {
					if (file["minecraft_versions"].includes(gameVersion)) canidates.push(file);
				}
				console.log('Got file canidates for "'+modName+'"...');
				canidates.sort((a,b) => {
					let aDate = Date.parse(a.timestamp);
					let bDate = Date.parse(b.timestamp);
					return bDate - aDate; 
				})
				console.log('Downloading "'+modName+'". URL: "'+canidates[0]["download_url"]+'"');
				let filename = canidates[0]["download_url"].split('/')[canidates[0]["download_url"].split("/").length-1];
				let location = path.join(__dirname,'mods',filename);
				if (download && fs.existsSync(location) == false) {
					try {
						canidates[0].download(location).then(path=>{
							console.log('Downloaded "'+modName+'" to '+location);
						}).catch(err=>{
							if (verbose) console.log(err);
						});
					} catch(err){
						if (verbose) console.log(err);
					};
				}
				if (canidates[0]["mod_dependencies"].length > 0) {
					deps = getRequiredDependencies(canidates[0]["mod_dependencies"]);
					res(deps);
				}
				res([]);
			}).catch(err=>{
				if (verbose) console.log(err);
			});
		}).catch(err=>{
			if (verbose) console.log(err);
		});
	});
}

function getRequiredDependencies(deps) {
	let dependencies = [];
	for (dep of deps) {
		if (dep.type == 3) {
			dependencies.push(dep.addonId);
		}
	}
	return dependencies;
}
