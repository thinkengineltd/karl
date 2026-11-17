import {spawn} from 'node:child_process';
import {mkdir,readFile,writeFile,watch} from 'node:fs/promises';
import {createServer} from 'node:net';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {parseEnv} from 'node:util';
import {createPreviewGateway,previewOptions} from './preview-gateway.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
process.chdir(root);
const mode=process.argv[2]||'dev';
if(!['dev','setup','migrate'].includes(mode))throw new Error('Expected dev, setup or migrate.');
const options=mode==='dev'?previewOptions():null;
const state=resolve(process.env.KARL_LOCAL_STATE||'.wrangler/preview-state');
const configDir=resolve('.wrangler/preview');
await mkdir(configDir,{recursive:true});
const childEnv={...process.env,XDG_CONFIG_HOME:process.env.XDG_CONFIG_HOME||resolve('.wrangler/config'),WRANGLER_SEND_METRICS:'false'};
const children=new Set();
let gateway,closing=false;
function stop(code=0){if(closing)return;closing=true;gateway?.close();for(const child of children)child.kill('SIGTERM');setTimeout(()=>process.exit(code),1000).unref();}
process.on('SIGINT',()=>stop());process.on('SIGTERM',()=>stop());
function launch(args){const child=spawn(process.execPath,args,{cwd:root,env:childEnv,stdio:'inherit'});children.add(child);child.on('exit',()=>children.delete(child));return child;}
async function run(args){await new Promise((accept,reject)=>{const child=launch(args);child.on('error',reject);child.on('exit',code=>code===0?accept():reject(new Error('Development command failed with exit code '+code)));});}
try{
  if(mode!=='migrate')await run(['build.mjs']);
  // Keep all preview configuration and secrets out of deployable dist/ output.
  const config=JSON.parse(await readFile('dist/server/wrangler.json','utf8'));
  config.main=resolve('dist/server/index.js');
  config.d1_databases=config.d1_databases.map(binding=>({...binding,migrations_dir:resolve('drizzle')}));
  const configPath=resolve(configDir,'wrangler.json');
  await writeFile(configPath,JSON.stringify(config,null,2));
  let local={};
  try{local=parseEnv(await readFile('.dev.vars','utf8'));}catch(error){if(error.code!=='ENOENT')throw error;}
  const vars={LOCAL_DEV_AUTH:'true',LOCAL_DEV_USER_EMAIL:'karl@thinkengine.co'};
  for(const name of ['OPENAI_API_KEY','OPENAI_MODEL'])if(process.env[name]||local[name])vars[name]=process.env[name]||local[name];
  await writeFile(resolve(configDir,'.dev.vars'),Object.entries(vars).map(([key,value])=>key+'='+JSON.stringify(value)).join('\n')+'\n',{mode:0o600});
  const wrangler='node_modules/wrangler/bin/wrangler.js';
  const flags=['--config',configPath,'--persist-to',state];
  await run([wrangler,'d1','migrations','apply','DB','--local',...flags]);
  if(mode!=='dev')process.exit(0);
  // Reserve a free loopback port; only the authenticated gateway is exposed.
  const socket=createServer();await new Promise(r=>socket.listen(0,'127.0.0.1',r));
  const internalPort=socket.address().port;await new Promise(r=>socket.close(r));
  const worker=launch([wrangler,'dev','--local',...flags,'--ip','127.0.0.1','--port',String(internalPort),'--inspector-port','0']);
  worker.on('exit',code=>{if(!closing)stop(code||1);});
  const upstream='http://127.0.0.1:'+internalPort;
  let ready=false;
  for(let attempt=0;attempt<120&&!closing;attempt++){
    try{const response=await fetch(upstream+'/api/state');if(response.ok){ready=true;break;}}catch{}
    await new Promise(r=>setTimeout(r,500));
  }
  if(!ready)throw new Error('The local Worker did not become ready. Check the migration and startup logs.');
  gateway=createPreviewGateway({upstream,...options});
  await new Promise((accept,reject)=>{gateway.once('error',reject);gateway.listen(options.port,options.host,accept);});
  console.log(`Karl development preview listening on ${options.host}:${options.port}. Local D1/R2: ${state}`);
  if(options.password)console.log('Preview sign-in username: preview. Use PREVIEW_PASSWORD as the password.');
  // Watch source assets and rebuild serially; Wrangler reloads the output bundle.
  let pending=false,building=false,timer;
  async function rebuild(){if(building){pending=true;return;}building=true;do{pending=false;try{await run(['build.mjs']);}catch{console.error('Build failed; fix the source and save again.');}}while(pending&&!closing);building=false;}
  for(const directory of ['src','public']){
    (async()=>{for await(const event of watch(directory,{recursive:true})){
      if(event.filename==='generated-assets.js')continue;
      clearTimeout(timer);timer=setTimeout(()=>void rebuild(),250);
    }})().catch(error=>{console.error('Source watcher failed:',error.message);stop(1);});
  }
}catch(error){console.error(error.message);stop(1);}
