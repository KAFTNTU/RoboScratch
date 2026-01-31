/* customblock.js v2.4
   RoboControl - Custom Blocks (Variant B)
   Fixes requested:
   1) Mini config workspace area still too small -> shrink left panel + shrink toolbox width in modal, ensure svgResize, min-height rules.
   2) Puzzle (🧩) button visible in joystick/other views -> mount ONLY inside #view-builder and hide whenever #view-builder is hidden.
      Also show ONLY on PC (no touch devices).
   3) Custom blocks features ONLY on PC -> on mobile/touch we do not add "⭐ Мої блоки" category and do not register UI.
   4) "⭐ Мої блоки" category label bigger than others -> add CSS class to that toolbox row.
   5) After saving, custom block didn't appear -> force toolbox rebuild + select the category.

   Load AFTER Blockly + main workspace are created.
*/
(function(){
  'use strict';

  const RC = window.RC_CUSTOMBLOCK = window.RC_CUSTOMBLOCK || {};
  const VERSION = 'v2.4';

  const CFG = {
    storageKeyBlocks: 'rc_cb_blocks_v2',
    customCategoryId: 'rc_custom_category',
    customCategoryName: '⭐ Мої блоки',
    customCategoryColour: '#F59E0B',
    customBlockColour: '#FB923C',
    uiZ: 96
  };

  // --- Desktop detect: show custom blocks ONLY on PC
  function isDesktop(){
    try{
      const fine = window.matchMedia && window.matchMedia('(pointer: fine)').matches;
      const hover = window.matchMedia && window.matchMedia('(hover: hover)').matches;
      const wide = window.matchMedia && window.matchMedia('(min-width: 900px)').matches;
      return !!(fine && hover && wide);
    }catch(e){
      // fallback: if no touch points, likely desktop
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
    }
  };

  // ------------------------------
  // Storage
  // ------------------------------
  function loadBlocks(){
    const raw = localStorage.getItem(CFG.storageKeyBlocks);
    const data = u.jparse(raw, []);
    return Array.isArray(data) ? data : [];
  }
  function saveBlocks(arr){
    localStorage.setItem(CFG.storageKeyBlocks, u.jstring(arr || []));
  }

  // ------------------------------
  // Toolbox: add ⭐ category
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

    try {
      workspace.updateToolbox(toolboxXml);
    } catch(e){
      // fallback: try string
      try { workspace.updateToolbox(toolboxXml.outerHTML); } catch(_){}
    }

    // Mark the toolbox row for our custom category (bigger label)
    setTimeout(()=>{
      try { markCustomCategoryRow(workspace); } catch(e){}
    }, 50);
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
      if (tb && typeof tb.refreshSelection === 'function'){
        tb.refreshSelection();
      }
    }catch(e){}
  }

  // ------------------------------
  // Mini blocks: rc_mini / rc_mini_value
  // - wrap any existing block type + serialized state
  // - generator reconstructs real block in hidden workspace and uses JS generator
  // ------------------------------
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

    Blockly.Blocks['rc_mini'] = {
      init: function(){
        this.appendDummyInput()
          .appendField('🧩')
          .appendField(new Blockly.FieldTextInput('mini'), 'LABEL')
          .appendField(new Blockly.FieldDropdown(getAllBlockTypesDropdown), 'WRAP_TYPE');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour('#64748B');
        this.setTooltip('Міні-блок: обгортає існуючий блок і зберігає його стан');
        this.data = this.data || '';
      }
    };

    Blockly.Blocks['rc_mini_value'] = {
      init: function(){
        this.appendDummyInput()
          .appendField('🔹')
          .appendField(new Blockly.FieldTextInput('val'), 'LABEL')
          .appendField(new Blockly.FieldDropdown(getAllBlockTypesDropdown), 'WRAP_TYPE');
        this.setOutput(true, null);
        this.setColour('#475569');
        this.setTooltip('Міні-значення: обгортає value-блок і зберігає його стан');
        this.data = this.data || '';
      }
    };

    // Context menu ONLY for our mini blocks using ContextMenuRegistry (avoids messing with other blocks)
    if (Blockly.ContextMenuRegistry && Blockly.ContextMenuRegistry.registry){
      const reg = Blockly.ContextMenuRegistry.registry;

      // Register once
      if (!reg.getItem('rc_mini_config')){
        reg.register({
          id: 'rc_mini_config',
          scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
          displayText: function(scope){ return '⚙ Налаштувати міні-блок…'; },
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

    // hidden ws
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
  // Custom macro block type
  // ------------------------------
  function defineCustomBlockType(Blockly, def){
    if (!def || !def.blockType) return;
    if (Blockly.Blocks[def.blockType]) return;

    Blockly.Blocks[def.blockType] = {
      init: function(){
        this.appendDummyInput().appendField('⭐').appendField(def.name || 'Custom');
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(def.colour || CFG.customBlockColour);
        this.setTooltip('Користувацький блок (збережений)');
      }
    };

    const jsGen = Blockly.JavaScript || Blockly.javascriptGenerator;
    if (!jsGen) return;
    jsGen.forBlock = jsGen.forBlock || {};
    jsGen.forBlock[def.blockType] = function(block, generator){
      const Blockly = window.Blockly;
      if (!Blockly) return '';
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
        // load saved program
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
  // UI CSS
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

/* Puzzle button (PC only, in #view-builder only) */
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

/* Mini config modal (keep close to old look, but bigger blockly area) */
#rcMiniBackdrop{
  position: fixed; inset: 0;
  background: rgba(0,0,0,.58);
  backdrop-filter: blur(8px);
  z-index: ${CFG.uiZ};
  display: none;
}
#rcMiniModal{
  position: fixed;
  left: 50%; top: 50%;
  transform: translate(-50%,-50%);
  width: min(1120px, calc(100vw - 20px));
  height: min(88vh, 780px);
  background: rgba(15,23,42,.96);
  border: 1px solid rgba(148,163,184,.16);
  border-radius: 18px;
  overflow: hidden;
  z-index: ${CFG.uiZ + 1};
  display: none;
  box-shadow: 0 28px 90px rgba(0,0,0,.6);
}
#rcMiniModal .hdr{
  display:flex; align-items:center; justify-content:space-between;
  padding: 12px 14px;
  border-bottom: 1px solid rgba(148,163,184,.14);
}
#rcMiniModal .hdr .title{
  display:flex; align-items:center; gap:10px;
  font-weight: 950;
  letter-spacing: .08em;
  text-transform: uppercase;
  font-size: 12px;
  color: #e2e8f0;
}
#rcMiniModal .hdr .title .dot{
  width: 10px; height: 10px;
  border-radius: 4px;
  background: ${CFG.customBlockColour};
  box-shadow: 0 0 12px rgba(251,146,60,.5);
}
#rcMiniModal .hdr .xbtn{
  width: 42px; height: 42px;
  border-radius: 14px;
  border: 1px solid rgba(148,163,184,.15);
  background: rgba(30,41,59,.70);
  color: #e2e8f0;
  cursor:pointer;
  display:flex; align-items:center; justify-content:center;
}
#rcMiniModal .subhdr{
  display:flex; align-items:center; justify-content:space-between;
  gap: 10px;
  padding: 10px 14px;
  border-bottom: 1px solid rgba(148,163,184,.10);
  background: rgba(2,6,23,.28);
  font-size: 12px;
  color: #cbd5e1;
  font-weight: 800;
}
#rcMiniModal .subhdr code{
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(30,41,59,.75);
  border: 1px solid rgba(148,163,184,.14);
  color: #e2e8f0;
  font-size: 11px;
}
#rcMiniModal .btn{
  padding: 10px 12px;
  border-radius: 14px;
  border: 1px solid rgba(148,163,184,.14);
  background: rgba(30,41,59,.74);
  color: #e2e8f0;
  font-weight: 950;
  cursor:pointer;
  user-select:none;
}
#rcMiniModal .btn.primary{
  background: rgba(59,130,246,.85);
  border-color: rgba(59,130,246,.55);
}
#rcMiniModal .body{
  height: calc(100% - 108px);
  display: grid;
  grid-template-columns: 300px 1fr; /* smaller left -> bigger workspace */
  min-height: 0;
}
@media (max-width: 980px){
  #rcMiniModal .body{ grid-template-columns: 1fr; }
}
#rcMiniModal .left, #rcMiniModal .right{
  min-height: 0;
  overflow: hidden;
}
#rcMiniModal .left{
  border-right: 1px solid rgba(148,163,184,.12);
  padding: 12px 12px 12px 14px;
  display:flex; flex-direction:column; gap: 12px;
}
#rcMiniModal .right{
  padding: 12px;
  display:flex;
  flex-direction:column;
  min-height: 0;
}
#rcMiniModal .card{
  background: rgba(30,41,59,.42);
  border: 1px solid rgba(148,163,184,.12);
  border-radius: 14px;
  padding: 12px;
}
#rcMiniModal pre{
  margin: 10px 0 0 0;
  background: rgba(2,6,23,.55);
  border: 1px solid rgba(148,163,184,.14);
  border-radius: 14px;
  padding: 10px 10px;
  color: #e2e8f0;
  font-size: 12px;
  line-height: 1.35;
  overflow: auto;
  min-height: 140px;
  max-height: 42vh;
  font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono","Courier New", monospace;
}
/* Hide scrollbars in modal panes */
#rcMiniModal pre, #rcMiniModal .left, #rcMiniModal .right{
  scrollbar-width: none;
  -ms-overflow-style: none;
}
#rcMiniModal pre::-webkit-scrollbar,
#rcMiniModal .left::-webkit-scrollbar,
#rcMiniModal .right::-webkit-scrollbar{
  width:0 !important; height:0 !important;
}

