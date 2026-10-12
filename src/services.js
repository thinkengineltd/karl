import {sectionTemplates} from './data.js';
export const defaultServices=[['seo','SEO','seo'],['ppc','PPC','ppc'],['paid','Paid social','paid'],['social','Social media','social'],['email','Email marketing','email'],['analytics','Analytics','analytics']].map(([id,name,sectionId])=>({id,name,sectionId,archived:false,aliases:[]}));
const key=name=>String(name||'').trim().toLowerCase();
export function findService(services,name){return services.find(s=>[s.name,...(s.aliases||[])].some(n=>key(n)===key(name)));}
export function clientServiceNames(client,services){return [...new Set((client.services||[]).map(name=>findService(services,name)?.name||name))];}
export function serviceSection(service){const builtin=sectionTemplates.find(s=>s.id===service.sectionId);return builtin?{...structuredClone(builtin),enabled:true}:{id:service.sectionId,title:service.name,enabled:true,notes:'',headers:['Metric','This Month','Vs Previous Month'],rows:[],images:[]};}
export function reportSections(base,client,services){const sections=structuredClone(base);for(const name of client?.services||[]){const service=findService(services,name);if(!service||service.archived||sections.some(s=>s.id===service.sectionId))continue;const index=sections.findIndex(s=>s.id==='progress'||s.id==='next');sections.splice(index<0?sections.length:index,0,serviceSection(service));}return sections;}
