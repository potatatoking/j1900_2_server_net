import fs from 'node:fs/promises';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
async function check(dir){
  for(const entry of await fs.readdir(dir,{withFileTypes:true})){
    if(['node_modules','vendor','data','.git'].includes(entry.name))continue;
    const file=path.join(dir,entry.name);
    if(entry.isDirectory())await check(file);
    else if(/\.(mjs|js)$/.test(entry.name)){
      const result=spawnSync(process.execPath,['--check',file],{stdio:'inherit'});
      if(result.status!==0)process.exit(result.status || 1);
    }
  }
}
await check(root);
console.log('JavaScript syntax checks passed.');
