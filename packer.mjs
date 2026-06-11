//  import FileReader
import pako from './pako.js';
import fs from 'fs';
import { createInterface } from 'readline';
import yauzl from 'yauzl'
import archiver from 'archiver'
import path from 'path';

// Unzip a Factorio save (`zipPath`) into `destDir`, writing every entry to disk.
function extractZip(zipPath, destDir) {
  return new Promise((resolve, reject) => {
    yauzl.open(zipPath, { lazyEntries: true }, (err, zip) => {
      if (err) return reject(err);
      zip.on('error', reject);
      zip.on('end', resolve);
      zip.on('entry', (entry) => {
        const outPath = path.join(destDir, entry.fileName);
        if (entry.fileName.endsWith('/')) { fs.mkdirSync(outPath, { recursive: true }); return zip.readEntry(); }
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        const stored = entry.compressionMethod === 0;
        zip.openReadStream(entry, stored ? {} : { decompress: false }, (e, rs) => {
          if (e) return reject(e);
          const parts = [];
          rs.on('data', (c) => parts.push(c));
          rs.on('end', () => {
            const raw = Buffer.concat(parts);
            fs.writeFileSync(outPath, stored ? raw : Buffer.from(pako.inflateRaw(raw)));
            zip.readEntry();
          });
        });
      });
      zip.readEntry();
    });
  });
}

// Thanks to u/KimJonhUnsSon which posted a solution for this on reddit
// https://www.reddit.com/r/factorio/comments/rlprxh/text_tutorial_for_reenabling_achievements_after/
// ========================
// Made by u/LagKnowsWhy on reddit
// @yi5 on discord
// https://github.com/0x796935
// ========================

function zipFolder(sourceFolder, targetZip) {
  return new Promise((resolve, reject) => {
    const output = fs.createWriteStream(targetZip);
    const archive = archiver('zip');

    output.on('close', () => {
      resolve();
    });

    archive.on('error', (err) => {
      reject(err);
    });

    archive.pipe(output);
    archive.directory(sourceFolder, false);
    archive.finalize();
  });
}

// let user pick a savegame from %appdata%/Factorio/saves/*.zip
async function main() {
  var gamePath = '';
  var savesPath = '';
  switch(process.platform) {
    case 'linux':
      gamePath = path.join(process.env.HOME, '.factorio');
      savesPath = path.join(gamePath, 'saves');
      break;
    case 'win32':
      gamePath = path.join(process.env.APPDATA, 'Factorio');
      savesPath = path.join(gamePath, 'saves');
      break;
    case 'darwin':
      gamePath = path.join(process.env.HOME, 'Library', 'Application Support', 'factorio');
      savesPath = path.join(gamePath, 'saves');
      break;
  }
  
  var savegames;
  try
  {
    // if save location supported from the switch statement
    savegames = fs.readdirSync(savesPath);
    savegames = savegames.filter(file => file.toLowerCase().endsWith('.zip'));
  }
  catch(e)
  {
    // if save location not supported from switch statement
    var customPath = await getCustomPath();
    console.log('');
    savesPath = customPath;
    savegames = fs.readdirSync(savesPath);
    savegames = savegames.filter(file => file.toLowerCase().endsWith('.zip'));
  }

  console.log('Pick a savegame to unpack:');
  for (let i = 0; i < savegames.length; i++) {
    console.log(`${i}:\t${savegames[i]}`);
  }

  const readline = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  await readline.question(`Enter a number: `, async (number) => {
    readline.close();
    if(isNaN(number)) {
      console.log('Not a number');
      process.exit(1);
    }
    if(number < 0 || number >= savegames.length) {
      console.log('Number out of range');
      process.exit(1);
    }

    const savegame = savegames[number];
    console.log(`You picked: ${savegame}`);

    // copy zip to temp folder
    try{
      await fs.rmSync('./temp', { recursive: true, force: true })
      await fs.mkdirSync('./temp');
      
      // clear temp folder
    } catch(e) {}
    await fs.copyFileSync(path.join(savesPath, `${savegame}`), './temp/savegame.zip');

    // unzip savegame
    const scriptDirectoryPath = fs.realpathSync(process.cwd()); 

    await extractZip('./temp/savegame.zip', scriptDirectoryPath+'/temp')

    // copy all "*.dat{0-9}[0-9]" files to input folder
    var files = await fs.readdirSync(`./temp/${savegame.replace('.zip', '')}`);
    files = files.filter(file => file.toLowerCase().includes('level.dat'));
    // remove all files which dont end with 0-9
    files = files.filter(file => file.match(/.*\d$/));

    // console.log(files)

    console.log(`[+] Found ${files.length} .dat files`)

    if(files.length == 0) {
      console.log('[-] No savegame found');
      process.exit(1);
    }
    
    // clear input folder
    try{
      await fs.rmSync('./input', { recursive: true, force: true })
      await fs.mkdirSync('./input');
    }catch(e) {}
    // clear output folder
    try{
      await fs.rmSync('./output', { recursive: true, force: true })
      await fs.mkdirSync('./output');
    }catch(e) {}

    // copy all files to input folder
    for(let file of files) {
      await fs.copyFileSync(`./temp/${savegame.replace('.zip', '')}/${file}`, `./input/${file}`);
    }

    try{
      await removeCheatFromSavegame();

      // copy output files into ./temp/${savegame.replace('.zip', '')}/${file}
      files = await fs.readdirSync(`./output`);
      for(let file of files) {
        console.log(`[+] Copied ${file} to savegame`)
        await fs.copyFileSync(`./output/${file}`, `./temp/${savegame.replace('.zip', '')}/${file}`);
      }

      // zip savegame
      // move folder from savegame to savegame_changed
      await fs.renameSync(`./temp/${savegame.replace('.zip', '')}`, `./temp/${savegame.replace('.zip', '')}_changed`);
      // remove old zip
      await fs.rmSync(`./temp/savegame.zip`);

      await zipFolder(`./temp`, path.join(savesPath, `${savegame.replace('.zip', '')}_changed.zip`));
      console.log(`[+] Zipping savegame to .../saves/${savegame.replace('.zip', '')}_changed.zip`)
      console.log(`[+] Enjoy your achievements!`)

    } catch(e) {
      console.log('[-]Error while removing cheat from savegame')
      console.log(e)
      process.exit(1);
    }


  });
}

