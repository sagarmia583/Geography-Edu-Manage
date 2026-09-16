document.addEventListener('DOMContentLoaded', () => {
const btn = document.querySelector('[data-mobile-menu]');
const nav = document.querySelector('.navlinks');
if (btn && nav) btn.addEventListener('click', () => nav.classList.toggle('open'));
document.querySelectorAll('[data-year]').forEach(el => el.textContent = new Date().getFullYear());
});

function naturalSortValue(value){
const s = String(value ?? '').trim();
const n = Number(s.replace(/[^\d.]/g, ''));
if(!Number.isNaN(n) && /\d/.test(s)) return n;
return s.toLowerCase();
}
function compareNatural(a,b,dir='asc'){
const av = naturalSortValue(a);
const bv = naturalSortValue(b);
const d = String(dir).toLowerCase() === 'desc' ? -1 : 1;
if(typeof av === 'number' && typeof bv === 'number') return (av-bv)*d;
return String(av).localeCompare(String(bv), undefined, {numeric:true, sensitivity:'base'})*d;
}
function sortStudentList(rows, field='roll', dir='asc'){
const f = String(field || 'roll').toLowerCase();
return [...(rows || [])].sort((a,b)=>{
const get = (s)=>{
if(f === 'reg' || f === 'registration' || f === 'registrationnumber') return s.RegistrationNumber || '';
if(f === 'name') return s.Name || s.StudentName || s.FullName || '';
if(f === 'session') return s.SessionYear || '';
if(f === 'year') return s.CurrentYear || s.AcademicYear || '';
if(f === 'type') return s.StudentType || s.IrregularStatus || '';
return s.Roll || s.RollID || '';
};
return compareNatural(get(a), get(b), dir);
});
}
function attachSortControls(sortId, dirId, callback){
const s = document.getElementById(sortId);
const d = document.getElementById(dirId);
if(s) s.addEventListener('change', callback);
if(d) d.addEventListener('change', callback);
}

(function(){
if (window.__buttonReactionReady) return;
window.__buttonReactionReady = true;

function getButton(el){
return el && el.closest ? el.closest('button,.btn,a[role="button"],input[type="button"],input[type="submit"]') : null;
}

document.addEventListener('click', function(e){
const btn = getButton(e.target);
if(!btn) return;
if(btn.classList.contains('no-reaction')) return;
if(btn.disabled || btn.getAttribute('aria-disabled') === 'true') return;

btn.classList.remove('btn-clicked');
void btn.offsetWidth;
btn.classList.add('btn-clicked');

const oldText = btn.tagName === 'INPUT' ? btn.value : btn.textContent;
const canShowWait =
btn.tagName === 'BUTTON' &&
!btn.dataset.keepText &&
!btn.classList.contains('logout-btn') &&
!btn.closest('.navlinks') &&
!btn.closest('.panel-menu') &&
!btn.closest('.panel-mobile-tabs');

if(canShowWait){
btn.dataset.oldText = oldText;
const lower = String(oldText || '').toLowerCase();
if(!lower.includes('print') && !lower.includes('logout') && !lower.includes('menu')){
btn.classList.add('btn-working');
if(!lower.includes('wait') && !lower.includes('loading') && !lower.includes('saving')){
btn.textContent = 'Please wait...';
}
setTimeout(function(){
if(btn.classList.contains('btn-working')){
btn.classList.remove('btn-working');
if(btn.dataset.oldText) btn.textContent = btn.dataset.oldText;
}
}, 1800);
}
}

setTimeout(function(){ btn.classList.remove('btn-clicked'); }, 650);
}, true);
})();

(function(){
if(window.__strongButtonReactionReady) return;
window.__strongButtonReactionReady = true;

function ensureActionBar(){
let bar = document.getElementById('globalActionBar');
if(!bar){
bar = document.createElement('div');
bar.id = 'globalActionBar';
document.body.appendChild(bar);
}
return bar;
}

function flashActionBar(){
const bar = ensureActionBar();
bar.classList.remove('run');
void bar.offsetWidth;
bar.classList.add('run');
setTimeout(()=>bar.classList.remove('run'), 900);
}

document.addEventListener('click', function(e){
const btn = e.target.closest && e.target.closest('button,.btn,input[type="button"],input[type="submit"]');
if(!btn || btn.disabled || btn.classList.contains('no-reaction')) return;
btn.classList.add('strong-click');
flashActionBar();
setTimeout(()=>btn.classList.remove('strong-click'), 850);
}, true);
})();

