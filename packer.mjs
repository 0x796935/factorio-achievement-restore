//  import FileReader
import pako from './pako.js';
import fs from 'fs';
import { createInterface } from 'readline';
import extract from 'extract-zip'
import archiver from 'archiver'
import path from 'path';

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
  switch(process.platform) {
    case 'linux':
      gamePath = path.join(process.env.HOME, '.factorio');
      break;
    case 'win32':
      gamePath = path.join(process.env.APPDATA, 'Factorio');
      break;
    case 'darwin':
      gamePath = path.join(process.env.HOME, 'Library', 'Application Support', 'factorio')
      break;
  }
  
  var savegames = fs.readdirSync(path.join(gamePath, 'saves'));
  savegames = savegames.filter(file => file.toLowerCase().endsWith('.zip'));

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
    await fs.copyFileSync(path.join(gamePath, 'saves', `${savegame}`), './temp/savegame.zip');

    // unzip savegame
    const scriptDirectoryPath = fs.realpathSync(process.cwd()); 

    await extract('./temp/savegame.zip', { dir: scriptDirectoryPath+'/temp' })

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

      await zipFolder(`./temp`, path.join(gamePath, 'saves', `${savegame.replace('.zip', '')}_changed.zip`));
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

    for (const file of files) {
      // use pako.inflate
      const input = fs.readFileSync(`./input/${file}`);
      var output = pako.inflate(input);

      // hex dump output to console
      var hexBuffer = Buffer.from(output)
      const hex = hexBuffer.toString('hex');
      // convert hex to ansii string 
      const outputString = hex.match(/.{1,2}/g).map(byte => String.fromCharCode(parseInt(byte, 16))).join('');


      var changedCount = 0


      // NOT THE REASON FOR issue #2:
      // https://github.com/0x796935/factorio-achievement-restore/issues/2

      // const fakeBuffer = hexBuffer;
      // let allOffsets = [];
      // while(fakeBuffer.indexOf(Buffer.from([0x63, 0x6F, 0x6D, 0x6D, 0x61, 0x6E, 0x64])) !== -1) {
      //   const offset = fakeBuffer.indexOf(Buffer.from([0x63, 0x6F, 0x6D, 0x6D, 0x61, 0x6E, 0x64]));
      //   allOffsets.push(offset);
      //   fakeBuffer[offset] = 0x00;
      // }
      // console.log(allOffsets);

      // for(let offset of allOffsets) {
      //   // if 01 xx 63 6F 6D 6D 61 6E 64 2D 72 61 6E
      //   // then change to
      //   // 00 xx 63 6F 6D 6D 61 6E 64 2D 72 61 6E
      //   if(hexBuffer[offset-2] === 0x01) {
      //     console.log(`[+] Removed cheat flag from offset ${offset}`)
      //     hexBuffer[offset-2] = 0x00
      //     hexBuffer[offset] = 0x63 // setting back c for some reason
      //     changedCount++

      //   }
        
      // }

      if(!outputString.includes('command-ran'))
        continue;

      console.log(`[!] Found command in ${file}`)

      // search all hex of: "FF FF 00 01 00"
      // search hex 
      // while hexBuffer has 0xFF 0xFF 0x00 0x01 0x00
      while(hexBuffer.indexOf(Buffer.from([0xFF, 0xFF, 0x00, 0x01, 0x00])) !== -1) {
          // replace the 0x01 with 0x00 in the hexBuffer 
          const offset = hexBuffer.indexOf(Buffer.from([0xFF, 0xFF, 0x00, 0x01, 0x00]))
          console.log(`[+] Removed cheat flag from offset ${offset}`)
          hexBuffer[offset + 3] = 0x00
          changedCount++
      }
      if (changedCount === 0) {
        console.log('[/] No changes made to file')
        continue;
      }
      // convert hexBuffer back to Uint8Array
      output = Uint8Array.from(hexBuffer)

      // pako deflate and write to ./output/*
      output = pako.deflate(output)

      console.log(`[+] Wrote ${file} to ./output/${file}`)
      fs.writeFileSync(`./output/${file}`, output)
    }
    resolve();
  });
}

main();
