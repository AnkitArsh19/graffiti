const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const OUT=path.join(__dirname,'data','export_scope');
fs.mkdirSync(OUT,{recursive:true});

function rect(id,pageId,x,y){return {id,pageId,type:'rectangle',x,y,width:90,height:60,text:id,
 strokeColor:'#111827',backgroundColor:'transparent',strokeWidth:2,roughness:1,opacity:100,seed:1};}
function state(variant){
 const pages=[{id:'p1',title:'Page one',template:'blank',elements:[rect('visible','p1',200,200)]}];
 if(variant==='offscreen') pages[0].elements.push(rect('offscreen','p1',1200,800));
 if(variant==='two_pages') pages.push({id:'p2',title:'Page two',template:'cornell',elements:[rect('second-page','p2',300,300)]});
 return {pages,activePageId:'p1'};
}
async function exportFile(page,kind){
 await page.locator('details.export-menu').evaluate(e=>{e.open=true});
 const [d]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:kind==='png'?'PNG image':kind==='svg'?'SVG vector':'Graffiti file'}).click()]);
 const b=fs.readFileSync(await d.path());
 return b;
}
(async()=>{
 const b=await chromium.launch({channel:'chrome',headless:true});
 const rows=[];
 try{
  for(const variant of ['visible','offscreen','two_pages']){
   const c=await b.newContext({viewport:{width:1440,height:900},deviceScaleFactor:1,acceptDownloads:true});
   await c.addInitScript(value=>localStorage.setItem('graffiti:notebook:v1',value),JSON.stringify(state(variant)));
   const p=await c.newPage();
   await p.goto('http://127.0.0.1:4173/',{waitUntil:'domcontentloaded'});
   await p.getByRole('textbox',{name:'Page title'}).waitFor();
   await p.waitForTimeout(500);
   for(const kind of ['png','svg','json']){
    const bytes=await exportFile(p,kind);
    const filename=`${variant}.${kind==='json'?'graffiti':kind}`;
    fs.writeFileSync(path.join(OUT,filename),bytes);
    const row={variant,format:kind.toUpperCase(),bytes:bytes.length,
     sha256:crypto.createHash('sha256').update(bytes).digest('hex'),pages:'',rectangles:'',labels:''};
    if(kind==='json') {const s=JSON.parse(bytes.toString());row.pages=s.pages.length;row.rectangles=s.pages.reduce((n,x)=>n+x.elements.length,0);}
    if(kind==='svg') {const s=bytes.toString();row.pages=1;row.rectangles=(s.match(/<rect /g)||[]).length-1;row.labels=(s.match(/<text /g)||[]).length;}
    if(kind==='png') {row.pages=1;row.rectangles='not machine-readable';}
    rows.push(row);
   }
   await c.close();
  }
 }finally{await b.close()}
 const head=Object.keys(rows[0]);const q=v=>`"${String(v??'').replaceAll('"','""')}"`;
 fs.writeFileSync(path.join(__dirname,'data','graffiti_export_scope.csv'),[head.map(q).join(','),...rows.map(r=>head.map(k=>q(r[k])).join(','))].join('\n')+'\n');
 console.log(rows);
 console.log('PNG visible/offscreen identical:',rows[0].sha256===rows[3].sha256);
})().catch(e=>{console.error(e);process.exitCode=1});
