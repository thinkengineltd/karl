import {reconcileHostingAccess} from './hosting-access.js';
const roles=['admin','staff','viewer'];
const fail=(message,status=403)=>{throw Object.assign(new Error(message),{status});};
const normalEmail=value=>String(value||'').trim().toLowerCase();
const validEmail=value=>value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const stamp=()=>new Date().toISOString();
function displayName(req,email){let name=req.headers.get('oai-authenticated-user-full-name')||'';if(req.headers.get('oai-authenticated-user-full-name-encoding')==='percent-encoded-utf-8'){try{name=decodeURIComponent(name);}catch{name='';}}return name.trim().slice(0,200)||email.split('@')[0];}
// Sites dispatch supplies identity headers and enforces hosted app access. Never accept identity in a request body.
export async function authenticate(req,DB,env={}){
 const local=['127.0.0.1','localhost','[::1]'].includes(new URL(req.url).hostname)&&!req.headers.has('x-dispatched-app')&&env.LOCAL_DEV_AUTH==='true';
 const identity=req.headers.get('oai-authenticated-user-id')||(local?'local-development':null),email=normalEmail(req.headers.get('oai-authenticated-user-email')||(local?env.LOCAL_DEV_USER_EMAIL:null));
 if(!identity&&validEmail(email))fail('This preview did not provide a complete signed-in account. Open the app in a new tab and sign in with your invited ChatGPT account.',401);
 if(!identity||!validEmail(email))fail('Sign in with your invited ChatGPT account to use this app.',401);
 const ownerConfig=await DB.prepare('SELECT data FROM settings WHERE id=?').bind('user_access').first();
 if(!ownerConfig)fail('User access has not been configured. Contact the agency administrator.',503);
 const ownerEmail=JSON.parse(ownerConfig.data).ownerEmail;
 // Explicit owner-approved onboarding records from trusted runtime configuration; never from browser input.
 if(env.STAFF_BOOTSTRAP_INVITES){let invitations;try{invitations=JSON.parse(env.STAFF_BOOTSTRAP_INVITES);}catch{fail('Staff onboarding configuration is invalid.',503);}if(!Array.isArray(invitations)||invitations.length>20)fail('Staff onboarding configuration is invalid.',503);for(const invite of invitations){if(!validEmail(normalEmail(invite.email))||invite.role!=='staff'||invite.accessType!=='external'||invite.hostingStatus!=='granted')fail('Staff onboarding configuration is invalid.',503);await DB.prepare('INSERT OR IGNORE INTO app_users (id,email,name,role,status,access_type,hosting_status,created_at,hosting_updated_at) VALUES (?,?,?,?,?,?,?,?,?)').bind(invite.id,normalEmail(invite.email),invite.name,'staff','invited','external','granted',stamp(),stamp()).run();await DB.prepare("UPDATE app_users SET access_type='external',hosting_status='granted',role='staff',hosting_updated_at=? WHERE email=? AND access_type='workspace' AND status<>'disabled'").bind(stamp(),normalEmail(invite.email)).run();}}

 let user=await DB.prepare('SELECT * FROM app_users WHERE user_id=?').bind(identity).first();
 if(!user)user=await DB.prepare('SELECT * FROM app_users WHERE email=?').bind(email).first();
 if(user?.status==='disabled')fail('Your agency app access has been deactivated. Contact an administrator.');
 if(user?.user_id&&user.user_id!==identity)fail('This email is linked to another account. Contact an administrator.');
 if(!user&&email!==ownerEmail)fail('This platform is for approved internal staff only. Ask an administrator to invite your ChatGPT account.');
 if(user?.access_type==='external'&&user.hosting_status!=='granted')fail('Your staff invitation is awaiting hosted access. Ask the administrator to complete or retry the invitation.');
 if(!user){const id=crypto.randomUUID();await DB.prepare('INSERT OR IGNORE INTO app_users (id,email,user_id,name,role,status,created_at) VALUES (?,?,?,?,?,?,?)').bind(id,email,identity,displayName(req,email),email===ownerEmail?'admin':'staff','active',stamp()).run();user=await DB.prepare('SELECT * FROM app_users WHERE user_id=?').bind(identity).first();if(!user)fail('Could not link your account. Retry or contact an administrator.',409);}
 if(!user.profile_id){
  const profile={id:crypto.randomUUID(),name:user.name,email:user.email,role:'Team member',photo:'',bio:''};
  // Conditional insert/link prevents duplicate profiles when a user's first requests arrive together.
  await DB.batch([DB.prepare('INSERT INTO profiles (id,data) SELECT ?,? WHERE EXISTS (SELECT 1 FROM app_users WHERE id=? AND profile_id IS NULL)').bind(profile.id,JSON.stringify(profile),user.id),DB.prepare('UPDATE app_users SET profile_id=? WHERE id=? AND profile_id IS NULL').bind(profile.id,user.id)]);
 }
 await DB.prepare("UPDATE app_users SET user_id=?,status='active',last_seen_at=? WHERE id=? AND status<>'disabled'").bind(identity,stamp(),user.id).run();
 user=await DB.prepare('SELECT * FROM app_users WHERE id=?').bind(user.id).first();
 if(user.status==='disabled')fail('Your agency app access has been deactivated. Contact an administrator.');
 return {...user,isOwner:user.email===ownerEmail};
}
export function authorize(user,path,method){
 if(path.startsWith('/api/users')){if(user.role!=='admin')fail('Only administrators can manage agency users.');return;}
 if(method==='GET')return;
 if(user.role==='viewer')fail('Your account has view-only access. Ask an administrator for staff permissions.');
 if(path==='/api/agency'&&user.role!=='admin')fail('Only administrators can change agency settings.');
 if(path==='/api/profiles'&&user.role!=='admin')fail('Use your linked staff profile. Only administrators can add other profiles.');
 const profile=path.match(/^\/api\/profiles\/([^/]+)$/);
 if(profile&&user.role!=='admin'&&profile[1]!==user.profile_id)fail('You can only edit your own staff profile.');
}
export function publicUser(u){return {id:u.id,email:u.email,name:u.name,role:u.role,status:u.status,profileId:u.profile_id,lastSeenAt:u.last_seen_at,createdAt:u.created_at,accessType:u.access_type||'workspace',hostingStatus:u.hosting_status||'not_required',hostingError:u.hosting_error||'',hostingUpdatedAt:u.hosting_updated_at};}
async function input(req){if(Number(req.headers.get('content-length')||0)>10000)fail('This form is too large.',413);const text=await req.text();if(text.length>10000)fail('This form is too large.',413);try{return JSON.parse(text);}catch{fail('Enter a valid user form.',400);}}
function event(DB,actor,target,action){return DB.prepare('INSERT INTO user_events (id,actor_id,target_id,action,created_at) VALUES (?,?,?,?,?)').bind(crypto.randomUUID(),actor.id,target,action,stamp());}
export async function usersRoute(req,DB,url,user,json,options={}){
 const path=url.pathname;if(!path.startsWith('/api/users'))return null;if(user.role!=='admin')fail('Only administrators can manage staff invitations.');
 if(path==='/api/users'&&req.method==='GET'){
  const users=await DB.prepare('SELECT * FROM app_users ORDER BY created_at DESC').all();
  const events=await DB.prepare('SELECT * FROM user_events ORDER BY created_at DESC LIMIT 30').all();
  return json({users:users.results.map(publicUser),events:events.results,hostingConnected:!!options.connector?.invoke,ownerId:users.results.find(u=>u.email===user.email&&user.isOwner)?.id||null});
 }
 if(path==='/api/users'&&req.method==='POST'){
  const v=await input(req),email=normalEmail(v.email),name=String(v.name||'').trim();
  if(v.staffConfirmed!==true)fail('Confirm that the invitee is an internal member of staff. Clients cannot access this platform.',400);
  const accessType=v.accessType||'workspace';if(!['workspace','external'].includes(accessType))fail('Choose workspace staff or staff with an external ChatGPT account.',400);
  if(!validEmail(email)||!name||name.length>200||!roles.includes(v.role))fail('Enter a name, valid business email and role.',400);
  if(await DB.prepare('SELECT id FROM app_users WHERE email=?').bind(email).first())fail('This user is already listed. Edit their access instead.',409);
  let profileId=v.profileId||null;
  if(profileId){if(!await DB.prepare('SELECT id FROM profiles WHERE id=?').bind(profileId).first())fail('Choose an existing staff profile.',400);if(await DB.prepare('SELECT id FROM app_users WHERE profile_id=?').bind(profileId).first())fail('This staff profile is already linked to another user.',409);}
  const id=crypto.randomUUID();
  try{await DB.batch([DB.prepare('INSERT INTO app_users (id,email,name,role,status,profile_id,invited_by,created_at,access_type,hosting_status) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(id,email,name,v.role,'invited',profileId,user.id,stamp(),accessType,accessType==='external'?'pending':'not_required'),event(DB,user,id,'invited')]);}catch(e){if(String(e).includes('UNIQUE'))fail('This email or profile is already linked. Refresh the list.',409);throw e;}
  const target=await DB.prepare('SELECT * FROM app_users WHERE id=?').bind(id).first();const hosting=accessType==='external'?await syncHosting(DB,target,user,options.connector,true):null;return json({user:publicUser(await DB.prepare('SELECT * FROM app_users WHERE id=?').bind(id).first()),inviteUrl:url.origin,emailSent:accessType==='external'?null:false,hosting},201);
 }
 const retry=path.match(/^\/api\/users\/([^/]+)\/hosting-access$/);
 if(retry&&req.method==='POST'){const target=await DB.prepare('SELECT * FROM app_users WHERE id=?').bind(retry[1]).first();if(!target)fail('Staff member not found.',404);if(target.access_type!=='external')fail('This staff member uses workspace access.',400);const hosting=await syncHosting(DB,target,user,options.connector,target.status!=='disabled');return json({user:publicUser(await DB.prepare('SELECT * FROM app_users WHERE id=?').bind(target.id).first()),hosting,inviteUrl:url.origin,emailSent:null});}
 const match=path.match(/^\/api\/users\/([^/]+)$/);
 if(match&&req.method==='PATCH'){
  const target=await DB.prepare('SELECT * FROM app_users WHERE id=?').bind(match[1]).first();if(!target)fail('User not found.',404);
  const config=await DB.prepare('SELECT data FROM settings WHERE id=?').bind('user_access').first();
  const v=await input(req),role=v.role??target.role;
  const status=v.status??target.status;
  if(!roles.includes(role)||!['invited','active','disabled'].includes(status))fail('Choose a valid role and account status.',400);
  if(target.email===JSON.parse(config.data).ownerEmail&&(role!=='admin'||status!=='active'))fail('The agency owner must remain an active administrator.',400);
  if(target.id===user.id&&(role!=='admin'||status!=='active'))fail('Ask another administrator to change your own access.',400);
  if(status==='active'&&!target.user_id)fail('This user needs to sign in first. Restore their invitation instead.',400);
  if(status==='invited'&&target.user_id)fail('An account that has signed in must be active or deactivated.',400);
  await DB.batch([DB.prepare('UPDATE app_users SET role=?,status=? WHERE id=?').bind(role,status,target.id),event(DB,user,target.id,'access changed: '+role+' / '+status)]);
  const hosting=target.access_type==='external'&&status!==target.status?await syncHosting(DB,{...target,status},user,options.connector,status!=='disabled'):null;return json({user:publicUser(await DB.prepare('SELECT * FROM app_users WHERE id=?').bind(target.id).first()),hosting});
 }
 return json({error:'Not found.'},404);
}

async function syncHosting(DB,target,actor,connector,grant){
 const pending=grant?'pending':'revocation_pending';
 const lock=await DB.prepare("UPDATE app_users SET hosting_status='syncing',hosting_updated_at=?,hosting_error=NULL WHERE id=? AND (hosting_status<>'syncing' OR hosting_updated_at<?)").bind(stamp(),target.id,new Date(Date.now()-300000).toISOString()).run();
 if(!lock.meta.changes)return {confirmed:false,error:'Another access update is running. Retry after it finishes.'};
 try{const result=await reconcileHostingAccess(connector,target.email,grant);const current=await DB.prepare('SELECT status FROM app_users WHERE id=?').bind(target.id).first();const matches=(current.status!=='disabled')===grant;await DB.batch([DB.prepare('UPDATE app_users SET hosting_status=?,hosting_error=?,hosting_updated_at=? WHERE id=?').bind(matches?result.hostingStatus:(current.status==='disabled'?'revocation_pending':'pending'),matches?null:'Staff access changed while hosting was updating. Retry to reconcile the current access.',stamp(),target.id),event(DB,actor,target.id,grant?'hosted staff access granted':'hosted staff access revoked')]);return {confirmed:matches,...result};}catch(e){const message=e.code==='reauthentication_required'?e.message:'Hosted access has not been confirmed. Retry using a Sites account that can manage this app.';await DB.prepare('UPDATE app_users SET hosting_status=?,hosting_error=?,hosting_updated_at=? WHERE id=?').bind(grant?'failed':pending,message,stamp(),target.id).run();return {confirmed:false,error:message,code:e.code||'hosting_access_unavailable'};}
}
