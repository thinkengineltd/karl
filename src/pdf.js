import {jsPDF} from 'jspdf';
import autoTable from 'jspdf-autotable';
const navy=[26,35,82],blue=[39,146,237];
export const monthName=m=>new Date(m+'-01T12:00:00').toLocaleDateString('en-GB',{month:'long',year:'numeric'});
async function imageData(url){if(!url)return null;const r=await fetch(url);if(!r.ok)throw new Error('A report image could not be loaded. Please retry.');const blob=await r.blob();return new Promise((res,rej)=>{const fr=new FileReader();fr.onload=()=>{const im=new Image();im.onload=()=>{const canvas=document.createElement('canvas');canvas.width=im.width;canvas.height=im.height;const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,im.width,im.height);ctx.drawImage(im,0,0);res({data:canvas.toDataURL('image/jpeg',.92),w:im.width,h:im.height});};im.onerror=()=>rej(new Error('A report image is invalid.'));im.src=fr.result;};fr.onerror=rej;fr.readAsDataURL(blob);});}
function place(pdf,im,x,y,w,h,cover=false){if(!im)return;let ih=w*im.h/im.w,iw=w;if(ih>h){ih=h;iw=h*im.w/im.h;}pdf.addImage(im.data,'JPEG',x,y,iw,ih);}
export async function makePDF(report,client,agency,profiles){
const team=report.team.map(id=>profiles.find(p=>p.id===id)).filter(Boolean),preparer=profiles.find(p=>p.id===report.preparedBy);
const [logo,clientLogo,cover,...photos]=await Promise.all([imageData(agency.logo),imageData(client.logo),imageData(agency.cover),...team.map(p=>imageData(p.photo))]);
const pdf=new jsPDF({unit:'mm',format:'a4'}),accent=agency.accent||'#00afe0';
for(const style of ['normal','bold','italic']){const name='poppins-'+(style==='normal'?'regular':style)+'.ttf';const response=await fetch('/assets/'+name);if(!response.ok)throw new Error('Report typography could not be loaded. Please retry.');const buffer=new Uint8Array(await response.arrayBuffer());let str='';for(const byte of buffer)str+=String.fromCharCode(byte);pdf.addFileToVFS(name,btoa(str));pdf.addFont(name,'poppins',style);}
pdf.setFont('poppins','normal');pdf.setProperties({title:client.name+' – '+monthName(report.month)+' Monthly Report',author:preparer?.name||agency.name,subject:'Digital marketing monthly report',creator:agency.name+' Report Studio'});
if(cover)pdf.addImage(cover.data,'JPEG',0,0,210,297);
pdf.setFillColor(255,255,255);pdf.rect(0,57,187,137,'F');if(logo)place(pdf,logo,20,78,65,15);else {pdf.setFont('poppins','bold');pdf.setFontSize(24);pdf.setTextColor(...navy);pdf.text(agency.name,20,88);}
pdf.setTextColor(...navy);pdf.setFont('poppins','bold');pdf.setFontSize(23);pdf.text(monthName(report.month).toUpperCase(),20,108);pdf.text('MONTHLY REPORT',20,124);pdf.setFontSize(20);pdf.text('Prepared for',20,139);if(clientLogo)place(pdf,clientLogo,20,151,60,25);else{pdf.text(pdf.splitTextToSize(client.name,140),20,156);}pdf.setFont('poppins','normal');pdf.setFontSize(10);pdf.text('Prepared by '+(preparer?.name||'Unassigned'),20,184);pdf.setTextColor(255,255,255);pdf.text('1',202,288,{align:'right'});
let y=25,page=1;
const addPage=()=>{pdf.addPage();page++;pdf.setFillColor(accent);pdf.rect(0,0,38,17,'F');pdf.setTextColor(255,255,255);pdf.setFontSize(11);pdf.text(String(page),19,10,{align:'center'});if(logo)place(pdf,logo,165,7,40,9);else{pdf.setTextColor(...navy);pdf.text(agency.name,190,10,{align:'right'});}pdf.setFillColor(22,22,22);pdf.rect(0,284,210,13,'F');pdf.setTextColor(255,255,255);pdf.setFontSize(8);pdf.text(client.name+' | '+monthName(report.month),20,292);y=25;};
const room=h=>{if(y+h>276)addPage();};
const title=t=>{room(20);pdf.setTextColor(...navy);pdf.setFont('poppins','bold');pdf.setFontSize(14);pdf.text(t,20,y+5);pdf.setDrawColor(...navy);pdf.line(20,y+6.5,20+Math.min(pdf.getTextWidth(t),170),y+6.5);y+=12;};
const prose=(text,color=blue,bullet=false)=>{for(const line of (text||'').split('\n').filter(x=>x.trim())){pdf.setFont('poppins','normal');pdf.setFontSize(11);pdf.setTextColor(...color);const wrapped=pdf.splitTextToSize(line,bullet?161:170);for(let i=0;i<wrapped.length;i++){room(7);if(bullet&&i===0)pdf.circle(25,y-1,0.7,'F');pdf.text(wrapped[i],bullet?30:20,y);y+=6;}y+=2;}};
addPage();
for(const s of report.sections.filter(s=>s.enabled)){
if(s.id==='traffic'&&y>100)addPage();if(s.id==='next')addPage();title(s.title);
if(s.subtitle){pdf.setFontSize(11);pdf.setFont('poppins','normal');pdf.setTextColor(...blue);pdf.text(s.subtitle,20,y);y+=7;}
if(s.bullets)prose(s.bullets,s.id==='seo'?blue:navy,true);
if(s.notes)prose(s.notes,navy);
if(s.headers&&s.rows.length){if(s.id==='seo'){pdf.setTextColor(...navy);pdf.setFont('poppins','bold');pdf.setFontSize(13);pdf.text('Top SEO Keywords',20,y+4);y+=12;pdf.setFont('poppins','italic');pdf.setFontSize(11);pdf.setTextColor(...blue);pdf.text('Top performing keywords in '+monthName(report.month).split(' ')[0],20,y);y+=4;}
autoTable(pdf,{startY:y,head:[s.headers],body:s.rows,theme:'grid',margin:{left:20,right:20,top:25,bottom:25},styles:{font:'poppins',fontSize:10,textColor:navy,lineColor:[0,0,0],lineWidth:.2,cellPadding:1.6},headStyles:{fillColor:[255,255,255],textColor:navy,fontStyle:'bold'},columnStyles:{0:{fontStyle:'bold'}},didParseCell:({section,cell})=>{if(section==='body'&&typeof cell.raw==='string'){if(/\bUp\b|No Change/.test(cell.raw))cell.styles.textColor=[0,174,77];else if(/\bDown\b/.test(cell.raw))cell.styles.textColor=[235,30,35];}},willDrawPage:()=>{},didDrawPage:()=>{if(pdf.getNumberOfPages()>page){page=pdf.getNumberOfPages();pdf.setFillColor(accent);pdf.rect(0,0,38,17,'F');pdf.setTextColor(255,255,255);pdf.text(String(page),19,10,{align:'center'});if(logo)place(pdf,logo,165,7,40,9);pdf.setFillColor(22,22,22);pdf.rect(0,284,210,13,'F');}}});y=pdf.lastAutoTable.finalY+10;}
if(s.focus){pdf.setFontSize(11);pdf.setFont('poppins','italic');pdf.setTextColor(...blue);room(10);pdf.text('Keywords to focus on',20,y);y+=8;prose(s.focus,blue,true);}
for(const image of s.images||[]){const im=await imageData(image.url);const h=Math.min(100,170*im.h/im.w);room(h+18);place(pdf,im,20,y,170,h);y+=h+5;if(image.caption)prose(image.caption,navy);}
y+=5;}
addPage();title('Client Account Team');
for(let i=0;i<team.length;i++){const p=team[i];room(42);if(photos[i])place(pdf,photos[i],20,y,29,29);const x=photos[i]?57:20;pdf.setFont('poppins','bold');pdf.setFontSize(14);pdf.setTextColor(...navy);pdf.text(p.name,x,y+9);pdf.setFont('poppins','normal');pdf.setFontSize(11);pdf.text(pdf.splitTextToSize(p.role,125),x,y+17);if(report.lead===p.id){pdf.setTextColor(...blue);pdf.setFontSize(9);pdf.text('LEAD',x,y+25);}y+=43;}
room(25);pdf.setTextColor(...navy);pdf.setFontSize(10);pdf.text('Prepared by '+(preparer?.name||agency.name),20,y+10);
return pdf.output('blob');}
