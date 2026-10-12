import test from 'node:test';
import assert from 'node:assert/strict';
import {api} from '../src/api-client.js';
const originalFetch=globalThis.fetch;
test.afterEach(()=>{globalThis.fetch=originalFetch;});
test('requests JSON and sends credentials without changing form uploads',async()=>{
 const form=new FormData();form.append('name','CSV data');
 globalThis.fetch=async(path,options)=>{assert.equal(path,'/api/reports');assert.equal(options.headers.Accept,'application/json');assert.equal(options.credentials,'same-origin');assert.equal(options.cache,'no-store');assert.equal(options.body,form);assert.equal(options.headers['content-type'],undefined);return Response.json({saved:true});};
 assert.deepEqual(await api('reports','POST',form),{saved:true});
});
test('HTML preview responses produce a useful message rather than a syntax error',async()=>{
 globalThis.fetch=async()=>new Response('<!DOCTYPE html><html>Preview</html>',{headers:{'content-type':'text/html'}});
 await assert.rejects(api('state'),/Open the live app rather than a static preview/);
});
test('preserves duplicate report and revision conflict messages',async()=>{
 globalThis.fetch=async()=>Response.json({error:'This client already has a report for that month.'},{status:409});
 await assert.rejects(api('reports','POST',{}),/already has a report/);
});
test('handles expired sessions without losing edits',async()=>{
 globalThis.fetch=async()=>new Response('<!DOCTYPE html>Sign in',{status:401,headers:{'content-type':'text/html'}});
 await assert.rejects(api('reports/x','PUT',{}),/Keep this tab open to preserve your edits/);
});
test('does not automatically retry a failed write that may already have saved',async()=>{
 let calls=0;globalThis.fetch=async()=>{calls++;throw new TypeError('Failed to fetch');};
 await assert.rejects(api('reports','POST',{}),/saving was not confirmed/);assert.equal(calls,1);
});
test('handles invalid JSON and upstream HTML upload errors',async()=>{
 globalThis.fetch=async()=>new Response('{broken',{headers:{'content-type':'application/json'}});
 await assert.rejects(api('state'),/unreadable response/);
 globalThis.fetch=async()=>new Response('<!DOCTYPE html>Error',{status:413,headers:{'content-type':'text/html'}});
 await assert.rejects(api('uploads','POST',new Blob(['x'])),/upload is too large/);
});

test('JSON authentication failures retain status for a sign-in recovery action',async()=>{globalThis.fetch=async()=>Response.json({error:'Incomplete preview account'},{status:401});await assert.rejects(api('state'),e=>e.kind==='authentication'&&e.status===401&&e.message==='Incomplete preview account');});
