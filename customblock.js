/* customblock.js v2.5
   RoboControl - Custom Blocks (Variant B)
   NEW: Builder opens as a separate full-screen view like Scratch (not a modal).
   - Adds section#view-customblocks dynamically (so index.html can stay almost untouched)
   - Floating 🧩 button appears ONLY in Scratch view (#view-builder), PC only
   - Custom blocks category "⭐ Мої блоки" is PC only + bigger label
   - After saving: toolbox rebuild + refresh selection + auto-select "⭐ Мої блоки"

   Requirements (already in your index):
   - global main Blockly workspace variable: window.workspace (or window._workspace)
   - function switchView(viewId, btnElement) exists
*/
(function(){
  'use strict';

  const RC = window.RC_CUSTOMBLOCK = window.RC_CUSTOMBLOCK || {};
  const VERSION = 'v2.5';

  const CFG = {
    storageKeyBlocks: 'rc_cb_blocks_v2',
    customCategoryId: 'rc_custom_category',
    customCategoryName: '⭐ Мої блоки',
    customCategoryColour: '#F59E0B',
    customBlockColour: '#FB923C',
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

/* Custom Blocks view header (uses your dark UI) */
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

/* Make the custom builder workspace fill */
#rcCustomBlocksDiv{
  flex:1;
  min-height: 0;
  background: rgba(2,6,23,.35);
}
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

    // Update toolbox
    try { workspace.updateToolbox(toolboxXml); }
    catch(e){
      try { workspace.updateToolbox(toolboxXml.outerHTML); } catch(_){}
    }

    // Mark row + refresh selection so content appears instantly
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
  // Mini blocks (rc_mini / rc_mini_value)
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

    // Context menu only for our mini blocks (official API)
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
          callback: function(scope){ openMiniConfigView(scope.block); },
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
  // Custom macro block types (stored)
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
        // load saved program (builder workspace)
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
  // MINI CONFIG as a modal (kept simple; uses your main toolbox clone)
  // ------------------------------
  const miniUI = { backdrop:null, modal:null, wsDiv:null, ws:null, current:null, meta:null, ro:null };
  function ensureMiniModal(){
    if (miniUI.modal) return;
    const Blockly = window.Blockly;
    if (!Blockly) return;

    // CSS minimal
    const styleId='rc-mini-css';
    if (!document.getElementById(styleId)){
      const st = document.createElement('style');
      st.id=styleId;
      st.textContent=`
#rcMiniBackdrop{position:fixed;inset:0;background:rgba(0,0,0,.58);backdrop-filter:blur(8px);z-index:${CFG.uiZ};display:none;}
#rcMiniModal{position:fixed;left:50%;top:50%;transform:translate(-50%,-50%);width:min(1120px,calc(100vw - 20px));height:min(88vh,780px);
background:rgba(15,23,42,.96);border:1px solid rgba(148,163,184,.16);border-radius:18px;overflow:hidden;z-index:${CFG.uiZ+1};display:none;box-shadow:0 28px 90px rgba(0,0,0,.6);}
#rcMiniModal .hdr{display:flex;align-items:center;justify-content:space-between;padding:12px 14px;border-bottom:1px solid rgba(148,163,184,.14);}
#rcMiniModal .ttl{color:#e2e8f0;font-weight:950;letter-spacing:.08em;text-transform:uppercase;font-size:12px;display:flex;gap:10px;align-items:center;}
#rcMiniModal .ttl .dot{width:10px;height:10px;border-radius:4px;background:${CFG.customBlockColour};box-shadow:0 0 12px rgba(251,146,60,.5);}
#rcMiniModal .x{width:42px;height:42px;border-radius:14px;border:1px solid rgba(148,163,184,.15);background:rgba(30,41,59,.70);color:#e2e8f0;cursor:pointer;display:flex;align-items:center;justify-content:center;}
#rcMiniModal .bar{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:10px 14px;border-bottom:1px solid rgba(148,163,184,.10);background:rgba(2,6,23,.28);color:#cbd5e1;font-weight:800;font-size:12px;}
#rcMiniModal .btn{padding:10px 12px;border-radius:14px;border:1px solid rgba(148,163,184,.14);background:rgba(30,41,59,.74);color:#e2e8f0;font-weight:950;cursor:pointer;}
#rcMiniModal .btn.primary{background:rgba(59,130,246,.85);border-color:rgba(59,130,246,.55);}
#rcMiniModal .body{height:calc(100% - 100px);display:grid;grid-template-columns:280px 1fr;min-height:0;}
#rcMiniModal .left,#rcMiniModal .right{min-height:0;overflow:hidden;}
#rcMiniModal .left{border-right:1px solid rgba(148,163,184,.12);padding:12px 12px 12px 14px;display:flex;flex-direction:column;gap:12px;}
#rcMiniModal .right{padding:12px;display:flex;flex-direction:column;min-height:0;}
#rcMiniModal pre{margin:0;background:rgba(2,6,23,.55);border:1px solid rgba(148,163,184,.14);border-radius:14px;padding:10px;color:#e2e8f0;font-size:12px;line-height:1.35;overflow:auto;min-height:140px;max-height:42vh;font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,"Liberation Mono","Courier New",monospace;}
#rcMiniModal pre,#rcMiniModal .left,#rcMiniModal .right{scrollbar-width:none;-ms-overflow-style:none;}
#rcMiniModal pre::-webkit-scrollbar,#rcMiniModal .left::-webkit-scrollbar,#rcMiniModal .right::-webkit-scrollbar{width:0!important;height:0!important;}
#rcMiniBlocklyHost{flex:1;min-height:560px;border-radius:14px;border:1px solid rgba(148,163,184,.14);overflow:hidden;background:rgba(2,6,23,.35);}
#rcMiniBlockly{width:100%;height:100%;}
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
      u.el('div', { class:'ttl' }, [ u.el('span',{class:'dot'}),'Налаштування міні-блоку' ]),
      u.el('button', { class:'x', onclick: closeMiniModal }, '✕')
    ]);

    miniUI.meta = u.el('div', { style:'display:flex; gap:10px; align-items:center; flex-wrap:wrap;' }, []);

    const btnSave = u.el('button', { class:'btn primary', onclick: saveMini }, 'Зберегти');
    const btnReset= u.el('button', { class:'btn', onclick: resetMini }, 'Скинути');

    const bar = u.el('div', { class:'bar' }, [
      miniUI.meta,
      u.el('div', { style:'display:flex; gap:10px; align-items:center;' }, [btnReset, btnSave])
    ]);

    const tips = u.el('div', { style:'font-size:12px;color:#cbd5e1;line-height:1.35;' }, [
      u.el('div', { style:'font-weight:950; letter-spacing:.08em; text-transform:uppercase; font-size:11px; color:#94a3b8; margin-bottom:8px;' }, 'ПІДКАЗКИ'),
      u.el('ul', { style:'margin: 6px 0 0 16px; padding:0;' }, [
        u.el('li', {}, 'Тут справжній Blockly — вставляй числа, змінні, PID, сенсори, if/цикли.'),
        u.el('li', {}, 'Після “Зберегти” у міні-блоку зберігається серіалізація (JSON/XML).')
      ])
    ]);

    const pre = u.el('pre', {}, '// preview…');
    const left = u.el('div', { class:'left' }, [ tips, pre ]);

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

    // keep preview updated
    const updatePreview = u.debounce(()=>{
      try{
        const jsGen = Blockly.JavaScript || Blockly.javascriptGenerator;
        pre.textContent = (jsGen && miniUI.ws) ? (jsGen.workspaceToCode(miniUI.ws) || '// (empty)') : '// (no generator)';
      }catch(e){ pre.textContent='// (error)'; }
    }, 80);

    miniUI._updatePreview = updatePreview;
  }

  function openMiniConfigView(miniBlock){
    ensureMiniModal();
    const Blockly = window.Blockly;
    if (!Blockly || !miniUI.modal) return;
    miniUI.current = miniBlock;

    miniUI.meta.innerHTML='';
    const wrapType = miniBlock.getFieldValue('WRAP_TYPE') || '(none)';
    const kind = miniBlock.type === 'rc_mini_value' ? 'VALUE' : 'STATEMENT';
    miniUI.meta.appendChild(u.el('span',{style:'opacity:.8;'},'Block:'));
    miniUI.meta.appendChild(u.el('code',{style:'padding:2px 7px;border-radius:999px;background:rgba(30,41,59,.75);border:1px solid rgba(148,163,184,.14);color:#e2e8f0;font-size:11px;'},wrapType));
    miniUI.meta.appendChild(u.el('code',{style:'padding:2px 7px;border-radius:999px;background:rgba(30,41,59,.75);border:1px solid rgba(148,163,184,.14);color:#e2e8f0;font-size:11px;'},kind));

    miniUI.backdrop.style.display='block';
    miniUI.modal.style.display='block';

    // recreate ws
    try { miniUI.ws && miniUI.ws.dispose(); } catch(e){}
    miniUI.ws = null;
    miniUI.wsDiv.innerHTML='';

    const toolboxClone = (document.getElementById('toolbox')?.cloneNode(true)) || '<xml></xml>';
    miniUI.ws = Blockly.inject(miniUI.wsDiv, {
      toolbox: toolboxClone,
      trashcan: true,
      scrollbars: true,
      move: { scrollbars: true, drag: true, wheel: true },
      zoom: { controls: true, wheel: true, startScale: 0.95, maxScale: 2, minScale: 0.5, scaleSpeed: 1.1 },
      renderer: 'zelos'
    });

    restoreMiniInner(miniBlock);

    miniUI.ws.addChangeListener(miniUI._updatePreview);
    setTimeout(()=>{ try{ Blockly.svgResize(miniUI.ws); }catch(e){} }, 80);
    setTimeout(()=>{ try{ Blockly.svgResize(miniUI.ws); }catch(e){} }, 180);
    miniUI._updatePreview();
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
  // CUSTOM BLOCK BUILDER VIEW (full screen)
  // ------------------------------
  const builder = {
    section: null,
    wsDiv: null,
    ws: null,
    nameInput: null,
    colourInput: null,
    btnPack: null
  };

  function ensureCustomBlocksView(){
    if (builder.section) return;
    injectCss();

    const main = document.querySelector('main.flex-1.relative') || document.querySelector('main');
    if (!main) return;

    // Create section like other views
    builder.section = u.el('section', {
      id: 'view-customblocks',
      class: 'absolute inset-0 flex flex-col hidden opacity-0 transition-opacity duration-300'
    });

    // Top row: back + name + color + pack
    const backBtn = u.el('button', {
      class: 'top-btn btn-exit',
      title: 'Назад до блоків',
      onclick: ()=> RC.closeCustomBuilder()
    }, u.el('i', { class: 'fa-solid fa-arrow-left' }));

    // Reuse your sensor-row class for nice spacing
    const topRow = u.el('div', { class:'sensor-row' }, [ backBtn ]);

    const topBar = u.el('div', { id:'rcCustomBlocksTop' }, [
      u.el('span', { class:'lbl' }, 'Назва'),
      builder.nameInput = u.el('input', { type:'text', value:'Мій блок' }),
      u.el('span', { class:'lbl', style:'margin-left:10px;' }, 'Колір'),
      builder.colourInput = u.el('input', { type:'color', value: CFG.customBlockColour }),
      u.el('div', { style:'flex:1;' }),
      builder.btnPack = u.el('button', { class:'btn primary', onclick: ()=> packCustomBlock() }, 'Спакувати блок')
    ]);

    builder.wsDiv = u.el('div', { id:'rcCustomBlocksDiv' });

    builder.section.appendChild(topRow);
    builder.section.appendChild(topBar);
    builder.section.appendChild(builder.wsDiv);

    // Insert right after view-builder if possible
    const viewBuilder = document.getElementById('view-builder');
    if (viewBuilder && viewBuilder.parentElement === main){
      main.insertBefore(builder.section, viewBuilder.nextSibling);
    } else {
      main.appendChild(builder.section);
    }

    // Build the workspace when first opened (lazy)
  }

  function ensureBuilderWorkspace(){
    ensureCustomBlocksView();
    const Blockly = window.Blockly;
    if (!Blockly || !builder.section || !builder.wsDiv) return;
    if (builder.ws) return;

    // Toolbox for builder
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

    builder.ws = Blockly.inject(builder.wsDiv, {
      toolbox,
      trashcan: true,
      scrollbars: true,
      move: { scrollbars: true, drag: true, wheel: true },
      zoom: { controls: true, wheel: true, startScale: 0.95, maxScale: 2, minScale: 0.5, scaleSpeed: 1.1 },
      renderer: 'zelos'
    });

    // Resize on view show
    const ro = new ResizeObserver(u.debounce(()=>{
      try { builder.ws && Blockly.svgResize(builder.ws); } catch(e){}
    }, 40));
    ro.observe(builder.wsDiv);

    setTimeout(()=>{ try{ Blockly.svgResize(builder.ws); }catch(e){} }, 100);
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

  function packCustomBlock(){
    const Blockly = window.Blockly;
    const mainWs = window.workspace || window._workspace;
    if (!Blockly || !builder.ws || !mainWs) return;

    const name = (builder.nameInput.value || '').trim() || 'Мій блок';
    const colour = builder.colourInput.value || CFG.customBlockColour;

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

    const blockType = 'rc_user_' + u.uid('b').replaceAll('-','_');
    const def = { id: u.uid('def'), name, colour, blockType, program, createdAt: Date.now() };

    const defs = loadBlocks();
    defs.push(def);
    saveBlocks(defs);

    defineCustomBlockType(Blockly, def);
    rebuildCustomCategory(mainWs);

    // auto-open category to show it
    setTimeout(()=> selectCustomCategory(mainWs), 80);

    toast('Додано в ⭐ Мої блоки');

    // Optional: clear builder for next block
    try { builder.ws.clear(); } catch(e){}
  }

  // Public controls
  RC.openCustomBuilder = function(){
    if (!isDesktop()) return;
    ensureBuilderWorkspace();
    const el = document.getElementById('view-customblocks');
    if (!el) return;

    // Hide other views via normal switchView, then show ours
    if (typeof window.switchView === 'function'){
      // move into our view id (we handle showing/hiding via wrapper)
      window.switchView('view-customblocks');
    } else {
      // fallback: show only our section
      showView(el);
    }

    // Resize
    setTimeout(()=>{
      try { window.Blockly && builder.ws && window.Blockly.svgResize(builder.ws); } catch(e){}
    }, 120);
  };

  RC.closeCustomBuilder = function(){
    const el = document.getElementById('view-customblocks');
    if (!el) return;
    // go back to Scratch view
    if (typeof window.switchView === 'function'){
      // find nav btn for builder if exists
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
  // Floating 🧩 button (in Scratch view only)
  // ------------------------------
  function ensureOpenButton(mainWs){
    if (!isDesktop()) return;
    injectCss();

    const vb = document.getElementById('view-builder');
    if (!vb) return;

    let btn = document.getElementById('rcCbOpenBtn');
    if (!btn){
      btn = u.el('button', { id:'rcCbOpenBtn', title:'Custom Blocks (Builder)' }, '🧩');
      btn.addEventListener('click', ()=> RC.openCustomBuilder());
      // make view-builder relative so button positions correctly
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

    // hook switchView to hide our view-customblocks when leaving it
    hookSwitchView();

    return btn;
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
      // Always hide our custom view when switching to any other
      const custom = document.getElementById('view-customblocks');
      if (custom && viewId !== 'view-customblocks'){
        hideView(custom);
      }

      const res = orig.call(this, viewId, btnElement);

      // If switching to custom view, show it + enable scratch-mode space
      if (viewId === 'view-customblocks'){
        ensureBuilderWorkspace();
        showView(custom);
        // Make UI same as Scratch mode (more space)
        if (typeof window.toggleScratchMode === 'function'){
          window.toggleScratchMode(true);
        }
        setTimeout(()=>{
          try { window.Blockly && builder.ws && window.Blockly.svgResize(builder.ws); } catch(e){}
        }, 120);
      } else {
        // if leaving blocks view, respect your app's logic
        if (typeof window.toggleScratchMode === 'function'){
          // keep the same behavior as your original (only view-builder is scratch mode)
          // but do NOT force false if view-builder is active
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
    // Mobile/touch: do nothing
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

    ensureCustomCategory();
    defineMiniBlocks(Blockly);

    const defs = loadBlocks();
    for (const d of defs) defineCustomBlockType(Blockly, d);

    rebuildCustomCategory(ws);
    setTimeout(()=>{
      try{ markCustomCategoryRow(ws); }catch(e){}
    }, 140);

    ensureCustomBlocksView();
    ensureOpenButton(ws);

    RC.version = VERSION;
    RC.enabled = true;
    RC.rebuild = ()=> rebuildCustomCategory(ws);
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
