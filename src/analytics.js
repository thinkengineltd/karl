import Papa from 'papaparse';
export const MAX_ROWS=10000;
export const normalise=s=>String(s??'').normalize('NFKC').trim().toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
export function previousMonth(month){const [y,m]=month.split('-').map(Number);return new Date(Date.UTC(y,m-2,1)).toISOString().slice(0,7);}
export function numeric(value,locale='standard'){
 let s=String(value??'').trim();if(!s||/^(?:-|–|—|n\/a|null|not set|not provided)$/i.test(s))return null;
 if(/^\d{1,3}:\d{2}(?::\d{2})?$/.test(s)){const p=s.split(':').map(Number);return p.length===3?p[0]*3600+p[1]*60+p[2]:p[0]*60+p[1];}
 if(/^\d+(?:\.\d+)?s$/i.test(s))s=s.slice(0,-1);
 const duration=s.match(/^(?:(\d+(?:\.\d+)?)h\s*)?(?:(\d+(?:\.\d+)?)m\s*)?(?:(\d+(?:\.\d+)?)s)?$/i);if(duration&&duration.slice(1).some(Boolean))return Number(duration[1]||0)*3600+Number(duration[2]||0)*60+Number(duration[3]||0);
 const negative=/^\(.*\)$/.test(s);s=s.replace(/[£$€%\s\u00a0]/g,'').replace(/^\((.*)\)$/,'$1').replace(/−/g,'-');
 s=locale==='european'?s.replace(/\./g,'').replace(',','.'):s.replace(/,/g,'');
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(s))return null;
 const n=Number(s)*(negative?-1:1);return Number.isFinite(n)&&Math.abs(n)<1e15?n:null;
}
export function parseCSV(text,headerRow){
 if(typeof text!=='string'||!text.trim())throw new Error('This CSV is empty.');
 if(text.includes('\uFFFD'))throw new Error('The CSV encoding could not be read. Export a UTF-8 CSV and retry.');
 if(text.includes('\0'))throw new Error('Choose a UTF-8 CSV file.');
 const parsed=Papa.parse(text.replace(/^\uFEFF/,''),{skipEmptyLines:'greedy'});
 if(parsed.errors.some(e=>e.type==='Quotes'))throw new Error('The CSV contains an unclosed or invalid quoted value. Export it again and retry.');
 const raw=parsed.data;if(raw.length<2)throw new Error('The CSV needs a header row and at least one data row.');
 const maximum=Math.max(...raw.slice(0,30).map(r=>r.filter(c=>String(c).trim()).length));
 const start=headerRow===undefined?raw.slice(0,30).findIndex(r=>r.filter(c=>String(c).trim()).length===maximum):Number(headerRow);
 if(!Number.isInteger(start)||start<0||start>=raw.length-1)throw new Error('Choose a valid header row.');
 const base=raw[start].map((v,i)=>String(v).trim()||'Column '+(i+1));if(base.length>64)throw new Error('CSV files can have up to 64 columns.');
 const seen=new Map();const headers=base.map(h=>{const k=normalise(h),n=(seen.get(k)||0)+1;seen.set(k,n);return n===1?h:h+' ('+n+')';});
 const rows=raw.slice(start+1);if(rows.length*headers.length>200000)throw new Error('This CSV has too many cells. Import up to 200,000 cells at a time.');if(rows.length>MAX_ROWS)throw new Error('Import up to 10,000 rows at a time.');
 if(rows.some(r=>r.length>headers.length))throw new Error('Some rows have more columns than the header. Check the header row and CSV delimiter.');
 return {headers,rows:rows.map(r=>headers.map((_,i)=>String(r[i]??'').trim())),headerRow:start,delimiter:parsed.meta.delimiter,headerOptions:raw.slice(0,20).map((r,i)=>({index:i,label:r.slice(0,4).join(' · ').slice(0,140)}))};
}
export function inferMapping(parsed,locale='standard'){
 const columns=parsed.headers.map((label,column)=>({label,column,key:normalise(label)}));
 const metricColumns=columns.filter(c=>{const cells=parsed.rows.slice(0,300).map(r=>r[c.column]).filter(Boolean);return cells.length&&cells.filter(x=>numeric(x,locale)!==null).length/cells.length>.8;});
 const dimension=columns.find(c=>!metricColumns.includes(c)&&/^(query|keyword|searchterm|campaign|adgroup|landingpage|page|channel|source|post|email|device|country)/.test(c.key)&&!c.key.endsWith('id'))?.column??columns.find(c=>!metricColumns.includes(c))?.column??0;
 const findWeight=keys=>columns.find(c=>keys.includes(c.key))?.column??columns.find(c=>keys.some(k=>c.key.endsWith(k)))?.column;
 const metrics=metricColumns.filter(c=>c.column!==dimension).slice(0,12).map(c=>{
 const sample=parsed.rows.slice(0,300).map(r=>r[c.column]).filter(Boolean),key=c.key;
 let aggregation='sum',weightColumn=null,format='number';
 if(/rate|ctr|cpc|cpm|cpa|costconv|costallconv|costper|roas|average|avg|position|rank|duration|time/.test(key))aggregation='average';
 if(/ctr|clickthrough|position|cpm/.test(key))weightColumn=findWeight(['impressions','impr']);
 else if(/cpc|costperclick|conversionrate|convrate/.test(key))weightColumn=findWeight(['clicks']);
 else if(/cpa|costperconversion|costconv/.test(key))weightColumn=findWeight(['conversions','conv']);
 else if(/costallconv/.test(key))weightColumn=findWeight(['allconversions','allconv']);
 else if(/costperlead/.test(key))weightColumn=findWeight(['leads']);
 else if(/roas/.test(key))weightColumn=findWeight(['cost','spend','adspend']);
 else if(/engagementrate/.test(key))weightColumn=findWeight(['sessions']);
 else if(/duration|time/.test(key))weightColumn=findWeight(['users','sessions']);
 if(weightColumn!==undefined&&weightColumn!==null&&weightColumn!==c.column){aggregation='weighted';}else weightColumn=null;
 if(sample.some(v=>v.includes('£')))format='gbp';else if(sample.some(v=>v.includes('$')))format='usd';else if(sample.some(v=>v.includes('€')))format='eur';
 else if(sample.some(v=>v.includes('%')))format='percent';else if(/rate|ctr/.test(key))format=sample.every(v=>Math.abs(numeric(v,locale)||0)<=1)?'ratio':'percent';
 else if(/position|rank/.test(key))format='rank';else if(/duration|time/.test(key)&&sample.some(v=>v.includes(':')||/s$/.test(v)))format='seconds';
 const direction=/^(cost|spend|adspend|amountspent|budget)$/.test(key)?'neutral':/cpc|cpm|cpa|costconv|costallconv|costper|position|rank|bounce/.test(key)?'lower':'higher';
 return {...c,aggregation,weightColumn,format,direction};});
 return {dimensionColumn:dimension,metrics,rankMetric:metrics[0]?.key||'',locale};
}
export function validateMapping(parsed,config){
 const column=c=>Number.isInteger(c)&&c>=0&&c<parsed.headers.length;
 if(!column(config.dimensionColumn))throw new Error('Select a label column.');
 if(!Array.isArray(config.metrics)||!config.metrics.length||config.metrics.length>12)throw new Error('Choose between one and twelve metrics.');
 const keys=new Set();for(const m of config.metrics){if(!column(m.column)||typeof m.key!=='string'||!m.key||keys.has(m.key)||!m.label||m.label.length>100)throw new Error('Check your metric mapping. Metric names must be unique.');keys.add(m.key);
 if(!['sum','average','weighted','snapshot'].includes(m.aggregation)||!['number','gbp','usd','eur','percent','ratio','rank','seconds'].includes(m.format)||!['higher','lower','neutral'].includes(m.direction))throw new Error('Check metric formats and aggregation.');
 if(m.aggregation==='weighted'&&(!column(m.weightColumn)||m.weightColumn===m.column))throw new Error('Choose a different weight column for weighted averages.');}
 if(!keys.has(config.rankMetric))throw new Error('Select a metric for the top 10.');
 if(!['standard','european'].includes(config.locale))throw new Error('Choose a valid number format.');
 return config;
}
export function aggregate(parsed,config){
 validateMapping(parsed,config);const groups=new Map(),totals=Object.fromEntries(config.metrics.map(m=>[m.key,{sum:0,count:0,weight:0,min:Infinity,max:-Infinity}]));let excluded=0,invalid=0,missingWeights=0;
 for(const row of parsed.rows){const label=String(row[config.dimensionColumn]??'').trim();
 if(!label||/^(?:grand\s*total|total|totals)(?:\s*[:\-].*)?$/i.test(label)||/^(?:account|campaign|filtered)\s+total/i.test(label)){excluded++;continue;}
 const key=label.normalize('NFKC').toLowerCase().replace(/\s+/g,' ');if(!groups.has(key))groups.set(key,{key,label,stats:Object.fromEntries(config.metrics.map(m=>[m.key,{sum:0,count:0,weight:0,min:Infinity,max:-Infinity}]))});const group=groups.get(key);
 for(const m of config.metrics){const n=numeric(row[m.column],config.locale);if(n===null||(m.format==='rank'&&n<=0)){invalid++;continue;}let weight=1;if(m.aggregation==='weighted'){weight=numeric(row[m.weightColumn],config.locale);if(weight===null||weight<=0){missingWeights++;continue;}}
 for(const target of [totals[m.key],group.stats[m.key]]){target.sum+=n*weight;target.count++;target.weight+=weight;target.min=Math.min(target.min,n);target.max=Math.max(target.max,n);}}
 }
 const value=(x,m)=>!x.count?null:m.aggregation==='snapshot'?(x.min===x.max?x.min:null):m.aggregation==='sum'?x.sum:x.sum/x.weight;
 return {rows:[...groups.values()].map(g=>({key:g.key,label:g.label,values:Object.fromEntries(config.metrics.map(m=>[m.key,value(g.stats[m.key],m)]))})),totals:Object.fromEntries(config.metrics.map(m=>[m.key,value(totals[m.key],m)])),sourceRows:parsed.rows.length,includedRows:parsed.rows.length-excluded,excludedRows:excluded,invalidCells:invalid,missingWeights,snapshotConflicts:config.metrics.filter(m=>m.aggregation==='snapshot'&&totals[m.key].count&&totals[m.key].min!==totals[m.key].max).map(m=>m.label)};
}
export function formatValue(value,metric){if(value===null||value===undefined)return '—';const n=Number(value),format=metric.format;const opts={maximumFractionDigits:format==='rank'?1:2};
 if(['gbp','usd','eur'].includes(format))return new Intl.NumberFormat('en-GB',{style:'currency',currency:format.toUpperCase(),maximumFractionDigits:2}).format(n);
 if(format==='ratio')return (n*100).toLocaleString('en-GB',opts)+'%';if(format==='percent')return n.toLocaleString('en-GB',opts)+'%';
 if(format==='seconds'){const sign=n<0?'-':'';const a=Math.round(Math.abs(n));return sign+Math.floor(a/60)+'m '+a%60+'s';}
 return n.toLocaleString('en-GB',opts);
}
export function change(current,previous,metric){if(current===null||previous===null||current===undefined||previous===undefined)return null;const delta=current-previous;const relative=previous===0?null:delta/Math.abs(previous)*100;const points=['ratio','percent'].includes(metric.format)?delta*(metric.format==='ratio'?100:1):null;return {delta,relative,points,improving:delta===0||metric.direction==='neutral'?null:metric.direction==='lower'?delta<0:delta>0};}
export function formatChange(c,metric){if(!c)return 'No comparison';if(c.delta===0)return 'No change';const signed=n=>(n>0?'+':'')+n.toLocaleString('en-GB',{maximumFractionDigits:2});if(c.points!==null)return signed(c.points)+' pp';if(metric.format==='rank')return (c.delta<0?'Up ':'Down ')+Math.abs(c.delta).toLocaleString('en-GB',{maximumFractionDigits:1})+(Math.abs(c.delta)===1?' position':' positions');if(c.relative===null)return 'From zero · '+(c.delta>0?'+':'')+formatValue(c.delta,metric);return signed(c.relative)+'%';}
export function buildAnalysis(current,baseline,config,{month,baselineSource=null,baselineLabel=null}={}){
 const previous=new Map((baseline?.rows||[]).map(r=>[r.key,r]));const warnings=[];
 if(current.excludedRows)warnings.push(current.excludedRows+' blank or total rows excluded.');if(current.invalidCells)warnings.push(current.invalidCells+' missing or invalid metric cells excluded; missing values are not treated as zero.');if(current.missingWeights)warnings.push(current.missingWeights+' cells lacked positive weights and were excluded from weighted averages.');
 for(const m of config.metrics){if(m.aggregation==='average'&&/rate|ctr|cpc|cpm|cpa|roas|position/.test(m.key))warnings.push(m.label+' uses an unweighted average. Select a weight column when available.');}
 if(baseline?.invalidCells)warnings.push('Previous-month data has '+baseline.invalidCells+' missing or invalid metric cells.');
 for(const label of current.snapshotConflicts||[])warnings.push(label+' has multiple distinct snapshot values. Its overall total is unavailable; unique audiences/follower totals are not summed.');
 for(const label of baseline?.snapshotConflicts||[])warnings.push('Previous-month '+label+' has conflicting snapshot values.');
 const snapshots=config.metrics.map(m=>({...m,current:current.totals[m.key]??null,previous:baseline?.totals[m.key]??null,change:change(current.totals[m.key],baseline?.totals[m.key],m)}));
 const top10ByMetric={},moversByMetric={};
 for(const m of config.metrics){const enriched=current.rows.filter(r=>r.values[m.key]!==null).map(r=>({label:r.label,key:r.key,current:r.values[m.key],previous:previous.get(r.key)?.values[m.key]??null,change:change(r.values[m.key],previous.get(r.key)?.values[m.key],m),isNew:!!baseline&&!previous.has(r.key)}));
 top10ByMetric[m.key]=[...enriched].sort((a,b)=>(m.direction==='lower'?a.current-b.current:b.current-a.current)||a.label.localeCompare(b.label)).slice(0,10);
 moversByMetric[m.key]=enriched.filter(r=>r.change&&r.change.delta!==0).sort((a,b)=>Math.abs(b.change.delta)-Math.abs(a.change.delta)||a.label.localeCompare(b.label)).slice(0,10);}
 const currentKeys=new Set(current.rows.map(r=>r.key));const disappeared=(baseline?.rows||[]).filter(r=>!currentKeys.has(r.key)).slice(0,10).map(r=>r.label);
 return {month,previousMonth:previousMonth(month),baselineSource,baselineLabel,hasBaseline:!!baseline,snapshots,top10ByMetric,moversByMetric,disappeared,warnings,rows:current.sourceRows,groupCount:current.rows.length,baselineRows:baseline?.sourceRows||0,generatedAt:new Date().toISOString()};
}
export function factualSummary(analysis){const lines=[];for(const m of analysis.snapshots.slice(0,6)){if(m.current===null)continue;let text=m.label+': '+formatValue(m.current,m)+'.';if(m.previous!==null)text+=' Previous month: '+formatValue(m.previous,m)+' ('+formatChange(m.change,m)+').';lines.push(text);}if(!analysis.hasBaseline)lines.push('No comparable previous-month data is available. Month-on-month changes cannot be assessed.');return lines.join('\n');}
export function analysisFacts(analysis,rankMetric){const facts=[{id:'data_coverage',text:analysis.rows+' source rows and '+analysis.groupCount+' label groups in the current file; '+analysis.baselineRows+' source rows in the previous file.'}];for(const m of analysis.snapshots){facts.push({id:'metric_'+m.key,text:m.label+': current '+formatValue(m.current,m)+', previous '+formatValue(m.previous,m)+', change '+formatChange(m.change,m)+'.',aggregation:m.aggregation,definition:m.definition||null});}
 const metric=analysis.snapshots.find(m=>m.key===rankMetric);for(const [i,r] of (analysis.top10ByMetric[rankMetric]||[]).entries())facts.push({id:'top_'+(i+1),text:'#'+(i+1)+' '+r.label+': '+formatValue(r.current,metric)+'; previous '+formatValue(r.previous,metric)+'; '+(r.isNew?'not present in the baseline file':formatChange(r.change,metric))+'.'});
 for(const [i,r] of (analysis.moversByMetric[rankMetric]||[]).entries())facts.push({id:'movement_'+(i+1),text:r.label+': current '+formatValue(r.current,metric)+', previous '+formatValue(r.previous,metric)+', change '+formatChange(r.change,metric)+'.'});
 return facts;
}

function quantityTokens(text){const tokens=[];const pattern=/(?:[£$€]\s*)?[+-]?\d[\d,]*(?:\.\d+)?(?:\s*(?:%|pp\b|percentage points\b))?/gi;for(const match of String(text).matchAll(pattern)){const value=match[0];const unit=value.includes('£')?'gbp':value.includes('$')?'usd':value.includes('€')?'eur':value.includes('%')?'percent':/pp|percentage points/i.test(value)?'points':'number';const number=Math.abs(Number(value.replace(/[^\d.\-+]/g,'')));tokens.push(unit+':'+number);}return tokens;}
export function groundedQuantities(items,facts,contextNumbers=[]){const byId=new Map(facts.map(f=>[f.id,f.text]));const context=contextNumbers.map(n=>'number:'+Math.abs(Number(n)));return items.every(item=>{const supported=new Set([...context,...(item.evidence_ids||[]).flatMap(id=>quantityTokens(byId.get(id)||''))]);return quantityTokens(item.text).every(token=>supported.has(token));});}
