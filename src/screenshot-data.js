const valuePattern=/^(?:[£$€]?\s*\(?[+-]?\d[\d,.]*(?:\s*[%xkmb])?\)?|[-–—]|n\/?a)$/i;
const isValue=value=>valuePattern.test(String(value).trim());
const clean=line=>line.replace(/[\u2018\u2019]/g,"'").trim();
export function extractScreenshotTable(text,confidence=0){
 const lines=String(text||'').split(/\r?\n/).map(clean).filter(Boolean);const rows=[];let header=null;let previous='';
 for(const line of lines){
  let cells=line.split(/\t+|\s{2,}|\s*\|\s*/).map(clean).filter(Boolean);
  if(cells.length<2){const tokens=line.split(/\s+/);let start=tokens.length;while(start>0&&isValue(tokens[start-1]))start--;if(start>0&&start<tokens.length)cells=[tokens.slice(0,start).join(' '),...tokens.slice(start)];}
  if(cells.length>=2&&cells.slice(1).some(isValue)&&!/^(?:january|february|march|april|may|june|july|august|september|october|november|december|year|reporting period)$/i.test(cells[0])){rows.push(cells);if(!header&&previous){const candidate=previous.split(/\t+|\s{2,}|\s*\|\s*/).map(clean).filter(Boolean);const words=previous.split(/\s+/);const guessed=candidate.length===cells.length?candidate:words.length===cells.length?words:null;if(guessed&&!guessed.some(isValue))header=guessed;}}
  else if(isValue(line)&&previous&&!isValue(previous)&&!/^(?:january|february|march|april|may|june|july|august|september|october|november|december|year|reporting period)$/i.test(previous)){rows.push([previous,line]);}
  previous=line;
 }
 if(!rows.length)return {headers:['Metric','Value'],rows:[],warnings:['No reliable values were found. Crop to the table or KPI cards, upload a sharper screenshot, or enter the visible data in the review table.'],confidence,rawText:text};
 const width=Math.max(...rows.map(r=>r.length));let headers;
 if(!header&&width===2){headers=['Period',...rows.map(r=>r[0])];const values=['Overall',...rows.map(r=>r[1])];return {headers,rows:[values],warnings:['Detected KPI cards. Check every metric label, value and unit before importing.',...(confidence<85?['OCR confidence is low. Check the screenshot carefully.']:[])],confidence,rawText:text};}
 headers=header?.length===width?header:['Item',...Array.from({length:width-1},(_,i)=>'Value '+(i+1))];
 return {headers,rows:rows.map(r=>[...r,...Array(width-r.length).fill('')]),warnings:[...(!header?['Column headings were not identified reliably. Rename them to match your source and previous-month data.']:[]),...(confidence<85?['OCR confidence is low. Check the screenshot carefully.']:[])],confidence,rawText:text};
}
export function tableToCSV(table){if(!table?.headers?.length||table.headers.length>64||!table.rows?.length||table.rows.length>10000)throw new Error('Review at least one row and up to 64 columns before importing.');if(table.headers.some(h=>!String(h).trim()))throw new Error('Give every column a heading.');if(new Set(table.headers.map(h=>String(h).trim().toLowerCase())).size!==table.headers.length)throw new Error('Use a different heading for each column.');const quote=value=>'"'+String(value??'').replaceAll('"','""')+'"';return [table.headers,...table.rows.map(row=>table.headers.map((_,i)=>row[i]??''))].map(row=>row.map(quote).join(',')).join('\r\n');}