async function removeCheatFromSavegame() {
  return new Promise((resolve, reject) => {

    const files = fs.readdirSync('./input');
    let foundCommandRan = false;

    for (const file of files) {
      console.log(`starting to read file ${file}`)

      const input = fs.readFileSync(`./input/${file}`);

      // Determine the compression method used for the dat file content so we
      // can recompress with the same method after patching.
      let output;
      let compressionType;
      try {
        output = pako.inflate(input);
        compressionType = 'zlib';
      } catch (_) {
        try {
          output = pako.inflateRaw(input);
          compressionType = 'raw';
        } catch (_2) {
          // Not compressed — use data as-is
          output = input;
          compressionType = 'none';
        }
      }

      var hexBuffer = Buffer.from(output)
      const hex = hexBuffer.toString('hex');
      // convert hex to ascii string
      const outputString = hex.match(/.{1,2}/g).map(byte => String.fromCharCode(parseInt(byte, 16))).join('');


      var changedCount = 0

      if(!outputString.includes('command-ran')) {
        continue;
      }

      foundCommandRan = true;
      console.log(`[!] Found command in ${file}`)

      // Primary pattern: cheat / command-ran flag (Map+0x22f in the Factorio
      // binary, confirmed on Factorio 2.0.x by binary analysis).
      // Context bytes "FF FF 00" immediately precede the flag byte 0x01.
      while(hexBuffer.indexOf(Buffer.from([0xFF, 0xFF, 0x00, 0x01, 0x00])) !== -1) {
          const offset = hexBuffer.indexOf(Buffer.from([0xFF, 0xFF, 0x00, 0x01, 0x00]))
          console.log(`[+] Removed cheat flag (command/cheat) from offset ${offset}`)
          hexBuffer[offset + 3] = 0x00
          changedCount++
      }

      // Secondary pattern: editor-used flag (Map+0x230 in the Factorio binary,
      // one byte after the command/cheat flag).
      // Context bytes "FF FF 01" precede the editor flag byte 0x01.
      while(hexBuffer.indexOf(Buffer.from([0xFF, 0xFF, 0x01, 0x01, 0x00])) !== -1) {
          const offset = hexBuffer.indexOf(Buffer.from([0xFF, 0xFF, 0x01, 0x01, 0x00]))
          console.log(`[+] Removed cheat flag (editor) from offset ${offset}`)
          hexBuffer[offset + 3] = 0x00
          changedCount++
      }

      if (changedCount === 0) {
        console.log('[/] No cheat flag bytes found in file — save may already be clean, or the format has changed in this Factorio version.')
        continue;
      }
      // convert hexBuffer back to Uint8Array
      output = Uint8Array.from(hexBuffer)

      // Recompress using the same method as the original file
      if (compressionType === 'zlib') {
        output = pako.deflate(output)
      } else if (compressionType === 'raw') {
        output = pako.deflateRaw(output)
      }
      // compressionType === 'none': keep uncompressed output as-is

      console.log(`[+] Wrote ${file} to ./output/${file}`)
      fs.writeFileSync(`./output/${file}`, output)
    }

    if (!foundCommandRan) {
      console.log('')
      console.log('[!] Warning: No "command-ran" marker was found in any level.dat file.')
      console.log('[!] This usually means one of:')
      console.log('[!]   1. You used /editor or /cheat instead of /c (not supported yet)')
      console.log('[!]   2. The command log has scrolled out of the current save chunks')
      console.log('[!] Workaround: load the save in-game, run any /c command (e.g.')
      console.log('[!]   /c game.player.print("test")), save again, then re-run this tool.')
    }

    resolve();
  });
}

async function getCustomPath() {
  console.log('[*]Unable to find factorio save(s)');
  console.log('[*]Please specify path to saves folder');
  console.log('');
  const readline = createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise(resolve => readline.question(`PATH: `, path => {
    readline.close();
    resolve(path);
  }))
}

main();
