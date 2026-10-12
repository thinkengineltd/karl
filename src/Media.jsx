import React,{useState} from 'react';
import {resolveImage} from './image-assets.js';
const initials=name=>name?.trim().split(/\s+/).map(word=>word[0]).slice(0,2).join('').toUpperCase()||'?';
export function ResolvedImage({src,alt,fallback,...props}){
 const resolved=resolveImage(src),[failed,setFailed]=useState(null);
 if(!resolved||failed===resolved)return fallback;
 return <img {...props} src={resolved} alt={alt} onError={()=>setFailed(resolved)}/>;
}
export function Avatar({person,size=36}){
 const name=person?.name||'Staff member';
 return <span className="avatar" title={name} style={{width:size,height:size}}><ResolvedImage src={person?.photo} alt={name} fallback={<span role="img" aria-label={name}>{initials(name)}</span>}/></span>;
}
export function Logo({client,size=40}){
 const name=client?.name||'Client';
 return <span className="client-logo" title={name} style={{width:size,height:size}}><ResolvedImage src={client?.logo} alt={name} fallback={<span role="img" aria-label={name}>{initials(name)}</span>}/></span>;
}
