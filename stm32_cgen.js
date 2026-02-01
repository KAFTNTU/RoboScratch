
/* stm32_cgen.js
 * Full Block→C generator for RoboScratch "🚗 Машинка" blocks.
 * Target: STM32F103C6T6 (STM32Cube HAL / CubeIDE / Keil).
 *
 * This generator compiles a Blockly workspace directly into a small cooperative bytecode VM
 * that runs inside the MCU main loop without blocking.
 *
 * It is designed for kids: any combination of supported blocks will produce C that compiles.
 *
 * Usage (loaded alongside customblock.js):
 *   window.RC_STM32_CGEN.generateArtifacts(workspace, {name, params})
 *
 * Artifacts:
 *   - rc_cb_<name>.c / .h : program + VM runtime
 *   - rc_platform_stm32f103.c / rc_platform.h : HAL platform hooks (PWM motors + ADC sensors) with safe defaults
 */

(function(){
  'use strict';

  // ============================================================
  // Public entry
  // ============================================================
  const API = {};
  API.version = 'A-f103-full-1.0.0';

  // Helper: safe string → C identifier
  function cIdent(name){
    return String(name||'cb')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]+/g,'_')
      .replace(/^([^a-z_])/, '_$1')
      .replace(/_+/g,'_')
      .slice(0, 48) || 'cb';
  }

  function cFloat(x){
    if (typeof x !== 'number' || !isFinite(x)) x = 0;
    // ensure decimal point for C float literal
    const s = (Math.round(x*1000000)/1000000).toString();
    return (s.indexOf('.')>=0 ? s : (s + '.0')) + 'f';
  }

  function fail(msg){
    const e = new Error(msg);
    e.isRCGen = true;
    throw e;
  }

  // ============================================================
  // Instruction set
  // Stack VM uses float stack (bool = 0/1).
  // ============================================================
  const OP = {
    NOP: 0,
    // stack / vars
    PUSHF: 1,      // f
    LOAD:  2,      // a=var
    STORE: 3,      // a=var (pop)
    DUP:   4,
    DROP:  5,

    // control flow
    JMP:   6,      // b=target
    JZ:    7,      // b=target; pop cond

    // math
    ADD: 10,
    SUB: 11,
    MUL: 12,
    DIV: 13,
    NEG: 14,
    ABS: 15,
    MIN: 16,
    MAX: 17,
    CLAMP: 18, // pop x, lo, hi -> push clamp(x)
    // compare
    LT: 20,
    GT: 21,
    LE: 22,
    GE: 23,
    EQ: 24,
    NE: 25,
    // logic
    AND: 30,
    OR: 31,
    NOT: 32,

    // time / wait
    TIMER_GET_S: 40,     // push seconds since timer_start
    TIMER_RESET: 41,     // reset timer_start
    WAIT_MS: 42,         // pop ms float; yield until elapsed
    WAIT_S:  43,         // pop seconds float; yield

    // sensors
    SENS: 50,            // a=sens index 0..3  -> push float 0..100
    WAIT_SENS: 51,       // a=sens index, b=op (0 LT, 1 GT), pop val -> yield until condition met

    // car actions
    SET_SPEED: 60,       // pop percent (0..100) -> speed_mult
    MOVE_LR: 61,         // pop R, pop L -> drive L,R,L,R with speed_mult + record if enabled
    MOVE4: 62,           // pop D,C,B,A -> drive A,B,C,D with speed_mult + record
    MOTOR_SINGLE: 63,    // a=motor index 0..3, pop speed -> update motor state then drive
    STOP: 64,            // stop motors
    TURN_TIMED: 65,      // a=dir (0 left 1 right), pop seconds -> state machine turn
    MOVE_SOFT: 66,       // pop sec, pop target -> ramp to target over sec (20Hz)
    GO_HOME: 67,         // home sequence (simple reverse + stop) state machine

    // recording / replay
    REC_START: 70,        // clear track + enable recording
    REPLAY_ONCE: 71,      // start replay once (non-blocking state machine)
    REPLAY_LOOP: 72,      // pop times -> replay in loop

    // helpers (stateful blocks)
    WAIT_START: 80,       // wait until sensor0 > 60
    STOP_AT_START: 81,    // wait until sensor0 > 60 then STOP
    COUNT_LAPS: 82,       // pop target laps -> wait until counted
    AUTOPILOT_DIST: 83,   // a=sens index, b=dir (0 left 1 right), pop spd, pop thr -> infinite until stop requested

    // PID / smoothing / schmitt / edge
    PID: 90,              // a=pid slot, pop kd, ki, kp, err -> push out
    SMOOTH: 91,           // a=smooth slot, b=size, pop val -> push smooth
    SCHMITT: 92,          // a=schmitt slot, pop val, low, high -> push bool state
    EDGE_RISE: 93,        // a=edge slot, pop val(bool) -> push bool (rising edge)
  };

  // ============================================================
  // Compiler
  // ============================================================
  class Compiler {
    constructor(ws){
      this.ws = ws;
      this.ins = [];
      this.varSlot = new Map();     // varName -> slot
      this.tempBase = 0;
      this.loopStack = [];          // {breakJmps:[], contTarget:number}
      this.breakPatchStack = [];    // stack of arrays of jump indices to patch later
      this.pidSlots = new Map();    // block.id -> slot
      this.smoothSlots = new Map();
      this.schmittSlots = new Map();
      this.edgeSlots = new Map();
      this.slotCounts = { pid:0, smooth:0, schmitt:0, edge:0 };

      // supported blocks set (rough)
      this.supported = new Set([
        'start_hat',
        'robot_move','robot_move_soft','robot_turn_timed','robot_set_speed','robot_stop',
        'move_4_motors','motor_single','go_home','record_start','replay_track','replay_loop',
        'wait_start','stop_at_start','count_laps','autopilot_distance',
        'wait_seconds','sensor_get','wait_until_sensor','math_number_limited',
        'logic_edge_detect','logic_schmitt','math_smooth','math_pid','timer_get','timer_reset',
        // builtins
        'controls_if','controls_repeat_ext','controls_repeat','controls_whileUntil','controls_for',
        'controls_flow_statements',
        'variables_get','variables_set','math_change',
        'math_number','math_arithmetic','math_single',
        'logic_boolean','logic_compare','logic_operation','logic_negate'
      ]);
    }

    // Emit instruction, returns index
    emit(op, a=0, b=0, f=0){
      const idx = this.ins.length;
      this.ins.push({op, a, b, f});
      return idx;
    }
    patchB(at, target){
      this.ins[at].b = target;
    }

    // Variable slots: allocate stable slots for Blockly variables; temp slots for loops
    initVarSlots(){
      const vars = (this.ws.getAllVariables ? this.ws.getAllVariables() : []);
      let i = 0;
      for (const v of vars){
        const name = v.name || v.getId?.() || ('v'+i);
        if (!this.varSlot.has(name)){
          this.varSlot.set(name, i++);
        }
      }
      // reserve a few internal temps
      this.tempBase = i;
    }
    allocTemp(){
      return this.tempBase++;
    }

    pidSlotFor(block){
      const key = block.id || ('pid_'+Math.random());
      if (this.pidSlots.has(key)) return this.pidSlots.get(key);
      const s = this.slotCounts.pid++;
      this.pidSlots.set(key, s);
      return s;
    }
    smoothSlotFor(block){
      const key = block.id || ('sm_'+Math.random());
      if (this.smoothSlots.has(key)) return this.smoothSlots.get(key);
      const s = this.slotCounts.smooth++;
      this.smoothSlots.set(key, s);
      return s;
    }
    schmittSlotFor(block){
      const key = block.id || ('sc_'+Math.random());
      if (this.schmittSlots.has(key)) return this.schmittSlots.get(key);
      const s = this.slotCounts.schmitt++;
      this.schmittSlots.set(key, s);
      return s;
    }
    edgeSlotFor(block){
      const key = block.id || ('ed_'+Math.random());
      if (this.edgeSlots.has(key)) return this.edgeSlots.get(key);
      const s = this.slotCounts.edge++;
      this.edgeSlots.set(key, s);
      return s;
    }

    // Main compile
    compile(){
      this.initVarSlots();

      const tops = this.ws.getTopBlocks(true);
      if (!tops || !tops.length) fail('Немає блоків у полі Builder.');
      let start = tops.find(b => b.type === 'start_hat') || tops[0];
      let firstStmt = (start && start.type === 'start_hat') ? start.getNextBlock() : start;

      if (!firstStmt){
        // Allow empty program
        this.emit(OP.NOP);
        return;
      }
      this.compileStmtList(firstStmt);

      // program end: STOP motors for safety
      this.emit(OP.STOP);
    }

    compileStmtList(block){
      let cur = block;
      while(cur){
        this.compileStmt(cur);
        cur = cur.getNextBlock();
      }
    }

    compileStmt(block){
      if (!block) return;

      switch(block.type){
        // --- car ---
        case 'robot_set_speed': return this.stmtRobotSetSpeed(block);
        case 'robot_move': return this.stmtRobotMove(block);
        case 'robot_move_soft': return this.stmtRobotMoveSoft(block);
        case 'robot_turn_timed': return this.stmtRobotTurnTimed(block);
        case 'robot_stop': return this.emit(OP.STOP);
        case 'move_4_motors': return this.stmtMove4(block);
        case 'motor_single': return this.stmtMotorSingle(block);
        case 'go_home': return this.emit(OP.GO_HOME);
        case 'record_start': return this.emit(OP.REC_START);
        case 'replay_track': return this.emit(OP.REPLAY_ONCE);
        case 'replay_loop': return this.stmtReplayLoop(block);
        case 'wait_start': return this.emit(OP.WAIT_START);
        case 'stop_at_start': return this.emit(OP.STOP_AT_START);
        case 'count_laps': return this.stmtCountLaps(block);
        case 'autopilot_distance': return this.stmtAutopilot(block);

        // --- sensors / time ---
        case 'wait_seconds': return this.stmtWaitSeconds(block);
        case 'wait_until_sensor': return this.stmtWaitUntilSensor(block);
        case 'timer_reset': return this.emit(OP.TIMER_RESET);

        // --- builtins ---
        case 'controls_if': return this.stmtIf(block);
        case 'controls_repeat_ext':
        case 'controls_repeat': return this.stmtRepeat(block);
        case 'controls_whileUntil': return this.stmtWhileUntil(block);
        case 'controls_for': return this.stmtFor(block);
        case 'controls_flow_statements': return this.stmtFlow(block);

        case 'variables_set': return this.stmtVarSet(block);
        case 'math_change': return this.stmtMathChange(block);

        case 'start_hat': return; // no-op
        default:
          // Unknown statement: ignore but keep safety
          return;
      }
    }

    // ===========================
    // Statement implementations
    // ===========================
    stmtRobotSetSpeed(block){
      this.compileValue(block.getInputTargetBlock('SPEED'));
      this.emit(OP.SET_SPEED);
    }

    stmtRobotMove(block){
      this.compileValue(block.getInputTargetBlock('L'));
      this.compileValue(block.getInputTargetBlock('R'));
      // stack: L, R
      this.emit(OP.MOVE_LR);
    }

    stmtRobotMoveSoft(block){
      this.compileValue(block.getInputTargetBlock('TARGET'));
      this.compileValue(block.getInputTargetBlock('SEC'));
      // stack: target, sec
      this.emit(OP.MOVE_SOFT);
    }

    stmtRobotTurnTimed(block){
      const dir = block.getFieldValue('DIR') === 'RIGHT' ? 1 : 0;
      this.compileValue(block.getInputTargetBlock('SEC'));
      this.emit(OP.TURN_TIMED, dir);
    }

    stmtMove4(block){
      this.compileValue(block.getInputTargetBlock('M1'));
      this.compileValue(block.getInputTargetBlock('M2'));
      this.compileValue(block.getInputTargetBlock('M3'));
      this.compileValue(block.getInputTargetBlock('M4'));
      this.emit(OP.MOVE4);
    }

    stmtMotorSingle(block){
      const m = parseInt(block.getFieldValue('MOTOR') || '1', 10);
      const idx = Math.max(1, Math.min(4, m)) - 1;
      this.compileValue(block.getInputTargetBlock('SPEED'));
      this.emit(OP.MOTOR_SINGLE, idx);
    }

    stmtReplayLoop(block){
      this.compileValue(block.getInputTargetBlock('TIMES'));
      this.emit(OP.REPLAY_LOOP);
    }

    stmtWaitSeconds(block){
      this.compileValue(block.getInputTargetBlock('SECONDS'));
      this.emit(OP.WAIT_S);
    }

    stmtWaitUntilSensor(block){
      const s = parseInt(block.getFieldValue('SENS') || '0', 10);
      const idx = Math.max(0, Math.min(3, s));
      const op = (block.getFieldValue('OP') === 'GT') ? 1 : 0;
      this.compileValue(block.getInputTargetBlock('VAL'));
      this.emit(OP.WAIT_SENS, idx, op);
    }

    stmtCountLaps(block){
      this.compileValue(block.getInputTargetBlock('LAPS'));
      this.emit(OP.COUNT_LAPS);
    }

    stmtAutopilot(block){
      const port = parseInt(block.getFieldValue('PORT') || '1', 10);
      const idx = Math.max(1, Math.min(4, port)) - 1;
      const dir = block.getFieldValue('DIR') === 'RIGHT' ? 1 : 0;
      this.compileValue(block.getInputTargetBlock('THR'));
      this.compileValue(block.getInputTargetBlock('SPD'));
      // stack: thr, spd
      this.emit(OP.AUTOPILOT_DIST, idx, dir);
    }

    stmtVarSet(block){
      const v = block.getFieldValue('VAR');
      const name = (v && v.name) ? v.name : (typeof v === 'string' ? v : String(v||'var'));
      const slot = this.getVarSlot(name);
      this.compileValue(block.getInputTargetBlock('VALUE'));
      this.emit(OP.STORE, slot);
    }

    stmtMathChange(block){
      const v = block.getFieldValue('VAR');
      const name = (v && v.name) ? v.name : (typeof v === 'string' ? v : String(v||'var'));
      const slot = this.getVarSlot(name);
      this.emit(OP.LOAD, slot);
      this.compileValue(block.getInputTargetBlock('DELTA'));
      this.emit(OP.ADD);
      this.emit(OP.STORE, slot);
    }

    getVarSlot(name){
      if (!this.varSlot.has(name)){
        const s = this.tempBase++;
        this.varSlot.set(name, s);
      }
      return this.varSlot.get(name);
    }

    // ---------- controls_if ----------
    stmtIf(block){
      // Blockly stores inputs: IF0 DO0 IF1 DO1 ... ELSE
      const elseifCount = block.elseifCount_ || 0;
      const hasElse = !!block.elseCount_;
      const endJmps = [];
      let nextCondLabel = null;

      for (let i=0; i<=elseifCount; i++){
        const cond = block.getInputTargetBlock('IF'+i);
        const doBlk = block.getInputTargetBlock('DO'+i);

        if (nextCondLabel !== null){
          // patch previous JZ to current position
          this.patchB(nextCondLabel, this.ins.length);
          nextCondLabel = null;
        }

        this.compileValue(cond);
        // if false -> jump to next condition / else
        nextCondLabel = this.emit(OP.JZ, 0, -1, 0);

        if (doBlk) this.compileStmtList(doBlk);

        endJmps.push(this.emit(OP.JMP, 0, -1, 0));
      }

      // ELSE
      if (nextCondLabel !== null){
        this.patchB(nextCondLabel, this.ins.length);
      }
      if (hasElse){
        const elseBlk = block.getInputTargetBlock('ELSE');
        if (elseBlk) this.compileStmtList(elseBlk);
      }

      const endPos = this.ins.length;
      for (const j of endJmps) this.patchB(j, endPos);
    }

    // ---------- repeat ----------
    stmtRepeat(block){
      // controls_repeat_ext has TIMES input; controls_repeat has TIMES field (Number)
      let timesInput = block.getInputTargetBlock('TIMES');
      if (!timesInput && block.type === 'controls_repeat'){
        // numeric field
        const num = parseFloat(block.getFieldValue('TIMES') || '0');
        timesInput = null;
        this.emit(OP.PUSHF, 0, 0, (isFinite(num)?num:0));
      }else{
        this.compileValue(timesInput);
      }

      const limitSlot = this.allocTemp();
      const counterSlot = this.allocTemp();
      // store limit
      this.emit(OP.STORE, limitSlot);
      // counter = 0
      this.emit(OP.PUSHF,0,0,0);
      this.emit(OP.STORE, counterSlot);

      const loopStart = this.ins.length;

      // if counter < limit else end
      this.emit(OP.LOAD, counterSlot);
      this.emit(OP.LOAD, limitSlot);
      this.emit(OP.LT);
      const jzEnd = this.emit(OP.JZ,0,-1,0);

      // push loop context
      const breakJmps = [];
      this.loopStack.push({breakJmps, contTarget: loopStart});

      const body = block.getInputTargetBlock('DO');
      if (body) this.compileStmtList(body);

      // counter++
      this.emit(OP.LOAD, counterSlot);
      this.emit(OP.PUSHF,0,0,1);
      this.emit(OP.ADD);
      this.emit(OP.STORE, counterSlot);

      this.emit(OP.JMP,0,loopStart,0);

      const loopEnd = this.ins.length;
      this.patchB(jzEnd, loopEnd);

      // patch breaks
      const ctx = this.loopStack.pop();
      for (const bi of ctx.breakJmps) this.patchB(bi, loopEnd);
    }

    // ---------- while/until ----------
    stmtWhileUntil(block){
      const mode = (block.getFieldValue('MODE') || 'WHILE'); // WHILE or UNTIL
      const condBlk = block.getInputTargetBlock('BOOL');
      const bodyBlk = block.getInputTargetBlock('DO');

      const loopStart = this.ins.length;

      this.compileValue(condBlk);
      if (mode === 'UNTIL'){
        this.emit(OP.NOT);
      }
      const jzEnd = this.emit(OP.JZ,0,-1,0);

      const breakJmps = [];
      this.loopStack.push({breakJmps, contTarget: loopStart});

      if (bodyBlk) this.compileStmtList(bodyBlk);

      this.emit(OP.JMP,0,loopStart,0);

      const loopEnd = this.ins.length;
      this.patchB(jzEnd, loopEnd);

      const ctx = this.loopStack.pop();
      for (const bi of ctx.breakJmps) this.patchB(bi, loopEnd);
    }

    // ---------- for ----------
    stmtFor(block){
      // Field VAR, inputs FROM, TO, BY, DO
      const v = block.getFieldValue('VAR');
      const name = (v && v.name) ? v.name : (typeof v === 'string' ? v : String(v||'i'));
      const varSlot = this.getVarSlot(name);

      const fromBlk = block.getInputTargetBlock('FROM');
      const toBlk = block.getInputTargetBlock('TO');
      const byBlk = block.getInputTargetBlock('BY');
      const bodyBlk = block.getInputTargetBlock('DO');

      const endSlot = this.allocTemp();
      const stepSlot = this.allocTemp();

      // init var = FROM
      this.compileValue(fromBlk);
      this.emit(OP.STORE, varSlot);

      // store end and step
      this.compileValue(toBlk);
      this.emit(OP.STORE, endSlot);
      this.compileValue(byBlk);
      this.emit(OP.STORE, stepSlot);

      const loopStart = this.ins.length;

      // condition: (step>=0 && var<=end) || (step<0 && var>=end)
      // step>=0
      this.emit(OP.LOAD, stepSlot);
      this.emit(OP.PUSHF,0,0,0);
      this.emit(OP.GE);
      // var<=end
      this.emit(OP.LOAD, varSlot);
      this.emit(OP.LOAD, endSlot);
      this.emit(OP.LE);
      this.emit(OP.AND);
      // step<0
      this.emit(OP.LOAD, stepSlot);
      this.emit(OP.PUSHF,0,0,0);
      this.emit(OP.LT);
      // var>=end
      this.emit(OP.LOAD, varSlot);
      this.emit(OP.LOAD, endSlot);
      this.emit(OP.GE);
      this.emit(OP.AND);
      // OR
      this.emit(OP.OR);

      const jzEnd = this.emit(OP.JZ,0,-1,0);

      const breakJmps = [];
      this.loopStack.push({breakJmps, contTarget: loopStart});

      if (bodyBlk) this.compileStmtList(bodyBlk);

      // var += step
      this.emit(OP.LOAD, varSlot);
      this.emit(OP.LOAD, stepSlot);
      this.emit(OP.ADD);
      this.emit(OP.STORE, varSlot);

      this.emit(OP.JMP,0,loopStart,0);

      const loopEnd = this.ins.length;
      this.patchB(jzEnd, loopEnd);

      const ctx = this.loopStack.pop();
      for (const bi of ctx.breakJmps) this.patchB(bi, loopEnd);
    }

    // ---------- break/continue ----------
    stmtFlow(block){
      const flow = block.getFieldValue('FLOW'); // BREAK / CONTINUE
      if (!this.loopStack.length){
        // ignore stray break/continue
        return;
      }
      const ctx = this.loopStack[this.loopStack.length-1];
      if (flow === 'CONTINUE'){
        this.emit(OP.JMP,0,ctx.contTarget,0);
      }else{ // BREAK
        const j = this.emit(OP.JMP,0,-1,0);
        ctx.breakJmps.push(j);
      }
    }

    // ===========================
    // Expression compilation
    // push result to stack
    // ===========================
    compileValue(block){
      if (!block){
        this.emit(OP.PUSHF,0,0,0);
        return;
      }

      switch(block.type){
        case 'math_number':
          return this.emit(OP.PUSHF,0,0, parseFloat(block.getFieldValue('NUM')||'0') || 0);

        case 'math_number_limited':
          return this.emit(OP.PUSHF,0,0, parseFloat(block.getFieldValue('NUM')||'0') || 0);

        case 'logic_boolean':
          return this.emit(OP.PUSHF,0,0, (block.getFieldValue('BOOL') === 'TRUE') ? 1 : 0);

        case 'variables_get': {
          const v = block.getFieldValue('VAR');
          const name = (v && v.name) ? v.name : (typeof v === 'string' ? v : String(v||'var'));
          const slot = this.getVarSlot(name);
          return this.emit(OP.LOAD, slot);
        }

        case 'sensor_get': {
          const s = parseInt(block.getFieldValue('SENS') || '0', 10);
          const idx = Math.max(0, Math.min(3, s));
          return this.emit(OP.SENS, idx);
        }

        case 'timer_get':
          return this.emit(OP.TIMER_GET_S);

        case 'math_arithmetic': {
          const op = block.getFieldValue('OP');
          const A = block.getInputTargetBlock('A');
          const B = block.getInputTargetBlock('B');
          this.compileValue(A);
          this.compileValue(B);
          if (op === 'ADD') return this.emit(OP.ADD);
          if (op === 'MINUS') return this.emit(OP.SUB);
          if (op === 'MULTIPLY') return this.emit(OP.MUL);
          if (op === 'DIVIDE') return this.emit(OP.DIV);
          if (op === 'POWER'){
            // simple power: use exp(log) not available; approximate for integers
            // We'll generate a small loop: pow(a,b) for integer b>=0 else 0
            // compile: store b in temp, store a in temp, result=1; loop; result*=a; b--; end; push result
            const aSlot = this.allocTemp();
            const bSlot = this.allocTemp();
            const rSlot = this.allocTemp();
            this.emit(OP.STORE, bSlot); // store B
            this.emit(OP.STORE, aSlot); // store A
            this.emit(OP.PUSHF,0,0,1);
            this.emit(OP.STORE, rSlot);
            const loopStart = this.ins.length;
            this.emit(OP.LOAD, bSlot);
            this.emit(OP.PUSHF,0,0,0);
            this.emit(OP.GT);
            const jzEnd = this.emit(OP.JZ,0,-1,0);
            this.emit(OP.LOAD, rSlot);
            this.emit(OP.LOAD, aSlot);
            this.emit(OP.MUL);
            this.emit(OP.STORE, rSlot);
            this.emit(OP.LOAD, bSlot);
            this.emit(OP.PUSHF,0,0,1);
            this.emit(OP.SUB);
            this.emit(OP.STORE, bSlot);
            this.emit(OP.JMP,0,loopStart,0);
            const end = this.ins.length;
            this.patchB(jzEnd, end);
            this.emit(OP.LOAD, rSlot);
            return;
          }
          return this.emit(OP.ADD);
        }

        case 'math_single': {
          const op = block.getFieldValue('OP');
          const num = block.getInputTargetBlock('NUM');
          this.compileValue(num);
          if (op === 'NEG') return this.emit(OP.NEG);
          if (op === 'ABS') return this.emit(OP.ABS);
          // others not supported: just pass through
          return;
        }

        case 'logic_compare': {
          const op = block.getFieldValue('OP');
          const A = block.getInputTargetBlock('A');
          const B = block.getInputTargetBlock('B');
          this.compileValue(A);
          this.compileValue(B);
          if (op === 'LT') return this.emit(OP.LT);
          if (op === 'GT') return this.emit(OP.GT);
          if (op === 'LTE') return this.emit(OP.LE);
          if (op === 'GTE') return this.emit(OP.GE);
          if (op === 'EQ') return this.emit(OP.EQ);
          if (op === 'NEQ') return this.emit(OP.NE);
          return this.emit(OP.EQ);
        }

        case 'logic_operation': {
          const op = block.getFieldValue('OP'); // AND / OR
          const A = block.getInputTargetBlock('A');
          const B = block.getInputTargetBlock('B');
          this.compileValue(A);
          this.compileValue(B);
          return this.emit(op === 'OR' ? OP.OR : OP.AND);
        }

        case 'logic_negate': {
          const b = block.getInputTargetBlock('BOOL');
          this.compileValue(b);
          return this.emit(OP.NOT);
        }

        case 'math_pid': {
          const slot = this.pidSlotFor(block);
          this.compileValue(block.getInputTargetBlock('ERROR'));
          this.compileValue(block.getInputTargetBlock('KP'));
          this.compileValue(block.getInputTargetBlock('KI'));
          this.compileValue(block.getInputTargetBlock('KD'));
          return this.emit(OP.PID, slot);
        }

        case 'math_smooth': {
          const slot = this.smoothSlotFor(block);
          const size = parseInt(block.getFieldValue('SIZE') || '5', 10);
          this.compileValue(block.getInputTargetBlock('VAL'));
          return this.emit(OP.SMOOTH, slot, Math.max(2, Math.min(50, size)));
        }

        case 'logic_schmitt': {
          const slot = this.schmittSlotFor(block);
          this.compileValue(block.getInputTargetBlock('HIGH'));
          this.compileValue(block.getInputTargetBlock('LOW'));
          this.compileValue(block.getInputTargetBlock('VAL'));
          // order on stack: high, low, val
          return this.emit(OP.SCHMITT, slot);
        }

        case 'logic_edge_detect': {
          const slot = this.edgeSlotFor(block);
          this.compileValue(block.getInputTargetBlock('VAL'));
          return this.emit(OP.EDGE_RISE, slot);
        }

        default:
          // unknown value -> 0
          this.emit(OP.PUSHF,0,0,0);
          return;
      }
    }
  }

  // ============================================================
  // C templates (runtime + platform)
  // ============================================================

  function emitCEnum(){
    const lines = [];
    lines.push('typedef enum {');
    for (const [k,v] of Object.entries(OP)){
      lines.push(`  RC_OP_${k} = ${v},`);
    }
    lines.push('} rc_op_t;');
    return lines.join('\n');
  }

  function emitCProgramArray(ins){
    const lines = [];
    lines.push('static const rc_insn_t rc_prog[] = {');
    for (const it of ins){
      const opName = Object.keys(OP).find(k => OP[k] === it.op) || ('NOP');
      lines.push(`  { RC_OP_${opName}, ${it.a|0}, ${it.b|0}, ${cFloat(it.f)} },`);
    }
    lines.push('};');
    lines.push('static const uint16_t rc_prog_len = (uint16_t)(sizeof(rc_prog)/sizeof(rc_prog[0]));');
    return lines.join('\n');
  }

  // Create a safe include guard
  function guard(name){
    return 'RC_' + cIdent(name).toUpperCase() + '_H';
  }

  function genHeader(name, meta){
    const g = guard('rc_cb_'+name);
    const cb = cIdent('rc_cb_'+name);
    const pidN = meta.pidN|0;
    const smN = meta.smoothN|0;
    const scN = meta.schmittN|0;
    const edN = meta.edgeN|0;
    const varN = meta.varN|0;

    return `#ifndef ${g}
#define ${g}

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stdbool.h>
#include "rc_platform.h"

/* ===== Generated by RoboScratch Block→C (STM32F103) =====
   Program: ${cb}
   VM model: cooperative bytecode
   Notes:
   - Call ${cb}_init(&vm) once.
   - Call ${cb}_step(&vm) from main while(1) repeatedly.
*/

typedef struct {
  uint16_t op;
  int16_t  a;
  int16_t  b;
  float    f;
} rc_insn_t;

typedef struct {
  // VM state
  uint16_t pc;
  uint8_t  halted;
  uint8_t  _pad0[1];

  // stack
  float stack[64];
  int16_t sp;

  // variables
  float vars[${Math.max(1,varN)}];

  // time
  uint32_t timer_start_ms;
  uint32_t wait_until_ms;

  // speed multiplier (0..1)
  float speed_mult;

  // motor state (A,B,C,D) -100..100
  float motor_state[4];

  // stop request flag (optional)
  uint8_t stop_requested;

  // --- Stateful ops ---
  // TURN_TIMED
  uint8_t turn_active;
  uint8_t turn_dir;
  uint32_t turn_end_ms;

  // MOVE_SOFT
  uint8_t soft_active;
  uint32_t soft_next_ms;
  uint16_t soft_steps;
  uint16_t soft_i;
  float soft_target;

  // GO_HOME
  uint8_t home_active;
  uint32_t home_end_ms;

  // Recording / replay
  uint8_t rec_enabled;
  uint8_t replay_active;
  uint16_t replay_i;
  uint16_t replay_loops_left;
  uint32_t replay_next_ms;

  // COUNT_LAPS
  uint8_t laps_active;
  uint16_t laps_target;
  uint16_t laps_count;
  uint8_t  laps_online;
  uint32_t laps_next_ms;

  // AUTOPILOT
  uint8_t ap_active;
  uint8_t ap_sens;
  uint8_t ap_dir;
  uint32_t ap_next_ms;
  float ap_thr;
  float ap_spd;

  // PID states
  struct { float integ; float prev; } pid[${Math.max(1,pidN)}];

  // Smooth states (variable window stored in ring buffer)
  struct { float buf[50]; uint8_t size; uint8_t idx; float sum; uint8_t init; } smooth[${Math.max(1,smN)}];

  // Schmitt states
  uint8_t schmitt_state[${Math.max(1,scN)}];

  // Edge states
  uint8_t edge_prev[${Math.max(1,edN)}];

} rc_vm_t;

void ${cb}_init(rc_vm_t* vm);
void ${cb}_step(rc_vm_t* vm);

/* Optional: request stop (used by autopilot / long loops) */
static inline void rc_vm_request_stop(rc_vm_t* vm){ if(vm) vm->stop_requested = 1; }

#ifdef __cplusplus
}
#endif
#endif
`;
  }

  function genProgramC(name, ins, meta){
    const cb = cIdent('rc_cb_'+name);
    const pidN = meta.pidN|0;
    const smN = meta.smoothN|0;
    const scN = meta.schmittN|0;
    const edN = meta.edgeN|0;
    const varN = meta.varN|0;

    return `#include "${cb}.h"
#include <string.h>

/* ===== VM runtime (cooperative, non-blocking) ===== */

${emitCEnum()}

static inline float rc_fclamp(float x, float lo, float hi){
  return (x < lo) ? lo : (x > hi ? hi : x);
}
static inline uint8_t rc_bool(float x){ return (x > 0.5f) ? 1u : 0u; }

static inline void rc_push(rc_vm_t* vm, float v){
  if (!vm) return;
  if (vm->sp < 63){ vm->stack[++vm->sp] = v; }
}
static inline float rc_pop(rc_vm_t* vm){
  if (!vm) return 0;
  if (vm->sp >= 0){ return vm->stack[vm->sp--]; }
  return 0;
}
static inline float rc_peek(rc_vm_t* vm){
  if (!vm) return 0;
  if (vm->sp >= 0) return vm->stack[vm->sp];
  return 0;
}

typedef struct {
  int16_t m1, m2, m3, m4;
  uint16_t dt_ms;
} rc_track_step_t;

/* Track buffer (RAM). Adjust RC_TRACK_MAX for your MCU RAM. */
#ifndef RC_TRACK_MAX
#define RC_TRACK_MAX 256
#endif

static rc_track_step_t rc_track[RC_TRACK_MAX];
static uint16_t rc_track_len = 0;
static uint32_t rc_track_last_ms = 0;

static void rc_track_reset(void){
  rc_track_len = 0;
  rc_track_last_ms = rc_millis();
}

static void rc_track_record(float a, float b, float c, float d){
  if (rc_track_len >= RC_TRACK_MAX) return;
  uint32_t now = rc_millis();
  uint32_t dt = (now - rc_track_last_ms);
  if (dt > 65000) dt = 65000;
  rc_track_last_ms = now;
  rc_track[rc_track_len].m1 = (int16_t)rc_fclamp(a, -100, 100);
  rc_track[rc_track_len].m2 = (int16_t)rc_fclamp(b, -100, 100);
  rc_track[rc_track_len].m3 = (int16_t)rc_fclamp(c, -100, 100);
  rc_track[rc_track_len].m4 = (int16_t)rc_fclamp(d, -100, 100);
  rc_track[rc_track_len].dt_ms = (uint16_t)dt;
  rc_track_len++;
}

/* Soft ramp step (20Hz) */
static void rc_soft_begin(rc_vm_t* vm, float target, float sec){
  if(!vm) return;
  if (sec < 0) sec = 0;
  vm->soft_active = 1;
  vm->soft_steps = (uint16_t)rc_fclamp(sec * 20.0f, 1.0f, 60000.0f);
  vm->soft_i = 0;
  vm->soft_target = target;
  vm->soft_next_ms = rc_millis();
}

/* Turn timed begin */
static void rc_turn_begin(rc_vm_t* vm, uint8_t dir, float sec){
  if(!vm) return;
  if (sec < 0) sec = 0;
  vm->turn_active = 1;
  vm->turn_dir = dir;
  vm->turn_end_ms = rc_millis() + (uint32_t)(sec * 1000.0f);
  // immediately issue turn command
  const float sp = 80.0f;
  const float l = (dir==0) ? -sp : sp;
  const float r = (dir==0) ? sp : -sp;
  rc_drive4(l*vm->speed_mult, r*vm->speed_mult, l*vm->speed_mult, r*vm->speed_mult);
  if (vm->rec_enabled) rc_track_record(l, r, l, r);
}

/* Go home begin: simple reverse then stop */
static void rc_home_begin(rc_vm_t* vm){
  if(!vm) return;
  vm->home_active = 1;
  vm->home_end_ms = rc_millis() + 300;
  rc_drive4(-60.0f*vm->speed_mult, -60.0f*vm->speed_mult, 0, 0);
  if (vm->rec_enabled) rc_track_record(-60, -60, 0, 0);
}

/* Replay begin */
static void rc_replay_begin(rc_vm_t* vm, uint16_t loops){
  if(!vm) return;
  vm->replay_active = 1;
  vm->replay_i = 0;
  vm->replay_loops_left = loops;
  vm->replay_next_ms = rc_millis();
}

/* Count laps begin (sensor0 > 60 considered "line") */
static void rc_laps_begin(rc_vm_t* vm, uint16_t target){
  if(!vm) return;
  vm->laps_active = 1;
  vm->laps_target = target;
  vm->laps_count = 0;
  vm->laps_online = 0;
  vm->laps_next_ms = rc_millis();
}

/* Autopilot begin */
static void rc_ap_begin(rc_vm_t* vm, uint8_t sens, uint8_t dir, float thr, float spd){
  if(!vm) return;
  vm->ap_active = 1;
  vm->ap_sens = sens;
  vm->ap_dir = dir;
  vm->ap_thr = thr;
  vm->ap_spd = spd;
  vm->ap_next_ms = rc_millis();
}

/* ===== Program bytecode ===== */
${emitCProgramArray(ins)}

/* ===== VM init / step ===== */
void ${cb}_init(rc_vm_t* vm){
  if(!vm) return;
  memset(vm, 0, sizeof(*vm));
  vm->sp = -1;
  vm->pc = 0;
  vm->timer_start_ms = rc_millis();
  vm->speed_mult = 1.0f;
  vm->motor_state[0]=vm->motor_state[1]=vm->motor_state[2]=vm->motor_state[3]=0;
  rc_drive4(0,0,0,0);
}

static void rc_vm_yield(rc_vm_t* vm){
  (void)vm;
}

static uint8_t rc_vm_waiting(rc_vm_t* vm){
  if(!vm) return 0;
  if (vm->wait_until_ms == 0) return 0;
  uint32_t now = rc_millis();
  if ((int32_t)(now - vm->wait_until_ms) >= 0){
    vm->wait_until_ms = 0;
    return 0;
  }
  return 1;
}

/* Execute auxiliary state machines (turn/soft/home/replay/laps/autopilot).
   If any is active, they may yield and prevent program from advancing. */
static uint8_t rc_vm_tick_aux(rc_vm_t* vm){
  if(!vm) return 0;
  const uint32_t now = rc_millis();

  // Stop requested: safety
  if (vm->stop_requested){
    rc_drive4(0,0,0,0);
    vm->halted = 1;
    vm->turn_active = vm->soft_active = vm->home_active = 0;
    vm->replay_active = vm->laps_active = vm->ap_active = 0;
    return 1;
  }

  // TURN_TIMED active
  if (vm->turn_active){
    if ((int32_t)(now - vm->turn_end_ms) >= 0){
      vm->turn_active = 0;
      rc_drive4(0,0,0,0);
      if (vm->rec_enabled) rc_track_record(0,0,0,0);
    }else{
      // keep turning; no-op
    }
    return 1;
  }

  // MOVE_SOFT active
  if (vm->soft_active){
    if ((int32_t)(now - vm->soft_next_ms) < 0){
      return 1;
    }
    vm->soft_next_ms = now + 50;
    vm->soft_i++;
    if (vm->soft_i > vm->soft_steps){
      vm->soft_active = 0;
      return 1;
    }
    float current = (vm->soft_target / (float)vm->soft_steps) * (float)vm->soft_i;
    float applied = current * vm->speed_mult;
    rc_drive4(applied, applied, applied, applied);
    if (vm->rec_enabled) rc_track_record(applied, applied, applied, applied);
    return 1;
  }

  // GO_HOME active
  if (vm->home_active){
    if ((int32_t)(now - vm->home_end_ms) >= 0){
      vm->home_active = 0;
      rc_drive4(0,0,0,0);
      if (vm->rec_enabled) rc_track_record(0,0,0,0);
    }
    return 1;
  }

  // Replay active
  if (vm->replay_active){
    if (rc_track_len == 0){
      vm->replay_active = 0;
      return 1;
    }
    if ((int32_t)(now - vm->replay_next_ms) < 0){
      return 1;
    }
    if (vm->replay_i >= rc_track_len){
      // finished one loop
      if (vm->replay_loops_left > 0) vm->replay_loops_left--;
      if (vm->replay_loops_left == 0){
        vm->replay_active = 0;
        rc_drive4(0,0,0,0);
        return 1;
      }
      vm->replay_i = 0;
      vm->replay_next_ms = now + 500; // pause between loops
      return 1;
    }
    rc_track_step_t st = rc_track[vm->replay_i];
    rc_drive4((float)st.m1 * vm->speed_mult, (float)st.m2 * vm->speed_mult, (float)st.m3 * vm->speed_mult, (float)st.m4 * vm->speed_mult);
    vm->replay_next_ms = now + st.dt_ms;
    vm->replay_i++;
    return 1;
  }

  // Laps active
  if (vm->laps_active){
    if ((int32_t)(now - vm->laps_next_ms) < 0){
      return 1;
    }
    vm->laps_next_ms = now + 50;
    float s = rc_sensor_read(vm, 0); // sensor 1
    uint8_t onLine = (s > 60.0f) ? 1u : 0u;
    if (onLine && !vm->laps_online){
      vm->laps_online = 1;
      vm->laps_count++;
      if (vm->laps_count >= vm->laps_target){
        vm->laps_active = 0;
        return 1;
      }
    }else if (!onLine && vm->laps_online){
      vm->laps_online = 0;
    }
    return 1;
  }

  // Autopilot active
  if (vm->ap_active){
    if ((int32_t)(now - vm->ap_next_ms) < 0){
      return 1;
    }
    vm->ap_next_ms = now + 80;
    float s = rc_sensor_read(vm, vm->ap_sens);
    float thr = vm->ap_thr;
    float spd = vm->ap_spd;
    if (s > 0.0f && s < thr){
      // back a bit
      rc_drive4(-spd*vm->speed_mult, -spd*vm->speed_mult, 0, 0);
      vm->ap_next_ms = now + 250;
      // schedule turn after back: simple state reuse
      vm->turn_active = 1;
      vm->turn_dir = (vm->ap_dir==1) ? 1 : 0;
      vm->turn_end_ms = now + 250 + 320;
      // We'll set motor turn right away on next tick via turn logic
      // (do it now too)
      float l = (vm->ap_dir==0) ? -spd : spd;
      float r = (vm->ap_dir==0) ? spd : -spd;
      rc_drive4(l*vm->speed_mult, r*vm->speed_mult, 0, 0);
      vm->ap_next_ms = now + 250 + 320 + 80;
      return 1;
    }else{
      rc_drive4(spd*vm->speed_mult, spd*vm->speed_mult, 0, 0);
      return 1;
    }
  }

  return 0;
}

void ${cb}_step(rc_vm_t* vm){
  if(!vm || vm->halted) return;

  // if any auxiliary state machine is active, tick it and yield
  if (rc_vm_tick_aux(vm)) return;

  // wait handling
  if (rc_vm_waiting(vm)) return;

  // run a slice of instructions to avoid hanging MCU
  uint16_t steps = 0;
  const uint16_t STEP_BUDGET = 200;

  while(!vm->halted && steps++ < STEP_BUDGET){
    if (vm->pc >= rc_prog_len){
      vm->halted = 1;
      rc_drive4(0,0,0,0);
      return;
    }

    const rc_insn_t I = rc_prog[vm->pc++];

    switch((rc_op_t)I.op){

      case RC_OP_NOP: break;

      case RC_OP_PUSHF: rc_push(vm, I.f); break;
      case RC_OP_LOAD:  rc_push(vm, vm->vars[(uint16_t)I.a]); break;
      case RC_OP_STORE: vm->vars[(uint16_t)I.a] = rc_pop(vm); break;
      case RC_OP_DUP:   rc_push(vm, rc_peek(vm)); break;
      case RC_OP_DROP:  (void)rc_pop(vm); break;

      case RC_OP_ADD: { float b=rc_pop(vm), a=rc_pop(vm); rc_push(vm, a+b); } break;
      case RC_OP_SUB: { float b=rc_pop(vm), a=rc_pop(vm); rc_push(vm, a-b); } break;
      case RC_OP_MUL: { float b=rc_pop(vm), a=rc_pop(vm); rc_push(vm, a*b); } break;
      case RC_OP_DIV: { float b=rc_pop(vm), a=rc_pop(vm); rc_push(vm, (b!=0)?(a/b):0); } break;
      case RC_OP_NEG: { float a=rc_pop(vm); rc_push(vm, -a); } break;
      case RC_OP_ABS: { float a=rc_pop(vm); rc_push(vm, (a<0)?-a:a); } break;
      case RC_OP_MIN: { float b=rc_pop(vm), a=rc_pop(vm); rc_push(vm, (a<b)?a:b); } break;
      case RC_OP_MAX: { float b=rc_pop(vm), a=rc_pop(vm); rc_push(vm, (a>b)?a:b); } break;
      case RC_OP_CLAMP: { float hi=rc_pop(vm), lo=rc_pop(vm), x=rc_pop(vm); rc_push(vm, rc_fclamp(x,lo,hi)); } break;

      case RC_OP_LT: { float b=rc_pop(vm), a=rc_pop(vm); rc_push(vm, (a<b)?1.0f:0.0f);} break;
      case RC_OP_GT: { float b=rc_pop(vm), a=rc_pop(vm); rc_push(vm, (a>b)?1.0f:0.0f);} break;
      case RC_OP_LE: { float b=rc_pop(vm), a=rc_pop(vm); rc_push(vm, (a<=b)?1.0f:0.0f);} break;
      case RC_OP_GE: { float b=rc_pop(vm), a=rc_pop(vm); rc_push(vm, (a>=b)?1.0f:0.0f);} break;
      case RC_OP_EQ: { float b=rc_pop(vm), a=rc_pop(vm); rc_push(vm, (a==b)?1.0f:0.0f);} break;
      case RC_OP_NE: { float b=rc_pop(vm), a=rc_pop(vm); rc_push(vm, (a!=b)?1.0f:0.0f);} break;

      case RC_OP_AND: { uint8_t b=rc_bool(rc_pop(vm)), a=rc_bool(rc_pop(vm)); rc_push(vm, (a&&b)?1.0f:0.0f);} break;
      case RC_OP_OR:  { uint8_t b=rc_bool(rc_pop(vm)), a=rc_bool(rc_pop(vm)); rc_push(vm, (a||b)?1.0f:0.0f);} break;
      case RC_OP_NOT: { uint8_t a=rc_bool(rc_pop(vm)); rc_push(vm, (!a)?1.0f:0.0f);} break;

      case RC_OP_TIMER_GET_S: {
        uint32_t now = rc_millis();
        float s = (float)(now - vm->timer_start_ms) / 1000.0f;
        rc_push(vm, s);
      } break;
      case RC_OP_TIMER_RESET:
        vm->timer_start_ms = rc_millis();
        break;

      case RC_OP_WAIT_MS: {
        float ms = rc_pop(vm);
        if (ms < 0) ms = 0;
        vm->wait_until_ms = rc_millis() + (uint32_t)ms;
        return;
      }
      case RC_OP_WAIT_S: {
        float sec = rc_pop(vm);
        if (sec < 0) sec = 0;
        vm->wait_until_ms = rc_millis() + (uint32_t)(sec * 1000.0f);
        return;
      }

      case RC_OP_SENS: {
        float v = rc_sensor_read(vm, (uint8_t)I.a);
        rc_push(vm, v);
      } break;

      case RC_OP_WAIT_SENS: {
        float val = rc_pop(vm);
        float cur = rc_sensor_read(vm, (uint8_t)I.a);
        uint8_t ok = 0;
        if (I.b == 0){ ok = (cur < val); } else { ok = (cur > val); }
        if (!ok){
          vm->wait_until_ms = rc_millis() + 50;
          // repeat this instruction (rewind pc by 1)
          vm->pc--;
          return;
        }
      } break;

      case RC_OP_SET_SPEED: {
        float pct = rc_pop(vm);
        pct = rc_fclamp(pct, 0, 100);
        vm->speed_mult = pct / 100.0f;
      } break;

      case RC_OP_MOVE_LR: {
        float r = rc_pop(vm);
        float l = rc_pop(vm);
        float a = l * vm->speed_mult;
        float b = r * vm->speed_mult;
        vm->motor_state[0] = l;
        vm->motor_state[1] = r;
        vm->motor_state[2] = l;
        vm->motor_state[3] = r;
        rc_drive4(a, b, a, b);
        if (vm->rec_enabled) rc_track_record(l, r, l, r);
      } break;

      case RC_OP_MOVE4: {
        float d = rc_pop(vm);
        float c = rc_pop(vm);
        float b = rc_pop(vm);
        float a = rc_pop(vm);
        vm->motor_state[0]=a;
        vm->motor_state[1]=b;
        vm->motor_state[2]=c;
        vm->motor_state[3]=d;
        rc_drive4(a*vm->speed_mult, b*vm->speed_mult, c*vm->speed_mult, d*vm->speed_mult);
        if (vm->rec_enabled) rc_track_record(a,b,c,d);
      } break;

      case RC_OP_MOTOR_SINGLE: {
        float s = rc_pop(vm);
        uint8_t idx = (uint8_t)I.a;
        if (idx < 4){
          vm->motor_state[idx] = s;
          rc_drive4(vm->motor_state[0]*vm->speed_mult, vm->motor_state[1]*vm->speed_mult,
                    vm->motor_state[2]*vm->speed_mult, vm->motor_state[3]*vm->speed_mult);
          if (vm->rec_enabled) rc_track_record(vm->motor_state[0],vm->motor_state[1],vm->motor_state[2],vm->motor_state[3]);
        }
      } break;

      case RC_OP_STOP:
        rc_drive4(0,0,0,0);
        if (vm->rec_enabled) rc_track_record(0,0,0,0);
        break;

      case RC_OP_TURN_TIMED: {
        float sec = rc_pop(vm);
        rc_turn_begin(vm, (uint8_t)I.a, sec);
        return;
      }

      case RC_OP_MOVE_SOFT: {
        float sec = rc_pop(vm);
        float target = rc_pop(vm);
        rc_soft_begin(vm, target, sec);
        return;
      }

      case RC_OP_GO_HOME:
        rc_home_begin(vm);
        return;

      case RC_OP_REC_START:
        rc_track_reset();
        vm->rec_enabled = 1;
        break;

      case RC_OP_REPLAY_ONCE:
        vm->rec_enabled = 0;
        rc_replay_begin(vm, 1);
        return;

      case RC_OP_REPLAY_LOOP: {
        float timesf = rc_pop(vm);
        uint16_t times = (uint16_t)rc_fclamp(timesf, 0, 60000);
        vm->rec_enabled = 0;
        if (times == 0) { break; }
        rc_replay_begin(vm, times);
        return;
      }

      case RC_OP_WAIT_START: {
        float s = rc_sensor_read(vm, 0);
        if (s <= 60.0f){
          vm->wait_until_ms = rc_millis() + 50;
          vm->pc--;
          return;
        }
      } break;

      case RC_OP_STOP_AT_START: {
        float s = rc_sensor_read(vm, 0);
        if (s <= 60.0f){
          vm->wait_until_ms = rc_millis() + 20;
          vm->pc--;
          return;
        }
        rc_drive4(0,0,0,0);
      } break;

      case RC_OP_COUNT_LAPS: {
        float lapsf = rc_pop(vm);
        uint16_t laps = (uint16_t)rc_fclamp(lapsf, 0, 60000);
        if (laps == 0) break;
        rc_laps_begin(vm, laps);
        return;
      }

      case RC_OP_AUTOPILOT_DIST: {
        float spd = rc_pop(vm);
        float thr = rc_pop(vm);
        rc_ap_begin(vm, (uint8_t)I.a, (uint8_t)I.b, thr, spd);
        return;
      }

      case RC_OP_PID: {
        float kd = rc_pop(vm);
        float ki = rc_pop(vm);
        float kp = rc_pop(vm);
        float err = rc_pop(vm);
        uint16_t slot = (uint16_t)I.a;
        if (slot >= ${Math.max(1,pidN)}) slot = 0;
        float dt = 0.05f; // assume 20Hz VM calls; adjust if needed
        vm->pid[slot].integ += err * dt;
        float deriv = (err - vm->pid[slot].prev) / dt;
        vm->pid[slot].prev = err;
        float out = kp*err + ki*vm->pid[slot].integ + kd*deriv;
        rc_push(vm, out);
      } break;

      case RC_OP_SMOOTH: {
        float v = rc_pop(vm);
        uint16_t slot = (uint16_t)I.a;
        uint8_t size = (uint8_t)I.b;
        if (slot >= ${Math.max(1,smN)}) slot = 0;
        if (size < 2) size = 2;
        if (size > 50) size = 50;
        vm->smooth[slot].size = size;
        if (!vm->smooth[slot].init){
          vm->smooth[slot].init = 1;
          vm->smooth[slot].idx = 0;
          vm->smooth[slot].sum = 0;
          for (uint8_t i=0;i<size;i++){ vm->smooth[slot].buf[i]=v; vm->smooth[slot].sum += v; }
        }else{
          uint8_t i = vm->smooth[slot].idx % size;
          vm->smooth[slot].sum -= vm->smooth[slot].buf[i];
          vm->smooth[slot].buf[i] = v;
          vm->smooth[slot].sum += v;
          vm->smooth[slot].idx = (uint8_t)((i+1)%size);
        }
        rc_push(vm, vm->smooth[slot].sum / (float)size);
      } break;

      case RC_OP_SCHMITT: {
        float val = rc_pop(vm);
        float low = rc_pop(vm);
        float high = rc_pop(vm);
        uint16_t slot = (uint16_t)I.a;
        if (slot >= ${Math.max(1,scN)}) slot = 0;
        uint8_t st = vm->schmitt_state[slot];
        if (!st && val > high) st = 1;
        else if (st && val < low) st = 0;
        vm->schmitt_state[slot] = st;
        rc_push(vm, st ? 1.0f : 0.0f);
      } break;

      case RC_OP_EDGE_RISE: {
        uint8_t v = rc_bool(rc_pop(vm));
        uint16_t slot = (uint16_t)I.a;
        if (slot >= ${Math.max(1,edN)}) slot = 0;
        uint8_t prev = vm->edge_prev[slot];
        vm->edge_prev[slot] = v;
        rc_push(vm, (v && !prev) ? 1.0f : 0.0f);
      } break;

      case RC_OP_JMP:
        vm->pc = (uint16_t)I.b;
        break;

      case RC_OP_JZ: {
        uint8_t cond = rc_bool(rc_pop(vm));
        if (!cond) vm->pc = (uint16_t)I.b;
      } break;

      default:
        // Unknown op => halt for safety
        vm->halted = 1;
        rc_drive4(0,0,0,0);
        return;
    }

    // tick aux after each instruction (so MOVE_SOFT etc can start)
    if (rc_vm_tick_aux(vm)) return;
    if (rc_vm_waiting(vm)) return;
  }
}
`;
  }

  function genPlatformH(){
    return `#ifndef RC_PLATFORM_H
#define RC_PLATFORM_H

#ifdef __cplusplus
extern "C" {
#endif

#include <stdint.h>
#include <stdbool.h>
#include "main.h"   // STM32CubeMX / CubeIDE project
#include "rc_board_conf.h" // RoboScratch board profile (TIM/ADC mapping)

/* ===== Hardware hooks expected by generated program =====
   The generated VM calls these functions. You can keep the default
   implementation from rc_platform_stm32f103.c, or replace with your own.
*/

/* Milliseconds (HAL_GetTick) */
uint32_t rc_millis(void);

/* Drive motors A,B,C,D with speed in range [-100..100] */
void rc_drive4(float m1, float m2, float m3, float m4);

/* Read sensor [0..3] and return normalized value 0..100 */
float rc_sensor_read(void* vm_unused, uint8_t index);

/* Optional: start PWM etc. Call once after MX_*_Init() */
void rc_platform_init(void);

/* Optional: external stop flag (button, UART command etc.) */
bool rc_platform_stop_requested(void);

#ifdef __cplusplus
}
#endif
#endif
`;
  }

  function genPlatformC(){
    return `#include "rc_platform.h"
#include "rc_board_conf.h"

/* ===== Default STM32F103 HAL implementation =====
   This file is safe by default: if you don't configure handles/pins,
   it compiles and does nothing (motors stop, sensors return 0).
   To make it реально працювало, fill cfg arrays below after CubeMX init.
*/

#ifndef RC_PWM_MAX
#define RC_PWM_MAX 1000u
#endif

typedef struct {
  TIM_HandleTypeDef* htim;
  uint32_t channel;
  GPIO_TypeDef* dir_port;
  uint16_t dir_pin;
  uint8_t dir_invert;
} rc_motor_cfg_t;

typedef struct {
  ADC_HandleTypeDef* hadc;
  uint32_t channel;
  uint16_t min_raw;
  uint16_t ma/* ===== Board profile mapping =====
   These defaults are defined in rc_board_conf.h.
   If you change pins/timers in CubeMX, edit ONLY rc_board_conf.h.
*/

rc_motor_cfg_t g_rc_motor[4] = {
  { RC_M1_TIM, RC_M1_CH, RC_M1_DIR_PORT, RC_M1_DIR_PIN, RC_M1_DIR_INV },
  { RC_M2_TIM, RC_M2_CH, RC_M2_DIR_PORT, RC_M2_DIR_PIN, RC_M2_DIR_INV },
  { RC_M3_TIM, RC_M3_CH, RC_M3_DIR_PORT, RC_M3_DIR_PIN, RC_M3_DIR_INV },
  { RC_M4_TIM, RC_M4_CH, RC_M4_DIR_PORT, RC_M4_DIR_PIN, RC_M4_DIR_INV },
};

rc_sensor_cfg_t g_rc_sensor[4] = {
  { RC_S1_ADC, RC_S1_CH, RC_S1_MIN_RAW, RC_S1_MAX_RAW },
  { RC_S2_ADC, RC_S2_CH, RC_S2_MIN_RAW, RC_S2_MAX_RAW },
  { RC_S3_ADC, RC_S3_CH, RC_S3_MIN_RAW, RC_S3_MAX_RAW },
  { RC_S4_ADC, RC_S4_CH, RC_S4_MIN_RAW, RC_S4_MAX_RAW },
};

5},
  {0, 0, 0, 4095},
};

/* ===== Helpers ===== */
static inline float rc_fclamp(float x, float lo, float hi){
  return (x < lo) ? lo : (x > hi ? hi : x);
}

uint32_t rc_millis(void){
  return HAL_GetTick();
}

/* Set PWM duty (0..RC_PWM_MAX) */
static void rc_pwm_set(TIM_HandleTypeDef* htim, uint32_t channel, uint16_t duty){
  if (!htim) return;
  __HAL_TIM_SET_COMPARE(htim, channel, duty);
}

/* Ensure PWM is started once */
static void rc_pwm_start_once(TIM_HandleTypeDef* htim, uint32_t channel){
  if(!htim) return;
  // Start PWM; ignore errors
  HAL_TIM_PWM_Start(htim, channel);
}

static void rc_motor_apply(uint8_t i, float speed){
  if (i >= 4) return;
  rc_motor_cfg_t* m = &g_rc_motor[i];
  if (!m->htim || !m->channel) return;

  float s = rc_fclamp(speed, -100.0f, 100.0f);
  uint8_t forward = (s >= 0) ? 1u : 0u;
  float absS = (s >= 0) ? s : -s;

  uint16_t duty = (uint16_t)((absS / 100.0f) * (float)RC_PWM_MAX);

  // Direction pin (optional)
  if (m->dir_port && m->dir_pin){
    uint8_t dir = forward ^ (m->dir_invert ? 1u : 0u);
    HAL_GPIO_WritePin(m->dir_port, m->dir_pin, dir ? GPIO_PIN_SET : GPIO_PIN_RESET);
  }

  rc_pwm_start_once(m->htim, m->channel);
  rc_pwm_set(m->htim, m->channel, duty);
}

/* Drive 4 motors */
void rc_drive4(float m1, float m2, float m3, float m4){
  rc_motor_apply(0, m1);
  rc_motor_apply(1, m2);
  rc_motor_apply(2, m3);
  rc_motor_apply(3, m4);
}

/* ADC read helper (blocking) */
static uint16_t rc_adc_read(ADC_HandleTypeDef* hadc, uint32_t channel){
  if (!hadc || !channel) return 0;

  ADC_ChannelConfTypeDef sConfig = {0};
  sConfig.Channel = channel;
  sConfig.Rank = ADC_REGULAR_RANK_1;
  sConfig.SamplingTime = ADC_SAMPLETIME_71CYCLES_5; // stable for F1
  HAL_ADC_ConfigChannel(hadc, &sConfig);

  HAL_ADC_Start(hadc);
  HAL_ADC_PollForConversion(hadc, 10);
  uint16_t val = (uint16_t)HAL_ADC_GetValue(hadc);
  HAL_ADC_Stop(hadc);
  return val;
}

/* Sensor read normalized to 0..100 */
float rc_sensor_read(void* vm_unused, uint8_t index){
  (void)vm_unused;
  if (index >= 4) return 0;
  rc_sensor_cfg_t* s = &g_rc_sensor[index];
  if (!s->hadc || !s->channel) return 0;

  uint16_t raw = rc_adc_read(s->hadc, s->channel);
  uint16_t lo = s->min_raw;
  uint16_t hi = s->max_raw;
  if (hi <= lo) { lo = 0; hi = 4095; }

  if (raw <= lo) return 0;
  if (raw >= hi) return 100;

  float norm = ((float)(raw - lo) / (float)(hi - lo)) * 100.0f;
  return norm;
}

void rc_platform_init(void){
  // Start PWM for all configured motors and set duty=0
  for (uint8_t i=0; i<4; i++){
    rc_motor_cfg_t* m = &g_rc_motor[i];
    if (m->htim && m->channel){
      HAL_TIM_PWM_Start(m->htim, m->channel);
      __HAL_TIM_SET_COMPARE(m->htim, m->channel, 0);
    }
    if (m->dir_port && m->dir_pin){
      // default direction: forward (inversion supported)
      uint8_t dir = (0u ^ (m->dir_invert ? 1u : 0u));
      HAL_GPIO_WritePin(m->dir_port, m->dir_pin, dir ? GPIO_PIN_SET : GPIO_PIN_RESET);
    }
  }
}

/* Optional stop request */
bool rc_platform_stop_requested(void){
  return false;
}
`;
  }

  
  function genBoardConfH(){
    return `#ifndef RC_BOARD_CONF_H
#define RC_BOARD_CONF_H

#ifdef __cplusplus
extern "C" {
#endif

#include "main.h"

/* ===== RoboScratch board profile =====
   Тут задається МАПІНГ "логіки" на залізо.
   Ідея: ти вибираєш таймери/канали/піни в CubeMX так, щоб збігалось з цим файлом.
   Або (2) міняєш тільки цей файл під свій пінмап — інший C не чіпаєш.

   Швидкість моторів у VM: [-100..100]
   PWM duty: 0..RC_PWM_MAX  (RC_PWM_MAX має відповідати Period таймера)
*/

// Declare common handles (CubeMX може створювати їх в main.c або tim.c/adc.c)
extern TIM_HandleTypeDef htim1;
extern TIM_HandleTypeDef htim2;
extern TIM_HandleTypeDef htim3;
extern TIM_HandleTypeDef htim4;

extern ADC_HandleTypeDef hadc1;
extern ADC_HandleTypeDef hadc2;

#ifndef RC_PWM_MAX
#define RC_PWM_MAX 1000u
#endif

/* ===== MOTORS (4 шт) =====
   Default: TIM1 CH1..CH4.
   Якщо DIR не потрібен (типу ESC/servo) — лишай PORT/PIN = 0.
*/

// Motor 1
#ifndef RC_M1_TIM
#define RC_M1_TIM (&htim1)
#endif
#ifndef RC_M1_CH
#define RC_M1_CH  TIM_CHANNEL_1
#endif
#ifndef RC_M1_DIR_PORT
#define RC_M1_DIR_PORT 0
#endif
#ifndef RC_M1_DIR_PIN
#define RC_M1_DIR_PIN  0
#endif
#ifndef RC_M1_DIR_INV
#define RC_M1_DIR_INV  0
#endif

// Motor 2
#ifndef RC_M2_TIM
#define RC_M2_TIM (&htim1)
#endif
#ifndef RC_M2_CH
#define RC_M2_CH  TIM_CHANNEL_2
#endif
#ifndef RC_M2_DIR_PORT
#define RC_M2_DIR_PORT 0
#endif
#ifndef RC_M2_DIR_PIN
#define RC_M2_DIR_PIN  0
#endif
#ifndef RC_M2_DIR_INV
#define RC_M2_DIR_INV  0
#endif

// Motor 3
#ifndef RC_M3_TIM
#define RC_M3_TIM (&htim1)
#endif
#ifndef RC_M3_CH
#define RC_M3_CH  TIM_CHANNEL_3
#endif
#ifndef RC_M3_DIR_PORT
#define RC_M3_DIR_PORT 0
#endif
#ifndef RC_M3_DIR_PIN
#define RC_M3_DIR_PIN  0
#endif
#ifndef RC_M3_DIR_INV
#define RC_M3_DIR_INV  0
#endif

// Motor 4
#ifndef RC_M4_TIM
#define RC_M4_TIM (&htim1)
#endif
#ifndef RC_M4_CH
#define RC_M4_CH  TIM_CHANNEL_4
#endif
#ifndef RC_M4_DIR_PORT
#define RC_M4_DIR_PORT 0
#endif
#ifndef RC_M4_DIR_PIN
#define RC_M4_DIR_PIN  0
#endif
#ifndef RC_M4_DIR_INV
#define RC_M4_DIR_INV  0
#endif

/* ===== SENSORS (4 шт) =====
   Значення повертається 0..100.
   Default: ADC1 CH0..CH3 (12-bit).
   Якщо хочеш цифрові датчики (GPIO) — можна замінити rc_sensor_read у rc_platform_stm32f103.c.
*/

// Sensor 1
#ifndef RC_S1_ADC
#define RC_S1_ADC (&hadc1)
#endif
#ifndef RC_S1_CH
#define RC_S1_CH  ADC_CHANNEL_0
#endif
#ifndef RC_S1_MIN_RAW
#define RC_S1_MIN_RAW 0
#endif
#ifndef RC_S1_MAX_RAW
#define RC_S1_MAX_RAW 4095
#endif

// Sensor 2
#ifndef RC_S2_ADC
#define RC_S2_ADC (&hadc1)
#endif
#ifndef RC_S2_CH
#define RC_S2_CH  ADC_CHANNEL_1
#endif
#ifndef RC_S2_MIN_RAW
#define RC_S2_MIN_RAW 0
#endif
#ifndef RC_S2_MAX_RAW
#define RC_S2_MAX_RAW 4095
#endif

// Sensor 3
#ifndef RC_S3_ADC
#define RC_S3_ADC (&hadc1)
#endif
#ifndef RC_S3_CH
#define RC_S3_CH  ADC_CHANNEL_2
#endif
#ifndef RC_S3_MIN_RAW
#define RC_S3_MIN_RAW 0
#endif
#ifndef RC_S3_MAX_RAW
#define RC_S3_MAX_RAW 4095
#endif

// Sensor 4
#ifndef RC_S4_ADC
#define RC_S4_ADC (&hadc1)
#endif
#ifndef RC_S4_CH
#define RC_S4_CH  ADC_CHANNEL_3
#endif
#ifndef RC_S4_MIN_RAW
#define RC_S4_MIN_RAW 0
#endif
#ifndef RC_S4_MAX_RAW
#define RC_S4_MAX_RAW 4095
#endif

#ifdef __cplusplus
}
#endif
#endif
`;
  }

// ============================================================
  // Public API: generate artifacts
  // ============================================================
  API.generateArtifacts = function(workspace, options){
    if (!workspace) fail('Workspace не знайдено.');
    const name = cIdent(options?.name || 'custom_block');

    const c = new Compiler(workspace);
    c.compile();

    // Meta for header sizing
    const meta = {
      pidN: c.slotCounts.pid,
      smoothN: c.slotCounts.smooth,
      schmittN: c.slotCounts.schmitt,
      edgeN: c.slotCounts.edge,
      varN: c.tempBase
    };

    const headerName = cIdent('rc_cb_'+name) + '.h';
    const cName = cIdent('rc_cb_'+name) + '.c';

    const out = {
      h: genHeader(name, meta),
      c: genProgramC(name, c.ins, meta),
      platformH: genPlatformH(),
      platformC: genPlatformC(),
      boardConfH: genBoardConfH(),
      files: {
        h: headerName,
        c: cName,
        platformH: 'rc_platform.h',
        platformC: 'rc_platform_stm32f103.c',
        boardConfH: 'rc_board_conf.h'
      },
      meta: meta,
      version: API.version
    };

    return out;
  };

  // expose
  window.RC_STM32_CGEN = API;

})();
