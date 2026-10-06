import {build} from 'esbuild';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir,readdir,rm,cp} from 'node:fs/promises';
await mkdir('dist/server',{recursive:true});await mkdir('dist/client/assets',{recursive:true});
await build({entryPoints:['src/App.jsx'],bundle:true,minify:true,format:'esm',outfile:'dist/client/assets/app.js',define:{'process.env.NODE_ENV':'"production"'},loader:{'.css':'css'},external:['/assets/*']});
await cp('public','dist/client/assets',{recursive:true});await cp('public/index.html','dist/client/index.html');await rm('dist/client/assets/index.html');
const assets={};for(const name of await readdir('dist/client/assets')){const data=await readFile('dist/client/assets/'+name);assets['/assets/'+name]={data:data.toString('base64'),type:name.endsWith('.js')?'text/javascript; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':name.endsWith('.svg')?'image/svg+xml':name.endsWith('.ttf')?'font/ttf':name.endsWith('.woff2')?'font/woff2':'image/jpeg'};}
let html=await readFile('public/index.html','utf8');
for(const name of ['app.js','app.css']){const hash=createHash('sha256').update(await readFile('dist/client/assets/'+name)).digest('hex').slice(0,16);html=html.replace('/assets/'+name,'/assets/'+name+'?v='+hash);}
await writeFile('dist/client/index.html',html);
assets['/index.html']={data:Buffer.from(html).toString('base64'),type:'text/html; charset=utf-8'};
await writeFile('src/generated-assets.js','export const assets='+JSON.stringify(assets));
await build({entryPoints:['src/worker.js'],bundle:true,minify:true,format:'esm',platform:'browser',target:'es2022',outfile:'dist/server/index.js'});await rm('src/generated-assets.js');
await cp('drizzle','dist/server/drizzle',{recursive:true});await cp('drizzle','dist/drizzle',{recursive:true});
await writeFile('dist/server/wrangler.json',JSON.stringify({name:'thinkengine-report-studio',main:'index.js',compatibility_date:'2026-09-01',d1_databases:[{binding:'DB',database_name:'report-studio',database_id:'local-db',migrations_dir:'../../drizzle'}],r2_buckets:[{binding:'BUCKET',bucket_name:'report-studio-files'}]}));
console.log('Report Studio built with D1 migrations and embedded client assets.');
