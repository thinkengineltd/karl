export async function screenshotObject(file,key){
 if(!file||typeof file.arrayBuffer!=='function')throw Object.assign(new Error('Choose an original screenshot image.'),{status:400});
 if(file.size>8*1024*1024||!['image/png','image/jpeg','image/webp'].includes(file.type))throw Object.assign(new Error('Screenshots must be PNG, JPG or WebP images smaller than 8 MB.'),{status:400});
 const body=await file.arrayBuffer(),v=new Uint8Array(body),isPNG=v.length>=8&&[137,80,78,71,13,10,26,10].every((b,i)=>v[i]===b),isJPG=v[0]===255&&v[1]===216&&v[2]===255,isWebP=v.length>=12&&new TextDecoder().decode(v.slice(0,4))==='RIFF'&&new TextDecoder().decode(v.slice(8,12))==='WEBP';
 if(!(file.type==='image/png'&&isPNG||file.type==='image/jpeg'&&isJPG||file.type==='image/webp'&&isWebP))throw Object.assign(new Error('The screenshot file does not contain a supported image.'),{status:400});
 return {key,body,type:file.type};
}
