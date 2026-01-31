/* customblock.js (v2.1)
   ==========================================================
   RoboControl / Blockly: "ВАРІАНТ B" — міні‑блоки з коду існуючих блоків
   ----------------------------------------------------------
   Що ти хотів:
     "Взяти всі блоки → витягнути з них код → зробити міні‑блоки → скласти великий блок → спакувати"

   Якщо робити буквально:
     • для кожного існуючого блоку створити окремий mini_* тип
     • це означає сотні/тисячі нових блоків у Blockly.Blocks
     • toolbox стане величезним, важким, і все почне лагати

   Тому тут кращий підхід (той самий ефект, без хаосу):
     ✅ Є 1 універсальний міні‑блок rc_mini (statement) і rc_mini_value (value).
     ✅ Він "обгортає" будь‑який існуючий block type.
     ✅ Всередині зберігається серіалізований реальний блок (JSON або XML).
     ✅ Генерація коду береться з офіційного javascriptGenerator (тобто ми реально "витягуємо код").

   Далі:
     • ти складаєш багато rc_mini у шаблон (builder workspace)
     • тиснеш "Спакувати блок"
     • створюється компактний rc_user_* блок (іншого кольору), який з’являється у категорії "⭐ Мої блоки"
     • зберігається в localStorage (не зникає після F5)

   Примітка про PID:
     У твоєму index PID є як block type `math_pid` (в toolbox). Див. index.
   ==========================================================
*/
(function(){
  'use strict';

  // ==========================================================
  // 0) Конфіг
  // ==========================================================
  const CFG = {
    STORAGE_KEY: 'rc_custom_blocks_v2_1',

    CATEGORY_NAME: '⭐ Мої блоки',
    CATEGORY_COLOUR: '#F97316',   // помаранчевий

    MINI_COLOUR_STMT: '#F59E0B',  // amber
    MINI_COLOUR_VAL:  '#38BDF8',  // sky

    MODAL_Z: 2000,

    HIDDEN_DIV_ID: 'rc_hidden_ws_root',
    FAB_ID: 'rc_custom_fab',

    MODAL_ID: 'rc_custom_modal',
    TAB_CREATE_ID: 'rc_tab_create',
    TAB_LIST_ID: 'rc_tab_list',
    VIEW_CREATE_ID: 'rc_view_create',
    VIEW_LIST_ID: 'rc_view_list',

    BUILDER_DIV_ID: 'rc_builder_ws',
    BUILDER_CODE_ID: 'rc_builder_code',
    BUILDER_COPY_ID: 'rc_builder_copy',

    CONFIG_MODAL_ID: 'rc_config_modal',
    CONFIG_WS_DIV_ID: 'rc_config_ws',
    CONFIG_CODE_ID: 'rc_cfg_code',
    CONFIG_COPY_ID: 'rc_cfg_copy',

    MAX_CUSTOM_BLOCKS: 250,

    DEBUG: false
  };

  // ==========================================================
  // 1) Утиліти
  // ==========================================================
  const U = {
    log(...a){ if(CFG.DEBUG) console.log('[customblock]', ...a); },
    uid(prefix='id'){
      return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
    },
    qs(sel, root=document){ return root.querySelector(sel); },
    qsa(sel, root=document){ return Array.from(root.querySelectorAll(sel)); },
    html(s){
      return String(s)
        .replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
        .replaceAll('"','&quot;').replaceAll("'",'&#039;');
    },
    safeJsonParse(s, fallback){
      try{ return JSON.parse(s); }catch(e){ return fallback; }
    },
    safeJsonStringify(obj, fallback='{}'){
      try{ return JSON.stringify(obj); }catch(e){ return fallback; }
    },
    sleep(ms){ return new Promise(r=>setTimeout(r, ms)); },
    sortByXY(blocks){
      return blocks.slice().sort((a,b)=>{
        const A = a.getRelativeToSurfaceXY ? a.getRelativeToSurfaceXY() : {x:0,y:0};
        const B = b.getRelativeToSurfaceXY ? b.getRelativeToSurfaceXY() : {x:0,y:0};
        if (A.y !== B.y) return A.y - B.y;
        return A.x - B.x;
      });
    },
    hasSerialization(){
      return !!(window.Blockly && Blockly.serialization && Blockly.serialization.workspaces && Blockly.serialization.blocks);
    },
    xmlTextToDom(text){
      if(!window.Blockly || !Blockly.Xml) return null;
      try{ return Blockly.Xml.textToDom(text); }catch(e){ return null; }
    },
    domToXmlText(dom){
      if(!window.Blockly || !Blockly.Xml) return '';
      try{ return Blockly.Xml.domToText(dom); }catch(e){ return ''; }
    },
    // simple debounce
    debounce(fn, ms){
      let t = null;
      return function(...args){
        clearTimeout(t);
        t = setTimeout(()=>fn.apply(this,args), ms);
      };
    }
  };

  // ==========================================================
  // 2) State
  // ==========================================================
  const S = {
    workspace: null,   // main workspace (from index)
    hiddenWs: null,    // hidden for generation
    builderWs: null,   // inside create modal
    configWs: null,    // config modal
    customBlocks: [],
    availableTypes: [],
    genStack: []
  };

  // ==========================================================
  // 3) Storage
  // ==========================================================
  function loadCustomBlocks(){
    const raw = localStorage.getItem(CFG.STORAGE_KEY);
    const arr = U.safeJsonParse(raw, []);
    if(!Array.isArray(arr)) return [];
    return arr.filter(x => x && typeof x === 'object')
      .slice(0, CFG.MAX_CUSTOM_BLOCKS)
      .map(x => ({
        id: String(x.id || U.uid('rc_user')),
        name: String(x.name || 'Мій блок'),
        colour: String(x.colour || CFG.CATEGORY_COLOUR),
        template: x.template || null,
        templateFormat: (x.templateFormat === 'xml') ? 'xml' : 'json',
        output: !!x.output,
        outputCheck: Array.isArray(x.outputCheck) ? x.outputCheck : null,
        createdAt: Number(x.createdAt || Date.now())
      }));
  }

  function saveCustomBlocks(){
    localStorage.setItem(CFG.STORAGE_KEY, U.safeJsonStringify(S.customBlocks, '[]'));
  }

  // ==========================================================
  // 4) Collect types (from toolbox + Blockly.Blocks)
  // ==========================================================
  function collectBlockTypes(){
    const set = new Set();

    const toolbox = document.getElementById('toolbox');
    if(toolbox){
      U.qsa('block[type]', toolbox).forEach(b=>{
        const t = b.getAttribute('type');
        if(t) set.add(t);
      });
    }

    if(window.Blockly && Blockly.Blocks){
      Object.keys(Blockly.Blocks).forEach(t=>set.add(t));
    }

    let types = Array.from(set).filter(t => typeof t === 'string' && t.trim().length);
    // remove our own wrappers from selection
    types = types.filter(t => !t.startsWith('rc_user_') && t !== 'rc_mini' && t !== 'rc_mini_value');

    // stable sort
    types.sort((a,b)=>a.localeCompare(b));
    S.availableTypes = types;
    return types;
  }

  // ==========================================================
  // 5) Hidden workspace (for code generation)
  // ==========================================================
  function ensureHiddenWorkspace(){
    if(!window.Blockly) return null;
    if(S.hiddenWs) return S.hiddenWs;

    let root = document.getElementById(CFG.HIDDEN_DIV_ID);
    if(!root){
      root = document.createElement('div');
      root.id = CFG.HIDDEN_DIV_ID;
      root.style.position = 'fixed';
      root.style.left = '-99999px';
      root.style.top = '0';
      root.style.width = '10px';
      root.style.height = '10px';
      root.style.opacity = '0';
      root.style.pointerEvents = 'none';
      document.body.appendChild(root);
    }

    const toolboxXml = document.createElement('xml');
    const theme = window.CustomTheme || (Blockly.Themes ? Blockly.Themes.Classic : null);

    S.hiddenWs = Blockly.inject(root, {
      toolbox: toolboxXml,
      renderer: 'zelos',
      theme,
      scrollbars: false,
      trashcan: false,
      grid: { spacing: 40, length: 2, colour: '#334155', snap: true },
      zoom: { controls: false, wheel: false, startScale: 1, maxScale: 1, minScale: 1 }
    });

    return S.hiddenWs;
  }

  // ==========================================================
  // 6) Code gen helpers
  // ==========================================================
  function blockToCodeNormalized(gen, block){
    let out = gen.blockToCode(block);
    if(Array.isArray(out)) out = out[0];
    out = (out == null) ? '' : String(out);
    return out;
  }

  function codeFromWorkspace(gen, ws){
    // Generate in XY order for stability
    const tops = U.sortByXY(ws.getTopBlocks(true));
    let code = '';
    for(const tb of tops){
      code += blockToCodeNormalized(gen, tb);
    }
    return code;
  }

  function generateCodeFromSerializedWorkspace(serialized, format){
    const ws = ensureHiddenWorkspace();
    if(!ws) return '';
    ws.clear();

    if(!window.javascript || !javascript.javascriptGenerator) return '';
    const gen = javascript.javascriptGenerator;

    try{
      if(format === 'xml'){
        const dom = U.xmlTextToDom(serialized || '');
        if(dom) Blockly.Xml.domToWorkspace(dom, ws);
      }else{
        if(U.hasSerialization() && serialized){
          Blockly.serialization.workspaces.load(serialized, ws);
        }
      }
    }catch(e){
      U.log('generateCodeFromSerializedWorkspace load failed', e);
    }

    return codeFromWorkspace(gen, ws);
  }

  function serializeWorkspace(ws){
    if(U.hasSerialization()){
      return { format:'json', state: Blockly.serialization.workspaces.save(ws) };
    }
    const dom = Blockly.Xml.workspaceToDom(ws);
    return { format:'xml', state: U.domToXmlText(dom) };
  }

  function loadWorkspace(ws, payload){
    ws.clear();
    if(!payload || !payload.format) return;
    if(payload.format === 'xml'){
      const dom = U.xmlTextToDom(payload.state || '');
      if(dom) Blockly.Xml.domToWorkspace(dom, ws);
      return;
    }
    if(U.hasSerialization() && payload.state){
      Blockly.serialization.workspaces.load(payload.state, ws);
    }
  }

  // ==========================================================
  // 7) Gear field (clickable) + mini blocks
  // ==========================================================
  function defineMiniBlocks(){
    if(!window.Blockly) return;
    if(Blockly.Blocks['rc_mini']) return; // already

    // Clickable image field with "⚙" (SVG text - short & safe)
    class RcGearField extends Blockly.FieldImage {
      constructor(kind){
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18">
          <rect x="0" y="0" width="18" height="18" rx="4" ry="4" fill="rgba(255,255,255,0.15)"/>
          <text x="9" y="13" text-anchor="middle" font-size="12">⚙</text>
        </svg>`;
        super('data:image/svg+xml;utf8,'+encodeURIComponent(svg), 18, 18, '⚙', () => {});
        this._kind = kind || 'stmt';
      }
      showEditor_(){
        const src = this.getSourceBlock();
        if(src) openConfigModalForMini(src, this._kind);
      }
    }

    const makeDropdown = ()=> new Blockly.FieldDropdown(()=>{
      const types = S.availableTypes.length ? S.availableTypes : collectBlockTypes();
      const opts = types.map(t => [t, t]);
      return opts.length ? opts : [['(нема блоків)', '']];
    });

    // --------------------------
    // rc_mini (statement wrapper)
    // --------------------------
    Blockly.Blocks['rc_mini'] = {
      init: function(){
        this.appendDummyInput()
          .appendField('🧩')
          .appendField(makeDropdown(), 'TYPE')
          .appendField(new RcGearField('stmt'), 'CFG');

        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
        this.setColour(CFG.MINI_COLOUR_STMT);
        this.setTooltip('Міні‑блок (statement): всередині реальний блок. Налаштування через ⚙.');
      }
    };

    // --------------------------
    // rc_mini_value (value wrapper)
    // --------------------------
    Blockly.Blocks['rc_mini_value'] = {
      init: function(){
        this.appendDummyInput()
          .appendField('🔹')
          .appendField(makeDropdown(), 'TYPE')
          .appendField(new RcGearField('value'), 'CFG');

        this.setOutput(true, null);
        this.setColour(CFG.MINI_COLOUR_VAL);
        this.setTooltip('Міні‑блок (value): обгортає value‑блок. Налаштування через ⚙.');
      }
    };

    // --------------------------
    // Generators
    // --------------------------
    if(window.javascript && javascript.javascriptGenerator){
      const gen = javascript.javascriptGenerator;
      gen.forBlock = gen.forBlock || {};

      gen.forBlock['rc_mini'] = function(block){
        const guardKey = block.id || 'rc_mini';
        if(S.genStack.includes(guardKey)) return `// [rc_mini] recursion guard\n`;
        S.genStack.push(guardKey);

        try{
          let payload = block.data ? U.safeJsonParse(block.data, null) : null;
          let code = '';
          if(payload && payload.format){
            code = generateCodeFromSerializedWorkspace(payload.state, payload.format);
          }else{
            const t = block.getFieldValue('TYPE') || '';
            code = `// [rc_mini] no config for ${t}\n`;
          }

          const next = block.getNextBlock();
          if(next) code += gen.blockToCode(next);
          return code;
        } finally {
          S.genStack.pop();
        }
      };

      gen.forBlock['rc_mini_value'] = function(block){
        const guardKey = block.id || 'rc_mini_value';
        if(S.genStack.includes(guardKey)) return ['0', gen.ORDER_ATOMIC];
        S.genStack.push(guardKey);

        try{
          let payload = block.data ? U.safeJsonParse(block.data, null) : null;
          if(payload && payload.format){
            const code = generateCodeFromSerializedWorkspace(payload.state, payload.format);
            // For value wrapper we want only first expression. If config workspace has statements too,
            // generator will output full code; that's not ideal, but user should keep it value‑only.
            const expr = (code || '').trim().replace(/;\s*$/,'');
            return [expr || '0', gen.ORDER_ATOMIC];
          }
          return ['0', gen.ORDER_ATOMIC];
        } finally {
          S.genStack.pop();
        }
      };
    }
  }

  // ==========================================================
  // 8) Config modal for a mini block (edit underlying real block)
  // ==========================================================
  function ensureConfigModal(){
    if(U.qs('#'+CFG.CONFIG_MODAL_ID)) return;

    const mask = document.createElement('div');
    mask.id = CFG.CONFIG_MODAL_ID;
    mask.style.cssText = `
      position: fixed; inset: 0;
      background: rgba(0,0,0,0.65);
      z-index: ${CFG.MODAL_Z+1};
      display: none;
      align-items: center;
      justify-content: center;
      padding: 14px;
      backdrop-filter: blur(6px);
    `;

    mask.innerHTML = `
      <div style="
        width: min(1000px, 96vw);
        height: min(760px, 92vh);
        background: rgba(15,23,42,0.98);
        border: 1px solid rgba(148,163,184,0.25);
        border-radius: 16px;
        box-shadow: 0 30px 80px rgba(0,0,0,0.6);
        display: flex;
        flex-direction: column;
        overflow: hidden;
      ">
        <div style="
          display:flex; align-items:center; justify-content:space-between;
          padding: 10px 14px; border-bottom: 1px solid rgba(148,163,184,0.18);
        ">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:10px; height:10px; border-radius:50%; background:#F59E0B;"></div>
            <div style="font-weight:900; letter-spacing:0.08em; text-transform:uppercase; font-size:12px; color:#FCD34D;">
              Налаштування міні‑блоку
            </div>
          </div>
          <button id="rc_cfg_close" style="
            width: 40px; height: 40px; border-radius: 12px;
            border: 1px solid rgba(148,163,184,0.25);
            background: rgba(30,41,59,0.6);
            color: #e2e8f0; font-weight:900; cursor:pointer;
          ">✕</button>
        </div>

        <div style="display:flex; gap:12px; padding: 10px 14px; border-bottom:1px solid rgba(148,163,184,0.12); align-items:center; flex-wrap:wrap;">
          <div style="display:flex; gap:10px; align-items:center; flex:1;">
            <div style="font-size:12px; color:#94a3b8; font-weight:800;">Block type:</div>
            <div id="rc_cfg_type" style="font-family:monospace; color:#e2e8f0; font-weight:900;">--</div>
            <div id="rc_cfg_kind" style="margin-left:8px; font-size:11px; color:#94a3b8; font-weight:900; letter-spacing:0.12em; text-transform:uppercase;">--</div>
          </div>
          <div style="display:flex; gap:10px;">
            <button id="rc_cfg_reset" style="
              padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(148,163,184,0.25);
              background: rgba(30,41,59,0.6); color:#e2e8f0; font-weight:900; cursor:pointer;
            ">Скинути</button>
            <button id="rc_cfg_save" style="
              padding: 10px 12px; border-radius: 12px; border: 1px solid rgba(59,130,246,0.4);
              background: rgba(37,99,235,0.92); color:white; font-weight:900; cursor:pointer;
            ">Зберегти</button>
          </div>
        </div>

        <div style="flex:1; display:flex; min-height:0;">
          <div style="width: 320px; border-right:1px solid rgba(148,163,184,0.12); padding: 12px; overflow:auto;">
            <div style="font-size:11px; color:#94a3b8; font-weight:900; letter-spacing:0.1em; text-transform:uppercase; margin-bottom:8px;">
              Підказки
            </div>
            <div style="font-size:12px; color:#cbd5e1; line-height:1.45;">
              • Тут справжній Blockly — можеш вставляти числа, змінні, PID, сенсори, IF/цикли.<br>
              • Після “Зберегти” всередині міні‑блоку зберігається серіалізація (JSON/XML).<br>
              • Для value‑міні блоку краще зберігати один value‑вираз (без зайвих statement‑блоків).
            </div>

            <div style="height:12px;"></div>
            <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
              <div style="font-size:11px; color:#94a3b8; font-weight:900; letter-spacing:0.1em; text-transform:uppercase;">
                Preview JS
              </div>
              <button id="${CFG.CONFIG_COPY_ID}" style="
                padding: 8px 10px; border-radius: 12px;
                border: 1px solid rgba(148,163,184,0.25);
                background: rgba(30,41,59,0.6);
                color:#e2e8f0; font-weight:900; cursor:pointer;
              ">Copy</button>
            </div>
            <pre id="${CFG.CONFIG_CODE_ID}" style="
              margin-top:8px;
              background: rgba(2,6,23,0.75);
              border: 1px solid rgba(148,163,184,0.18);
              border-radius: 14px;
              padding: 10px;
              color: #e2e8f0;
              font-size: 12px;
              overflow:auto;
              max-height: 280px;
              white-space: pre-wrap;
              word-break: break-word;
            ">(код з’явиться тут)</pre>
          </div>

          <div style="flex:1; position:relative; min-height:0;">
            <div id="${CFG.CONFIG_WS_DIV_ID}" style="position:absolute; inset:0;"></div>
          </div>
        </div>

        <div style="
          padding: 10px 14px;
          border-top: 1px solid rgba(148,163,184,0.12);
          display:flex; justify-content:space-between; align-items:center;
          font-size: 12px; color:#94a3b8;
        ">
          <div>Esc — закрити</div>
          <div style="font-family:monospace;">customblock.js v2.1</div>
        </div>
      </div>
    `;

    document.body.appendChild(mask);

    const close = ()=> mask.style.display = 'none';
    U.qs('#rc_cfg_close', mask).addEventListener('click', close);
    mask.addEventListener('click', (e)=>{ if(e.target === mask) close(); });
    window.addEventListener('keydown', (e)=>{ if(e.key === 'Escape' && mask.style.display !== 'none') close(); });

    // init ws lazily
    function ensureConfigWs(){
      if(S.configWs) return S.configWs;
      const theme = window.CustomTheme || (Blockly.Themes ? Blockly.Themes.Classic : null);
      const toolbox = document.getElementById('toolbox') || document.createElement('xml');
      S.configWs = Blockly.inject(CFG.CONFIG_WS_DIV_ID, {
        toolbox,
        theme,
        renderer: 'zelos',
        scrollbars: true,
        trashcan: true,
        grid: { spacing: 40, length: 2, colour: '#334155', snap: true },
        zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 2.2, minScale: 0.2 }
      });
      return S.configWs;
    }

    mask._ensureConfigWs = ensureConfigWs;
  }

  // Create default payload for a block type
  function defaultPayloadForType(type){
    const tmpWs = ensureHiddenWorkspace();
    if(!tmpWs) return null;
    tmpWs.clear();
    try{
      const b = tmpWs.newBlock(type);
      b.initSvg(); b.render();
      const payload = serializeWorkspace(tmpWs);
      b.dispose(false);
      return payload;
    }catch(e){
      U.log('defaultPayloadForType failed', type, e);
      return null;
    }
  }

  // Update preview code in config modal
  function updateConfigPreview(){
    const pre = U.qs('#'+CFG.CONFIG_CODE_ID);
    if(!pre || !S.configWs) return;
    if(!window.javascript || !javascript.javascriptGenerator) return;

    const gen = javascript.javascriptGenerator;
    const tops = U.sortByXY(S.configWs.getTopBlocks(true));
    const root = tops[0] || null;
    if(!root){
      pre.textContent = '(нема блоку)';
      return;
    }

    // blockToCode: include nested + next inside root
    let code = blockToCodeNormalized(gen, root);
    // show trimmed but keep readability
    pre.textContent = (code || '').trim() || '(порожній код)';
  }

  const updateConfigPreviewDebounced = U.debounce(updateConfigPreview, 200);

  async function openConfigModalForMini(miniBlock, kind){
    ensureConfigModal();
    const modal = U.qs('#'+CFG.CONFIG_MODAL_ID);
    const ws = modal._ensureConfigWs();

    // clear
    ws.clear();

    const type = miniBlock.getFieldValue('TYPE') || '';
    U.qs('#rc_cfg_type', modal).textContent = type || '--';
    U.qs('#rc_cfg_kind', modal).textContent = (kind === 'value') ? 'VALUE' : 'STATEMENT';

    // load payload from miniBlock.data
    let payload = miniBlock.data ? U.safeJsonParse(miniBlock.data, null) : null;
    if(!payload || !payload.format){
      payload = defaultPayloadForType(type);
    }
    if(payload) loadWorkspace(ws, payload);

    // buttons
    const btnReset = U.qs('#rc_cfg_reset', modal);
    const btnSave = U.qs('#rc_cfg_save', modal);
    const btnCopy = U.qs('#'+CFG.CONFIG_COPY_ID, modal);

    btnReset.onclick = ()=>{
      ws.clear();
      const p = defaultPayloadForType(type);
      if(p) loadWorkspace(ws, p);
      updateConfigPreview();
    };

    btnSave.onclick = ()=>{
      // Save full workspace payload
      const p = serializeWorkspace(ws);
      miniBlock.data = U.safeJsonStringify(p, '{}');
      modal.style.display = 'none';
    };

    btnCopy.onclick = async ()=>{
      const pre = U.qs('#'+CFG.CONFIG_CODE_ID, modal);
      const txt = pre ? pre.textContent : '';
      try{
        await navigator.clipboard.writeText(txt || '');
        btnCopy.textContent = 'Copied';
        setTimeout(()=>btnCopy.textContent='Copy', 600);
      }catch(e){
        alert('Не вдалося скопіювати (браузер заборонив).');
      }
    };

    // auto preview on ws changes
    ws.removeChangeListener(updateConfigPreviewDebounced);
    ws.addChangeListener(updateConfigPreviewDebounced);

    updateConfigPreview();

    // show
    modal.style.display = 'flex';

    // resize fix
    setTimeout(()=>{ try{ ws.resize(); }catch(e){} }, 50);
  }

  // ==========================================================
  // 9) Main modal (builder + list)
  // ==========================================================
  function ensureMainModal(){
    if(U.qs('#'+CFG.MODAL_ID)) return;

    const mask = document.createElement('div');
    mask.id = CFG.MODAL_ID;
    mask.style.cssText = `
      position: fixed; inset: 0;
      z-index: ${CFG.MODAL_Z};
      background: rgba(0,0,0,0.65);
      backdrop-filter: blur(6px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: 14px;
    `;

    mask.innerHTML = `
      <div style="
        width: min(1180px, 98vw);
        height: min(860px, 94vh);
        background: rgba(15,23,42,0.98);
        border: 1px solid rgba(148,163,184,0.22);
        border-radius: 18px;
        box-shadow: 0 30px 90px rgba(0,0,0,0.65);
        overflow: hidden;
        display: flex;
        flex-direction: column;
      ">
        <div style="
          display:flex; align-items:center; justify-content:space-between;
          padding: 10px 14px; border-bottom: 1px solid rgba(148,163,184,0.16);
        ">
          <div style="display:flex; align-items:center; gap:10px;">
            <div style="width:10px; height:10px; border-radius:50%; background:${CFG.CATEGORY_COLOUR};"></div>
            <div style="font-weight:900; letter-spacing:0.12em; text-transform:uppercase; font-size:12px; color:#fdba74;">
              Кастом‑блоки
            </div>
          </div>

          <div style="display:flex; gap:10px; align-items:center;">
            <button id="${CFG.TAB_CREATE_ID}" style="padding:8px 12px; border-radius:12px; border:1px solid rgba(148,163,184,0.18); background: rgba(30,41,59,0.6); color:#e2e8f0; font-weight:900; cursor:pointer;">Створити</button>
            <button id="${CFG.TAB_LIST_ID}" style="padding:8px 12px; border-radius:12px; border:1px solid rgba(148,163,184,0.18); background: rgba(30,41,59,0.35); color:#cbd5e1; font-weight:900; cursor:pointer;">Мої</button>

            <button id="rc_modal_close" style="
              width: 40px; height: 40px; border-radius: 12px;
              border: 1px solid rgba(148,163,184,0.25);
              background: rgba(30,41,59,0.6);
              color: #e2e8f0; font-weight:900; cursor:pointer;
            ">✕</button>
          </div>
        </div>

        <div style="flex:1; min-height:0;">
          <!-- Create -->
          <div id="${CFG.VIEW_CREATE_ID}" style="height:100%; display:flex; flex-direction:column;">
            <div style="display:flex; gap:12px; padding: 12px 14px; border-bottom: 1px solid rgba(148,163,184,0.12); flex-wrap: wrap; align-items:end;">
              <div style="display:flex; flex-direction:column; gap:6px;">
                <div style="font-size:11px; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; color:#94a3b8;">Назва блоку</div>
                <input id="rc_new_name" value="Мій блок" style="
                  width: 280px; max-width: 80vw;
                  background: rgba(2,6,23,0.65);
                  border: 1px solid rgba(148,163,184,0.22);
                  border-radius: 14px;
                  padding: 10px 12px;
                  color: white;
                  font-weight: 900;
                "/>
              </div>

              <div style="display:flex; flex-direction:column; gap:6px;">
                <div style="font-size:11px; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; color:#94a3b8;">Колір</div>
                <input id="rc_new_colour" type="color" value="${CFG.CATEGORY_COLOUR}" style="
                  width: 96px;
                  height: 42px;
                  background: rgba(2,6,23,0.65);
                  border: 1px solid rgba(148,163,184,0.22);
                  border-radius: 14px;
                  padding: 6px;
                "/>
              </div>

              <div style="flex:1; display:flex; gap:10px; justify-content:flex-end; flex-wrap:wrap;">
                <button id="rc_builder_clear" style="
                  padding: 10px 12px; border-radius: 14px;
                  border: 1px solid rgba(148,163,184,0.22);
                  background: rgba(30,41,59,0.6);
                  color: #e2e8f0; font-weight:900; cursor:pointer;
                ">Очистити шаблон</button>

                <button id="rc_builder_pack" style="
                  padding: 10px 12px; border-radius: 14px;
                  border: 1px solid rgba(59,130,246,0.5);
                  background: rgba(37,99,235,0.92);
                  color: white; font-weight:900; cursor:pointer;
                ">Спакувати блок</button>
              </div>
            </div>

            <div style="flex:1; min-height:0; display:flex;">
              <div style="width: 360px; border-right: 1px solid rgba(148,163,184,0.12); padding: 12px; overflow:auto;">
                <div style="font-size:11px; font-weight:900; letter-spacing:0.12em; text-transform:uppercase; color:#94a3b8; margin-bottom:10px;">
                  Пам'ятка
                </div>

                <div style="font-size:12px; color:#cbd5e1; line-height:1.45;">
                  • Додаєш 🧩 <b>rc_mini</b> (statement) або 🔹 <b>rc_mini_value</b> (value).<br>
                  • Обираєш тип блоку.<br>
                  • Тиснеш ⚙ та налаштовуєш реальний блок всередині.<br>
                  • Складаєш ланцюжок — натискаєш <b>Спакувати блок</b>.<br><br>

                  <span style="color:#fdba74; font-weight:900;">PID:</span> у тебе є <code style="background:#0b1220; padding:2px 6px; border-radius:8px;">math_pid</code>.
                </div>

                <div style="height:12px;"></div>

                <div style="display:flex; align-items:center; justify-content:space-between; gap:10px;">
                  <div style="font-size:11px; color:#94a3b8; font-weight:900; letter-spacing:0.1em; text-transform:uppercase;">
                    Preview JS (шаблон)
                  </div>
                  <button id="${CFG.BUILDER_COPY_ID}" style="
                    padding: 8px 10px; border-radius: 12px;
                    border: 1px solid rgba(148,163,184,0.25);
                    background: rgba(30,41,59,0.6);
                    color:#e2e8f0; font-weight:900; cursor:pointer;
                  ">Copy</button>
                </div>
                <pre id="${CFG.BUILDER_CODE_ID}" style="
                  margin-top:8px;
                  background: rgba(2,6,23,0.75);
                  border: 1px solid rgba(148,163,184,0.18);
                  border-radius: 14px;
                  padding: 10px;
                  color: #e2e8f0;
                  font-size: 12px;
                  overflow:auto;
                  max-height: 280px;
                  white-space: pre-wrap;
                  word-break: break-word;
                ">(з’явиться коли додаси блоки у шаблон)</pre>
              </div>

              <div style="flex:1; position:relative; min-height:0;">
                <div id="${CFG.BUILDER_DIV_ID}" style="position:absolute; inset:0;"></div>
              </div>
            </div>
          </div>

          <!-- List -->
          <div id="${CFG.VIEW_LIST_ID}" style="height:100%; display:none; flex-direction:column;">
            <div style="padding: 12px 14px; border-bottom: 1px solid rgba(148,163,184,0.12); display:flex; justify-content:space-between; align-items:center; gap:12px; flex-wrap:wrap;">
              <div style="font-size:12px; color:#94a3b8; font-weight:900; letter-spacing:0.12em; text-transform:uppercase;">
                Мої блоки (localStorage)
              </div>
              <div style="display:flex; gap:10px;">
                <button id="rc_export_json" style="padding:10px 12px; border-radius:14px; border:1px solid rgba(148,163,184,0.22); background: rgba(30,41,59,0.6); color:#e2e8f0; font-weight:900; cursor:pointer;">Експорт JSON</button>
                <button id="rc_import_json" style="padding:10px 12px; border-radius:14px; border:1px solid rgba(148,163,184,0.22); background: rgba(30,41,59,0.6); color:#e2e8f0; font-weight:900; cursor:pointer;">Імпорт JSON</button>
                <button id="rc_reset_all" style="padding:10px 12px; border-radius:14px; border:1px solid rgba(239,68,68,0.35); background: rgba(127,29,29,0.8); color:#fee2e2; font-weight:900; cursor:pointer;">Скинути все</button>
              </div>
            </div>
            <div id="rc_list_container" style="flex:1; overflow:auto; padding: 14px;"></div>
          </div>
        </div>

        <div style="
          padding: 10px 14px;
          border-top: 1px solid rgba(148,163,184,0.12);
          display:flex; justify-content:space-between; align-items:center;
          font-size: 12px; color:#94a3b8;
        ">
          <div>Esc — закрити • Ctrl+M — відкрити</div>
          <div style="font-family:monospace;">customblock.js v2.1</div>
        </div>
      </div>
    `;

    document.body.appendChild(mask);

    // close / click outside
    const close = ()=> mask.style.display = 'none';
    U.qs('#rc_modal_close', mask).addEventListener('click', close);
    mask.addEventListener('click', (e)=>{ if(e.target === mask) close(); });
    window.addEventListener('keydown', (e)=>{ if(e.key === 'Escape' && mask.style.display !== 'none') close(); });

    // tabs
    const btnCreate = U.qs('#'+CFG.TAB_CREATE_ID, mask);
    const btnList = U.qs('#'+CFG.TAB_LIST_ID, mask);
    const viewCreate = U.qs('#'+CFG.VIEW_CREATE_ID, mask);
    const viewList = U.qs('#'+CFG.VIEW_LIST_ID, mask);

    function setTab(which){
      const isCreate = which === 'create';
      viewCreate.style.display = isCreate ? 'flex' : 'none';
      viewList.style.display = isCreate ? 'none' : 'flex';
      btnCreate.style.background = isCreate ? 'rgba(30,41,59,0.6)' : 'rgba(30,41,59,0.35)';
      btnList.style.background = isCreate ? 'rgba(30,41,59,0.35)' : 'rgba(30,41,59,0.6)';
      btnCreate.style.color = isCreate ? '#e2e8f0' : '#cbd5e1';
      btnList.style.color = isCreate ? '#cbd5e1' : '#e2e8f0';

      if(!isCreate) renderCustomBlockList();
    }

    btnCreate.addEventListener('click', ()=>setTab('create'));
    btnList.addEventListener('click', ()=>setTab('list'));

    // init builder ws lazily
    function ensureBuilderWs(){
      if(S.builderWs) return S.builderWs;
      const theme = window.CustomTheme || (Blockly.Themes ? Blockly.Themes.Classic : null);

      // Minimal toolbox: our two mini blocks
      const toolbox = document.createElement('xml');

      const cat = document.createElement('category');
      cat.setAttribute('name', '🧩 Міні');
      cat.setAttribute('colour', CFG.MINI_COLOUR_STMT);

      const b1 = document.createElement('block');
      b1.setAttribute('type', 'rc_mini');
      cat.appendChild(b1);

      const b2 = document.createElement('block');
      b2.setAttribute('type', 'rc_mini_value');
      cat.appendChild(b2);

      toolbox.appendChild(cat);

      S.builderWs = Blockly.inject(CFG.BUILDER_DIV_ID, {
        toolbox,
        theme,
        renderer: 'zelos',
        scrollbars: true,
        trashcan: true,
        grid: { spacing: 40, length: 2, colour: '#334155', snap: true },
        zoom: { controls: true, wheel: true, startScale: 0.9, maxScale: 2.2, minScale: 0.2 }
      });

      // update preview on changes
      S.builderWs.addChangeListener(U.debounce(updateBuilderPreview, 250));

      return S.builderWs;
    }

    mask._ensureBuilderWs = ensureBuilderWs;
    mask._setTab = setTab;

    // buttons
    U.qs('#rc_builder_clear', mask).addEventListener('click', ()=>{
      ensureBuilderWs().clear();
      updateBuilderPreview();
    });

    U.qs('#rc_builder_pack', mask).addEventListener('click', ()=>{
      packFromBuilder(ensureBuilderWs());
      setTab('list');
    });

    U.qs('#'+CFG.BUILDER_COPY_ID, mask).addEventListener('click', async ()=>{
      const pre = U.qs('#'+CFG.BUILDER_CODE_ID, mask);
      const txt = pre ? pre.textContent : '';
      try{
        await navigator.clipboard.writeText(txt || '');
        const b = U.qs('#'+CFG.BUILDER_COPY_ID, mask);
        b.textContent = 'Copied';
        setTimeout(()=>b.textContent='Copy', 600);
      }catch(e){
        alert('Не вдалося скопіювати (браузер заборонив).');
      }
    });

    U.qs('#rc_export_json', mask).addEventListener('click', exportAll);
    U.qs('#rc_import_json', mask).addEventListener('click', importAll);
    U.qs('#rc_reset_all', mask).addEventListener('click', ()=>{
      if(confirm('Точно стерти всі кастом‑блоки?')){
        S.customBlocks = [];
        saveCustomBlocks();
        refreshToolbox();
        renderCustomBlockList();
      }
    });

    // initial tab
    setTab('create');
  }

  function openMainModal(){
    ensureMainModal();
    const modal = U.qs('#'+CFG.MODAL_ID);
    modal.style.display = 'flex';
    modal._ensureBuilderWs();
    modal._setTab('create');
    setTimeout(()=>{ try{ S.builderWs && S.builderWs.resize(); }catch(e){} }, 50);
  }

  // ==========================================================
  // 10) Builder preview JS
  // ==========================================================
  function updateBuilderPreview(){
    const pre = U.qs('#'+CFG.BUILDER_CODE_ID);
    if(!pre || !S.builderWs) return;
    if(!window.javascript || !javascript.javascriptGenerator){
      pre.textContent = '(generator недоступний)';
      return;
    }
    const gen = javascript.javascriptGenerator;
    const code = codeFromWorkspace(gen, S.builderWs).trim();
    pre.textContent = code || '(порожній код)';
  }

  // ==========================================================
  // 11) Pack: builder workspace -> custom block
  // ==========================================================
  function detectTemplateMode(builderWs){
    // If exactly 1 top block and it is rc_mini_value and it has no next, we can create value custom block.
    const tops = builderWs.getTopBlocks(true);
    if(tops.length !== 1) return { output:false, outputCheck:null };
    const root = tops[0];
    if(root.type !== 'rc_mini_value') return { output:false, outputCheck:null };
    if(root.getNextBlock()) return { output:false, outputCheck:null };
    // outputCheck can be null; we keep null (any)
    return { output:true, outputCheck:null };
  }

  function packFromBuilder(builderWs){
    const name = (U.qs('#rc_new_name')?.value || 'Мій блок').trim() || 'Мій блок';
    const colour = (U.qs('#rc_new_colour')?.value || CFG.CATEGORY_COLOUR).trim() || CFG.CATEGORY_COLOUR;

    const tops = builderWs.getTopBlocks(true);
    if(!tops.length){
      alert('Додай хоча б один міні‑блок у шаблон.');
      return;
    }

    const templatePayload = serializeWorkspace(builderWs);
    const mode = detectTemplateMode(builderWs);

    const rec = {
      id: U.uid('rc_user'),
      name,
      colour,
      template: templatePayload.state,
      templateFormat: templatePayload.format,
      output: mode.output,
      outputCheck: mode.outputCheck,
      createdAt: Date.now()
    };

    S.customBlocks.unshift(rec);
    saveCustomBlocks();
    registerOneCustomBlock(rec);
    refreshToolbox();

    builderWs.clear();
    updateBuilderPreview();

    alert('Готово! Блок додано у "⭐ Мої блоки".');
  }

  // ==========================================================
  // 12) Register rc_user_* blocks
  // ==========================================================
  function registerAllCustomBlocks(){
    S.customBlocks.forEach(registerOneCustomBlock);
  }

  function registerOneCustomBlock(rec){
    if(!window.Blockly || !rec || !rec.id) return;

    const type = rec.id;
    if(Blockly.Blocks[type]) return;

    Blockly.Blocks[type] = {
      init: function(){
        this.appendDummyInput()
          .appendField('⭐')
          .appendField(rec.name);
        this.setColour(rec.colour || CFG.CATEGORY_COLOUR);
        if(rec.output){
          this.setOutput(true, rec.outputCheck || null);
        }else{
          this.setPreviousStatement(true, null);
          this.setNextStatement(true, null);
        }
        this.setTooltip('Користувацький блок (згенерований з міні‑блоків).');
      }
    };

    if(window.javascript && javascript.javascriptGenerator){
      const gen = javascript.javascriptGenerator;
      gen.forBlock = gen.forBlock || {};

      gen.forBlock[type] = function(block){
        if(S.genStack.includes(type)) {
          return rec.output ? ['0', gen.ORDER_ATOMIC] : `// [${type}] recursion guard\n`;
        }
        S.genStack.push(type);
        try{
          const ws = ensureHiddenWorkspace();
          if(!ws) return rec.output ? ['0', gen.ORDER_ATOMIC] : '';

          // load template
          ws.clear();
          try{
            if(rec.templateFormat === 'xml'){
              const dom = U.xmlTextToDom(rec.template || '');
              if(dom) Blockly.Xml.domToWorkspace(dom, ws);
            }else{
              if(U.hasSerialization() && rec.template){
                Blockly.serialization.workspaces.load(rec.template, ws);
              }
            }
          }catch(e){
            U.log('template load failed', e);
          }

          // generate code
          const code = codeFromWorkspace(gen, ws);

          if(rec.output){
            const expr = (code || '').trim().replace(/;\s*$/,'');
            return [expr || '0', gen.ORDER_ATOMIC];
          }

          // statement block: append next from main workspace
          let out = code || '';
          const next = block.getNextBlock();
          if(next) out += gen.blockToCode(next);
          return out;
        } finally {
          S.genStack.pop();
        }
      };
    }
  }

  // ==========================================================
  // 13) Toolbox patch: add "⭐ Мої блоки" category
  // ==========================================================
  function refreshToolbox(){
    if(!S.workspace) return;
    const toolbox = document.getElementById('toolbox');
    if(!toolbox) return;

    let cat = null;
    for(const c of U.qsa('category', toolbox)){
      if((c.getAttribute('name') || '').trim() === CFG.CATEGORY_NAME){
        cat = c; break;
      }
    }
    if(!cat){
      cat = document.createElement('category');
      cat.setAttribute('name', CFG.CATEGORY_NAME);
      cat.setAttribute('colour', CFG.CATEGORY_COLOUR);
      toolbox.appendChild(cat);
    }

    // clear
    U.qsa('block', cat).forEach(n=>n.remove());

    // add
    for(const rec of S.customBlocks){
      const b = document.createElement('block');
      b.setAttribute('type', rec.id);
      cat.appendChild(b);
    }

    try{
      if(typeof S.workspace.updateToolbox === 'function'){
        S.workspace.updateToolbox(toolbox);
      }
    }catch(e){
      U.log('updateToolbox failed', e);
    }
  }

  // ==========================================================
  // 14) List UI
  // ==========================================================
  function renderCustomBlockList(){
    const modal = U.qs('#'+CFG.MODAL_ID);
    if(!modal) return;
    const container = U.qs('#rc_list_container', modal);
    if(!container) return;

    if(!S.customBlocks.length){
      container.innerHTML = `
        <div style="padding:18px; border-radius:16px; border:1px solid rgba(148,163,184,0.16); background: rgba(30,41,59,0.35); color:#cbd5e1;">
          Немає жодного кастом‑блоку. Зроби у вкладці “Створити”.
        </div>
      `;
      return;
    }

    let html = '';
    for(const rec of S.customBlocks){
      html += `
        <div style="
          padding: 14px;
          border-radius: 16px;
          border: 1px solid rgba(148,163,184,0.16);
          background: rgba(30,41,59,0.35);
          display:flex; align-items:center; justify-content:space-between;
          gap: 12px;
          margin-bottom: 12px;
        ">
          <div style="display:flex; align-items:center; gap:12px;">
            <div style="width:14px; height:14px; border-radius:6px; background:${U.html(rec.colour || CFG.CATEGORY_COLOUR)}; box-shadow: 0 0 0 3px rgba(0,0,0,0.25) inset;"></div>
            <div>
              <div style="color:white; font-weight: 900;">${U.html(rec.name)} ${rec.output ? '<span style="font-size:11px; color:#7dd3fc; font-weight:900; letter-spacing:0.12em; margin-left:6px;">VALUE</span>' : ''}</div>
              <div style="font-size:12px; color:#94a3b8; font-family:monospace;">${U.html(rec.id)}</div>
            </div>
          </div>
          <div style="display:flex; gap:10px; flex-wrap:wrap;">
            <button data-act="delete" data-id="${U.html(rec.id)}" style="padding:10px 12px; border-radius:14px; border:1px solid rgba(239,68,68,0.35); background: rgba(127,29,29,0.8); color:#fee2e2; font-weight:900; cursor:pointer;">Видалити</button>
          </div>
        </div>
      `;
    }
    container.innerHTML = html;

    U.qsa('button[data-act="delete"]', container).forEach(btn=>{
      btn.addEventListener('click', ()=>{
        const id = btn.getAttribute('data-id');
        if(!id) return;
        if(confirm('Видалити цей кастом‑блок?')){
          S.customBlocks = S.customBlocks.filter(x => x.id !== id);
          saveCustomBlocks();
          refreshToolbox();
          renderCustomBlockList();
        }
      });
    });
  }

  // ==========================================================
  // 15) Export / Import
  // ==========================================================
  function exportAll(){
    const data = U.safeJsonStringify(S.customBlocks, '[]');
    const blob = new Blob([data], {type:'application/json'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'rc_custom_blocks_v2.json';
    a.click();
    setTimeout(()=>URL.revokeObjectURL(a.href), 1000);
  }

  function importAll(){
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = ()=>{
      const file = input.files && input.files[0];
      if(!file) return;
      const r = new FileReader();
      r.onload = ()=>{
        const arr = U.safeJsonParse(String(r.result||''), null);
        if(!Array.isArray(arr)){
          alert('Невірний JSON.');
          return;
        }
        S.customBlocks = arr.filter(x=>x && typeof x==='object')
          .slice(0, CFG.MAX_CUSTOM_BLOCKS)
          .map(x => ({
            id: String(x.id || U.uid('rc_user')),
            name: String(x.name || 'Мій блок'),
            colour: String(x.colour || CFG.CATEGORY_COLOUR),
            template: x.template || null,
            templateFormat: (x.templateFormat === 'xml') ? 'xml' : 'json',
            output: !!x.output,
            outputCheck: Array.isArray(x.outputCheck) ? x.outputCheck : null,
            createdAt: Number(x.createdAt || Date.now())
          }));

        saveCustomBlocks();
        registerAllCustomBlocks();
        refreshToolbox();
        renderCustomBlockList();
        alert('Імпортовано.');
      };
      r.readAsText(file);
    };
    input.click();
  }

  // ==========================================================
  // 16) Floating button (FAB)
  // ==========================================================
  function ensureFab(){
    if(U.qs('#'+CFG.FAB_ID)) return;
    const btn = document.createElement('button');
    btn.id = CFG.FAB_ID;
    btn.textContent = '🧩';
    btn.title = 'Кастом‑блоки (Ctrl+M)';
    btn.style.cssText = `
      position: fixed;
      right: 14px;
      bottom: 14px;
      width: 54px;
      height: 54px;
      border-radius: 18px;
      border: 1px solid rgba(148,163,184,0.22);
      background: rgba(30,41,59,0.78);
      color: white;
      font-size: 22px;
      font-weight: 900;
      box-shadow: 0 18px 60px rgba(0,0,0,0.55);
      z-index: ${CFG.MODAL_Z-1};
      cursor: pointer;
      display:flex;
      align-items:center;
      justify-content:center;
      backdrop-filter: blur(8px);
    `;
    btn.addEventListener('click', openMainModal);
    document.body.appendChild(btn);

    // shortcut
    window.addEventListener('keydown', (e)=>{
      if(e.ctrlKey && (e.key === 'm' || e.key === 'M')){
        e.preventDefault();
        openMainModal();
      }
    });
  }

  // ==========================================================
  // 17) Boot
  // ==========================================================
  async function boot(){
    // wait for Blockly + generator
    for(let i=0;i<120;i++){
      if(window.Blockly && window.javascript && javascript.javascriptGenerator) break;
      await U.sleep(50);
    }
    if(!window.Blockly){
      console.warn('[customblock] Blockly not found.');
      return;
    }

    // wait for window.workspace from index
    for(let i=0;i<200;i++){
      if(window.workspace) break;
      await U.sleep(70);
    }
    S.workspace = window.workspace || null;

    // load blocks
    S.customBlocks = loadCustomBlocks();

    // types
    collectBlockTypes();

    // define wrappers
    defineMiniBlocks();

    // register stored blocks
    registerAllCustomBlocks();

    // patch toolbox
    if(S.workspace) refreshToolbox();

    // UI
    ensureFab();

    U.log('ready', S.customBlocks.length);
  }

  // Start
  boot();

})();
