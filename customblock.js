/* customblock.js v2.6
   RoboControl - Custom Blocks (Variant B) — UI back like earlier + manager + grid

   User fixes:
   1) Custom Builder: look simpler (like before) — only 2 mini blocks + visible ⚙ on each, no trashcan UI.
   2) Bring back management: rename / recolor / delete / edit custom blocks.
   3) Builder grid must be real grid, not just background.
   4) Keep: 🧩 only in Scratch view (#view-builder), PC only; custom blocks PC only.
   5) After saving: custom block appears in ⭐ Мої блоки instantly.

   Notes:
   - We DO NOT override your own blocks' mixins; we only use ContextMenuRegistry for our blocks.
   - We keep a lightweight map of defs so rename/color updates work.
*/
(function(){
  'use strict';

  const RC = window.RC_CUSTOMBLOCK = window.RC_CUSTOMBLOCK || {};
  const VERSION = 'v2.6';

  const CFG = {
    storageKeyBlocks: 'rc_cb_blocks_v2',
    customCategoryId: 'rc_custom_category',
    customCategoryName: '⭐ Мої блоки',
    customCategoryColour: '#F59E0B',
    defaultCustomBlockColour: '#FB923C',
    uiZ: 96
  };

  // ------------------------------
  // Desktop detect (PC only)
  // ------------------------------
  function isDesktop(){
    try{
      const fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
      const hover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
      const wide = window.matchMedia && window.matchMedia('(min-width: 900px)').matches;
      return !!(fine && hover && wide);
    }catch(e){
      return (navigator.maxTouchPoints || 0) === 0 && window.innerWidth >= 900;
    }
  }

  // ------------------------------
  // Utils
  // ------------------------------
  const u = {
    uid(prefix='id'){
      return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
    },
    jparse(str, fallback){
      try { return JSON.parse(str); } catch(e){ return fallback; }
    },
    jstring(obj){
      try { return JSON.stringify(obj); } catch(e){ return 'null'; }
    },
    el(tag, attrs={}, children=[]){
      const n = document.createElement(tag);
      for (const [k,v] of Object.entries(attrs||{})){
        if (k === 'class') n.className = v;
        else if (k === 'style') n.setAttribute('style', v);
        else if (k.startsWith('on') && typeof v === 'function') n.addEventListener(k.slice(2), v);
        else if (v !== null && v !== undefined) n.setAttribute(k, String(v));
      }
      for (const c of (Array.isArray(children)?children:[children])){
        if (c === null || c === undefined) continue;
        if (typeof c === 'string') n.appendChild(document.createTextNode(c));
        else n.appendChild(c);
      }
      return n;
    },
    debounce(fn, ms){
      let t=null;
      return (...args)=>{ clearTimeout(t); t=setTimeout(()=>fn(...args), ms); };
    },
    downloadText(filename, text){
      const blob = new Blob([text], { type:'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); }, 0);
    }
  };

  // ------------------------------
  // Toast
  // ------------------------------
  let toastT=null;
  function toast(msg){
    const id = 'rcCbToast';
    let el = document.getElementById(id);
    if (!el){
      el = u.el('div', { id, style: `
        position: fixed; left: 50%; bottom: 18px; transform: translateX(-50%);
        background: rgba(2,6,23,.85);
        border: 1px solid rgba(148,163,184,.18);
        color: #e2e8f0;
        padding: 10px 12px;
        border-radius: 14px;
        font-weight: 900;
        z-index: ${CFG.uiZ+8};
        display:none;
        backdrop-filter: blur(10px);
        box-shadow: 0 18px 60px rgba(0,0,0,.55);
      `});
      document.body.appendChild(el);
    }
    el.textContent = msg;
    el.style.display='block';
    clearTimeout(toastT);
    toastT = setTimeout(()=>{ el.style.display='none'; }, 1300);
  }

  // ------------------------------
  // Storage + defs map
  // ------------------------------
  RC._defsByType = RC._defsByType || new Map();

  function loadBlocks(){
    const raw = localStorage.getItem(CFG.storageKeyBlocks);
    const data = u.jparse(raw, []);
    return Array.isArray(data) ? data : [];
  }
  function saveBlocks(arr){
    localStorage.setItem(CFG.storageKeyBlocks, u.jstring(arr || []));
  }
  function rebuildDefsMap(){
    RC._defsByType.clear();
    for (const d of loadBlocks()){
      if (d && d.blockType) RC._defsByType.set(d.blockType, d);
    }
  }
  function updateDef(blockType, patch){
    const defs = loadBlocks();
    const idx = defs.findIndex(d => d.blockType === blockType);
    if (idx < 0) return false;
    defs[idx] = Object.assign({}, defs[idx], patch || {}, { updatedAt: Date.now() });
    saveBlocks(defs);
    rebuildDefsMap();
    return true;
  }
  function deleteDef(blockType){
    const defs = loadBlocks().filter(d => d.blockType !== blockType);
    saveBlocks(defs);
    rebuildDefsMap();
  }

  // ------------------------------
  // CSS
  // ------------------------------
  function injectCss(){
    if (document.getElementById('rc-cb-css')) return;
    const s = document.createElement('style');
    s.id='rc-cb-css';
    s.textContent = `
/* Bigger label only for custom category */
.rcCustomCatRow .blocklyTreeLabel{
  font-size: 18px !important;
  font-weight: 1000 !important;
  letter-spacing: .02em !important;
}

/* PC-only floating open button inside Scratch view */
#rcCbOpenBtn{
  position: absolute;
  right: 14px;
  bottom: 14px;
  width: 56px;
  height: 56px;
  border-radius: 18px;
  border: 1px solid rgba(148,163,184,.16);
  background: rgba(30,41,59,.78);
  color: #e2e8f0;
  display: none;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  user-select: none;
  box-shadow: 0 20px 45px rgba(0,0,0,.45);
  z-index: 20;
  backdrop-filter: blur(8px);
}
#rcCbOpenBtn:active{ transform: scale(.97); }

/* Custom Blocks view */
#view-customblocks{
  background: rgba(2,6,23,.22);
}
#rcCustomBlocksTop{
  display:flex;
  align-items:center;
  gap:10px;
  padding: 10px 12px;
  border-bottom: 1px solid rgba(148,163,184,.10);
  background: rgba(2,6,23,.28);
}
#rcCustomBlocksTop .lbl{
  font-size: 11px;
  font-weight: 900;
  color: #cbd5e1;
}
#rcCustomBlocksTop input[type="text"]{
  min-width: 220px;
  background: rgba(2,6,23,.55);
  border: 1px solid rgba(148,163,184,.16);
  border-radius: 12px;
  padding: 10px 10px;
  color: #fff;
  outline: none;
  font-weight: 900;
}
#rcCustomBlocksTop input[type="color"]{
  width: 48px;
  height: 40px;
  border: none;
  background: transparent;
}
#rcCustomBlocksTop .btn{
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(30,41,59,.74);
  color: #e2e8f0;
  font-weight: 950;
  cursor: pointer;
  user-select:none;
}
#rcCustomBlocksTop .btn.primary{
  background: rgba(59,130,246,.85);
  border-color: rgba(59,130,246,.55);
  color: #fff;
}
#rcCustomBlocksTop .btn:active{ transform: scale(.99); }
#rcCustomBlocksDiv{
  flex:1;
  min-height: 0;
  background: rgba(2,6,23,.35);
}

/* Dark toolbox for builder workspace (so it doesn't look "white") */
#view-customblocks .blocklyToolboxDiv{
  background: rgba(15,23,42,.96) !important;
  border-right: 1px solid rgba(148,163,184,.12) !important;
  width: 230px !important;
}
#view-customblocks .blocklyTreeLabel{
  color:#e2e8f0 !important;
  font-weight: 900 !important;
}
#view-customblocks .blocklyFlyoutBackground{ fill: rgba(2,6,23,.55) !important; }
#view-customblocks .blocklyMainBackground{ fill: rgba(2,6,23,.35) !important; }

/* Manager modal */
#rcCbMgrBackdrop{position:fixed;inset:0;background:rgba(0,0,0,.58);backdrop-filter:blur(8px);z-index:${CFG.uiZ+20};display:none;}
#rcCbMgrModal{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);
width:min(860px,calc(100vw - 20px));height:min(78vh,680px);
background:rgba(15,23,42,.96);border:1px solid rgba(148,163,184,.16);border-radius:18px;overflow:hidden;
z-index:${CFG.uiZ+21};display:none;box-shadow:0 28px 90px rgba(0,0,0,.6);}
#rcCbMgrModal .hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(148,163,184,.14);}
#rcCbMgrModal .hdr .ttl{display:flex;align-items:center;gap:10px;color:#e2e8f0;font-weight:950;letter-spacing:.08em;text-transform:uppercase;font-size:12px;}
#rcCbMgrModal .hdr .ttl .dot{width:10px;height:10px;border-radius:4px;background:${CFG.customCategoryColour};box-shadow:0 0 12px rgba(245,158,11,.45);}
#rcCbMgrModal .hdr .x{width:42px;height:42px;border-radius:14px;border:1px solid rgba(148,163,184,.15);background:rgba(30,41,59,.70);color:#e2e8f0;cursor:pointer;display:flex;align-items:center;justify-content:center;}
#rcCbMgrModal .bar{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid rgba(148,163,184,.10);background:rgba(2,6,23,.28);}
#rcCbMgrModal .bar .btn{padding:10px 12px;border-radius:14px;border:1px solid rgba(148,163,184,.14);background:rgba(30,41,59,.74);color:#e2e8f0;font-weight:950;cursor:pointer;}
#rcCbMgrModal .bar .btn.primary{background:rgba(59,130,246,.85);border-color:rgba(59,130,246,.55);color:#fff;}
#rcCbMgrList{padding:12px 14px;overflow:auto; height: calc(100% - 120px);}
#rcCbMgrList{scrollbar-width:none;-ms-overflow-style:none;}
#rcCbMgrList::-webkit-scrollbar{width:0!important;height:0!important;}
.rcCbRow{display:flex;align-items:center;gap:10px;padding:10px;border:1px solid rgba(148,163,184,.12);border-radius:14px;background:rgba(30,41,59,.35);margin-bottom:10px;}
.rcCbRow .name{flex:1;color:#e2e8f0;font-weight:950;}
.rcCbRow .meta{color:#94a3b8;font-size:12px;font-weight:800;}
.rcCbRow .sw{width:16px;height:16px;border-radius:6px;border:1px solid rgba(148,163,184,.18);}
.rcCbRow .act{display:flex;gap:8px;align-items:center;}
.rcCbRow .act .btn{padding:8px 10px;border-radius:12px;border:1px solid rgba(148,163,184,.14);background:rgba(30,41,59,.74);color:#e2e8f0;font-weight:950;cursor:pointer;}
.rcCbRow .act .btn.danger{border-color:rgba(248,113,113,.35);background:rgba(248,113,113,.12);color:#fecaca;}
`;
    document.head.appendChild(s);
  }

  // ------------------------------
  // Toolbox category: ⭐ Мої блоки
  // ------------------------------
  function ensureCustomCategory(){
    const toolboxXml = document.getElementById('toolbox');
    if (!toolboxXml) return null;

    const exists = Array.from(toolboxXml.children).find(n =>
      n.tagName?.toLowerCase()==='category' && (n.getAttribute('id')||'')===CFG.customCategoryId
    );
    if (exists) return exists;

    const cat = document.createElement('category');
    cat.setAttribute('id', CFG.customCategoryId);
    cat.setAttribute('name', CFG.customCategoryName);
    cat.setAttribute('colour', CFG.customCategoryColour);
    toolboxXml.appendChild(cat);
    return cat;
  }

  function rebuildCustomCategory(workspace){
    const toolboxXml = document.getElementById('toolbox');
    if (!toolboxXml || !workspace) return;

    const cat = ensureCustomCategory();
    if (!cat) return;

    while (cat.firstChild) cat.removeChild(cat.firstChild);

    const blocks = loadBlocks();
    for (const b of blocks){
      const blockEl = document.createElement('block');
      blockEl.setAttribute('type', b.blockType);
      cat.appendChild(blockEl);
    }

    try { workspace.updateToolbox(toolboxXml); }
    catch(e){
      try { workspace.updateToolbox(toolboxXml.outerHTML); } catch(_){}
    }

    setTimeout(()=>{
      try { markCustomCategoryRow(workspace); } catch(e){}
      try {
        const tb = workspace.getToolbox && workspace.getToolbox();
        tb && tb.refreshSelection && tb.refreshSelection();
      } catch(e){}
    }, 60);
  }

  function markCustomCategoryRow(workspace){
    const tb = workspace && workspace.getToolbox && workspace.getToolbox();
    if (!tb || !tb.getToolboxItems) return;
    const items = tb.getToolboxItems();
    for (const it of items){
      try{
        if (typeof it.getId === 'function' && it.getId() === CFG.customCategoryId){
          const div = it.getDiv && it.getDiv();
          if (div) div.classList.add('rcCustomCatRow');
        }
      }catch(e){}
    }
  }

  function selectCustomCategory(workspace){
    try{
      const tb = workspace.getToolbox && workspace.getToolbox();
      if (tb && typeof tb.selectItem === 'function'){
        tb.selectItem(CFG.customCategoryId);
      }
      tb && tb.refreshSelection && tb.refreshSelection();
    }catch(e){}
  }

  // ------------------------------
  // Mini blocks (rc_mini / rc_mini_value) + ⚙ on block
  // ------------------------------
  const GEAR_SVG = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24">
  <path fill="#e2e8f0" d="M19.14,12.94a7.43,7.43,0,0,0,.05-.94,7.43,7.43,0,0,0-.05-.94l2.11-1.65a.5.5,0,0,0,.12-.64l-2-3.46a.5.5,0,0,0-.6-.22l-2.49,1a7.28,7.28,0,0,0-1.63-.94l-.38-2.65A.5.5,0,0,0,12.77,2H11.23a.5.5,0,0,0-.49.42L10.36,5.07a7.28,7.28,0,0,0-1.63.94l-2.49-1a.5.5,0,0,0-.6.22l-2,3.46a.5.5,0,0,0,.12.64L5.86,11.06a7.43,7.43,0,0,0-.05.94,7.43,7.43,0,0,0,.05.94L3.75,14.59a.5.5,0,0,0-.12.64l2,3.46a.5.5,0,0,0,.6.22l2.49-1a7.28,7.28,0,0,0,1.63.94l.38,2.65a.5.5,0,0,0,.49.42h1.54a.5.5,0,0,0,.49-.42l.38-2.65a7.28,7.28,0,0,0,1.63-.94l2.49,1a.5.5,0,0,0,.6-.22l2-3.46a.5.5,0,0,0-.12-.64ZM12,15.5A3.5,3.5,0,1,1,15.5,12,3.5,3.5,0,0,1,12,15.5Z"/>
</svg>`);

  function getAllBlockTypesDropdown(){
    try {
      const Blockly = window.Blockly;
      if (!Blockly || !Blockly.Blocks) return [['(нема)', '']];
      const types = Object.keys(Blockly.Blocks)
        .filter(t => !t.startsWith('rc_'))
        .sort((a,b)=>a.localeCompare(b,'en'));
      const res = types.map(t => [t, t]);
      return res.length ? res : [['(нема)', '']];
    } catch(e){
      return [['(нема)', '']];
    }
  }

  function defineMiniBlocks(Blockly){
    if (Blockly.Blocks['rc_mini']) return;

    function addGearField(input, miniBlockRefGetter){
      const field = new Blockly.FieldImage(GEAR_SVG, 16, 16, '⚙', function(){
        const b = miniBlockRefGetter();
        if (b) openMiniConfigModal(b);
      });
      input.appendField(field, 'GEAR');
    }

    Blockly.Blocks['rc_mini'] = {
      init: function(){
        const input = this.appendDummyInput();
        input.appendField('🧩')
          .appendField(new Blockly.FieldTextInput('mini'), 'LABEL')
          .appendField(new Blockly.FieldDropdown(getAllBlockTypesDropdown), 'WRAP_TYPE');
        addGearField(input, ()=>this);
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#64748B');
        this.setTooltip('Міні-блок: обгортає існуючий блок і зберігає його стан');
        this.data = this.data || '';
      }
    };

    Blockly.Blocks['rc_mini_value'] = {
      init: function(){
        const input = this.appendDummyInput();
        input.appendField('🔹')
          .appendField(new Blockly.FieldTextInput('val'), 'LABEL')
          .appendField(new Blockly.FieldDropdown(getAllBlockTypesDropdown), 'WRAP_TYPE');
        addGearField(input, ()=>this);
        this.setOutput(true, null);
        this.setColour('#475569');
        this.setTooltip('Міні-значення: обгортає value-блок і зберігає його стан');
        this.data = this.data || '';
      }
    };

    // Context menu item as fallback (right-click)
    if (Blockly.ContextMenuRegistry && Blockly.ContextMenuRegistry.registry){
      const reg = Blockly.ContextMenuRegistry.registry;

      if (!reg.getItem('rc_mini_config')){
        reg.register({
          id: 'rc_mini_config',
          scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
          displayText: function(){ return '⚙ Налаштувати міні-блок…'; },
          preconditionFn: function(scope){
            const b = scope.block;
            return (b && (b.type === 'rc_mini' || b.type === 'rc_mini_value')) ? 'enabled' : 'hidden';
          },
          callback: function(scope){ openMiniConfigModal(scope.block); },
          weight: 120
        });
      }
      if (!reg.getItem('rc_mini_clear')){
        reg.register({
          id: 'rc_mini_clear',
          scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
          displayText: function(){ return '🧹 Очистити стан'; },
          preconditionFn: function(scope){
            const b = scope.block;
            return (b && (b.type === 'rc_mini' || b.type === 'rc_mini_value')) ? 'enabled' : 'hidden';
          },
          callback: function(scope){ scope.block.data=''; toast('Стан очищено'); },
          weight: 121
        });
      }
    }

    const jsGen = Blockly.JavaScript || Blockly.javascriptGenerator;
    if (!jsGen) return;

    // hidden ws for generator bridge
    let hiddenWs = null;
    function ensureHiddenWs(){
      if (hiddenWs) return hiddenWs;
      const div = document.createElement('div');
      div.style.position='fixed';
      div.style.left='-99999px';
      div.style.top='-99999px';
      div.style.width='10px';
      div.style.height='10px';
      div.style.opacity='0';
      document.body.appendChild(div);
      hiddenWs = Blockly.inject(div, { toolbox:'<xml></xml>', readOnly:false, scrollbars:false, trashcan:false });
      return hiddenWs;
    }

    function serializeBlock(block){
      try {
        if (Blockly.serialization?.blocks?.save){
          return { kind:'json', payload: Blockly.serialization.blocks.save(block) };
        }
      } catch(e){}
      try {
        const xml = Blockly.Xml.blockToDom(block, true);
        return { kind:'xml', payload: Blockly.Xml.domToText(xml) };
      } catch(e){}
      return null;
    }

    function deserializeBlockTo(ws, wrapType, stateObj){
      ws.clear();
      let b = null;

      if (stateObj && stateObj.kind === 'json' && Blockly.serialization?.blocks?.load){
        try{
          Blockly.serialization.blocks.load(stateObj.payload, ws);
          b = ws.getTopBlocks(true)[0] || null;
        }catch(e){ b=null; }
      }
      if (!b){
        try{
          b = ws.newBlock(wrapType);
          b.initSvg(); b.render();
          if (stateObj && stateObj.kind === 'xml'){
            const dom = Blockly.Xml.textToDom(stateObj.payload);
            ws.clear();
            const loaded = Blockly.Xml.domToBlock(dom, ws);
            b = loaded || b;
            b.initSvg(); b.render();
          }
        }catch(e){
          try{
            b = ws.newBlock(wrapType);
            b.initSvg(); b.render();
          }catch(_){ b=null; }
        }
      }
      return b;
    }

    RC._miniSerialize = serializeBlock;
    RC._miniDeserializeTo = deserializeBlockTo;

    jsGen.forBlock = jsGen.forBlock || {};
    jsGen.forBlock['rc_mini'] = function(block, generator){
      const wrapType = block.getFieldValue('WRAP_TYPE');
      const state = u.jparse(block.data || '', null);
      const ws = ensureHiddenWs();
      const real = deserializeBlockTo(ws, wrapType, state);
      let code = '';
      if (real){
        try{ code = (jsGen.blockToCode ? jsGen.blockToCode(real) : generator.blockToCode(real)) || ''; }catch(e){ code=''; }
      }
      if (Array.isArray(code)) code = code[0] || '';
      if (typeof code !== 'string') code = String(code || '');
      if (code && !code.endsWith('\n')) code += '\n';
      return code;
    };
    jsGen.forBlock['rc_mini_value'] = function(block, generator){
      const wrapType = block.getFieldValue('WRAP_TYPE');
      const state = u.jparse(block.data || '', null);
      const ws = ensureHiddenWs();
      const real = deserializeBlockTo(ws, wrapType, state);
      let out = '';
      let order = 0;
      if (real){
        try{
          const r = (jsGen.blockToCode ? jsGen.blockToCode(real) : generator.blockToCode(real));
          if (Array.isArray(r)){ out = r[0] || ''; order = r[1] || 0; }
          else out = r || '';
        }catch(e){ out=''; }
      }
      if (typeof out !== 'string') out = String(out || '');
      return [out, order];
    };
  }

  // ------------------------------
  // Custom macro block types (stored) — dynamic name/color updates
  // ------------------------------
  function defineCustomBlockType(Blockly, blockType){
    if (!blockType) return;
    if (Blockly.Blocks[blockType]) return;

    Blockly.Blocks[blockType] = {
      init: function(){
        const def = RC._defsByType.get(blockType) || {};
        this.appendDummyInput().appendField('⭐').appendField(def.name || 'Custom');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(def.colour || CFG.defaultCustomBlockColour);
        this.setTooltip('Користувацький блок (збережений)');
      }
    };

    const jsGen = Blockly.JavaScript || Blockly.javascriptGenerator;
    if (!jsGen) return;
    jsGen.forBlock = jsGen.forBlock || {};
    jsGen.forBlock[blockType] = function(block, generator){
      const Blockly = window.Blockly;
      if (!Blockly) return '';
      const def = RC._defsByType.get(blockType);
      if (!def) return '';

      const div = document.createElement('div');
      div.style.position='fixed';
      div.style.left='-99999px';
      div.style.top='-99999px';
      div.style.width='10px';
      div.style.height='10px';
      div.style.opacity='0';
      document.body.appendChild(div);

      let tmpWs = null;
      try{
        tmpWs = Blockly.inject(div, { toolbox:'<xml></xml>', readOnly:false, scrollbars:false, trashcan:false });
        if (def.program && def.program.kind === 'json' && Blockly.serialization?.workspaces?.load){
          Blockly.serialization.workspaces.load(def.program.payload, tmpWs);
        } else if (def.program && def.program.kind === 'xml'){
          const dom = Blockly.Xml.textToDom(def.program.payload);
          Blockly.Xml.domToWorkspace(dom, tmpWs);
        }

        const tops = tmpWs.getTopBlocks(true);
        tops.sort((a,b)=>a.getRelativeToSurfaceXY().y - b.getRelativeToSurfaceXY().y);

        let out = '';
        for (const t of tops){
          let c = '';
          try { c = (jsGen.blockToCode ? jsGen.blockToCode(t) : generator.blockToCode(t)) || ''; } catch(e){ c=''; }
          if (Array.isArray(c)) c = c[0] || '';
          if (typeof c !== 'string') c = String(c||'');
          out += c;
          if (out && !out.endsWith('\n')) out += '\n';
        }
        return out;
      } finally {
        try { tmpWs && tmpWs.dispose(); } catch(e){}
        try { div.remove(); } catch(e){}
      }
    };
  }

  // ------------------------------
  // Mini config modal (kept like earlier screenshot; remove trashcan UI + show grid)
  // ------------------------------
  const miniUI = { backdrop:null, modal:null, wsDiv:null, ws:null, current:null, metaType:null, metaKind:null, pre:null, ro:null };

  function ensureMiniModal(){
    if (miniUI.modal) return;
    injectCss();
    const Blockly = window.Blockly;
    if (!Blockly) return;

    const styleId='rc-mini-css-v26';
    if (!document.getElementById(styleId)){
      const st = document.createElement('style');
      st.id=styleId;
      st.textContent=`
#rcMiniBackdrop{position:fixed;inset:0;background:rgba(0,0,0,.58);backdrop-filter:blur(8px);z-index:${CFG.uiZ+2};display:none;}
#rcMiniModal{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(1180px,calc(100vw - 20px));height:min(88vh,800px);
background:rgba(15,23,42,.96);border:1px solid rgba(148,163,184,.16);border-radius:18px;overflow:hidden;z-index:${CFG.uiZ+3};display:none;box-shadow:0 28px 90px rgba(0,0,0,.6);}
#rcMiniModal .hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(148,163,184,.14);}
#rcMiniModal .ttl{color:#e2e8f0;font-weight:950;letter-spacing:.08em;text-transform:uppercase;font-size:12px;display:flex;gap:10px;align-items:center;}
#rcMiniModal .ttl .dot{width:10px;height:10px;border-radius:4px;background:${CFG.defaultCustomBlockColour};box-shadow:0 0 12px rgba(251,146,60,.5);}
#rcMiniModal .x{width:42px;height:42px;border-radius:14px;border:1px solid rgba(148,163,184,.15);background:rgba(30,41,59,.70);color:#e2e8f0;cursor:pointer;display:flex;align-items:center;justify-content:center;}
#rcMiniModal .bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-bottom:1px solid rgba(148,163,184,.10);background:rgba(2,6,23,.28);color:#cbd5e1;font-weight:800;font-size:12px;}
#rcMiniModal code{padding:2px 7px;border-radius:999px;background:rgba(30,41,59,.75);border:1px solid rgba(148,163,184,.14);color:#e2e8f0;font-size:11px;}
#rcMiniModal .btn{padding:10px 12px;border-radius:14px;border:1px solid rgba(148,163,184,.14);background:rgba(30,41,59,.74);color:#e2e8f0;font-weight:950;cursor:pointer;}
#rcMiniModal .btn.primary{background:rgba(59,130,246,.85);border-color:rgba(59,130,246,.55);color:#fff;}
#rcMiniModal .body{height:calc(100% - 100px);display:grid;grid-template-columns:340px 1fr;min-height:0;}
#rcMiniModal .left,#rcMiniModal .right{min-height:0;overflow:hidden;}
#rcMiniModal .left{border-right:1px solid rgba(148,163,184,.12);padding:12px 12px 12px 14px;display:flex;flex-direction:column;gap:12px;}
#rcMiniModal .right{padding:12px;display:flex;flex-direction:column;min-height:0;}
#rcMiniModal pre{margin:0;background:rgba(2,6,23,.55);border:1px solid rgba(148,163,184,.14);border-radius:14px;padding:10px;color:#e2e8f0;font-size:12px;line-height:1.35;overflow:auto;min-height:180px;max-height:42vh;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;}
#rcMiniModal pre,#rcMiniModal .left,#rcMiniModal .right{scrollbar-width:none;-ms-overflow-style:none;}
#rcMiniModal pre::-webkit-scrollbar,#rcMiniModal .left::-webkit-scrollbar,#rcMiniModal .right::-webkit-scrollbar{width:0!important;height:0!important;}
#rcMiniBlocklyHost{flex:1;min-height:560px;border-radius:14px;border:1px solid rgba(148,163,184,.14);overflow:hidden;background:rgba(2,6,23,.35);}
#rcMiniBlockly{width:100%;height:100%;}
/* Dark toolbox in mini modal */
#rcMiniModal .blocklyToolboxDiv{background:rgba(15,23,42,.96)!important;border-right:1px solid rgba(148,163,184,.12)!important;width:210px!important;}
#rcMiniModal .blocklyTreeLabel{color:#e2e8f0!important;font-weight:900!important;}
#rcMiniModal .blocklyFlyoutBackground{fill:rgba(2,6,23,.55)!important;}
#rcMiniModal .blocklyMainBackground{fill:rgba(2,6,23,.35)!important;}
      `;
      document.head.appendChild(st);
    }

    miniUI.backdrop = u.el('div', { id:'rcMiniBackdrop' });
    miniUI.modal = u.el('div', { id:'rcMiniModal' });

    const hdr = u.el('div', { class:'hdr' }, [
      u.el('div', { class:'ttl' }, [ u.el('span',{class:'dot'}),'НАЛАШТУВАННЯ МІНІ-БЛОКУ' ]),
      u.el('button', { class:'x', onclick: closeMiniModal }, '✕')
    ]);

    miniUI.metaType = u.el('code', {}, '—');
    miniUI.metaKind = u.el('code', {}, '—');

    const btnSave = u.el('button', { class:'btn primary', onclick: saveMini }, 'Зберегти');
    const btnReset= u.el('button', { class:'btn', onclick: resetMini }, 'Скинути');

    const bar = u.el('div', { class:'bar' }, [
      u.el('div', { style:'display:flex; gap:10px; align-items:center; flex-wrap:wrap;' }, [
        u.el('span', { style:'opacity:.85;' }, 'Block type:'),
        miniUI.metaType,
        miniUI.metaKind
      ]),
      u.el('div', { style:'display:flex; gap:10px; align-items:center;' }, [btnReset, btnSave])
    ]);

    const tips = u.el('div', { style:'font-size:12px;color:#cbd5e1;line-height:1.35;' }, [
      u.el('div', { style:'font-weight:950; letter-spacing:.08em; text-transform:uppercase; font-size:11px; color:#94a3b8; margin-bottom:8px;' }, 'ПІДКАЗКИ'),
      u.el('ul', { style:'margin: 6px 0 0 16px; padding:0;' }, [
        u.el('li', {}, 'Тут справжній Blockly — можеш вставляти числа, змінні, PID, сенсори, if/цикли.'),
        u.el('li', {}, 'Після “Зберегти” всередині міні-блоку зберігається серіалізація (JSON/XML).')
      ])
    ]);

    miniUI.pre = u.el('pre', {}, '// preview…');
    const copyBtn = u.el('button', {
      class:'btn',
      style:'align-self:flex-start;',
      onclick: async ()=>{
        const txt = miniUI.pre.textContent || '';
        try{ await navigator.clipboard.writeText(txt); toast('Скопійовано'); }
        catch(e){
          const ta = document.createElement('textarea'); ta.value=txt; document.body.appendChild(ta); ta.select();
          try{ document.execCommand('copy'); toast('Скопійовано'); }catch(_){}
          ta.remove();
        }
      }
    }, 'Copy');

    const left = u.el('div', { class:'left' }, [
      tips,
      u.el('div', { style:'display:flex; align-items:center; justify-content:space-between; gap:10px;' }, [
        u.el('div', { style:'font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:#a5b4fc; font-weight:950;' }, 'PREVIEW JS'),
        copyBtn
      ]),
      miniUI.pre
    ]);

    const host = u.el('div', { id:'rcMiniBlocklyHost' }, [ miniUI.wsDiv = u.el('div', { id:'rcMiniBlockly' }) ]);
    const right = u.el('div', { class:'right' }, [ host ]);

    const body = u.el('div', { class:'body' }, [ left, right ]);

    miniUI.modal.appendChild(hdr);
    miniUI.modal.appendChild(bar);
    miniUI.modal.appendChild(body);

    document.body.appendChild(miniUI.backdrop);
    document.body.appendChild(miniUI.modal);

    miniUI.backdrop.addEventListener('click', closeMiniModal);
    document.addEventListener('keydown', (e)=>{ if (e.key==='Escape' && miniUI.modal.style.display==='block') closeMiniModal(); });

    miniUI.ro = new ResizeObserver(u.debounce(()=>{
      try { miniUI.ws && Blockly.svgResize(miniUI.ws); } catch(e){}
    }, 30));
    miniUI.ro.observe(host);
  }

  function openMiniConfigModal(miniBlock){
    ensureMiniModal();
    const Blockly = window.Blockly;
    if (!Blockly || !miniUI.modal) return;
    miniUI.current = miniBlock;

    const wrapType = miniBlock.getFieldValue('WRAP_TYPE') || '(none)';
    const kind = miniBlock.type === 'rc_mini_value' ? 'VALUE' : 'STATEMENT';
    miniUI.metaType.textContent = wrapType;
    miniUI.metaKind.textContent = kind;

    miniUI.backdrop.style.display='block';
    miniUI.modal.style.display='block';

    // recreate ws
    try { miniUI.ws && miniUI.ws.dispose(); } catch(e){}
    miniUI.ws = null;
    miniUI.wsDiv.innerHTML='';

    const toolboxClone = (document.getElementById('toolbox')?.cloneNode(true)) || '<xml></xml>';
    miniUI.ws = Blockly.inject(miniUI.wsDiv, {
      toolbox: toolboxClone,
      trashcan: false,             // <-- user asked remove trash UI
      scrollbars: true,
      zoom: { controls: false, wheel: true, startScale: 0.95, maxScale: 2, minScale: 0.5, scaleSpeed: 1.1 },
      move: { scrollbars: true, drag: true, wheel: true },
      grid: { spacing: 24, length: 3, colour: 'rgba(148,163,184,.30)', snap: true },
      renderer: 'zelos'
    });

    restoreMiniInner(miniBlock);

    const updatePreview = u.debounce(()=>{
      try{
        const jsGen = Blockly.JavaScript || Blockly.javascriptGenerator;
        miniUI.pre.textContent = (jsGen && miniUI.ws) ? ((jsGen.workspaceToCode(miniUI.ws) || '').trim() || '// (empty)') : '// (no generator)';
      }catch(e){ miniUI.pre.textContent='// (error)'; }
    }, 90);
    miniUI.ws.addChangeListener(updatePreview);

    setTimeout(()=>{ try{ Blockly.svgResize(miniUI.ws); }catch(e){} }, 80);
    setTimeout(()=>{ try{ Blockly.svgResize(miniUI.ws); }catch(e){} }, 180);
    updatePreview();
  }

  function closeMiniModal(){
    if (!miniUI.modal) return;
    miniUI.backdrop.style.display='none';
    miniUI.modal.style.display='none';
    miniUI.current = null;
    try { miniUI.ws && miniUI.ws.dispose(); } catch(e){}
    miniUI.ws = null;
  }

  function restoreMiniInner(miniBlock, forceFresh=false){
    const Blockly = window.Blockly;
    if (!Blockly || !miniUI.ws) return;
    miniUI.ws.clear();

    const wrapType = miniBlock.getFieldValue('WRAP_TYPE');
    let state = null;
    if (!forceFresh) state = u.jparse(miniBlock.data || '', null);

    let real = null;
    if (RC._miniDeserializeTo){
      try { real = RC._miniDeserializeTo(miniUI.ws, wrapType, state); } catch(e){ real=null; }
    }
    if (!real){
      try { real = miniUI.ws.newBlock(wrapType); real.initSvg(); real.render(); } catch(e){}
    }
    const top = miniUI.ws.getTopBlocks(true)[0];
    if (top) { try{ top.moveBy(60, 60); }catch(e){} }
    try { Blockly.svgResize(miniUI.ws); } catch(e){}
  }

  function saveMini(){
    const b = miniUI.current;
    if (!b || !miniUI.ws) return;
    const top = miniUI.ws.getTopBlocks(true)[0];
    if (!top){ b.data=''; toast('Порожньо'); closeMiniModal(); return; }
    const ser = RC._miniSerialize ? RC._miniSerialize(top) : null;
    b.data = ser ? u.jstring(ser) : '';
    toast('Збережено');
    closeMiniModal();
  }

  function resetMini(){
    const b = miniUI.current;
    if (!b || !miniUI.ws) return;
    b.data='';
    restoreMiniInner(b, true);
    toast('Скинуто');
  }

  // ------------------------------
  // Custom Blocks view (separate workspace like Scratch)
  // ------------------------------
  const builder = {
    section: null,
    wsDiv: null,
    ws: null,
    nameInput: null,
    colourInput: null,
    editingType: null
  };

  function ensureCustomBlocksView(){
    if (builder.section) return;
    injectCss();

    const main = document.querySelector('main.flex-1.relative') || document.querySelector('main');
    if (!main) return;

    builder.section = u.el('section', {
      id: 'view-customblocks',
      class: 'absolute inset-0 flex flex-col hidden opacity-0 transition-opacity duration-300'
    });

    // Top row: back
    const backBtn = u.el('button', {
      class: 'top-btn btn-exit',
      title: 'Назад до блоків',
      onclick: ()=> RC.closeCustomBuilder()
    }, u.el('i', { class: 'fa-solid fa-arrow-left' }));

    const topRow = u.el('div', { class:'sensor-row' }, [ backBtn ]);

    const mgrBtn = u.el('button', { class:'btn', onclick: ()=> openManager() }, 'Мої блоки');

    const topBar = u.el('div', { id:'rcCustomBlocksTop' }, [
      u.el('span', { class:'lbl' }, 'Назва'),
      builder.nameInput = u.el('input', { type:'text', value:'Мій блок' }),
      u.el('span', { class:'lbl', style:'margin-left:10px;' }, 'Колір'),
      builder.colourInput = u.el('input', { type:'color', value: CFG.defaultCustomBlockColour }),
      u.el('div', { style:'flex:1;' }),
      mgrBtn,
      u.el('button', { class:'btn primary', onclick: ()=> packOrUpdateCustomBlock() }, 'Спакувати блок')
    ]);

    builder.wsDiv = u.el('div', { id:'rcCustomBlocksDiv' });

    builder.section.appendChild(topRow);
    builder.section.appendChild(topBar);
    builder.section.appendChild(builder.wsDiv);

    const viewBuilder = document.getElementById('view-builder');
    if (viewBuilder && viewBuilder.parentElement === main){
      main.insertBefore(builder.section, viewBuilder.nextSibling);
    } else {
      main.appendChild(builder.section);
    }
  }

  function ensureBuilderWorkspace(){
    ensureCustomBlocksView();
    const Blockly = window.Blockly;
    if (!Blockly || !builder.section || !builder.wsDiv) return;
    if (builder.ws) return;

    // Toolbox: ONLY 2 blocks (as user requested), with gear on each
    const toolbox = document.createElement('xml');
    toolbox.innerHTML = `
      <category name="Міні" colour="#64748B">
        <block type="rc_mini"></block>
        <block type="rc_mini_value"></block>
      </category>
    `;

    builder.ws = Blockly.inject(builder.wsDiv, {
      toolbox,
      trashcan: false,  // <-- remove trash UI
      scrollbars: true,
      zoom: { controls: false, wheel: true, startScale: 0.95, maxScale: 2, minScale: 0.5, scaleSpeed: 1.1 },
      move: { scrollbars: true, drag: true, wheel: true },
      grid: { spacing: 24, length: 3, colour: 'rgba(148,163,184,.30)', snap: true }, // <-- real grid
      renderer: 'zelos'
    });

    // Resize on view show
    const ro = new ResizeObserver(u.debounce(()=>{
      try { builder.ws && Blockly.svgResize(builder.ws); } catch(e){}
    }, 40));
    ro.observe(builder.wsDiv);

    setTimeout(()=>{ try{ Blockly.svgResize(builder.ws); }catch(e){} }, 120);
  }

  function showView(el){
    if (!el) return;
    el.classList.remove('hidden');
    setTimeout(()=>{
      el.classList.remove('opacity-0');
      el.classList.add('opacity-100');
    }, 10);
  }
  function hideView(el){
    if (!el) return;
    el.classList.add('hidden');
    el.classList.remove('opacity-100');
    el.classList.add('opacity-0');
  }

  function clearBuilder(){
    try { builder.ws && builder.ws.clear(); } catch(e){}
    builder.editingType = null;
    if (builder.nameInput) builder.nameInput.value = 'Мій блок';
    if (builder.colourInput) builder.colourInput.value = CFG.defaultCustomBlockColour;
  }

  function loadProgramIntoBuilder(def){
    const Blockly = window.Blockly;
    ensureBuilderWorkspace();
    if (!Blockly || !builder.ws || !def) return;

    clearBuilder();
    builder.editingType = def.blockType;
    builder.nameInput.value = def.name || 'Мій блок';
    builder.colourInput.value = def.colour || CFG.defaultCustomBlockColour;

    builder.ws.clear();
    if (def.program && def.program.kind === 'json' && Blockly.serialization?.workspaces?.load){
      Blockly.serialization.workspaces.load(def.program.payload, builder.ws);
    } else if (def.program && def.program.kind === 'xml'){
      const dom = Blockly.Xml.textToDom(def.program.payload);
      Blockly.Xml.domToWorkspace(dom, builder.ws);
    }
    setTimeout(()=>{ try{ Blockly.svgResize(builder.ws); }catch(e){} }, 80);
  }

  function packOrUpdateCustomBlock(){
    const Blockly = window.Blockly;
    const mainWs = window.workspace || window._workspace;
    if (!Blockly || !builder.ws || !mainWs) return;

    const name = (builder.nameInput.value || '').trim() || 'Мій блок';
    const colour = builder.colourInput.value || CFG.defaultCustomBlockColour;

    let program = null;
    try{
      if (Blockly.serialization?.workspaces?.save){
        program = { kind:'json', payload: Blockly.serialization.workspaces.save(builder.ws) };
      }
    }catch(e){}
    if (!program){
      try{
        const xml = Blockly.Xml.workspaceToDom(builder.ws);
        program = { kind:'xml', payload: Blockly.Xml.domToText(xml) };
      }catch(e){
        program = { kind:'xml', payload: '<xml></xml>' };
      }
    }

    // If editing existing block -> update it
    if (builder.editingType && RC._defsByType.has(builder.editingType)){
      updateDef(builder.editingType, { name, colour, program });
      // Refresh toolbox list + manager list, and future instances will show new name/color
      rebuildCustomCategory(mainWs);
      toast('Оновлено');
      setTimeout(()=> selectCustomCategory(mainWs), 80);
      refreshManagerList();
      return;
    }

    // Otherwise create new
    const blockType = 'rc_user_' + u.uid('b').replaceAll('-','_');
    const def = { id: u.uid('def'), name, colour, blockType, program, createdAt: Date.now() };

    const defs = loadBlocks();
    defs.push(def);
    saveBlocks(defs);
    rebuildDefsMap();

    defineCustomBlockType(Blockly, blockType);
    rebuildCustomCategory(mainWs);
    setTimeout(()=> selectCustomCategory(mainWs), 80);

    toast('Додано в ⭐ Мої блоки');
    refreshManagerList();
  }

  // ------------------------------
  // Manager modal: edit/rename/color/delete/export/import
  // ------------------------------
  const mgr = { backdrop:null, modal:null, list:null, fileInput:null };

  function ensureManager(){
    if (mgr.modal) return;
    injectCss();

    mgr.backdrop = u.el('div', { id:'rcCbMgrBackdrop' });
    mgr.modal = u.el('div', { id:'rcCbMgrModal' });

    const hdr = u.el('div', { class:'hdr' }, [
      u.el('div', { class:'ttl' }, [ u.el('span',{class:'dot'}), 'МОЇ КАСТОМНІ БЛОКИ' ]),
      u.el('button', { class:'x', onclick: closeManager }, '✕')
    ]);

    const btnExport = u.el('button', { class:'btn', onclick: ()=>{
      const defs = loadBlocks();
      u.downloadText('custom_blocks.json', u.jstring({ version: VERSION, defs }));
      toast('Export готовий');
    }}, 'Export');

    mgr.fileInput = u.el('input', { type:'file', accept:'application/json', style:'display:none;' });
    mgr.fileInput.addEventListener('change', async (e)=>{
      const f = e.target.files && e.target.files[0];
      if (!f) return;
      try{
        const txt = await f.text();
        const obj = u.jparse(txt, null);
        const incoming = obj && (obj.defs || obj.blocks || obj);
        if (!Array.isArray(incoming)) throw new Error('bad format');
        const existing = loadBlocks();
        const byType = new Map(existing.map(d=>[d.blockType,d]));
        for (const d of incoming){
          if (!d || !d.blockType) continue;
          byType.set(d.blockType, d);
        }
        const merged = Array.from(byType.values());
        saveBlocks(merged);
        rebuildDefsMap();
        // Register missing types
        const Blockly = window.Blockly;
        if (Blockly){
          for (const d of merged){
            defineCustomBlockType(Blockly, d.blockType);
          }
        }
        const mainWs = window.workspace || window._workspace;
        mainWs && rebuildCustomCategory(mainWs);
        toast('Імпортовано');
        refreshManagerList();
      }catch(err){
        toast('Помилка імпорту');
      }finally{
        mgr.fileInput.value='';
      }
    });

    const btnImport = u.el('button', { class:'btn', onclick: ()=> mgr.fileInput.click() }, 'Import');

    const btnNew = u.el('button', { class:'btn primary', onclick: ()=>{
      RC.openCustomBuilder();
      clearBuilder();
      closeManager();
    }}, 'Новий');

    const bar = u.el('div', { class:'bar' }, [
      u.el('div', { style:'display:flex; gap:10px; align-items:center;' }, [btnExport, btnImport, mgr.fileInput]),
      u.el('div', { style:'display:flex; gap:10px; align-items:center;' }, [btnNew])
    ]);

    mgr.list = u.el('div', { id:'rcCbMgrList' });

    mgr.modal.appendChild(hdr);
    mgr.modal.appendChild(bar);
    mgr.modal.appendChild(mgr.list);

    document.body.appendChild(mgr.backdrop);
    document.body.appendChild(mgr.modal);

    mgr.backdrop.addEventListener('click', closeManager);
    document.addEventListener('keydown', (e)=>{ if (e.key==='Escape' && mgr.modal.style.display==='block') closeManager(); });
  }

  function openManager(){
    ensureManager();
    refreshManagerList();
    mgr.backdrop.style.display='block';
    mgr.modal.style.display='block';
  }
  function closeManager(){
    if (!mgr.modal) return;
    mgr.backdrop.style.display='none';
    mgr.modal.style.display='none';
  }

  function refreshManagerList(){
    if (!mgr.list) return;
    mgr.list.innerHTML='';

    const defs = loadBlocks().sort((a,b)=>(b.updatedAt||b.createdAt||0)-(a.updatedAt||a.createdAt||0));
    if (!defs.length){
      mgr.list.appendChild(u.el('div',{style:'color:#94a3b8;font-weight:900;padding:10px;'},'Нема кастомних блоків. Натисни "Новий".'));
      return;
    }

    for (const d of defs){
      const sw = u.el('div', { class:'sw', style:`background:${d.colour || CFG.defaultCustomBlockColour};` });
      const name = u.el('div', { class:'name' }, d.name || d.blockType);

      const meta = u.el('div', { class:'meta' }, (d.blockType||'').slice(0,24));

      const btnEdit = u.el('button', { class:'btn', onclick: ()=>{
        closeManager();
        RC.openCustomBuilder();
        setTimeout(()=> loadProgramIntoBuilder(d), 120);
      }}, 'Редаг.');

      const btnRename = u.el('button', { class:'btn', onclick: ()=>{
        const n = prompt('Нова назва блоку:', d.name || '');
        if (n === null) return;
        const newName = (n || '').trim();
        if (!newName) return toast('Порожня назва');
        updateDef(d.blockType, { name: newName });
        toast('Перейменовано');
        // Rebuild toolbox so new instances show new label
        const mainWs = window.workspace || window._workspace;
        mainWs && rebuildCustomCategory(mainWs);
        refreshManagerList();
      }}, 'Назва');

      const colorInput = u.el('input', { type:'color', value: d.colour || CFG.defaultCustomBlockColour, style:'width:38px;height:34px;border:none;background:transparent;cursor:pointer;' });
      colorInput.addEventListener('input', ()=>{
        updateDef(d.blockType, { colour: colorInput.value });
        const mainWs = window.workspace || window._workspace;
        mainWs && rebuildCustomCategory(mainWs);
        refreshManagerList();
      });

      const btnDel = u.el('button', { class:'btn danger', onclick: ()=>{
        if (!confirm('Видалити цей блок?')) return;
        deleteDef(d.blockType);
        const mainWs = window.workspace || window._workspace;
        mainWs && rebuildCustomCategory(mainWs);
        toast('Видалено');
        refreshManagerList();
      }}, 'Видал.');

      mgr.list.appendChild(
        u.el('div', { class:'rcCbRow' }, [
          sw,
          name,
          meta,
          u.el('div', { class:'act' }, [btnEdit, btnRename, colorInput, btnDel])
        ])
      );
    }
  }

  // ------------------------------
  // Public: open/close custom builder view
  // ------------------------------
  RC.openCustomBuilder = function(){
    if (!isDesktop()) return;
    ensureBuilderWorkspace();
    const el = document.getElementById('view-customblocks');
    if (!el) return;

    if (typeof window.switchView === 'function'){
      window.switchView('view-customblocks');
    } else {
      showView(el);
    }

    if (typeof window.toggleScratchMode === 'function'){
      window.toggleScratchMode(true);
    }

    setTimeout(()=>{
      try { window.Blockly && builder.ws && window.Blockly.svgResize(builder.ws); } catch(e){}
    }, 140);
  };

  RC.closeCustomBuilder = function(){
    const el = document.getElementById('view-customblocks');
    if (!el) return;
    if (typeof window.switchView === 'function'){
      const btn = document.querySelector('button.nav-btn[title="Блоки"]') || null;
      window.switchView('view-builder', btn);
    } else {
      hideView(el);
      const vb = document.getElementById('view-builder');
      showView(vb);
    }
    setTimeout(()=>{
      try { window.Blockly && window.workspace && window.Blockly.svgResize(window.workspace); } catch(e){}
    }, 120);
  };

  // ------------------------------
  // Floating 🧩 button in Scratch view only
  // ------------------------------
  function ensureOpenButton(){
    if (!isDesktop()) return;
    injectCss();

    const vb = document.getElementById('view-builder');
    if (!vb) return;

    let btn = document.getElementById('rcCbOpenBtn');
    if (!btn){
      btn = u.el('button', { id:'rcCbOpenBtn', title:'Custom Blocks' }, '🧩');
      btn.addEventListener('click', ()=> RC.openCustomBuilder());
      const cs = getComputedStyle(vb);
      if (cs.position === 'static') vb.style.position = 'relative';
      vb.appendChild(btn);
    } else if (btn.parentElement !== vb){
      vb.appendChild(btn);
    }

    const update = ()=>{
      const hidden = vb.classList.contains('hidden');
      btn.style.display = hidden ? 'none' : 'flex';
    };
    update();

    const mo = new MutationObserver(u.debounce(update, 20));
    mo.observe(vb, { attributes:true, attributeFilter:['class','style'] });

    hookSwitchView();
  }

  // ------------------------------
  // Hook switchView: make view-customblocks behave like others
  // ------------------------------
  let switchHooked = false;
  function hookSwitchView(){
    if (switchHooked) return;
    if (typeof window.switchView !== 'function') return;

    switchHooked = true;
    const orig = window.switchView;

    window.switchView = function(viewId, btnElement){
      const custom = document.getElementById('view-customblocks');
      if (custom && viewId !== 'view-customblocks'){
        hideView(custom);
      }

      const res = orig.call(this, viewId, btnElement);

      if (viewId === 'view-customblocks'){
        ensureBuilderWorkspace();
        showView(custom);
        if (typeof window.toggleScratchMode === 'function'){
          window.toggleScratchMode(true);
        }
        setTimeout(()=>{
          try { window.Blockly && builder.ws && window.Blockly.svgResize(builder.ws); } catch(e){}
        }, 120);
      } else {
        if (typeof window.toggleScratchMode === 'function'){
          if (viewId !== 'view-builder'){
            window.toggleScratchMode(false);
          }
        }
      }
      return res;
    };
  }

  // ------------------------------
  // Init
  // ------------------------------
  function initWhenReady(){
    if (!isDesktop()){
      RC.version = VERSION;
      RC.enabled = false;
      return true;
    }

    const Blockly = window.Blockly;
    const ws = window.workspace || window._workspace || null;
    if (!Blockly || !ws) return false;

    injectCss();
    hookSwitchView();
    ensureCustomBlocksView();

    rebuildDefsMap();

    // Ensure category + define blocks
    ensureCustomCategory();
    defineMiniBlocks(Blockly);

    // Register existing custom blocks
    for (const d of loadBlocks()){
      defineCustomBlockType(Blockly, d.blockType);
    }

    rebuildCustomCategory(ws);
    setTimeout(()=>{
      try{ markCustomCategoryRow(ws); }catch(e){}
    }, 140);

    ensureOpenButton();

    RC.version = VERSION;
    RC.enabled = true;
    RC.openManager = openManager;
    return true;
  }

  if (!initWhenReady()){
    let tries = 0;
    const t = setInterval(()=>{
      tries++;
      if (initWhenReady() || tries > 120) clearInterval(t);
    }, 150);
  }

})();