/* Blockly host fill */
#rcMiniBlocklyHost{
  flex: 1;
  min-height: 520px; /* bigger area */
  height: auto;
  border-radius: 14px;
  border: 1px solid rgba(148,163,184,.14);
  overflow: hidden;
  background: rgba(2,6,23,.35);
}
#rcMiniBlockly{ width:100%; height:100%; }

/* Darker toolbox inside mini modal + narrower to free space */
#rcMiniModal .blocklyToolboxDiv{
  background: rgba(15,23,42,.96) !important;
  border-right: 1px solid rgba(148,163,184,.12) !important;
  width: 210px !important;
}
#rcMiniModal .blocklyTreeLabel{
  color:#e2e8f0 !important;
  font-weight: 900 !important;
}
#rcMiniModal .blocklyFlyoutBackground{ fill: rgba(2,6,23,.55) !important; }
#rcMiniModal .blocklyMainBackground{ fill: rgba(2,6,23,.35) !important; }
`;
    document.head.appendChild(s);
  }

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
        z-index: ${CFG.uiZ+5};
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
  // Mini config modal
  // ------------------------------
  const miniUI = {
    backdrop: null,
    modal: null,
    metaType: null,
    metaKind: null,
    wsHost: null,
    wsDiv: null,
    codePre: null,
    copyBtn: null,
    btnSave: null,
    btnReset: null,
    currentMiniBlock: null,
    miniWorkspace: null,
    ro: null
  };

  function ensureMiniModal(){
    injectCss();
    if (miniUI.modal) return;

    miniUI.backdrop = u.el('div', { id:'rcMiniBackdrop' });
    miniUI.modal = u.el('div', { id:'rcMiniModal' });

    const hdr = u.el('div', { class:'hdr' }, [
      u.el('div', { class:'title' }, [
        u.el('span', { class:'dot' }),
        document.createTextNode('НАЛАШТУВАННЯ МІНІ-БЛОКУ')
      ]),
      u.el('button', { class:'xbtn', onclick: closeMiniModal, title:'Закрити (Esc)' }, '✕')
    ]);

    miniUI.metaType = u.el('code', {}, '—');
    miniUI.metaKind = u.el('code', {}, '—');

    miniUI.btnReset = u.el('button', { class:'btn', onclick: ()=> resetMiniBlockConfig() }, 'Скинути');
    miniUI.btnSave  = u.el('button', { class:'btn primary', onclick: ()=> saveMiniBlockConfig() }, 'Зберегти');

    const sub = u.el('div', { class:'subhdr' }, [
      u.el('div', { style:'display:flex; gap:10px; align-items:center; flex-wrap:wrap;' }, [
        document.createTextNode('Block type:'),
        miniUI.metaType,
        miniUI.metaKind
      ]),
      u.el('div', { style:'display:flex; gap:10px; align-items:center;' }, [
        miniUI.btnReset,
        miniUI.btnSave
      ])
    ]);

    const tips = u.el('div', { style:'font-size:12px;color:#cbd5e1;line-height:1.35;' }, [
      u.el('div', { style:'font-weight:950; letter-spacing:.08em; text-transform:uppercase; font-size:11px; color:#94a3b8; margin-bottom:8px;' }, 'ПІДКАЗКИ'),
      u.el('ul', { style:'margin: 6px 0 0 16px; padding:0;' }, [
        u.el('li', {}, 'Тут справжній Blockly — можеш вставляти числа, змінні, PID, сенсори, if/цикли.'),
        u.el('li', {}, 'Після “Зберегти” у міні-блоку зберігається серіалізація (JSON/XML).'),
        u.el('li', {}, 'Для value-міні блоку краще зберігати один value-вираз (без зайвих statement).')
      ])
    ]);

    miniUI.codePre = u.el('pre', {}, '// preview…');
    miniUI.copyBtn = u.el('button', {
      style:'padding:8px 10px;border-radius:12px;border:1px solid rgba(148,163,184,.14);background:rgba(30,41,59,.74);color:#e2e8f0;font-weight:950;cursor:pointer;',
      onclick: ()=> copyMiniPreview()
    }, 'Copy');

    const left = u.el('div', { class:'left' }, [
      u.el('div', { class:'card' }, [ tips ]),
      u.el('div', { class:'card' }, [
        u.el('div', { style:'display:flex; align-items:center; justify-content:space-between; gap:10px;' }, [
          u.el('div', { style:'font-size:11px; letter-spacing:.12em; text-transform:uppercase; color:#a5b4fc; font-weight:950;' }, 'PREVIEW JS'),
          miniUI.copyBtn
        ]),
        miniUI.codePre
      ])
    ]);

    miniUI.wsHost = u.el('div', { id:'rcMiniBlocklyHost' }, [
      miniUI.wsDiv = u.el('div', { id:'rcMiniBlockly' })
    ]);
    const right = u.el('div', { class:'right' }, [ miniUI.wsHost ]);

    const body = u.el('div', { class:'body' }, [ left, right ]);

    miniUI.modal.appendChild(hdr);
    miniUI.modal.appendChild(sub);
    miniUI.modal.appendChild(body);

    document.body.appendChild(miniUI.backdrop);
    document.body.appendChild(miniUI.modal);

    miniUI.backdrop.addEventListener('click', closeMiniModal);
    document.addEventListener('keydown', (e)=>{
      if (e.key === 'Escape' && miniUI.modal.style.display === 'block') closeMiniModal();
    });

    miniUI.ro = new ResizeObserver(u.debounce(()=>{
      try { if (miniUI.miniWorkspace) window.Blockly.svgResize(miniUI.miniWorkspace); } catch(e){}
    }, 30));
    miniUI.ro.observe(miniUI.wsHost);
  }

  function openMiniConfigModal(miniBlock){
    ensureMiniModal();
    miniUI.currentMiniBlock = miniBlock;

    const wrapType = miniBlock.getFieldValue('WRAP_TYPE') || '(none)';
    const kind = miniBlock.type === 'rc_mini_value' ? 'VALUE' : 'STATEMENT';
    miniUI.metaType.textContent = wrapType;
    miniUI.metaKind.textContent = kind;

    miniUI.backdrop.style.display = 'block';
    miniUI.modal.style.display = 'block';

    // recreate mini workspace
    try { miniUI.miniWorkspace && miniUI.miniWorkspace.dispose(); } catch(e){}
    miniUI.miniWorkspace = null;
    miniUI.wsDiv.innerHTML = '';

    const Blockly = window.Blockly;
    if (!Blockly) return;

    // IMPORTANT: clone toolbox DOM so it doesn't mess main workspace
    const toolboxClone = (document.getElementById('toolbox')?.cloneNode(true)) || '<xml></xml>';

    miniUI.miniWorkspace = Blockly.inject(miniUI.wsDiv, {
      toolbox: toolboxClone,
      trashcan: true,
      scrollbars: true,
      move: { scrollbars: true, drag: true, wheel: true },
      zoom: { controls: true, wheel: true, startScale: 0.95, maxScale: 2, minScale: 0.5, scaleSpeed: 1.1 },
      renderer: 'zelos'
    });

    restoreMiniInnerBlock(miniBlock);

    miniUI.miniWorkspace.addChangeListener(u.debounce(()=>{
      updateMiniPreview();
    }, 90));

    // resize fixes
    setTimeout(()=>{ try{ Blockly.svgResize(miniUI.miniWorkspace); }catch(e){} }, 50);
    setTimeout(()=>{ try{ Blockly.svgResize(miniUI.miniWorkspace); }catch(e){} }, 180);

    updateMiniPreview();
  }

  function closeMiniModal(){
    if (!miniUI.modal) return;
    miniUI.backdrop.style.display = 'none';
    miniUI.modal.style.display = 'none';
    miniUI.currentMiniBlock = null;
    try { miniUI.miniWorkspace && miniUI.miniWorkspace.dispose(); } catch(e){}
    miniUI.miniWorkspace = null;
  }

  function resetMiniBlockConfig(){
    const b = miniUI.currentMiniBlock;
    if (!b || !miniUI.miniWorkspace) return;
    b.data = '';
    restoreMiniInnerBlock(b, true);
    updateMiniPreview();
    toast('Скинуто');
  }

  function restoreMiniInnerBlock(miniBlock, forceFresh=false){
    const Blockly = window.Blockly;
    if (!Blockly || !miniUI.miniWorkspace) return;

    miniUI.miniWorkspace.clear();
    const wrapType = miniBlock.getFieldValue('WRAP_TYPE');
    let state = null;
    if (!forceFresh) state = u.jparse(miniBlock.data || '', null);

    let real = null;
    if (RC._miniDeserializeTo){
      try { real = RC._miniDeserializeTo(miniUI.miniWorkspace, wrapType, state); } catch(e){ real=null; }
    }
    if (!real){
      try{
        real = miniUI.miniWorkspace.newBlock(wrapType);
        real.initSvg(); real.render();
      }catch(e){}
    }
    const top = miniUI.miniWorkspace.getTopBlocks(true)[0];
    if (top){
      try { top.moveBy(60, 60); } catch(e){}
    }
    try { Blockly.svgResize(miniUI.miniWorkspace); } catch(e){}
  }

  function saveMiniBlockConfig(){
    const b = miniUI.currentMiniBlock;
    if (!b || !miniUI.miniWorkspace) return;
    const Blockly = window.Blockly;

    const top = miniUI.miniWorkspace.getTopBlocks(true)[0];
    if (!top){
      b.data = '';
      toast('Порожньо');
      closeMiniModal();
      return;
    }
    const ser = RC._miniSerialize ? RC._miniSerialize(top) : null;
    b.data = ser ? u.jstring(ser) : '';
    toast('Збережено');
    closeMiniModal();
  }

  function updateMiniPreview(){
    const Blockly = window.Blockly;
    if (!Blockly || !miniUI.miniWorkspace) return;
    const jsGen = Blockly.JavaScript || Blockly.javascriptGenerator;
    if (!jsGen) { miniUI.codePre.textContent = '// (нема JS generator)'; return; }

    let code = '';
    try { code = jsGen.workspaceToCode(miniUI.miniWorkspace) || ''; } catch(e){ code=''; }
    if (Array.isArray(code)) code = code[0] || '';
    if (typeof code !== 'string') code = String(code || '');
    miniUI.codePre.textContent = code.trim() ? code : '// (empty)';
  }

  async function copyMiniPreview(){
    const txt = miniUI.codePre?.textContent || '';
    try{
      await navigator.clipboard.writeText(txt);
      toast('Скопійовано');
    }catch(e){
      const ta = document.createElement('textarea');
      ta.value = txt;
      document.body.appendChild(ta);
      ta.select();
      try{ document.execCommand('copy'); toast('Скопійовано'); }catch(_){}
      ta.remove();
    }
  }

  // ------------------------------
  // Builder modal (pack blocks)
  // ------------------------------
  const builderUI = { modal:null, backdrop:null, ws:null, wsDiv:null, nameInput:null, colourInput:null };

  function ensureBuilderModal(mainWs){
    injectCss();
    if (builderUI.modal) return;

    builderUI.backdrop = u.el('div', { id:'rcCbBackdrop', style:`display:none; position:fixed; inset:0; z-index:${CFG.uiZ}; background: rgba(0,0,0,.55); backdrop-filter: blur(8px);` });
    builderUI.modal = u.el('div', { id:'rcCbModal', style:`display:none; position:fixed; left:50%; top:50%; transform: translate(-50%,-50%);
      width:min(980px,calc(100vw - 20px)); height:min(86vh,760px); z-index:${CFG.uiZ+1};
      background: rgba(15,23,42,.96); border:1px solid rgba(148,163,184,.16); border-radius:18px; overflow:hidden;
      box-shadow: 0 28px 90px rgba(0,0,0,.6);
    `});

    const head = u.el('div', { style:'display:flex; align-items:center; justify-content:space-between; padding:12px 14px; border-bottom:1px solid rgba(148,163,184,.14);' }, [
      u.el('div', { style:'display:flex; align-items:center; gap:10px; color:#e2e8f0; font-weight:950; letter-spacing:.08em; text-transform:uppercase; font-size:12px;' }, [
        u.el('span', { style:`width:10px;height:10px;border-radius:4px;background:${CFG.customCategoryColour};box-shadow:0 0 12px rgba(245,158,11,.45);` }),
        'CUSTOM BLOCK BUILDER'
      ]),
      u.el('button', { style:'width:42px;height:42px;border-radius:14px;border:1px solid rgba(148,163,184,.15);background:rgba(30,41,59,.70);color:#e2e8f0;cursor:pointer;', onclick: closeBuilderModal }, '✕')
    ]);

    const topBar = u.el('div', { style:'display:flex; align-items:center; gap:10px; padding:10px 14px; border-bottom:1px solid rgba(148,163,184,.10); background:rgba(2,6,23,.28);' }, [
      u.el('div', { style:'flex:1; display:flex; gap:10px; align-items:center; flex-wrap:wrap;' }, [
        u.el('label', { style:'font-size:11px;color:#cbd5e1;font-weight:900;' }, 'Назва'),
        builderUI.nameInput = u.el('input', { type:'text', value:'Мій блок', style:'min-width:220px; background:rgba(2,6,23,.55); border:1px solid rgba(148,163,184,.16); border-radius:12px; padding:10px 10px; color:#fff; outline:none; font-weight:900;' }),
        u.el('label', { style:'font-size:11px;color:#cbd5e1;font-weight:900;' }, 'Колір'),
        builderUI.colourInput = u.el('input', { type:'color', value: CFG.customBlockColour, style:'width:48px;height:40px;border:none;background:transparent;' })
      ]),
      u.el('button', { style:'padding:10px 12px;border-radius:14px;border:1px solid rgba(59,130,246,.55);background:rgba(59,130,246,.85);color:#fff;font-weight:950;cursor:pointer;', onclick: ()=> saveCustomBlockFromBuilder(mainWs) }, 'Спакувати блок')
    ]);

    builderUI.wsDiv = u.el('div', { id:'rcBuilderBlockly', style:'width:100%; height: calc(100% - 108px); background: rgba(2,6,23,.35);' });

    builderUI.modal.appendChild(head);
    builderUI.modal.appendChild(topBar);
    builderUI.modal.appendChild(builderUI.wsDiv);

    document.body.appendChild(builderUI.backdrop);
    document.body.appendChild(builderUI.modal);

    builderUI.backdrop.addEventListener('click', closeBuilderModal);

    const Blockly = window.Blockly;
    const toolbox = document.createElement('xml');
    toolbox.innerHTML = `
      <category name="Міні" colour="#64748B">
        <block type="rc_mini"></block>
        <block type="rc_mini_value"></block>
      </category>
      <category name="Логіка" colour="#60a5fa">
        <block type="controls_if"></block>
        <block type="logic_compare"></block>
        <block type="logic_operation"></block>
        <block type="logic_boolean"></block>
      </category>
      <category name="Математика" colour="#a78bfa">
        <block type="math_number"></block>
        <block type="math_arithmetic"></block>
      </category>
      <category name="Змінні" colour="#f87171" custom="VARIABLE"></category>
    `;

    builderUI.ws = Blockly.inject(builderUI.wsDiv, {
      toolbox,
      trashcan: true,
      scrollbars: true,
      move: { scrollbars: true, drag: true, wheel: true },
      zoom: { controls: true, wheel: true, startScale: 0.95, maxScale: 2, minScale: 0.5, scaleSpeed: 1.1 },
      renderer: 'zelos'
    });

    setTimeout(()=>{ try{ Blockly.svgResize(builderUI.ws); }catch(e){} }, 80);
  }

  function openBuilderModal(mainWs){
    ensureBuilderModal(mainWs);
    builderUI.backdrop.style.display='block';
    builderUI.modal.style.display='block';
    setTimeout(()=>{ try{ window.Blockly.svgResize(builderUI.ws); }catch(e){} }, 80);
  }
  function closeBuilderModal(){
    if (!builderUI.modal) return;
    builderUI.backdrop.style.display='none';
    builderUI.modal.style.display='none';
  }

  function saveCustomBlockFromBuilder(mainWs){
    const Blockly = window.Blockly;
    if (!Blockly || !builderUI.ws || !mainWs) return;

    const name = (builderUI.nameInput.value || '').trim() || 'Мій блок';
    const colour = builderUI.colourInput.value || CFG.customBlockColour;

    let program = null;
    try{
      if (Blockly.serialization?.workspaces?.save){
        program = { kind:'json', payload: Blockly.serialization.workspaces.save(builderUI.ws) };
      }
    }catch(e){}
    if (!program){
      try{
        const xml = Blockly.Xml.workspaceToDom(builderUI.ws);
        program = { kind:'xml', payload: Blockly.Xml.domToText(xml) };
      }catch(e){
        program = { kind:'xml', payload: '<xml></xml>' };
      }
    }

    const blockType = 'rc_user_' + u.uid('b').replaceAll('-','_');
    const def = { id: u.uid('def'), name, colour, blockType, program, createdAt: Date.now() };

    const defs = loadBlocks();
    defs.push(def);
    saveBlocks(defs);

    defineCustomBlockType(Blockly, def);
    rebuildCustomCategory(mainWs);
    setTimeout(()=> selectCustomCategory(mainWs), 80);

    toast('Додано в ⭐ Мої блоки');
    closeBuilderModal();
  }

  // ------------------------------
  // Puzzle button: ONLY inside #view-builder, ONLY desktop, hidden if view-builder hidden
  // ------------------------------
  function ensureOpenButton(mainWs){
    if (!isDesktop()) return; // PC only
    injectCss();

    const vb = document.getElementById('view-builder');
    if (!vb) return;

    let btn = document.getElementById('rcCbOpenBtn');
    if (!btn){
      btn = u.el('button', { id:'rcCbOpenBtn', title:'Custom Blocks (Builder)' }, '🧩');
      btn.addEventListener('click', ()=> openBuilderModal(mainWs));
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

    // observe class changes
    const mo = new MutationObserver(u.debounce(update, 20));
    mo.observe(vb, { attributes:true, attributeFilter:['class','style'] });

    // also hook switchView (if exists) for safety
    if (typeof window.switchView === 'function' && !window.__rcCbSwitchHooked){
      window.__rcCbSwitchHooked = true;
      const orig = window.switchView;
      window.switchView = function(viewId, btnElement){
        const r = orig.call(this, viewId, btnElement);
        setTimeout(update, 25);
        return r;
      };
    }
  }

  // ------------------------------
  // Init
  // ------------------------------
  function initWhenReady(){
    // Mobile/touch: do nothing, keep app as-is
    if (!isDesktop()){
      RC.version = VERSION;
      RC.enabled = false;
      return true;
    }

    const Blockly = window.Blockly;
    const ws = window.workspace || window._workspace || null;
    if (!Blockly || !ws) return false;

    ensureCustomCategory();
    defineMiniBlocks(Blockly);

    const defs = loadBlocks();
    for (const d of defs) defineCustomBlockType(Blockly, d);

    rebuildCustomCategory(ws);
    setTimeout(()=>{
      try{ markCustomCategoryRow(ws); }catch(e){}
    }, 120);

    ensureOpenButton(ws);

    RC.version = VERSION;
    RC.enabled = true;
    RC.rebuild = ()=> rebuildCustomCategory(ws);
    RC.openBuilder = ()=> openBuilderModal(ws);
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
