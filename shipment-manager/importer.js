/* 出货管家 Excel/CSV 导入器 v2：原始值、来源行、合并单元格提醒、可选字段映射 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const fields=[
 {key:'orderNo',label:'订单号',aliases:['订单号','订单编号','单号','客户订单号','order no','order number','po no','po number','订单']},
 {key:'productName',label:'品名',aliases:['品名','产品名称','商品名称','产品名','货品名称','product name','item name','product','品种']},
 {key:'color',label:'颜色',aliases:['颜色','色号','颜色名称','colour','color','色彩']},
 {key:'spec',label:'规格',aliases:['规格','尺寸','型号','产品规格','规格型号','spec','size']},
 {key:'productInfo',label:'产品信息（合并）',aliases:['产品信息','产品明细','规格品名颜色','品名规格颜色','产品描述','货物描述','描述','产品','明细','product info','description']},
 {key:'qty',label:'要货数',aliases:['要货数','数量','订购数量','订单数量','出货数量','采购数量','qty','quantity','amount']},
 {key:'shipDate',label:'计划出货日期',aliases:['计划出货日期','出货日期','交货日期','交期','计划交期','预计出货日期','要求交期','交货时间','ship date','delivery date','due date']},
 {key:'actualDate',label:'实际出货日期',aliases:['实际出货日期','实际出货时间','出货完成日期','发货日期','实际发货日期','actual ship date']},
 {key:'docUrl',label:'在线文档链接',aliases:['在线文档链接','文档链接','链接','网址','url','link']}
];
let rows=[],headers=[],mapping={},sourceName='',sourceSheet='',sourceRowStart=1,merges=[],selectedFields=new Set(),rawHeaderRow=[];
function norm(s){return String(s??'').trim().toLowerCase().replace(/[\\s_\\-（）()【】\\[\\]：:、.]/g,'')}
function show(){$('importOverlay').classList.add('show');document.body.style.overflow='hidden'}
function hide(){$('importOverlay').classList.remove('show');document.body.style.overflow=''}
function notify(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function guess(header,key){const h=norm(header),f=fields.find(x=>x.key===key);return !!h&&f.aliases.some(a=>{const n=norm(a);return h===n||(n.length>=3&&(h.includes(n)||n.includes(h)))})}
function scoreHeader(row){const vals=row.map(v=>String(v??'').trim()).filter(Boolean);let score=0;for(const f of fields)if(vals.some(v=>guess(v,f.key)))score+=2;score+=Math.min(vals.length,23)/20;return score}
function infer(){mapping={};for(const f of fields){const i=headers.findIndex(h=>guess(h,f.key));if(i>=0)mapping[f.key]=i}
 if(mapping.productInfo===undefined&&mapping.productName===undefined&&mapping.spec===undefined&&mapping.color===undefined){const i=headers.findIndex(h=>/产品|商品|货物|品名|描述|明细/.test(h));if(i>=0)mapping.productInfo=i}
 selectedFields=new Set(Object.keys(mapping));
}
function selectHtml(key){const selected=mapping[key]===undefined?-1:mapping[key];const checked=selectedFields.has(key)?'checked':'';return '<label><span style="display:flex;align-items:center;gap:5px"><input type="checkbox" data-use="'+key+'" '+checked+'> '+fields.find(f=>f.key===key).label+'</span><select data-map="'+key+'"><option value="-1">不映射</option>'+headers.map((h,i)=>'<option value="'+i+'" '+(selected===i?'selected':'')+'>'+escapeHtml(h||('第'+(i+1)+'列'))+'</option>').join('')+'</select></label>'}
function getCell(row,key){const idx=mapping[key];return idx===undefined||idx<0||!selectedFields.has(key)?'':row[idx]===undefined?'':row[idx]}
function rawValue(v){if(v===null||v===undefined)return '';if(v instanceof Date)return v.toISOString();return String(v).trim()}
function makeRecord(row,index){const orderNo=rawValue(getCell(row,'orderNo'));const productName=rawValue(getCell(row,'productName'));const color=rawValue(getCell(row,'color'));const spec=rawValue(getCell(row,'spec'));const combined=rawValue(getCell(row,'productInfo'));const productInfo=combined||[productName,color,spec].filter(Boolean).join(' / ');
 const extraFields={};headers.forEach((h,i)=>{if(h&&row[i]!==undefined&&String(row[i]??'').trim()!=='')extraFields[h]=rawValue(row[i])});
 const sourceRow=sourceRowStart+index;
 return {orderNo,productName,spec,color,productInfo,qty:rawValue(getCell(row,'qty')),shipDate:rawValue(getCell(row,'shipDate')),actualDate:rawValue(getCell(row,'actualDate')),docUrl:rawValue(getCell(row,'docUrl')),sourceFile:sourceName,sourceSheet,sourceRow,sourceKey:sourceName+'|'+sourceSheet+'|'+sourceRow,extraFields,_rawRow:row.map(rawValue)};
}
function records(){return rows.map((r,i)=>makeRecord(r,i)).filter(r=>r._rawRow.some(v=>String(v??'').trim()!==''))}
function renderMapping(){
 $('mappingFields').innerHTML=fields.map(f=>selectHtml(f.key)).join('');
 $('mappingFields').querySelectorAll('select').forEach(s=>s.addEventListener('change',()=>{const k=s.dataset.map;const n=Number(s.value);if(n<0)delete mapping[k];else mapping[k]=n;renderPreview()}));
 $('mappingFields').querySelectorAll('input[type=checkbox][data-use]').forEach(c=>c.addEventListener('change',()=>{if(c.checked)selectedFields.add(c.dataset.use);else selectedFields.delete(c.dataset.use);renderPreview()}));
 renderPreview();
}
function renderPreview(){
 const rs=records(),withNo=rs.filter(r=>r.orderNo);
 $('previewCount').textContent='识别到 '+rs.length+' 行非空数据，其中 '+withNo.length+' 行有订单号；原始日期和备注文本按原值保留。';
 const shown=rs.slice(0,8);
 $('previewTable').innerHTML=shown.length?'<table><thead><tr><th>源行</th><th>订单号</th><th>产品信息</th><th>数量</th><th>计划日期（原文）</th><th>实际日期（原文）</th></tr></thead><tbody>'+shown.map(r=>'<tr><td>'+r.sourceRow+'</td><td>'+escapeHtml(r.orderNo||'（缺失）')+'</td><td>'+escapeHtml(r.productInfo||[r.productName,r.color,r.spec].filter(Boolean).join(' / ')||'（缺失）')+'</td><td>'+escapeHtml(r.qty)+'</td><td>'+escapeHtml(r.shipDate)+'</td><td>'+escapeHtml(r.actualDate)+'</td></tr>').join('')+'</tbody></table>'+(rs.length>8?'<p class="import-small">仅预览前 8 行，导入时会处理全部可导入数据。</p>':''):'<p class="import-small">没有识别到数据行。</p>';
 $('doImportBtn').disabled=!withNo.length;
}
async function readFile(file){
 sourceName=file.name;const ext=file.name.split('.').pop().toLowerCase();merges=[];sourceSheet='CSV';sourceRowStart=2;
 if(ext==='csv'){const text=await file.text();const parsed=parseCSV(text);let hi=0,best=-1;for(let i=0;i<Math.min(parsed.length,40);i++){const s=scoreHeader(parsed[i]);if(s>best){best=s;hi=i}}headers=(parsed[hi]||[]).map((x,i)=>String(x??'').trim()||'第'+(i+1)+'列');rows=parsed.slice(hi+1).filter(r=>r.some(c=>String(c??'').trim()!==''));sourceRowStart=hi+2;
 }else if(ext==='xlsx'||ext==='xls'){
  if(!window.XLSX)throw new Error('Excel 读取组件未加载，请检查网络后重新打开 APP。');
  const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:'array',cellDates:false,cellNF:true,cellText:true});sourceSheet=wb.SheetNames[0];if(!sourceSheet)throw new Error('文件中没有工作表。');
  const ws=wb.Sheets[sourceSheet],matrix=XLSX.utils.sheet_to_json(ws,{header:1,defval:'',raw:false,blankrows:true});if(!matrix.length)throw new Error('文件中没有数据。');
  let hi=0,best=-1;for(let i=0;i<Math.min(matrix.length,40);i++){const s=scoreHeader(matrix[i]);if(s>best){best=s;hi=i}}
  headers=(matrix[hi]||[]).map((v,i)=>String(v??'').trim()||'第'+(i+1)+'列');rows=matrix.slice(hi+1).filter(r=>r.some(c=>String(c??'').trim()!==''));sourceRowStart=hi+2;
  merges=(ws['!merges']||[]).map(m=>({range:XLSX.utils.encode_range(m),startRow:m.s.r+1,endRow:m.e.r+1,startCol:m.s.c+1,endCol:m.e.c+1})).filter(m=>m.endRow>=sourceRowStart);
 }else throw new Error('暂时支持 .xlsx、.xls 和 .csv 文件。');
 if(!headers.length||!rows.length)throw new Error('没有识别到表头或数据行。');
 infer();$('fileSummary').textContent='文件：'+sourceName+'；工作表：'+sourceSheet+'；识别表头第 '+(sourceRowStart-1)+' 行；读取 '+rows.length+' 行非空数据。'+(merges.length?' 检测到 '+merges.length+' 个合并单元格区域，需检查后再导入。':'');
 let warning=$('mergeWarning');if(!warning){warning=document.createElement('div');warning.id='mergeWarning';warning.className='notice';$('mappingArea').appendChild(warning)}
 warning.innerHTML=merges.length?'<b>合并单元格检查</b><br>'+merges.slice(0,12).map(m=>escapeHtml(m.range)+'（第 '+m.startRow+'–'+m.endRow+' 行）').join('；')+(merges.length>12?'；另有 '+(merges.length-12)+' 个区域':'')+'。系统不会自动将合并单元格值复制到其他行，请检查预览后再决定是否导入。':'未检测到合并单元格区域。';
 $('mappingArea').hidden=false;$('previewArea').hidden=false;renderMapping();
}
function parseCSV(text){const out=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'&&quoted&&n==='"'){cell+='"';i++}else if(c==='"'){quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(cell);out.push(row);row=[];cell=''}else cell+=c}if(cell!==''||row.length){row.push(cell);out.push(row)}return out}
function reset(){rows=[];headers=[];mapping={};sourceName='';sourceSheet='';sourceRowStart=1;merges=[];$('importFile').value='';$('mappingArea').hidden=true;$('previewArea').hidden=true;$('fileSummary').textContent='';$('previewTable').innerHTML='';}
$('importExcelBtn').addEventListener('click',()=>{reset();show()});
$('closeImportBtn').addEventListener('click',hide);$('cancelImportBtn').addEventListener('click',hide);
$('importOverlay').addEventListener('click',e=>{if(e.target===$('importOverlay'))hide()});
$('importFile').addEventListener('change',async e=>{const file=e.target.files&&e.target.files[0];if(!file)return;try{await readFile(file)}catch(err){notify(err.message||'读取文件失败');reset()}});
$('doImportBtn').addEventListener('click',()=>{
 const rs=records().filter(r=>r.orderNo);if(!rs.length){notify('没有包含订单号的数据');return}
 const existing=(()=>{try{return JSON.parse(localStorage.getItem('shipment-orders-v1')||'[]')}catch(e){return []}})();
 const sourceSet=new Set(existing.map(o=>o.sourceKey).filter(Boolean));
 const exactDuplicates=rs.filter(r=>sourceSet.has(r.sourceKey)).length;
 const sameOrder=rs.filter(r=>existing.some(o=>String(o.orderNo||'').trim().toLowerCase()===r.orderNo.trim().toLowerCase())).length;
 let mode='continue';
 if(exactDuplicates){const choice=prompt('检测到 '+exactDuplicates+' 行与历史导入来源相同。输入 1=继续导入全部，2=跳过来源完全相同的行，3=取消导入。\n另有 '+sameOrder+' 行订单号与现有记录相同；同订单号允许有多条独立记录。','2');if(choice==='3'||choice===null)return;if(choice==='2')mode='skip-exact';else if(choice!=='1'){notify('输入无效，已取消导入');return}}
 else if(sameOrder&&!confirm('发现 '+sameOrder+' 行订单号与现有记录相同。系统不会按订单号自动去重，同一订单号可有多条记录。仍要继续导入吗？'))return;
 const valid=rs.filter(r=>mode!=='skip-exact'||!sourceSet.has(r.sourceKey)).map(r=>{const { _rawRow,...rest}=r;return rest});
 const missing=valid.filter(r=>!r.productInfo||!r.qty||!r.shipDate).length;
 if(!confirm('准备导入 '+valid.length+' 笔独立记录。'+(missing?'其中 '+missing+' 笔缺少产品信息、数量或计划日期。':'')+'\n日期、备注等原始文本不会自动拆分。继续吗？'))return;
 window.dispatchEvent(new CustomEvent('shipment-import-ready',{detail:{records:valid,duplicateMode:mode}}));hide();reset();
});
})();
