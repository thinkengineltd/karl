import http from 'node:http';
import {createHash,timingSafeEqual} from 'node:crypto';

const digest=value=>createHash('sha256').update(value).digest();
export function previewOptions(env=process.env){
  const host=env.HOST||'127.0.0.1';
  const port=Number(env.PORT||5173);
  if(!Number.isInteger(port)||port<1||port>65535)throw new Error('PORT must be between 1 and 65535.');
  if(!['127.0.0.1','localhost','::1','0.0.0.0'].includes(host))throw new Error('HOST must be a loopback address or 0.0.0.0.');
  const password=env.PREVIEW_PASSWORD||'';
  if((host==='0.0.0.0'||password)&&password.length<16)throw new Error('Set PREVIEW_PASSWORD to at least 16 characters before sharing a preview.');
  const origin=env.PREVIEW_ORIGIN?new URL(env.PREVIEW_ORIGIN).origin:null;
  if(origin&&!origin.startsWith('https://'))throw new Error('PREVIEW_ORIGIN must use HTTPS.');
  return {host,port,password,origin};
}

// This gateway runs only in development. It is never part of the Worker bundle.
export function createPreviewGateway({upstream,password='',origin=null}){
  const target=new URL(upstream);
  if(target.hostname!=='127.0.0.1'||target.protocol!=='http:')throw new Error('Preview upstream must be loopback HTTP.');
  return http.createServer((req,res)=>{
    const respond=(status,message,headers={})=>{res.writeHead(status,{'cache-control':'no-store','content-type':'text/plain; charset=utf-8',...headers});res.end(message);};
    if(req.headers['x-dispatched-app']!==undefined)return respond(403,'The development preview cannot run as a hosted Site.');
    if(!password){
      let hostname;try{hostname=new URL('http://'+req.headers.host).hostname;}catch{return respond(400,'Invalid host');}
      if(!['127.0.0.1','localhost','[::1]'].includes(hostname))return respond(403,'Shared previews require PREVIEW_PASSWORD.');
    }
    if(password){
      const expected='Basic '+Buffer.from('preview:'+password).toString('base64');
      if(!timingSafeEqual(digest(req.headers.authorization||''),digest(expected)))return respond(401,'Sign in with username preview and the configured preview password.',{'www-authenticate':'Basic realm="Karl development preview", charset="UTF-8"'});
    }
    // Validate the browser origin before rewriting it for the loopback Worker.
    // An explicit origin handles preview proxies that rewrite the Host header.
    if(!['GET','HEAD'].includes(req.method)){
      let supplied;
      try{supplied=new URL(req.headers.origin).origin;}catch{return respond(403,'A same-origin browser request is required.');}
      const allowed=origin?[origin]:['http://'+req.headers.host,'https://'+req.headers.host];
      if(!allowed.includes(supplied))return respond(403,'A same-origin browser request is required.');
    }
    // Keep Wrangler's local explorer, inspector and scheduling endpoints private.
    let path;
    try{const parsed=new URL(req.url,target);if(parsed.origin!==target.origin)return respond(404,'Not found');path=parsed.pathname+parsed.search;}catch{return respond(400,'Invalid URL');}
    if(!/^\/(?:api\/|assets\/|$)/.test(path))return respond(404,'Not found');
    const headers={...req.headers,host:target.host};
    for(const key of Object.keys(headers))if(key.startsWith('oai-')||key.startsWith('x-forwarded-')||['forwarded','authorization','connection','upgrade','proxy-authorization','cookie'].includes(key))delete headers[key];
    if(headers.origin)headers.origin=target.origin;
    const proxy=http.request(target.origin+path,{method:req.method,headers},upstreamResponse=>{
      const responseHeaders={...upstreamResponse.headers,'cache-control':'no-store'};
      delete responseHeaders['set-cookie'];
      res.writeHead(upstreamResponse.statusCode,responseHeaders);
      upstreamResponse.pipe(res);
    });
    proxy.on('error',()=>{if(!res.headersSent)respond(502,'The local reporting service is restarting. Retry shortly.');else res.destroy();});
    req.on('aborted',()=>proxy.destroy());
    res.on('close',()=>proxy.destroy());
    req.pipe(proxy);
  });
}
