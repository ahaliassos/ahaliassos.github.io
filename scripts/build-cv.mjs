import { readFile, writeFile, mkdir, mkdtemp } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { root, cvInputs, renderCV, digest } from './cv-source.mjs';

const {profile,papers,cv,template} = await cvInputs();
const source = renderCV(profile,papers,cv,template);
const artifactRoot = path.join(root,'.artifacts/cv-build');
await mkdir(artifactRoot,{recursive:true});
const directory = await mkdtemp(path.join(artifactRoot,'run-'));
const stem = 'alexandros-haliassos-cv';
const sourcePath = path.join(directory,`${stem}.tex`);
await writeFile(sourcePath,source);
function run(command,args) {
  const result = spawnSync(command,args,{encoding:'utf8',cwd:root});
  if (result.error) throw new Error(`${command} is required to rebuild the CV: ${result.error.message}`);
  if (result.status !== 0) throw new Error(`${command} failed:\n${result.stdout}\n${result.stderr}`);
  return result.stdout;
}
const offline = process.argv.includes('--offline') ? ['--only-cached'] : [];
run('tectonic',[...offline,'--keep-logs','--outdir',directory,sourcePath]);
const log = await readFile(path.join(directory,`${stem}.log`),'utf8');
if (/Overfull \\[hv]box|Missing character:|LaTeX Font Warning/.test(log)) {
  throw new Error(`CV layout/font problem. Inspect ${path.join(directory,`${stem}.log`)}`);
}
const pdfPath = path.join(directory,`${stem}.pdf`);
const info = run('pdfinfo',[pdfPath]);
const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
if (pages !== 2) throw new Error(`CV has ${pages} pages; expected two. Inspect ${pdfPath}`);
if (!/^Page size:.*A4/m.test(info)) throw new Error('Expected an A4 CV.');
const pdf = await readFile(pdfPath);
await writeFile(path.join(root,'cv',`${stem}.tex`),source);
await writeFile(path.join(root,'assets',`${stem}.pdf`),pdf);
await writeFile(path.join(root,'cv/build.json'),JSON.stringify({
  sourceSha256:digest(source),pdfSha256:digest(pdf),pages,engine:'Tectonic / XeLaTeX'
},null,2)+'\n');
console.log(`Typeset and checked the ${pages}-page CV. Editable LaTeX: cv/${stem}.tex`);
