import {sectionTemplates} from './data.js';
export const defaultServices=[['seo','SEO','seo'],['ppc','PPC','ppc'],['paid','Paid social','paid'],['social','Social media','social'],['email','Email marketing','email'],['analytics','Analytics','analytics']].map(([id,name,sectionId])=>({id,name,sectionId,archived:false,aliases:[],inputMode:'both'}));
const key=name=>String(name||'').trim().toLowerCase();
export function findService(services,name){return services.find(s=>[s.name,...(s.aliases||[])].some(n=>key(n)===key(name)));}
export function clientServiceNames(client,services){return [...new Set((client.services||[]).map(name=>findService(services,name)?.name||name))];}
export function serviceSection(service){const builtin=sectionTemplates.find(s=>s.id===service.sectionId);return applyInputMode(builtin?{...structuredClone(builtin),enabled:true}:{id:service.sectionId,title:service.name,enabled:true,notes:'',headers:['Metric','This Month','Vs Previous Month'],rows:[],images:[]},service.inputMode||'both');}
export function reportSections(base,client,services){const sections=structuredClone(base).map(section=>{const service=services.find(s=>s.sectionId===section.id);return service?applyInputMode(section,service.inputMode||'both'):section;});for(const name of client?.services||[]){const service=findService(services,name);if(!service||service.archived||sections.some(s=>s.id===service.sectionId))continue;const index=sections.findIndex(s=>s.id==='progress'||s.id==='next');sections.splice(index<0?sections.length:index,0,serviceSection(service));}return sections;}
export const inputModes={csv:'Data only (CSV or screenshot)',text:'Free text only',both:'Data + free text'};
export const sectionMode=section=>section?.inputMode||'both';
export const allowsCSV=section=>sectionMode(section)!=='text';
export const allowsText=section=>sectionMode(section)!=='csv';
export function applyInputMode(section,mode){const result={...structuredClone(section),inputMode:mode};if(result.notes===undefined&&result.bullets===undefined)result.notes='';if(!result.headers){result.headers=['Metric','This Month','Vs Previous Month'];result.rows=result.rows||[];}return result;}
export function sectionForPDF(section){const result=structuredClone(section);if(!allowsText(section)){result.notes='';result.bullets='';result.focus='';result.subtitle='';result.images=[];result.rows=[];}if(!allowsCSV(section)){result.rows=[];result.images=[];}return result;}
