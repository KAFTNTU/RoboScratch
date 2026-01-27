/*!
 * help.js — RoboControl Blockly Kid Help Overlay
 * Mode B (mobile): long-press on a block -> floating (?) button near the block.
 * Mode C (desktop): right click -> context menu item "❓ Пояснення (для дітей)".
 *
 * Requirements:
 *  - Blockly already loaded
 *  - main workspace available as window.workspace (your project already does this)
 *
 * Drop-in: <script src="help.js"></script>
 */

(function () {
  "use strict";

  // ---------------------------
  // 0) Small utilities
  // ---------------------------
  const $ = (sel, root = document) => root.querySelector(sel);

  function el(tag, attrs = {}, children = []) {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "style") Object.assign(n.style, v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of children) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return n;
  }

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function isMobileLayout() {
    // Your project toggles body.layout-mobile / body.layout-desktop
    // If not present, fallback to coarse pointer check.
    return document.body.classList.contains("layout-mobile") || window.matchMedia("(pointer: coarse)").matches;
  }

  function isDesktopLayout() {
    return document.body.classList.contains("layout-desktop") || window.matchMedia("(pointer: fine)").matches;
  }

  function safeStr(x) {
    return (x == null) ? "" : String(x);
  }

  // ---------------------------
  // 1) Kid-friendly HELP database
  // ---------------------------
  // You asked: "для всіх блоків".
  // Strategy:
  //  - For your custom blocks: hand-written kid explanations + analogies + examples.
  //  - For built-in Blockly blocks: auto text from Blockly's tooltip + a kid template.
  //
  // You can extend HELP_TEXTS anytime.
  const HELP_TEXTS = {
    // ===== Your project blocks (based on toolbox in index) =====
    "start_hat": {
      title: "Старт",
      kid: "Це як кнопка «ПОЇХАЛИ». Все, що з’єднано під цим блоком — починає виконуватись.",
      analogy: "Уяви старт у гонці: поки суддя не махнув прапорцем — нічого не рухається.",
      steps: [
        "Постав «Старт» зверху.",
        "Під’єднай під нього блоки руху/повороту/очікування.",
        "Натисни запуск — програма піде зверху вниз."
      ],
      example: "Старт → Їхати вперед 1 сек → Стоп",
      xml: `<block type="start_hat"></block>`
    },
    "robot_move": {
      title: "Рух (L/R)",
      kid: "Задає швидкість лівого (L) і правого (R) мотора. Якщо обидва однакові — їде прямо.",
      analogy: "Як на танку: ліва гусениця і права гусениця. Різні швидкості = поворот.",
      steps: [
        "L = 100, R = 100 → вперед",
        "L = -50, R = -50 → назад",
        "L = 100, R = 20 → поворот вправо"
      ],
      example: "Їхати: L=80 R=80 (прямо)",
      xml: `<block type="robot_move">
              <value name="L"><shadow type="math_number_limited"><field name="NUM">80</field></shadow></value>
              <value name="R"><shadow type="math_number_limited"><field name="NUM">80</field></shadow></value>
            </block>`
    },
    "robot_move_soft": {
      title: "Плавно до швидкості",
      kid: "Робить розгін/гальмування плавно: за вказаний час доходить до потрібної швидкості.",
      analogy: "Як у машині: ти не тиснеш газ одразу в підлогу, а плавно розганяєшся.",
      steps: [
        "TARGET — до якої швидкості дійти",
        "SEC — за скільки секунд це зробити"
      ],
      example: "Плавно до 100% за 2 сек",
      xml: `<block type="robot_move_soft">
              <value name="TARGET"><shadow type="math_number_limited"><field name="NUM">100</field></shadow></value>
              <value name="SEC"><shadow type="math_number"><field name="NUM">2</field></shadow></value>
            </block>`
    },
    "robot_turn_timed": {
      title: "Поворот на час",
      kid: "Повертає вліво/вправо певний час. Чим довше час — тим більше поверне.",
      analogy: "Як кермом: тримаєш кермо повернутим 0.5 сек — трохи повернув; 2 сек — сильніше.",
      steps: [
        "Вибери напрям (LEFT або RIGHT).",
        "Задай секунди (наприклад 0.5).",
        "Після цього можеш їхати прямо."
      ],
      example: "Повернути LEFT 0.6 сек",
      xml: `<block type="robot_turn_timed">
              <field name="DIR">LEFT</field>
              <value name="SEC"><shadow type="math_number"><field name="NUM">0.6</field></shadow></value>
            </block>`
    },
    "robot_set_speed": {
      title: "Потужність (ліміт)",
      kid: "Обмежує максимальну швидкість. Це як «гучність» для моторів: більше — швидше.",
      analogy: "Як обмежувач швидкості на самокаті: ставиш 50% — він не розженеться сильніше.",
      steps: [
        "Постав 30–50% для дітей-початківців.",
        "Постав 80–100% для швидкого режиму."
      ],
      example: "Потужність 60%",
      xml: `<block type="robot_set_speed">
              <value name="SPEED"><shadow type="math_number_limited"><field name="NUM">60</field></shadow></value>
            </block>`
    },
    "robot_stop": {
      title: "Стоп",
      kid: "Зупиняє мотори.",
      analogy: "Як натиснути гальма.",
      steps: ["Постав після руху або в кінці програми."],
      example: "Їхати → Стоп",
      xml: `<block type="robot_stop"></block>`
    },
    "move_4_motors": {
      title: "4 мотори",
      kid: "Керує кожним мотором окремо (M1..M4).",
      analogy: "Уяви чотири колеса з окремими педалями: кожне можна крутити по-різному.",
      steps: [
        "Якщо хочеш їхати прямо — став M1=M2=M3=M4",
        "Для поворотів роби ліві колеса і праві різними"
      ],
      example: "M1=80 M2=80 M3=80 M4=80",
      xml: `<block type="move_4_motors">
              <value name="M1"><shadow type="math_number_limited"><field name="NUM">80</field></shadow></value>
              <value name="M2"><shadow type="math_number_limited"><field name="NUM">80</field></shadow></value>
              <value name="M3"><shadow type="math_number_limited"><field name="NUM">80</field></shadow></value>
              <value name="M4"><shadow type="math_number_limited"><field name="NUM">80</field></shadow></value>
            </block>`
    },
    "motor_single": {
      title: "Один мотор",
      kid: "Вмикає один вибраний мотор на потрібну швидкість.",
      analogy: "Як окремо крутити тільки одне колесо, щоб перевірити чи воно працює.",
      steps: ["Вибери мотор", "Постав SPEED"],
      example: "Мотор M1 = 70",
      xml: `<block type="motor_single">
              <value name="SPEED"><shadow type="math_number_limited"><field name="NUM">70</field></shadow></value>
            </block>`
    },
    "sensor_get": {
      title: "Датчик (Port)",
      kid: "Повертає число з датчика на порту (1..4). Це як «поглянути» що бачить сенсор.",
      analogy: "Як перевірити температуру — датчик каже число.",
      steps: [
        "Встав цей блок у порівняння (>, <, =).",
        "Або виведи число в лог/умову."
      ],
      example: "Якщо Port1 < 20 → Стоп",
      xml: `<block type="sensor_get"></block>`
    },
    "wait_until_sensor": {
      title: "Чекати датчик",
      kid: "Пауза: програма чекає, поки датчик стане таким як треба (наприклад менше 20).",
      analogy: "Як чекати, поки двері відкриються, і тільки тоді заходити.",
      steps: ["Вибери порт", "Вибери умову (LT/GT/EQ)", "Вкажи число"],
      example: "Чекати поки Port2 < 15",
      xml: `<block type="wait_until_sensor">
              <field name="SENS">1</field>
              <field name="OP">LT</field>
              <value name="VAL"><shadow type="math_number"><field name="NUM">15</field></shadow></value>
            </block>`
    },
    "wait_seconds": {
      title: "Чекати секунди",
      kid: "Пауза на певний час. Програма «засинає» і потім продовжує.",
      analogy: "Як таймер на телефоні: 3 секунди — і далі.",
      steps: ["Постав 0.2–1 сек для маленьких пауз", "2–5 сек для великих"],
      example: "Чекати 1 сек",
      xml: `<block type="wait_seconds"><value name="SECONDS"><shadow type="math_number"><field name="NUM">1</field></shadow></value></block>`
    },
    "timer_get": {
      title: "Таймер (прочитати)",
      kid: "Показує, скільки часу пройшло після обнулення таймера.",
      analogy: "Як секундомір.",
      steps: ["Спочатку «Обнулити таймер»", "Потім перевіряти час у циклі/умові"],
      example: "Якщо таймер > 3 сек → Стоп",
      xml: `<block type="timer_get"></block>`
    },
    "timer_reset": {
      title: "Таймер (обнулити)",
      kid: "Скидає таймер в 0.",
      analogy: "Як натиснути «Reset» на секундомірі.",
      steps: ["Став на початку програми або перед виміром часу."],
      example: "Обнулити таймер",
      xml: `<block type="timer_reset"></block>`
    },
    "logic_edge_detect": {
      title: "Край (зміна 0→1 / 1→0)",
      kid: "Ловить момент, коли значення різко змінилось (ніби «клац»).",
      analogy: "Як натиснути кнопку: важливий момент натискання, а не те, що вона потім тримається.",
      steps: ["Клади сюди сигнал (0/1).", "Використовуй для «один раз спрацювати»."],
      example: "Коли лінія з’явилась → зробити дію 1 раз",
      xml: `<block type="logic_edge_detect"></block>`
    },
    "logic_schmitt": {
      title: "Фільтр шуму (Шмітт)",
      kid: "Допомагає, коли датчик «стрибає» (то 49, то 51). Робить рішення стабільним.",
      analogy: "Як двері з доводчиком: не тремтять, а нормально закриваються.",
      steps: ["LOW — нижня межа", "HIGH — верхня межа", "VAL — поточне значення"],
      example: "LOW=30 HIGH=70: між ними не «скаче»",
      xml: `<block type="logic_schmitt">
              <value name="VAL"><shadow type="math_number"><field name="NUM">50</field></shadow></value>
              <value name="LOW"><shadow type="math_number"><field name="NUM">30</field></shadow></value>
              <value name="HIGH"><shadow type="math_number"><field name="NUM">70</field></shadow></value>
            </block>`
    },
    "math_pid": {
      title: "PID-регулятор",
      kid: "Розумна формула, яка підправляє керування, щоб їхати рівно (по лінії/по відстані).",
      analogy: "Як ти тримаєш рівновагу на велосипеді: постійно трохи підрулюєш.",
      steps: ["ERROR — помилка (наскільки збились)", "Kp — швидка реакція", "Ki — накопичення", "Kd — гальмування ривків"],
      example: "PID допоможе не «смикатись»",
      xml: `<block type="math_pid">
              <value name="ERROR"><shadow type="math_number"><field name="NUM">10</field></shadow></value>
              <value name="KP"><shadow type="math_number"><field name="NUM">1</field></shadow></value>
              <value name="KI"><shadow type="math_number"><field name="NUM">0</field></shadow></value>
              <value name="KD"><shadow type="math_number"><field name="NUM">0.2</field></shadow></value>
            </block>`
    },
    "math_smooth": {
      title: "Згладити",
      kid: "Робить число «плавнішим», щоб не стрибало.",
      analogy: "Як фільтр на відео: прибирає різкі ривки.",
      steps: ["Корисно для датчиків і керування моторами."],
      example: "Згладити покази датчика",
      xml: `<block type="math_smooth"></block>`
    },

    // Track / автопілот
    "record_start": {
      title: "Запис траси",
      kid: "Починає запам’ятовувати, як ти керуєш (швидкості і час).",
      analogy: "Як записати відео гри: потім можна «повторити».",
      steps: ["Натисни старт запису", "Покатайся", "Потім використай «Відтворити трасу»"],
      example: "Запис → керування → Відтворення",
      xml: `<block type="record_start"></block>`
    },
    "replay_track": {
      title: "Відтворити трасу",
      kid: "Повторює керування, яке було записано раніше.",
      analogy: "Як автопілот по твоєму маршруту.",
      steps: ["Спочатку треба записати трасу.", "Потім цей блок її програє."],
      example: "Відтворити 1 раз",
      xml: `<block type="replay_track"></block>`
    },
    "replay_loop": {
      title: "Повторити запис N разів",
      kid: "Програє трасу кілька разів.",
      analogy: "Як включити повтор пісні 3 рази.",
      steps: ["Постав TIMES = скільки повторів."],
      example: "Повторити 3 рази",
      xml: `<block type="replay_loop"><value name="TIMES"><shadow type="math_number"><field name="NUM">3</field></shadow></value></block>`
    },
    "count_laps": {
      title: "Кількість кіл",
      kid: "Керує, щоб виконати задану кількість кіл (лапів).",
      analogy: "Як бігти 3 кола на стадіоні.",
      steps: ["Вкажи LAPS — скільки кіл."],
      example: "3 кола",
      xml: `<block type="count_laps"><value name="LAPS"><shadow type="math_number"><field name="NUM">3</field></shadow></value></block>`
    },
    "wait_start": {
      title: "Чекати старт-лінію",
      kid: "Чекає, поки датчик побачить стартову лінію.",
      analogy: "Як чекати, поки ти дійдеш до старту, і тільки потім почати рахувати кола.",
      steps: ["Використовуй з датчиком лінії (чорна/біла)."],
      example: "Чекати старт",
      xml: `<block type="wait_start"></block>`
    },
    "stop_at_start": {
      title: "Зупинитись на старті",
      kid: "Коли повернувся на стартову лінію — зупиняє робота.",
      analogy: "Фініш: перетнув лінію — стоп.",
      steps: ["Став після логіки кіл/руху."],
      example: "Фініш на старті",
      xml: `<block type="stop_at_start"></block>`
    },
    "go_home": {
      title: "Додому / Нуль",
      kid: "Повертає в базовий стан (як «скинути керування»).",
      analogy: "Як кнопка «додому» на телефоні.",
      steps: ["Використовуй після тестів або перед новою програмою."],
      example: "Go Home",
      xml: `<block type="go_home"></block>`
    },

    // Spider blocks (generic kid)
    "spider_center": {
      title: "Павук: Центр",
      kid: "Ставить лапи в рівне положення (база).",
      analogy: "Як встати рівно на дві ноги перед кроком.",
      steps: ["Зручно на початку програми."],
      example: "Центр → кроки",
      xml: `<block type="spider_center"></block>`
    },
    "spider_step": {
      title: "Павук: Крок",
      kid: "Робить один крок в обраному напрямку.",
      analogy: "Як зробити 1 крок вперед/назад.",
      steps: ["Вибери напрям DIR", "Постав у цикл для багато кроків."],
      example: "Крок вперед",
      xml: `<block type="spider_step"><field name="DIR">FWD</field></block>`
    },
    "spider_walk_while": {
      title: "Павук: Йти поки",
      kid: "Йде кроками, поки умова не зміниться.",
      analogy: "Йти, поки не дійшов до дверей.",
      steps: ["Добре працює з датчиками."],
      example: "Йти вперед поки датчик не побачить перешкоду",
      xml: `<block type="spider_walk_while"><field name="DIR">FWD</field></block>`
    },
    "spider_walk_time": {
      title: "Павук: Йти час",
      kid: "Йде певний час (в секундах).",
      analogy: "Йти 2 секунди, як по команді.",
      steps: ["SEC — скільки секунд йти."],
      example: "Йти 2 сек",
      xml: `<block type="spider_walk_time"><field name="DIR">FWD</field><value name="SEC"><shadow type="math_number"><field name="NUM">2</field></shadow></value></block>`
    },
    "spider_turn_smooth": {
      title: "Павук: Плавний поворот",
      kid: "Повертає павука на кут.",
      analogy: "Як повернутись на місці на 90°.",
      steps: ["ANGLE — кут повороту."],
      example: "90°",
      xml: `<block type="spider_turn_smooth"><value name="ANGLE"><shadow type="math_number"><field name="NUM">90</field></shadow></value></block>`
    },
    "spider_leg_control": {
      title: "Павук: Лапа",
      kid: "Керує однією лапою (кут).",
      analogy: "Як підняти/опустити одну ногу.",
      steps: ["VAL — кут 0..180."],
      example: "Кут 90",
      xml: `<block type="spider_leg_control"><value name="VAL"><shadow type="math_number"><field name="NUM">90</field></shadow></value></block>`
    },
    "spider_config": {
      title: "Павук: Налаштування",
      kid: "Налаштовує висоту і швидкість ходи павука.",
      analogy: "Як налаштувати висоту стільця і темп ходи.",
      steps: ["HEIGHT — висота", "SPEED — швидкість"],
      example: "HEIGHT 40 SPEED 100",
      xml: `<block type="spider_config">
              <value name="HEIGHT"><shadow type="math_number"><field name="NUM">40</field></shadow></value>
              <value name="SPEED"><shadow type="math_number"><field name="NUM">100</field></shadow></value>
            </block>`
    },
    "spider_anim": {
      title: "Павук: Анімація",
      kid: "Запускає готову анімацію (помах, танець...).",
      analogy: "Як вибрати емоцію у персонажа.",
      steps: ["ANIM — яка саме анімація."],
      example: "WAVE",
      xml: `<block type="spider_anim"><field name="ANIM">WAVE</field></block>`
    },
    "spider_joystick_ctrl": {
      title: "Павук: Джойстик",
      kid: "Дозволяє керувати павуком джойстиком.",
      analogy: "Як у грі: рухаєш — він йде.",
      steps: ["Став в програму, щоб підхопити джойстик."],
      example: "Павук керується руками",
      xml: `<block type="spider_joystick_ctrl"></block>`
    },
    "spider_stop": {
      title: "Павук: Стоп",
      kid: "Зупиняє рух павука.",
      analogy: "Команда «Стій!»",
      steps: ["Став в кінці або при перешкоді."],
      example: "Стоп",
      xml: `<block type="spider_stop"></block>`
    }
  };

  // Built-in blocks: kid template by category / common patterns
  const GENERIC_KID = {
    "controls_if": {
      title: "Якщо (умова)",
      kid: "Перевіряє умову. Якщо вона правдива — робить те, що всередині.",
      analogy: "Як правило: «якщо дощ — бери парасольку».",
      example: "Якщо датчик < 20 → Стоп"
    },
    "controls_repeat_ext": {
      title: "Повторити N разів",
      kid: "Повторює те, що всередині, багато разів.",
      analogy: "Як віджимання: зробити 10 разів.",
      example: "Повторити 4 рази → крок"
    },
    "controls_whileUntil": {
      title: "Поки / До того як",
      kid: "Поки умова виконується — повторює дії.",
      analogy: "Поки не дійшов додому — йди.",
      example: "Поки датчик > 30 → їхати"
    },
    "controls_for": {
      title: "Цикл з лічильником",
      kid: "Робить цикл і рахує i: 1,2,3…",
      analogy: "Як рахувати кроки: 1 до 10.",
      example: "для i від 1 до 10 → дія"
    },
    "logic_compare": {
      title: "Порівняння",
      kid: "Порівнює 2 числа (більше/менше/дорівнює).",
      analogy: "Хто більший: 5 чи 7?",
      example: "датчик < 20"
    },
    "logic_operation": {
      title: "І / АБО",
      kid: "Об’єднує дві умови.",
      analogy: "Треба і шапку, і рукавички (І). АБО — або чай, або какао.",
      example: "(датчик1<20) І (датчик2<20)"
    },
    "logic_negate": {
      title: "НЕ",
      kid: "Робить навпаки: якщо було так — стане ні.",
      analogy: "Не холодно = тепло.",
      example: "НЕ(датчик<20)"
    },
    "math_number": {
      title: "Число",
      kid: "Просто число.",
      analogy: "Як цифра на лінійці.",
      example: "10"
    },
    "math_arithmetic": {
      title: "Математика",
      kid: "Додає, віднімає, множить, ділить.",
      analogy: "Як калькулятор.",
      example: "3 + 2"
    },
    "math_random_int": {
      title: "Випадкове число",
      kid: "Дає випадкове число між двома числами.",
      analogy: "Як кинути кубик.",
      example: "від 1 до 6"
    }
  };

  function getHelpForBlock(block) {
    const type = block?.type;
    const fromDb = HELP_TEXTS[type];
    if (fromDb) return { ...fromDb, type };

    const generic = GENERIC_KID[type];
    const tooltip = (typeof block.getTooltip === "function") ? block.getTooltip() : "";
    const title = generic?.title || ("Блок: " + safeStr(type));
    const kid = generic?.kid || (tooltip ? ("Цей блок робить таке: " + tooltip) : "Це блок програми. Він виконує свою дію, коли до нього доходить черга.");
    const analogy = generic?.analogy || "Уяви, що програма — це інструкція. Цей блок — один крок інструкції.";
    const example = generic?.example || "Спробуй поставити цей блок у програму і подивитись, що зміниться.";

    // XML preview: default from block itself, or minimal block stub
    let xml = "";
    try {
      if (Blockly && Blockly.Xml && typeof Blockly.Xml.blockToDom === "function") {
        const dom = Blockly.Xml.blockToDom(block, true);
        // remove position and id so it doesn't conflict
        dom.removeAttribute("id");
        dom.removeAttribute("x");
        dom.removeAttribute("y");
        xml = new XMLSerializer().serializeToString(dom);
      }
    } catch (_) {}

    if (!xml) xml = `<block type="${safeStr(type)}"></block>`;
    return { type, title, kid, analogy, steps: [], example, xml };
  }

  // ---------------------------
  // 2) UI: Help Panel (right side)
  // ---------------------------
  let _uiReady = false;
  let _panel, _panelInner, _panelTitle, _panelKid, _panelAnalogy, _panelSteps, _panelExample, _panelAddBtn, _panelCloseBtn, _miniWrap, _miniDiv;
  let _miniWorkspace = null;
  let _currentBlock = null;

  function ensureUI() {
    if (_uiReady) return;

    const style = el("style", {}, [`
      /* Help overlay UI */
      .rc-help-fab{
        position: absolute;
        width: 38px; height: 38px;
        border-radius: 999px;
        background: rgba(59,130,246,0.95);
        border: 1px solid rgba(255,255,255,0.25);
        box-shadow: 0 10px 25px rgba(0,0,0,0.45);
        display: none;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-weight: 900;
        z-index: 9999;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
      }
      .rc-help-fab:active{ transform: scale(0.92); }

      .rc-help-panel{
        position: fixed;
        top: 70px;
        right: 12px;
        width: min(420px, calc(100vw - 24px));
        max-height: calc(100vh - 90px);
        background: rgba(15, 23, 42, 0.97);
        border: 1px solid rgba(148,163,184,0.25);
        border-radius: 18px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.65);
        z-index: 10000;
        display: none;
        overflow: hidden;
        backdrop-filter: blur(12px);
      }
      .rc-help-panel header{
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:10px;
        padding: 12px 14px;
        border-bottom: 1px solid rgba(148,163,184,0.18);
      }
      .rc-help-panel header .t{
        display:flex; flex-direction:column; gap:2px;
      }
      .rc-help-panel header .t .h{
        font-size: 14px;
        font-weight: 900;
        color: #e2e8f0;
        letter-spacing: 0.02em;
      }
      .rc-help-panel header .t .s{
        font-size: 10px;
        color: #94a3b8;
        font-weight: 700;
        letter-spacing: 0.14em;
        text-transform: uppercase;
      }
      .rc-help-panel header button{
        width: 34px; height: 34px;
        border-radius: 10px;
        border: 1px solid rgba(148,163,184,0.25);
        background: rgba(30,41,59,0.6);
        color: #cbd5e1;
        cursor: pointer;
      }
      .rc-help-panel header button:active{ transform: scale(0.95); }

      .rc-help-body{
        padding: 12px 14px;
        overflow: auto;
        max-height: calc(100vh - 160px);
      }
      .rc-help-card{
        background: rgba(2,6,23,0.35);
        border: 1px solid rgba(148,163,184,0.14);
        border-radius: 14px;
        padding: 10px 12px;
        margin-bottom: 10px;
      }
      .rc-help-card .label{
        font-size: 10px;
        font-weight: 900;
        color: #94a3b8;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }
      .rc-help-card .text{
        font-size: 13px;
        line-height: 1.35;
        color: #e2e8f0;
        white-space: pre-wrap;
      }
      .rc-help-steps li{
        margin: 6px 0;
        color: #e2e8f0;
        font-size: 13px;
        line-height: 1.25;
      }

      .rc-help-mini{
        height: 130px;
        width: 100%;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(148,163,184,0.18);
        background: rgba(15,23,42,0.6);
      }

      .rc-help-actions{
        display:flex;
        gap: 10px;
        padding: 12px 14px;
        border-top: 1px solid rgba(148,163,184,0.18);
        background: rgba(2,6,23,0.25);
      }
      .rc-help-actions button{
        flex: 1;
        padding: 10px 12px;
        border-radius: 12px;
        border: 1px solid rgba(148,163,184,0.2);
        cursor: pointer;
        font-weight: 900;
        font-size: 12px;
        letter-spacing: 0.04em;
      }
      .rc-help-add{
        background: rgba(34,197,94,0.9);
        color: #0b1220;
      }
      .rc-help-add:active{ transform: scale(0.98); }
      .rc-help-close{
        background: rgba(30,41,59,0.7);
        color: #e2e8f0;
      }

      /* Desktop: dock help panel a bit wider if space */
      @media (min-width: 900px){
        .rc-help-panel{ width: 440px; }
      }
    `]);
    document.head.appendChild(style);

    _panelTitle = el("div", { class: "h" }, ["Підказка"]);
    const sub = el("div", { class: "s" }, ["для дітей"]);
    const titleWrap = el("div", { class: "t" }, [_panelTitle, sub]);

    _panelCloseBtn = el("button", { title: "Закрити" }, ["✕"]);
    _panelCloseBtn.addEventListener("click", () => closeHelp());

    const header = el("header", {}, [titleWrap, _panelCloseBtn]);

    _panelKid = el("div", { class: "text" }, ["—"]);
    _panelAnalogy = el("div", { class: "text" }, ["—"]);
    _panelExample = el("div", { class: "text" }, ["—"]);
    _panelSteps = el("ul", { class: "rc-help-steps" });

    _miniDiv = el("div", { class: "rc-help-mini" });
    _miniWrap = el("div", { class: "rc-help-card" }, [
      el("div", { class: "label" }, ["Як виглядає блок"]),
      _miniDiv
    ]);

    const card1 = el("div", { class: "rc-help-card" }, [
      el("div", { class: "label" }, ["Що робить"]),
      _panelKid
    ]);
    const card2 = el("div", { class: "rc-help-card" }, [
      el("div", { class: "label" }, ["Аналогія"]),
      _panelAnalogy
    ]);
    const card3 = el("div", { class: "rc-help-card" }, [
      el("div", { class: "label" }, ["Кроки"]),
      _panelSteps
    ]);
    const card4 = el("div", { class: "rc-help-card" }, [
      el("div", { class: "label" }, ["Приклад"]),
      _panelExample
    ]);

    _panelInner = el("div", { class: "rc-help-body" }, [_miniWrap, card1, card2, card3, card4]);

    _panelAddBtn = el("button", { class: "rc-help-add" }, ["➕ Додати цей блок на полотно"]);
    _panelAddBtn.addEventListener("click", () => {
      if (_currentBlock) addBlockToMainWorkspace(_currentBlock);
    });

    const closeBtn2 = el("button", { class: "rc-help-close" }, ["Закрити"]);
    closeBtn2.addEventListener("click", () => closeHelp());

    const actions = el("div", { class: "rc-help-actions" }, [_panelAddBtn, closeBtn2]);

    _panel = el("div", { class: "rc-help-panel" }, [header, _panelInner, actions]);
    document.body.appendChild(_panel);

    // Floating (?) button
    const fab = el("div", { class: "rc-help-fab", id: "rcHelpFab", title: "Пояснення" }, ["?"]);
    fab.addEventListener("click", () => {
      if (_currentBlock) openHelpForBlock(_currentBlock);
    });
    document.body.appendChild(fab);

    _uiReady = true;
  }

  function closeHelp() {
    ensureUI();
    _panel.style.display = "none";
  }

  // ---------------------------
  // 3) Mini preview workspace
  // ---------------------------
  function ensureMiniWorkspace() {
    if (_miniWorkspace) return _miniWorkspace;

    // Inject a read-only workspace into the mini div
    _miniWorkspace = Blockly.inject(_miniDiv, {
      readOnly: true,
      scrollbars: false,
      sounds: false,
      trashcan: false,
      renderer: "zelos",
      zoom: { controls: false, wheel: false, startScale: 0.9, maxScale: 2, minScale: 0.5 },
      move: { scrollbars: false, drag: false, wheel: false },
      toolbox: null,
      media: undefined
    });
    return _miniWorkspace;
  }

  function renderMiniBlock(xmlText) {
    try {
      const ws = ensureMiniWorkspace();
      ws.clear();

      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(`<xml xmlns="https://developers.google.com/blockly/xml">${xmlText}</xml>`, "text/xml");
      const xml = xmlDoc.documentElement;
      Blockly.Xml.domToWorkspace(xml, ws);

      // Center block
      const blocks = ws.getAllBlocks(false);
      if (blocks.length) {
        const b = blocks[0];
        b.moveBy(10, 10);
      }
      ws.resizeContents();
    } catch (e) {
      // ignore
    }
  }

  // ---------------------------
  // 4) Open help for a specific block
  // ---------------------------
  function openHelpForBlock(block) {
    ensureUI();
    _currentBlock = block;

    const info = getHelpForBlock(block);
    _panelTitle.textContent = info.title || ("Блок: " + info.type);

    _panelKid.textContent = info.kid || "—";
    _panelAnalogy.textContent = info.analogy || "—";
    _panelExample.textContent = info.example || "—";

    // Steps
    _panelSteps.innerHTML = "";
    const steps = Array.isArray(info.steps) ? info.steps : [];
    if (steps.length === 0) {
      _panelSteps.appendChild(el("li", {}, ["Спробуй додати блок і подивись, як змінюється поведінка робота."]));
    } else {
      steps.forEach(s => _panelSteps.appendChild(el("li", {}, [safeStr(s)])));
    }

    // Preview
    renderMiniBlock(info.xml);

    _panel.style.display = "block";
  }

  // ---------------------------
  // 5) Add block to the MAIN workspace (your canvas)
  // ---------------------------
  function addBlockToMainWorkspace(sourceBlock) {
    const ws = getMainWorkspace();
    if (!ws) return;

    try {
      // Clone DOM of the block (keeps fields + shadow values)
      const dom = Blockly.Xml.blockToDom(sourceBlock, true);
      dom.removeAttribute("id");
      dom.removeAttribute("x");
      dom.removeAttribute("y");

      const block = Blockly.Xml.domToBlock(dom, ws);

      // Place near center of viewport
      const metrics = ws.getMetrics();
      const cx = (metrics.viewLeft + metrics.viewWidth / 2);
      const cy = (metrics.viewTop + metrics.viewHeight / 2);
      // Convert from pixels in view to workspace coords:
      const xy = ws.getSvgMetrics ? ws.getSvgMetrics() : null;
      // Best effort: just move to center in workspace coords.
      const mainScale = ws.scale || 1;
      const wx = (cx / mainScale);
      const wy = (cy / mainScale);

      block.moveBy(wx, wy);
      block.select();
      ws.scrollCenter();
    } catch (e) {
      // fallback: create by type only
      try {
        const type = sourceBlock.type;
        const b = ws.newBlock(type);
        b.initSvg();
        b.render();
        b.moveBy(40, 40);
        b.select();
      } catch (_) {}
    }
  }

  // ---------------------------
  // 6) Mobile mode (B): long-press -> show (?) button
  // ---------------------------
  let _fab = null;
  let _pressTimer = null;
  let _pressTargetBlockId = null;
  let _moved = false;

  function getFab() {
    ensureUI();
    if (!_fab) _fab = $("#rcHelpFab");
    return _fab;
  }

  function hideFab() {
    const fab = getFab();
    fab.style.display = "none";
  }

  function showFabNearBlock(block) {
    const fab = getFab();
    const svgRoot = block.getSvgRoot && block.getSvgRoot();
    const div = $("#blocklyDiv") || document.body;

    if (!svgRoot) return;

    const rBlock = svgRoot.getBoundingClientRect();
    const rDiv = div.getBoundingClientRect();

    // Place to the right-middle of the block
    const left = (rBlock.right - rDiv.left) + 8;
    const top = (rBlock.top - rDiv.top) + (rBlock.height / 2) - 19;

    // Keep inside screen
    const maxLeft = window.innerWidth - 44;
    const maxTop = window.innerHeight - 44;

    fab.style.left = clamp(left, 8, maxLeft) + "px";
    fab.style.top = clamp(top, 70, maxTop) + "px"; // don't cover header
    fab.style.display = "flex";
  }

  function findBlockIdFromEventTarget(ev) {
    let n = ev.target;
    for (let i = 0; i < 12 && n; i++) {
      if (n.getAttribute && n.getAttribute("data-id")) return n.getAttribute("data-id");
      n = n.parentNode;
    }
    return null;
  }

  function attachMobileLongPress(ws) {
    const div = $("#blocklyDiv");
    if (!div) return;

    // Avoid multiple attachments
    if (div.__rcHelpMobileAttached) return;
    div.__rcHelpMobileAttached = true;

    const onDown = (ev) => {
      if (!isMobileLayout()) return;

      _moved = false;
      _pressTargetBlockId = findBlockIdFromEventTarget(ev);
      if (!_pressTargetBlockId) return;

      clearTimeout(_pressTimer);
      _pressTimer = setTimeout(() => {
        if (_moved) return;
        const b = ws.getBlockById(_pressTargetBlockId);
        if (!b) return;
        _currentBlock = b;
        showFabNearBlock(b);
      }, 380); // long press threshold
    };

    const onMove = () => {
      _moved = true;
      clearTimeout(_pressTimer);
    };

    const onUp = () => {
      clearTimeout(_pressTimer);
      // don't auto-hide; user may want to tap (?) after lifting finger
      // But if they tap elsewhere, we hide.
    };

    const onTapOutside = (ev) => {
      const fab = getFab();
      if (fab.style.display === "flex") {
        if (ev.target === fab || fab.contains(ev.target)) return;
        // if user tapped on a block again, keep; else hide
        const bid = findBlockIdFromEventTarget(ev);
        if (!bid) hideFab();
      }
    };

    div.addEventListener("pointerdown", onDown, { passive: true });
    div.addEventListener("pointermove", onMove, { passive: true });
    div.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("pointerdown", onTapOutside, { passive: true });
  }

  // ---------------------------
  // 7) Desktop mode (C): context menu item
  // ---------------------------
  let _patchedContext = false;

  function patchContextMenuOnce() {
    if (_patchedContext) return;
    _patchedContext = true;

    const proto = Blockly?.BlockSvg?.prototype;
    if (!proto) return;

    const old = proto.customContextMenu;
    proto.customContextMenu = function (options) {
      try { if (typeof old === "function") old.call(this, options); } catch (_) {}

      if (!isDesktopLayout()) return;

      const block = this;
      options.push({
        text: "❓ Пояснення (для дітей) 📌",
        enabled: true,
        callback: function () {
          openHelpForBlock(block);
        }
      });
    };
  }

  // ---------------------------
  // 8) Main workspace discovery & re-attach
  // ---------------------------
  let _lastWorkspace = null;

  function getMainWorkspace() {
    // Your app sets window.workspace; fallback to Blockly.getMainWorkspace()
    return window.workspace || (Blockly && Blockly.getMainWorkspace && Blockly.getMainWorkspace());
  }

  function attachToWorkspace(ws) {
    if (!ws) return;
    if (ws === _lastWorkspace) return;
    _lastWorkspace = ws;

    ensureUI();
    patchContextMenuOnce();
    attachMobileLongPress(ws);

    // Also: show small hover tooltip (native) for every block based on kid text
    // This helps even if they don't open the panel.
    try {
      const oldTooltip = ws.getToolbox ? ws.getToolbox() : null;
      // No-op, we set tooltips on blocks as they are created/changed
    } catch (_) {}

    // On block create/change: set tooltip
    ws.addChangeListener((e) => {
      try {
        if (e.type === Blockly.Events.BLOCK_CREATE || e.type === Blockly.Events.BLOCK_CHANGE) {
          const b = ws.getBlockById(e.blockId);
          if (!b) return;
          const info = getHelpForBlock(b);
          // short tooltip
          if (typeof b.setTooltip === "function") {
            b.setTooltip(info.kid || info.title || "Пояснення");
          }
        }
        if (e.type === Blockly.Events.SELECTED && e.newElementId) {
          const b = ws.getBlockById(e.newElementId);
          if (b) _currentBlock = b;
        }
      } catch (_) {}
    });
  }

  function boot() {
    if (!window.Blockly) return; // Blockly not loaded yet

    // UI now
    ensureUI();

    // Keep watching for workspace changes (your app recreates workspace sometimes)
    setInterval(() => {
      const ws = getMainWorkspace();
      if (ws) attachToWorkspace(ws);
    }, 300);
  }

  // Start ASAP (after DOM + Blockly)
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();
