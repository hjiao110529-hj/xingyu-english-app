/* 出货管家 Excel/CSV 导入初版 */
(function(){
'use strict';
const $=id=>document.getElementById(id);
const fields=[
 {key:'orderNo',label:'订单号',aliases:['订单号','订单编号','单号','客户订单号','order no','order number','po no','po number','订单']},
 {key:'productName',label:'品名',aliases:['品名','产品名称','商品名称','产品名','货品名称','品名名称','product name','item name','product','品种']},
 {key:'color',label:'颜色',aliases:['颜色','色号','颜色名称','colour','color','色彩']},
 {key:'spec',label:'规格',aliases:['规格','尺寸','型号','产品规格','规格型号','尺寸规格','spec','size','型号规格']},
 {key:'productInfo',label:'产品信息（合并）',aliases:['产品信息','产品明细','规格品名颜色','品名规格颜色','产品描述','货物描述','描述','产品','明细','product info','description']},
 {key:'qty',label:'要货数',aliases:['要货数','数量','订购数量','订单数量','出货数量','采购数量','qty','quantity','amount','数量单位']},
 {key:'shipDate',label:'计划出货日期',aliases:['计划出货日期','出货日期','交货日期','交期','计划交期','预计出货日期','要求交期','交货时间','ship date','delivery date','due date']},
 {key:'actualDate',label:'实际出货日期',aliases:['实际出货日期','实际出货时间','出货完成日期','发货日期','实际发货日期','actual ship date']},
 {key:'docUrl',label:'在线文档链接',aliases:['在线文档链接','文档链接','链接','网址','url','link']}
];
let rows=[],headers=[],mapping={},sourceName='';
function norm(s){return String(s??'').trim().toLowerCase().replace(/[\s_\-（）()【】\[\]：:、.]/g,'')}
function show(){ $('importOverlay').classList.add('show');document.body.style.overflow='hidden'; }
function hide(){ $('importOverlay').classList.remove('show');document.body.style.overflow=''; }
function notify(msg){const t=$('toast');t.textContent=msg;t.classList.add('show');setTimeout(()=>t.classList.remove('show'),2600)}
function guess(header,key){const h=norm(header);const f=fields.find(x=>x.key===key);if(!h)return false;return f.aliases.some(a=>{const n=norm(a);return h===n||(n.length>=3&&(h.includes(n)||n.includes(h)))})}
function dateValue(v){
 if(v===null||v===undefined||v==='')return '';
 if(typeof v==='number'&&window.XLSX&&XLSX.SSF){const p=XLSX.SSF.parse_date_code(v);if(p)return p.y+'-'+String(p.m).padStart(2,'0')+'-'+String(p.d).padStart(2,'0')}
 let s=String(v).trim();if(!s)return '';
 let m=s.match(/^(\d{4})[年./\-](\d{1,2})[月./\-](\d{1,2})日?$/);if(m)return m[1]+'-'+m[2].padStart(2,'0')+'-'+m[3].padStart(2,'0');
 m=s.match(/^(\d{1,2})[./\-](\d{1,2})[./\-](\d{4})$/);if(m)return m[3]+'-'+m[1].padStart(2,'0')+'-'+m[2].padStart(2,'0');
 return s;
}
function getCell(row,key){const idx=mapping[key];return idx===undefined||idx<0?'':row[idx]===undefined?'':row[idx]}
function selectHtml(key){const selected=mapping[key]===undefined?-1:mapping[key];return '<label>'+fields.find(f=>f.key===key).label+'<select data-map="'+key+'"><option value="-1">不导入</option>'+headers.map((h,i)=>'<option value="'+i+'" '+(selected===i?'selected':'')+'>'+escapeHtml(h||('第'+(i+1)+'列'))+'</option>').join('')+'</select></label>'}
function escapeHtml(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))}
function infer(){
 mapping={};for(const f of fields){const i=headers.findIndex(h=>guess(h,f.key));if(i>=0)mapping[f.key]=i}
 if(mapping.productInfo===undefined&&mapping.productName===undefined&&mapping.spec===undefined&&mapping.color===undefined){const i=headers.findIndex(h=>/产品|商品|货物|品名|描述|明细/i.test(h));if(i>=0)mapping.productInfo=i}
}
function renderMapping(){
 $('mappingFields').innerHTML=fields.map(f=>selectHtml(f.key)).join('');
 $('mappingFields').querySelectorAll('select').forEach(s=>s.addEventListener('change',()=>{mapping[s.dataset.map]=Number(s.value);if(Number(s.value)<0)delete mapping[s.dataset.map];renderPreview()}));
 renderPreview();
}
function makeRecord(row,index){
 const orderNo=String(getCell(row,'orderNo')||'').trim();
 const productName=String(getCell(row,'productName')||'').trim();
 const color=String(getCell(row,'color')||'').trim();
 const spec=String(getCell(row,'spec')||'').trim();
 const combined=String(getCell(row,'productInfo')||'').trim();
 const productInfo=combined||[productName,color,spec].filter(Boolean).join(' / ');
 return {orderNo,productName,spec,color,productInfo,qty:String(getCell(row,'qty')??'').trim(),shipDate:dateValue(getCell(row,'shipDate')),actualDate:dateValue(getCell(row,'actualDate')),docUrl:String(getCell(row,'docUrl')||'').trim(),_row:index+2};
}
function records(){return rows.map((r,i)=>makeRecord(r,i)).filter(r=>Object.values(r).some(v=>v!==''&&v!==undefined))}
function renderPreview(){
 const rs=records();const selected=rs.filter(r=>r.orderNo);
 $('previewCount').textContent='识别到 '+rs.length+' 行数据，其中 '+selected.length+' 行有订单号';
 const shown=rs.slice(0,8);
 $('previewTable').innerHTML=shown.length?'<table><thead><tr><th>行</th><th>订单号</th><th>产品信息</th><th>数量</th><th>计划日期</th></tr></thead><tbody>'+shown.map(r=>'<tr><td>'+r._row+'</td><td>'+escapeHtml(r.orderNo||'（缺失）')+'</td><td>'+escapeHtml(r.productInfo||[r.productName,r.color,r.spec].filter(Boolean).join(' / ')||'（缺失）')+'</td><td>'+escapeHtml(r.qty)+'</td><td>'+escapeHtml(r.shipDate)+'</td></tr>').join('')+'</tbody></table>'+(rs.length>8?'<p class="import-small">仅预览前 8 行，导入时会处理全部数据。</p>':''):'<p class="import-small">请选择文件，或调整字段对应关系。</p>';
 $('doImportBtn').disabled=!selected.length;
}
async function readFile(file){
 sourceName=file.name;const ext=file.name.split('.').pop().toLowerCase();
 if(ext==='csv'){
  const text=await file.text();const parsed=parseCSV(text);headers=parsed[0].map(x=>String(x??'').trim());rows=parsed.slice(1).filter(r=>r.some(c=>String(c??'').trim()!==''));
 }else if(ext==='xlsx'||ext==='xls'){
  if(!window.XLSX)throw new Error('Excel 读取组件未加载，请检查网络后重新打开 APP。');
  const buf=await file.arrayBuffer();const wb=XLSX.read(buf,{type:'array',cellDates:false});const sheetName=wb.SheetNames[0];if(!sheetName)throw new Error('文件中没有工作表。');
  const matrix=XLSX.utils.sheet_to_json(wb.Sheets[sheetName],{header:1,defval:'',raw:true,blankrows:false});
  if(!matrix.length)throw new Error('第一个工作表没有数据。');
  let headerRow=0;for(let i=0;i<Math.min(matrix.length,10);i++){const nonempty=matrix[i].filter(v=>String(v??'').trim()!=='').length;if(nonempty>=2){headerRow=i;break}}
  headers=matrix[headerRow].map((v,i)=>String(v??'').trim()||'第'+(i+1)+'列');rows=matrix.slice(headerRow+1).filter(r=>r.some(c=>String(c??'').trim()!==''));
 }else throw new Error('暂时支持 .xlsx、.xls 和 .csv 文件。');
 if(!headers.length||!rows.length)throw new Error('没有识别到表头或数据行。');
 infer();$('fileSummary').textContent='文件：'+sourceName+'；共 '+rows.length+' 行数据。当前读取第一个工作表。';$('mappingArea').hidden=false;$('previewArea').hidden=false;renderMapping();
}
function parseCSV(text){
 const out=[];let row=[],cell='',quoted=false;for(let i=0;i<text.length;i++){const c=text[i],n=text[i+1];if(c==='"'&&quoted&&n==='"'){cell+='"';i++}else if(c==='"'){quoted=!quoted}else if(c===','&&!quoted){row.push(cell);cell=''}else if((c==='\n'||c==='\r')&&!quoted){if(c==='\r'&&n==='\n')i++;row.push(cell);out.push(row);row=[];cell=''}else cell+=c}if(cell!==''||row.length){row.push(cell);out.push(row)}return out;
}
function reset(){rows=[];headers=[];mapping={};sourceName='';$('importFile').value='';$('mappingArea').hidden=true;$('previewArea').hidden=true;$('fileSummary').textContent='';$('previewTable').innerHTML='';}
$('importExcelBtn').addEventListener('click',()=>{reset();show()});
$('closeImportBtn').addEventListener('click',hide);$('cancelImportBtn').addEventListener('click',hide);
$('importOverlay').addEventListener('click',e=>{if(e.target===$('importOverlay'))hide()});
$('importFile').addEventListener('change',async e=>{const file=e.target.files&&e.target.files[0];if(!file)return;try{await readFile(file)}catch(err){notify(err.message||'读取文件失败');reset()}});
$('doImportBtn').addEventListener('click',()=>{
 const rs=records().filter(r=>r.orderNo);if(!rs.length){notify('没有包含订单号的数据');return}
 const valid=rs.map(r=>{const productInfo=r.productInfo||[r.productName,r.color,r.spec].filter(Boolean).join(' / ');return {orderNo:r.orderNo,productInfo,productName:r.productName||productInfo,spec:r.spec,color:r.color,qty:r.qty,shipDate:r.shipDate,actualDate:r.actualDate,docUrl:r.docUrl,sourceFile:sourceName}});
 const missing=valid.filter(r=>!r.productInfo||!r.qty||!r.shipDate).length;
 const msg='准备导入 '+valid.length+' 笔订单。'+(missing?'其中 '+missing+' 笔缺少产品信息、数量或计划日期，导入后可再编辑。':'')+'\n已有同订单号的数据会跳过，不会覆盖。继续吗？';
 if(!confirm(msg))return;
 window.dispatchEvent(new CustomEvent('shipment-import-ready',{detail:{records:valid}}));hide();reset();
});
})();
