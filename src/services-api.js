import {defaultServices,findService,inputModes,applyInputMode,sectionMode} from './services.js';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export async function getServices(DB){
 let row=await DB.prepare('SELECT data FROM settings WHERE id=?').bind('services').first();
 if(!row){const clients=await DB.prepare('SELECT data FROM clients').all();const services=structuredClone(defaultServices);for(const row of clients.results){for(const name of JSON.parse(row.data).services||[]){if(!findService(services,name)){const id=crypto.randomUUID();services.push({id,name,sectionId:'service-'+id,archived:false,aliases:[],inputMode:'both'});}}}await DB.prepare('INSERT OR IGNORE INTO settings (id,data) VALUES (?,?)').bind('services',JSON.stringify({revision:1,services})).run();row=await DB.prepare('SELECT data FROM settings WHERE id=?').bind('services').first();}
 const catalog=JSON.parse(row.data);return {raw:row.data,...catalog,services:catalog.services.map(s=>({...s,inputMode:s.inputMode||'both'}))};
}
export async function servicesRoute(req,DB,url,user,json){
 const path=url.pathname.replace(/^\/api\/agency\/services(?=\/|$)/,'/api/services');
 if(!path.startsWith('/api/services'))return null;
 if(req.method==='GET'&&path==='/api/services'){const {raw,...catalog}=await getServices(DB);return json(catalog);}
 if(user.role!=='admin')fail('Only administrators can manage agency services.',403);
 const text=await req.text();if(text.length>10000)fail('This service form is too large.',413);let v;try{v=JSON.parse(text);}catch{fail('Enter a valid service form.');}
 const catalog=await getServices(DB);if(v.revision!==catalog.revision)fail('The service list changed. Refresh it before saving.',409);
 if(v.inputMode!==undefined&&!Object.hasOwn(inputModes,v.inputMode))fail('Choose CSV only, free text only, or CSV + free text.');
 const services=structuredClone(catalog.services);
 let id;
 if(path==='/api/services'&&req.method==='POST'){
  const name=String(v.name||'').trim();if(!name||name.length>80)fail('Enter a service name up to 80 characters.');if(findService(services,name))fail('A service with this name already exists. You can restore it if archived.',409);id=crypto.randomUUID();services.push({id,name,sectionId:'service-'+id,archived:false,aliases:[],inputMode:v.inputMode||'both'});
 }else{const match=path.match(/^\/api\/services\/([^/]+)$/);if(!match||req.method!=='PATCH')return json({error:'Not found.'},404);const service=services.find(s=>s.id===match[1]);if(!service)fail('Service not found.',404);id=service.id;
  if(v.name!==undefined){const name=String(v.name).trim();if(!name||name.length>80)fail('Enter a service name up to 80 characters.');if(findService(services.filter(s=>s.id!==service.id),name))fail('Another service uses this name.',409);if(service.name!==name){service.aliases=[...new Set([...(service.aliases||[]),service.name])].filter(n=>n!==name);service.name=name;}}
  if(v.inputMode!==undefined)service.inputMode=v.inputMode;
  if(v.archived!==undefined){if(typeof v.archived!=='boolean')fail('Choose a valid service status.');service.archived=v.archived;}
 }
 const updated={revision:catalog.revision+1,services};const result=await DB.prepare('UPDATE settings SET data=? WHERE id=? AND data=?').bind(JSON.stringify(updated),'services',catalog.raw).run();if(!result.meta.changes)fail('The service list changed. Refresh it before saving.',409);
 return json({...updated,service:services.find(s=>s.id===id)},req.method==='POST'?201:200);
}
export async function validateClientServices(DB,client,previous={services:[]}){
 if(!Array.isArray(client.services)||client.services.length>100||client.services.some(s=>typeof s!=='string'||!s.trim()||s.length>80))fail('Choose valid client services from the agency list.');
 const {services}=await getServices(DB),existing=new Set((previous.services||[]).map(name=>findService(services,name)?.id));
 client.services=[...new Set(client.services.map(name=>{const service=findService(services,name);if(!service)fail('This service is not in the agency list. Ask an administrator to add it.');if(service.archived&&!existing.has(service.id))fail('This service is archived. Choose an active service.');return service.name;}))];
}

export async function configureReportModes(DB,report,previous){
 const {services}=await getServices(DB);
 for(let i=0;i<report.sections.length;i++){const section=report.sections[i],service=services.find(s=>s.sectionId===section.id);if(!service)continue;
  const old=previous?.sections.find(s=>s.id===section.id),requested=section.inputMode||(!old?service.inputMode:sectionMode(old));
  if(!Object.hasOwn(inputModes,requested))fail('Choose a valid report input mode.');
  if(old&&requested!==sectionMode(old)&&requested!==service.inputMode)fail('Use the current service settings for this report section.');
  report.sections[i]=applyInputMode(section,old?requested:service.inputMode);
 }
}
