import { readFile, stat } from 'node:fs/promises';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { readVerifiedCV } from './cv-source.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const dist=path.join(root,'dist');
const papers=JSON.parse(await readFile(path.join(root,'data/publications.json'),'utf8'));
assert.equal(new Set(papers.map(p=>p.id)).size,papers.length,'Unique paper IDs');
assert.equal(papers.filter(p=>p.selected).length,5,'Five selected papers');
for(const p of papers){assert(p.authors.includes('Alexandros Haliassos'),`Missing author: ${p.id}`);assert(p.source,`Missing source: ${p.id}`);assert(p.topics.length);assert.equal(new URL(p.paper).protocol,'https:');}
const decode=s=>s.replace(/&amp;/g,'&').replace(/&#39;/g,"'").replace(/&quot;/g,'"').replace(/&lt;/g,'<').replace(/&gt;/g,'>');
const htmlPages=new Map();
for(const file of ['index.html','publications.html','cv.html','404.html']){
  const html=await readFile(path.join(dist,file),'utf8');htmlPages.set(file,html);
  assert.equal((html.match(/<h1[ >]/g)||[]).length,1,`${file}: single h1`);
  assert.equal((html.match(/<main[ >]/g)||[]).length,1,`${file}: single main`);
  assert(html.includes('lang="en-GB"'));assert(html.includes('name="viewport"'));
  const ids=[...html.matchAll(/\bid="([^"]+)"/g)].map(m=>m[1]);
  assert.equal(new Set(ids).size,ids.length,`${file}: duplicate IDs`);
  const json=html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
  assert.equal(JSON.parse(json[1]).name,'Alexandros Haliassos');
  assert(!/\b(?:TODO|Lorem ipsum|undefined)\b/.test(html),`${file}: placeholder content`);
}
let checkedLinks=0;
const siteURL=new URL(decode(htmlPages.get('index.html').match(/rel="canonical" href="([^"]+)"/)[1]));
const pageCases=[...htmlPages];
// A host serves this same error document at the requested URL, not /404.html.
for(const missing of ['missing/nested-page','missing/nested/page/'])pageCases.push([missing,htmlPages.get('404.html')]);
for(const [file,html] of pageCases){
  for(const match of html.matchAll(/(?:href|src)="([^"]+)"/g)){
    const href=decode(match[1]);if(/^(https?:|mailto:)/.test(href))continue;
    if(href.startsWith('#')){
      assert(html.includes(`id="${href.slice(1)}"`),`${file}: broken anchor ${href}`);
      checkedLinks++;
      continue;
    }
    const url=new URL(href,new URL(file,siteURL));
    assert(url.pathname.startsWith(siteURL.pathname),`${file}: link leaves site root: ${href}`);
    const target=url.pathname.slice(siteURL.pathname.length)||'index.html';
    assert((await stat(path.join(dist,target))).isFile(),`${file}: missing ${href}`);
    const fragment=url.hash.slice(1);
    if(fragment){const targetHTML=htmlPages.get(target)||await readFile(path.join(dist,target),'utf8');assert(targetHTML.includes(`id="${fragment}"`),`${file}: broken anchor ${href}`);}
    checkedLinks++;
  }
}
const png=await readFile(path.join(dist,'assets/social-preview.png'));
assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1200);assert.equal(png.readUInt32BE(20),630);
const pdf=await readFile(path.join(dist,'assets/alexandros-haliassos-cv.pdf'));
assert.deepEqual(pdf,await readVerifiedCV(),'Published CV must match the current, verified two-page PDF');
const pubHTML=htmlPages.get('publications.html');
assert.equal((pubHTML.match(/class="paper-row publication"/g)||[]).length,papers.length);
assert(pubHTML.includes('class="publication-controls" hidden'),'Controls should be hidden without JavaScript');
const bibliography=await readFile(path.join(dist,'assets/publications.bib'),'utf8');
const inlineCitations=[...pubHTML.matchAll(/<pre>([\s\S]*?)<\/pre>/g)].map(match=>decode(match[1]));
assert.equal(inlineCitations.length,papers.length);
assert.equal(bibliography,inlineCitations.join('\n\n')+'\n','Downloaded and inline citations must match');
for(const name of ['CTC','BRAVEn','Auto-AVSR','SparseVSR','SVTS']){
  assert(bibliography.includes(`{${name}}`),`BibTeX must preserve ${name} under title-case conversion`);
}

// Exercise the actual browser script against small DOM test doubles. This checks
// filtering interactions and progressive enhancement without a browser dependency.
class Element {
  constructor(data={}){this.dataset=data;this.hidden=false;this.value='';this.textContent='';this.events={};this.attrs={};}
  addEventListener(type,fn){this.events[type]=fn;}
  setAttribute(name,value){this.attrs[name]=value;}
  focus(){this.focused=true;}
  fire(type){return this.events[type]?.();}
}
const articles=[...pubHTML.matchAll(/<article class="paper-row publication" id="([^"]+)" data-topics="([^"]+)" data-search="([^"]+)"/g)].map(m=>{const e=new Element({topics:m[2],search:decode(m[3])});e.id=m[1];return e;});
const filters=['all','deepfakes','representation','speech','generation','other'].map(filter=>new Element({filter}));
const controls=new Element(),search=new Element(),count=new Element(),empty=new Element(),reset=new Element(),print=new Element();
const selectors={'.publication-controls':controls,'#publication-search':search,'.result-count':count,'.empty-state':empty,'#reset-search':reset,'.print-cv':print};
let printed=false;
const context={document:{querySelector:s=>selectors[s],querySelectorAll:s=>s==='.publication'?articles:s==='[data-filter]'?filters:[]},navigator:{},window:{addEventListener(){},print(){printed=true;}},setTimeout};
vm.runInNewContext(await readFile(path.join(root,'assets/site.js'),'utf8'),context);
assert.equal(articles.filter(a=>!a.hidden).length,papers.length);
filters[1].fire('click');assert.deepEqual(articles.filter(a=>!a.hidden).map(a=>a.id),['realforensics','lipforensics']);
search.value='CTC';search.fire('input');assert.equal(count.textContent,'0 publications');assert.equal(empty.hidden,false);
reset.fire('click');assert.equal(count.textContent,`${papers.length} publications`);assert(search.focused);
search.value='iclr 2026';search.fire('input');assert.deepEqual(articles.filter(a=>!a.hidden).map(a=>a.id),['usr2']);
search.value="lips don't lie";search.fire('input');assert.deepEqual(articles.filter(a=>!a.hidden).map(a=>a.id),['lipforensics']);
search.value='Bjorn';search.fire('input');assert.deepEqual(articles.filter(a=>!a.hidden).map(a=>a.id),['svts']);
search.value='  ';search.fire('input');assert.equal(count.textContent,`${papers.length} publications`);
filters.at(-1).fire('click');search.value='EAGE';search.fire('input');
assert.deepEqual(articles.filter(a=>!a.hidden).map(a=>a.id),['spectral']);
print.fire('click');assert(printed);
console.log(`Passed: ${papers.length} publication records, 4 pages, ${checkedLinks} local links and anchors (including nested 404 URLs), protected BibTeX names, structured metadata, 1200×630 social image, 2-page PDF, topic/search/reset/print interactions.`);
console.log('These are file and script checks. Browser layout and external URL availability require separate verification.');
