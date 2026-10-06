// Never treat an HTML preview, sign-in page, or gateway error as a saved action.
function responseError(response){
 if(response.status===401||response.redirected)return 'Your sign-in may have expired. Open the live app in another tab and sign in, then retry here. Keep this tab open to preserve your edits.';
 if(response.status===403)return 'This request was blocked. Open the live app in your browser and check that you are signed in, then retry.';
 if(response.status===413)return 'The upload is too large for the server. Choose a smaller file and retry.';
 if(response.status===409)return 'This report already exists or has changed. Open the saved report to continue. Keep your current edits until you have checked it.';
 if(response.status>=500)return 'The reporting service is temporarily unavailable. Keep your edits and retry shortly.';
 return 'The app received a web page instead of report data. Open the live app rather than a static preview and retry. Keep this tab open to preserve your edits.';
}
export async function api(path,method='GET',data,extra={}){
 const isForm=data instanceof FormData,isBlob=data instanceof Blob;
 let response;
 try{response=await fetch('/api/'+path,{method,credentials:'same-origin',cache:'no-store',headers:{Accept:'application/json',...(data===undefined||isForm?{}:isBlob?{'content-type':data.type}:{'content-type':'application/json'}),...extra},body:data===undefined?undefined:isBlob||isForm?data:JSON.stringify(data)});}catch{throw new Error('Could not connect to the reporting service. Check your connection and retry. Keep your edits; saving was not confirmed.');}
 const type=response.headers.get('content-type')||'';
 if(!/\bapplication\/(?:[\w.-]+\+)?json\b/i.test(type))throw new Error(responseError(response));
 let result;
 try{result=await response.json();}catch{throw new Error('The reporting service returned an unreadable response. Keep your edits; saving was not confirmed. Try again shortly.');}
 if(!response.ok)throw new Error(typeof result?.error==='string'?result.error:responseError(response));
 if(!result||typeof result!=='object'||Array.isArray(result))throw new Error('The reporting service returned unexpected data. Keep your edits and retry.');
 return result;
}