(function(){
if(window.__htmlPrintPatchApplied) return;
window.__htmlPrintPatchApplied = true;
const nativePrint = window.print.bind(window);

function collectPrintHtml(){
const preferred = document.querySelector('#printArea') || document.querySelector('.print-area') || document.querySelector('.admit-grid') || document.querySelector('.marksheet') || document.querySelector('.panel-main') || document.body;
const clone = preferred.cloneNode(true);
clone.querySelectorAll('.no-print,.topbar,.panel-sidebar,.panel-mobile-tabs,button,input,select,textarea').forEach(el=>{
if(el.closest('.info-table') || el.closest('.schedule-table')) return;
if(el.tagName && ['INPUT','SELECT','TEXTAREA'].includes(el.tagName)){
const span = document.createElement('span');
span.textContent = el.value || '';
el.replaceWith(span);
}else{
el.remove();
}
});
if(window.applyPrintableTableAlignment) window.applyPrintableTableAlignment(clone);
return clone.innerHTML;
}

function openHtmlPrintView(){
const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"],style')).map(el=>el.outerHTML).join('\n');
const html = collectPrintHtml();
const w = window.open('', '_blank');
if(!w){
nativePrint();
return;
}
w.document.open();
w.document.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Print View</title><base href="${window.location.href}">${styles}
<style>
body{background:#fff!important;margin:0!important;padding:0!important}
.no-print,.topbar,.panel-sidebar,.panel-mobile-tabs{display:none!important}
.panel-main{margin:0!important;width:100%!important;padding:0!important}
#printViewToolbar{position:sticky;top:0;background:#fff;border-bottom:1px solid #ddd;padding:8px;margin:0 0 6mm 0;z-index:9999}
#printViewToolbar button{padding:8px 14px;border:0;border-radius:8px;background:#0f664b;color:#fff;font-weight:700}
  table thead th,table th{text-align:center!important;vertical-align:middle!important}
table.print-align-table th,table.print-align-table thead th,table.print-align-table .print-header-cell{text-align:center!important;vertical-align:middle!important}table.print-align-table td,table.print-align-table td.printable-center-cell{text-align:center!important;vertical-align:middle!important}table.print-align-table td.printable-name-cell{text-align:left!important}

@media print{#printViewToolbar{display:none!important}body{padding:0!important}@page{size:A4 portrait;margin:8mm}}
</style></head><body><div id="printViewToolbar"><button onclick="window.print()">Print</button></div>${html}</body></html>`);
w.document.close();
w.focus();
}

window.openHtmlPrintView = openHtmlPrintView;
window.print = function(){
if(window.__insideHtmlPrintView) return nativePrint();
openHtmlPrintView();
};
})();

window.__nativePrintOriginal = window.__nativePrintOriginal || (window.print ? window.print.bind(window) : null);

function stableDirectPrint(target, title='Print', extraCss=''){
  const el = (typeof target === 'string') ? document.querySelector(target) : target;
  if(!el){ alert('Print content পাওয়া যায়নি'); return; }

  document.querySelectorAll('.stable-print-target').forEach(x=>x.classList.remove('stable-print-target'));
  el.classList.add('stable-print-target');
  el.classList.remove('hide');
  el.querySelectorAll('.hide').forEach(x=>x.classList.remove('hide'));

  let style = document.getElementById('originalLayoutPrintStyle');
  if(!style){
    style = document.createElement('style');
    style.id = 'originalLayoutPrintStyle';
    document.head.appendChild(style);
  }

  style.textContent = `
@media print{
  body.original-layout-print *{visibility:hidden!important}
  body.original-layout-print .stable-print-target,
  body.original-layout-print .stable-print-target *{visibility:visible!important}
  body.original-layout-print .stable-print-target{
    position:absolute!important;
    left:0!important;
    top:0!important;
    width:100%!important;
    max-width:100%!important;
    background:#fff!important;
    margin:0!important;
    padding:0!important;
    overflow:visible!important;
  }
  body.original-layout-print .no-print,
  body.original-layout-print .topbar,
  body.original-layout-print .panel-sidebar,
  body.original-layout-print .panel-mobile-tabs,
  body.original-layout-print .academic-banner.no-print{display:none!important}
  body.original-layout-print .admit-grid{display:block!important;width:100%!important}
  body.original-layout-print .admit-card{background:#fff!important;page-break-after:always!important}
  body.original-layout-print .admit-card:last-child{page-break-after:auto!important}
  body.original-layout-print table{page-break-inside:auto}
  body.original-layout-print tr{page-break-inside:avoid;page-break-after:auto}
  body.original-layout-print table thead th,body.original-layout-print th{text-align:center!important;vertical-align:middle!important}
body.original-layout-print table.print-align-table th,body.original-layout-print table.print-align-table thead th,body.original-layout-print table.print-align-table .print-header-cell{text-align:center!important;vertical-align:middle!important}body.original-layout-print table.print-align-table td,body.original-layout-print table.print-align-table td.printable-center-cell{text-align:center!important;vertical-align:middle!important}body.original-layout-print table.print-align-table td.printable-name-cell{text-align:left!important}
  ${extraCss||''}
}`;

  window.__insideHtmlPrintView = true;
  document.body.classList.add('original-layout-print');

  const cleanup = () => {
    setTimeout(()=>{
      document.body.classList.remove('original-layout-print');
      el.classList.remove('stable-print-target');
      window.__insideHtmlPrintView = false;
    }, 700);
  };

  setTimeout(()=>{
    try{
      if(window.__nativePrintOriginal) window.__nativePrintOriginal();
      else window.print();
    }catch(e){
      window.print();
    }
    cleanup();
  }, 100);
}
function printElementNow(target,title,css){ stableDirectPrint(target,title,css); }

(function(){
  if(window.__printNameColumnAlignFix) return;
  window.__printNameColumnAlignFix = true;

  function norm(t){return String(t||'').replace(/\s+/g,' ').trim().toLowerCase();}
  function cleanHeader(t){return norm(t).replace(/[:：*]/g,'').replace(/\s+/g,' ');}
  function isNameHeader(t){
    var s=cleanHeader(t);
    if(!s) return false;
    if(s === 'name' || s === 'student name' || s === 'students name' || s === "student's name" || s === 'candidate name') return true;
    if(s === 'subject' || s === 'subject name' || s === 'course' || s === 'course title' || s === 'paper name') return true;
    return false;
  }
  function formatDateText(txt){
    var s=String(txt||'').trim();
    var m=s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if(m) return String(m[3]).padStart(2,'0')+'/'+String(m[2]).padStart(2,'0')+'/'+m[1];
    var months={jan:'01',january:'01',feb:'02',february:'02',mar:'03',march:'03',apr:'04',april:'04',may:'05',jun:'06',june:'06',jul:'07',july:'07',aug:'08',august:'08',sep:'09',sept:'09',september:'09',oct:'10',october:'10',nov:'11',november:'11',dec:'12',december:'12'};
    m=s.match(/^(\d{1,2})[-\s]([A-Za-z]+)[-\s](\d{4})$/);
    if(m){
      var mo=months[m[2].toLowerCase()];
      if(mo) return String(m[1]).padStart(2,'0')+'/'+mo+'/'+m[3];
    }
    return s;
  }
  function formatDates(root){
    root = root || document;
    var cells = root.querySelectorAll ? root.querySelectorAll('th,td') : [];
    Array.prototype.forEach.call(cells,function(cell){
      if(!cell || cell.children.length) return;
      var old=String(cell.textContent||'').trim();
      var neu=formatDateText(old);
      if(neu!==old) cell.textContent=neu;
    });
  }
  function getNameIndexes(table){
    var indexes=[];
    if(!table) return indexes;
    var headerRows=[];
    if(table.tHead && table.tHead.rows && table.tHead.rows.length){
      headerRows=Array.prototype.slice.call(table.tHead.rows||[]);
    }else{
      var rows=Array.prototype.slice.call(table.rows||[]);
      for(var i=0;i<rows.length;i++){
        if(rows[i].querySelector('th')){headerRows=[rows[i]];break;}
      }
    }
    headerRows.forEach(function(row){
      Array.prototype.forEach.call(row.children||[],function(cell){
        cell.classList.add('print-header-cell');
        if(isNameHeader(cell.textContent)){
          var idx = typeof cell.cellIndex === 'number' ? cell.cellIndex : Array.prototype.indexOf.call(row.children,cell);
          if(indexes.indexOf(idx)===-1) indexes.push(idx);
        }
      });
    });
    return indexes;
  }
  function apply(root){
    root = root || document;
    var tables = root.querySelectorAll ? root.querySelectorAll('table') : [];
    Array.prototype.forEach.call(tables,function(table){
      table.classList.add('print-align-table');
      var nameIndexes=getNameIndexes(table);
      Array.prototype.forEach.call(table.rows||[],function(row,rowIndex){
        var cells=Array.prototype.slice.call(row.children||[]);
        var isHeader = row.parentElement && row.parentElement.tagName === 'THEAD';
        cells.forEach(function(cell,idx){
          if(isHeader || cell.tagName === 'TH' || rowIndex === 0){
            cell.classList.add('print-header-cell');
            cell.classList.remove('printable-name-cell');
            cell.classList.add('printable-center-cell');
            return;
          }
          if(nameIndexes.indexOf(idx)>-1){
            cell.classList.add('printable-name-cell');
            cell.classList.remove('printable-center-cell');
          }else{
            cell.classList.add('printable-center-cell');
            cell.classList.remove('printable-name-cell');
          }
        });
      });
    });
    formatDates(root);
  }
  window.applyPrintableTableAlignment = apply;
  window.formatPrintableDates = formatDates;
  window.formatPrintableDateText = formatDateText;
  document.addEventListener('DOMContentLoaded',function(){setTimeout(function(){apply(document);},120);});
  window.addEventListener('beforeprint',function(){apply(document);});
  setTimeout(function(){apply(document);},400);

  function wrapPrint(){
    if(window.__printAlignWrapped) return;
    window.__printAlignWrapped = true;
    var oldPrint = window.print;
    window.print = function(){
      try{apply(document);}catch(e){}
      return oldPrint.apply(window, arguments);
    };
    if(typeof window.stableDirectPrint === 'function'){
      var oldStable = window.stableDirectPrint;
      window.stableDirectPrint = function(target,title,extraCss){
        try{apply(document);}catch(e){}
        return oldStable.call(window,target,title,extraCss);
      };
    }
    if(typeof window.openHtmlPrintView === 'function'){
      var oldOpen = window.openHtmlPrintView;
      window.openHtmlPrintView = function(){
        try{apply(document);}catch(e){}
        return oldOpen.apply(window,arguments);
      };
    }
  }
  setTimeout(wrapPrint, 0);
})();

window.exportTableToCSV = function(tableId, filename) {
  var table = document.getElementById(tableId) || document.querySelector(tableId);
  if(!table) return;
  var rows = Array.from(table.rows);
  var csvContent = [];
  rows.forEach(function(row) {
    if(row.style.display === 'none') return;
    var rowData = [];
    var cells = Array.from(row.cells);
    cells.forEach(function(cell) {
      if(cell.style.display === 'none') return;
      var text = cell.innerText || cell.textContent;
      text = text.replace(/"/g, '""');
      if(text.search(/("|,|\n)/g) >= 0) {
        text = '"' + text + '"';
      }
      rowData.push(text.trim());
    });
    if(rowData.length) csvContent.push(rowData.join(','));
  });
  var csvData = '\uFEFF' + csvContent.join('\n');
  var blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename || 'export.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
