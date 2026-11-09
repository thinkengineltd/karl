import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {once} from 'node:events';
import {createPreviewGateway,previewOptions} from '../scripts/preview-gateway.mjs';

test('network previews require a strong password and an HTTPS public origin',()=>{
  assert.equal(previewOptions({}).host,'127.0.0.1');
  assert.throws(()=>previewOptions({HOST:'0.0.0.0'}),/PREVIEW_PASSWORD/);
  assert.throws(()=>previewOptions({PORT:'NaN'}),/PORT/);
  assert.throws(()=>previewOptions({PREVIEW_ORIGIN:'http://preview.example'}),/HTTPS/);
  assert.equal(previewOptions({HOST:'0.0.0.0',PREVIEW_PASSWORD:'a-long-test-password'}).host,'0.0.0.0');
});

async function fixture(t){
  const upstream=http.createServer(async(req,res)=>{
    let body='';for await(const chunk of req)body+=chunk;
    res.setHeader('content-type','application/json');
    res.end(JSON.stringify({headers:req.headers,body,url:req.url}));
  });
  upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
  const target='http://127.0.0.1:'+upstream.address().port;
  const gateway=createPreviewGateway({upstream:target,password:'a-long-test-password',origin:'https://preview.example'});
  gateway.listen(0,'127.0.0.1');await once(gateway,'listening');
  t.after(()=>{gateway.closeAllConnections();gateway.close();upstream.closeAllConnections();upstream.close();});
  const url='http://127.0.0.1:'+gateway.address().port;
  const headers={authorization:'Basic '+Buffer.from('preview:a-long-test-password').toString('base64')};
  return {url,target,headers};
}

test('preview authentication protects both files and API endpoints',async t=>{
  const {url}=await fixture(t);
  for(const path of ['/','/api/state','/assets/app.js']){
    const response=await fetch(url+path);
    assert.equal(response.status,401);assert.match(response.headers.get('www-authenticate'),/^Basic/);
  }
});

test('preview gateway validates origin, strips caller identities and streams writes',async t=>{
  const {url,target,headers}=await fixture(t);
  const unsafe=await fetch(url+'/api/clients',{method:'POST',headers:{...headers,origin:'https://attacker.example'},body:'bad'});
  assert.equal(unsafe.status,403);
  const noOrigin=await fetch(url+'/api/clients',{method:'POST',headers,body:'bad'});assert.equal(noOrigin.status,403);
  const response=await fetch(url+'/api/clients',{method:'POST',headers:{...headers,origin:'https://preview.example','content-type':'application/json','oai-authenticated-user-id':'forged','oai-authenticated-user-email':'other@example.com','x-forwarded-host':'attacker.example',cookie:'secret=value'},body:'{"name":"Preview"}'});
  assert.equal(response.status,200);
  const received=await response.json();
  assert.equal(received.body,'{"name":"Preview"}');assert.equal(received.headers.origin,target);
  for(const key of ['authorization','oai-authenticated-user-id','oai-authenticated-user-email','x-forwarded-host','cookie'])assert.equal(received.headers[key],undefined);
});

test('preview does not expose Wrangler tools or act as an open proxy',async t=>{
  const {url,headers}=await fixture(t);
  for(const path of ['/cdn-cgi/local/explorer/api','/api/../cdn-cgi/local/explorer/api','/__scheduled'])assert.equal((await fetch(url+path,{headers})).status,404);
  assert.equal((await fetch(url+'/api/state',{headers:{...headers,'x-dispatched-app':'site'}})).status,403);
});

test('password-free local previews reject non-loopback Host headers',async t=>{
  const upstream=http.createServer((req,res)=>res.end('local'));
  upstream.listen(0,'127.0.0.1');await once(upstream,'listening');
  const gateway=createPreviewGateway({upstream:'http://127.0.0.1:'+upstream.address().port});
  gateway.listen(0,'127.0.0.1');await once(gateway,'listening');
  t.after(()=>{gateway.closeAllConnections();gateway.close();upstream.closeAllConnections();upstream.close();});
  const url='http://127.0.0.1:'+gateway.address().port;
  assert.equal((await fetch(url)).status,200);
  const status=await new Promise((accept,reject)=>{
    const req=http.get(url,{headers:{host:'attacker.example'}},res=>{res.resume();accept(res.statusCode);});req.on('error',reject);
  });
  assert.equal(status,403);
});
