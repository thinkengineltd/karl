// Request-scoped Sites connector; no provider tokens or credentials are stored in the app.
export const SITES_CONNECTOR='connector_20205bf7d4e99a89d7154bb849718324';
export const SITE_PROJECT='appgprj_6ac4f3d81eb88191b32c7e0558df7533';
const error=(message,code='hosting_access_unavailable')=>Object.assign(new Error(message),{code,status:503});
const messages={reauthentication_required:'Connect your Sites account to manage staff access. Sign in again, then retry.',permission_denied:'Your Sites account cannot manage access to this app. Ask the Site owner to complete the invitation.',access_denied:'Your Sites account cannot manage access to this app. Ask the Site owner to complete the invitation.'};
function resultData(response){
 if(response?.status!=='success')throw error(messages[response?.error?.code]||'The hosting platform could not confirm this access change. Retry to check its current state.',response?.error?.code);
 const result=response.result||response;
 if(result.isError)throw error('The hosting platform rejected this access change. Check your Sites account permissions.');
 if(result.structuredContent)return result.structuredContent;
 for(const block of result.content||[]){if(block.type==='text'){try{const value=JSON.parse(block.text);if(value&&typeof value==='object')return value;}catch{}}}
 throw error('The hosting platform returned an unconfirmed response. Retry to check the invitation.');
}
async function actionNames(connector){
 const native={get:'sites_get_site',update:'sites_update_site_access'};
 if(!connector?.invoke)throw error('Hosting access is not connected for this session. Sign in with the Site owner account, then retry.','reauthentication_required');
 if(connector.getContext){const context=await connector.getContext();const data=context?.result||context;const tools=data?.tools||data?.context?.tools;if(Array.isArray(tools)){for(const [key,canonical] of Object.entries(native)){const short=canonical.replace(/^sites_/,'');const tool=tools.find(t=>{const connectorId=t.connectorId||t.connector_id;const name=t.actionName||t.action_name||t.name;return (!connectorId||connectorId===SITES_CONNECTOR)&&[canonical,short].includes(name);});if(tool)native[key]=tool.actionName||tool.action_name||tool.name;}}}
 return native;
}
export async function reconcileHostingAccess(connector,email,grant){
 const actions=await actionNames(connector);
 const read=async()=>{const site=resultData(await connector.invoke(SITES_CONNECTOR,actions.get,{project_id:SITE_PROJECT}));if(site.id!==SITE_PROJECT||!site.access_policy||!Array.isArray(site.access_policy.allowed_users))throw error('The hosting platform could not verify this app’s access list.');return site;};
 const site=await read();
 if(grant&&!site.external_visitor_invites_enabled)throw error('External staff invitations are disabled by the hosting platform. Contact the workspace administrator.','external_invites_disabled');
 const existing=site.access_policy.allowed_users;
 const normalize=value=>String(value||'').trim().toLowerCase();
 const present=existing.some(u=>normalize(u.email)===email);
 if(present===grant)return {hostingStatus:grant?'granted':'revoked',emailDelivery:'unconfirmed',changed:false};
 if(existing.some(u=>!u.email))throw error('A current access-list email is unavailable. The Site owner must update access in Sites sharing settings to preserve everyone’s access.');
 const emails=existing.map(u=>normalize(u.email));const requested=grant?[...new Set([...emails,email])]:emails.filter(e=>e!==email);
 let mutation;
 try{mutation=resultData(await connector.invoke(SITES_CONNECTOR,actions.update,{project_id:SITE_PROJECT,allowed_user_emails:requested}));}catch(e){
  // A timed-out write may have completed. Read the provider before allowing a retry; never replay blindly.
  try{const checked=await read();const now=checked.access_policy.allowed_users.some(u=>normalize(u.email)===email);if(now===grant)return {hostingStatus:grant?'granted':'revoked',emailDelivery:'unconfirmed',changed:true};}catch{}
  throw e;
 }
 if(mutation.project_id!==SITE_PROJECT||!Array.isArray(mutation.allowed_users)||mutation.allowed_users.some(u=>normalize(u.email)===email)!==grant)throw error('The hosting platform did not confirm the requested staff access. Retry to reconcile it.');
 return {hostingStatus:grant?'granted':'revoked',emailDelivery:'unconfirmed',changed:true};
}
