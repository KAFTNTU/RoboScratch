/*!
 * help.js — RoboControl Blockly Kid Help Overlay (Examples-only)
 * Phone (B): long-press a block -> floating (?) button near the block -> opens help panel.
 * PC (C): right click a block -> context menu item "❓ Пояснення (для дітей)" -> opens help panel.
 *
 * In help panel:
 *  - kid-friendly explanation (простими словами)
 *  - analogy (аналогія)
 *  - steps (кроки)
 *  - mini preview of the selected block
 *  - mini preview of an EXAMPLE chain (not a full ready program)
 *
 * NOTE: there is NO "add to workspace" button (by request), so kids don't just spam "+".
 *
 * Drop-in: <script src="help.js"></script>
 */
(function () {
  "use strict";

  // ---------------------------
  // 0) Utilities
  // ---------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

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

  function safeStr(x) { return (x == null) ? "" : String(x); }

  function isMobileLayout() {
    return document.body.classList.contains("layout-mobile") || window.matchMedia("(pointer: coarse)").matches;
  }
  function isDesktopLayout() {
    return document.body.classList.contains("layout-desktop") || window.matchMedia("(pointer: fine)").matches;
  }

  // ---------------------------
  // 1) HELP DATABASE (for all blocks)
  // ---------------------------
  // This database covers:
  //  - Your custom robot/spider blocks
  //  - Common Blockly standard blocks
  //  - Fallback for any unknown block type (auto)
  //
  // Each entry can have:
  //  title, kid, analogy, steps[], example, example_xml (workspace fragment)
  const HELP = {
  "controls_if": {
    "title": "Якщо",
    "kid": "Перевіряє умову і виконує дії, якщо вона правда.",
    "analogy": "Як інструкція з кроками: роби це, потім те; інколи повторюй.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"controls_if\"></block>"
  },
  "controls_ifelse": {
    "title": "Якщо-інакше",
    "kid": "Якщо умова правда — робить перше, інакше — друге.",
    "analogy": "Як інструкція з кроками: роби це, потім те; інколи повторюй.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"controls_ifelse\"></block>"
  },
  "controls_repeat_ext": {
    "title": "Повторити N разів",
    "kid": "Повторює дії задану кількість разів.",
    "analogy": "Як інструкція з кроками: роби це, потім те; інколи повторюй.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"controls_repeat_ext\"></block>"
  },
  "controls_whileUntil": {
    "title": "Поки / До того як",
    "kid": "Повторює дії, поки умова виконується (або до виконання).",
    "analogy": "Як інструкція з кроками: роби це, потім те; інколи повторюй.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"controls_whileUntil\"></block>"
  },
  "controls_for": {
    "title": "Для i від…до…",
    "kid": "Цикл з лічильником i (рахує кроки).",
    "analogy": "Як інструкція з кроками: роби це, потім те; інколи повторюй.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"controls_for\"></block>"
  },
  "controls_forEach": {
    "title": "Для кожного з списку",
    "kid": "Проходить по елементах списку один за одним.",
    "analogy": "Як інструкція з кроками: роби це, потім те; інколи повторюй.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"controls_forEach\"></block>"
  },
  "controls_flow_statements": {
    "title": "Зупинити цикл",
    "kid": "Зупиняє або пропускає кроки в циклі.",
    "analogy": "Як інструкція з кроками: роби це, потім те; інколи повторюй.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"controls_flow_statements\"></block>"
  },
  "controls_wait": {
    "title": "Чекати",
    "kid": "Пауза на секунди (як таймер).",
    "analogy": "Як інструкція з кроками: роби це, потім те; інколи повторюй.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"controls_wait\"></block>"
  },
  "controls_forever": {
    "title": "Завжди",
    "kid": "Повторює дії без кінця (поки не натиснеш стоп).",
    "analogy": "Як інструкція з кроками: роби це, потім те; інколи повторюй.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"controls_forever\"></block>"
  },
  "logic_compare": {
    "title": "Порівняти",
    "kid": "Порівнює числа: >, <, =.",
    "analogy": "Як правило: «якщо ... то ...». Це допомагає приймати рішення.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"logic_compare\">\n  <field name=\"OP\">LT</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">5</field></shadow></value>\n</block>"
  },
  "logic_operation": {
    "title": "І / АБО",
    "kid": "З’єднує дві умови.",
    "analogy": "Як правило: «якщо ... то ...». Це допомагає приймати рішення.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"logic_compare\">\n  <field name=\"OP\">LT</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">5</field></shadow></value>\n</block>"
  },
  "logic_negate": {
    "title": "НЕ",
    "kid": "Робить умову навпаки.",
    "analogy": "Як правило: «якщо ... то ...». Це допомагає приймати рішення.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"logic_compare\">\n  <field name=\"OP\">LT</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">5</field></shadow></value>\n</block>"
  },
  "logic_boolean": {
    "title": "Так/Ні",
    "kid": "Логічне значення: правда або брехня.",
    "analogy": "Як правило: «якщо ... то ...». Це допомагає приймати рішення.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"logic_compare\">\n  <field name=\"OP\">LT</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">5</field></shadow></value>\n</block>"
  },
  "logic_null": {
    "title": "Нічого",
    "kid": "Порожнє значення (нема даних).",
    "analogy": "Як правило: «якщо ... то ...». Це допомагає приймати рішення.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"logic_compare\">\n  <field name=\"OP\">LT</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">5</field></shadow></value>\n</block>"
  },
  "logic_ternary": {
    "title": "Вибір (умова ? A : B)",
    "kid": "Вибирає одне з двох значень за умовою.",
    "analogy": "Як правило: «якщо ... то ...». Це допомагає приймати рішення.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"logic_compare\">\n  <field name=\"OP\">LT</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">5</field></shadow></value>\n</block>"
  },
  "math_number": {
    "title": "Число",
    "kid": "Звичайне число.",
    "analogy": "Як калькулятор: допомагає рахувати і порівнювати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"math_arithmetic\">\n  <field name=\"OP\">ADD</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">4</field></shadow></value>\n</block>"
  },
  "math_arithmetic": {
    "title": "+ − × ÷",
    "kid": "Математика: додати/відняти/помножити/поділити.",
    "analogy": "Як калькулятор: допомагає рахувати і порівнювати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"math_arithmetic\">\n  <field name=\"OP\">ADD</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">4</field></shadow></value>\n</block>"
  },
  "math_single": {
    "title": "Матем. функція",
    "kid": "Модуль, корінь, синус тощо.",
    "analogy": "Як калькулятор: допомагає рахувати і порівнювати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"math_arithmetic\">\n  <field name=\"OP\">ADD</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">4</field></shadow></value>\n</block>"
  },
  "math_trig": {
    "title": "Тригонометрія",
    "kid": "Синус/косинус/тангенс.",
    "analogy": "Як калькулятор: допомагає рахувати і порівнювати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"math_arithmetic\">\n  <field name=\"OP\">ADD</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">4</field></shadow></value>\n</block>"
  },
  "math_constant": {
    "title": "Константа",
    "kid": "Готове число: π, e тощо.",
    "analogy": "Як калькулятор: допомагає рахувати і порівнювати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"math_arithmetic\">\n  <field name=\"OP\">ADD</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">4</field></shadow></value>\n</block>"
  },
  "math_number_property": {
    "title": "Властивість числа",
    "kid": "Парне? Ділиться? Прості числа?",
    "analogy": "Як калькулятор: допомагає рахувати і порівнювати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"math_arithmetic\">\n  <field name=\"OP\">ADD</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">4</field></shadow></value>\n</block>"
  },
  "math_round": {
    "title": "Округлення",
    "kid": "Округлює число.",
    "analogy": "Як калькулятор: допомагає рахувати і порівнювати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"math_arithmetic\">\n  <field name=\"OP\">ADD</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">4</field></shadow></value>\n</block>"
  },
  "math_on_list": {
    "title": "Математика зі списком",
    "kid": "Сума/середнє/макс/мін у списку.",
    "analogy": "Як калькулятор: допомагає рахувати і порівнювати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"math_arithmetic\">\n  <field name=\"OP\">ADD</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">4</field></shadow></value>\n</block>"
  },
  "math_modulo": {
    "title": "Остача",
    "kid": "Остача від ділення (mod).",
    "analogy": "Як калькулятор: допомагає рахувати і порівнювати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"math_arithmetic\">\n  <field name=\"OP\">ADD</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">4</field></shadow></value>\n</block>"
  },
  "math_constrain": {
    "title": "Обмежити",
    "kid": "Не дає числу вийти за межі.",
    "analogy": "Як калькулятор: допомагає рахувати і порівнювати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"math_arithmetic\">\n  <field name=\"OP\">ADD</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">4</field></shadow></value>\n</block>"
  },
  "math_random_int": {
    "title": "Випадкове ціле",
    "kid": "Випадкове число між A і B.",
    "analogy": "Як калькулятор: допомагає рахувати і порівнювати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"math_arithmetic\">\n  <field name=\"OP\">ADD</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">4</field></shadow></value>\n</block>"
  },
  "math_random_float": {
    "title": "Випадкове 0..1",
    "kid": "Випадкове число від 0 до 1.",
    "analogy": "Як калькулятор: допомагає рахувати і порівнювати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"math_arithmetic\">\n  <field name=\"OP\">ADD</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">4</field></shadow></value>\n</block>"
  },
  "text": {
    "title": "Текст",
    "kid": "Слова/рядок.",
    "analogy": "Як слова в повідомленні: можна склеювати, різати, рахувати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"text_join\">\n  <mutation items=\"2\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"text\"><field name=\"TEXT\">Привіт</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"text\"><field name=\"TEXT\">світ</field></shadow></value>\n</block>"
  },
  "text_join": {
    "title": "З’єднати текст",
    "kid": "Склеює слова в одне речення.",
    "analogy": "Як слова в повідомленні: можна склеювати, різати, рахувати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"text_join\">\n  <mutation items=\"2\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"text\"><field name=\"TEXT\">Привіт</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"text\"><field name=\"TEXT\">світ</field></shadow></value>\n</block>"
  },
  "text_append": {
    "title": "Дописати до змінної",
    "kid": "Додає текст до змінної.",
    "analogy": "Як слова в повідомленні: можна склеювати, різати, рахувати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"text_join\">\n  <mutation items=\"2\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"text\"><field name=\"TEXT\">Привіт</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"text\"><field name=\"TEXT\">світ</field></shadow></value>\n</block>"
  },
  "text_length": {
    "title": "Довжина",
    "kid": "Скільки символів у тексті.",
    "analogy": "Як слова в повідомленні: можна склеювати, різати, рахувати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"text_join\">\n  <mutation items=\"2\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"text\"><field name=\"TEXT\">Привіт</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"text\"><field name=\"TEXT\">світ</field></shadow></value>\n</block>"
  },
  "text_isEmpty": {
    "title": "Порожній?",
    "kid": "Перевіряє, чи текст порожній.",
    "analogy": "Як слова в повідомленні: можна склеювати, різати, рахувати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"text_join\">\n  <mutation items=\"2\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"text\"><field name=\"TEXT\">Привіт</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"text\"><field name=\"TEXT\">світ</field></shadow></value>\n</block>"
  },
  "text_indexOf": {
    "title": "Знайти",
    "kid": "Шукає підрядок у тексті.",
    "analogy": "Як слова в повідомленні: можна склеювати, різати, рахувати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"text_join\">\n  <mutation items=\"2\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"text\"><field name=\"TEXT\">Привіт</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"text\"><field name=\"TEXT\">світ</field></shadow></value>\n</block>"
  },
  "text_charAt": {
    "title": "Символ №",
    "kid": "Бере символ з тексту за номером.",
    "analogy": "Як слова в повідомленні: можна склеювати, різати, рахувати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"text_join\">\n  <mutation items=\"2\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"text\"><field name=\"TEXT\">Привіт</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"text\"><field name=\"TEXT\">світ</field></shadow></value>\n</block>"
  },
  "text_getSubstring": {
    "title": "Частина тексту",
    "kid": "Вирізає шматок тексту.",
    "analogy": "Як слова в повідомленні: можна склеювати, різати, рахувати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"text_join\">\n  <mutation items=\"2\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"text\"><field name=\"TEXT\">Привіт</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"text\"><field name=\"TEXT\">світ</field></shadow></value>\n</block>"
  },
  "text_changeCase": {
    "title": "Великі/малі",
    "kid": "Робить літери великими або малими.",
    "analogy": "Як слова в повідомленні: можна склеювати, різати, рахувати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"text_join\">\n  <mutation items=\"2\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"text\"><field name=\"TEXT\">Привіт</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"text\"><field name=\"TEXT\">світ</field></shadow></value>\n</block>"
  },
  "text_trim": {
    "title": "Обрізати пробіли",
    "kid": "Прибирає пробіли на краях.",
    "analogy": "Як слова в повідомленні: можна склеювати, різати, рахувати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"text_join\">\n  <mutation items=\"2\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"text\"><field name=\"TEXT\">Привіт</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"text\"><field name=\"TEXT\">світ</field></shadow></value>\n</block>"
  },
  "text_print": {
    "title": "Показати текст",
    "kid": "Виводить текст (лог/вікно).",
    "analogy": "Як слова в повідомленні: можна склеювати, різати, рахувати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"text_join\">\n  <mutation items=\"2\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"text\"><field name=\"TEXT\">Привіт</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"text\"><field name=\"TEXT\">світ</field></shadow></value>\n</block>"
  },
  "text_prompt_ext": {
    "title": "Запитати",
    "kid": "Питає користувача і читає відповідь.",
    "analogy": "Як слова в повідомленні: можна склеювати, різати, рахувати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"text_join\">\n  <mutation items=\"2\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"text\"><field name=\"TEXT\">Привіт</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"text\"><field name=\"TEXT\">світ</field></shadow></value>\n</block>"
  },
  "lists_create_empty": {
    "title": "Порожній список",
    "kid": "Створює список без елементів.",
    "analogy": "Як коробка з предметами: у списку є багато значень по порядку.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"lists_create_with\">\n  <mutation items=\"3\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"ADD2\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value>\n</block>"
  },
  "lists_create_with": {
    "title": "Список з елементів",
    "kid": "Створює список з кількох значень.",
    "analogy": "Як коробка з предметами: у списку є багато значень по порядку.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"lists_create_with\">\n  <mutation items=\"3\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"ADD2\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value>\n</block>"
  },
  "lists_repeat": {
    "title": "Повторити в списку",
    "kid": "Повторює значення N разів у списку.",
    "analogy": "Як коробка з предметами: у списку є багато значень по порядку.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"lists_create_with\">\n  <mutation items=\"3\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"ADD2\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value>\n</block>"
  },
  "lists_length": {
    "title": "Довжина списку",
    "kid": "Скільки елементів у списку.",
    "analogy": "Як коробка з предметами: у списку є багато значень по порядку.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"lists_create_with\">\n  <mutation items=\"3\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"ADD2\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value>\n</block>"
  },
  "lists_isEmpty": {
    "title": "Список порожній?",
    "kid": "Перевіряє, чи список пустий.",
    "analogy": "Як коробка з предметами: у списку є багато значень по порядку.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"lists_create_with\">\n  <mutation items=\"3\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"ADD2\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value>\n</block>"
  },
  "lists_indexOf": {
    "title": "Знайти в списку",
    "kid": "Шукає елемент у списку.",
    "analogy": "Як коробка з предметами: у списку є багато значень по порядку.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"lists_create_with\">\n  <mutation items=\"3\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"ADD2\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value>\n</block>"
  },
  "lists_getIndex": {
    "title": "Взяти елемент",
    "kid": "Бере/видаляє елемент зі списку.",
    "analogy": "Як коробка з предметами: у списку є багато значень по порядку.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"lists_create_with\">\n  <mutation items=\"3\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"ADD2\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value>\n</block>"
  },
  "lists_setIndex": {
    "title": "Змінити елемент",
    "kid": "Ставить нове значення в позицію.",
    "analogy": "Як коробка з предметами: у списку є багато значень по порядку.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"lists_create_with\">\n  <mutation items=\"3\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"ADD2\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value>\n</block>"
  },
  "lists_getSublist": {
    "title": "Частина списку",
    "kid": "Бере шматок списку.",
    "analogy": "Як коробка з предметами: у списку є багато значень по порядку.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"lists_create_with\">\n  <mutation items=\"3\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"ADD2\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value>\n</block>"
  },
  "lists_split": {
    "title": "Розбити/з’єднати",
    "kid": "Ділить текст у список або навпаки.",
    "analogy": "Як коробка з предметами: у списку є багато значень по порядку.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"lists_create_with\">\n  <mutation items=\"3\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"ADD2\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value>\n</block>"
  },
  "lists_sort": {
    "title": "Сортувати",
    "kid": "Сортує список.",
    "analogy": "Як коробка з предметами: у списку є багато значень по порядку.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"lists_create_with\">\n  <mutation items=\"3\"></mutation>\n  <value name=\"ADD0\"><shadow type=\"math_number\"><field name=\"NUM\">1</field></shadow></value>\n  <value name=\"ADD1\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"ADD2\"><shadow type=\"math_number\"><field name=\"NUM\">3</field></shadow></value>\n</block>"
  },
  "variables_get": {
    "title": "Змінна (прочитати)",
    "kid": "Бере значення зі змінної.",
    "analogy": "Змінна — як коробочка з підписом, де лежить число/текст.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"variables_set\">\n  <field name=\"VAR\">x</field>\n  <value name=\"VALUE\"><shadow type=\"math_number\"><field name=\"NUM\">10</field></shadow></value>\n</block>"
  },
  "variables_set": {
    "title": "Змінна (задати)",
    "kid": "Записує значення в змінну.",
    "analogy": "Змінна — як коробочка з підписом, де лежить число/текст.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"variables_set\">\n  <field name=\"VAR\">x</field>\n  <value name=\"VALUE\"><shadow type=\"math_number\"><field name=\"NUM\">10</field></shadow></value>\n</block>"
  },
  "math_change": {
    "title": "Змінити на",
    "kid": "Додає/віднімає число від змінної.",
    "analogy": "Як калькулятор: допомагає рахувати і порівнювати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"math_arithmetic\">\n  <field name=\"OP\">ADD</field>\n  <value name=\"A\"><shadow type=\"math_number\"><field name=\"NUM\">2</field></shadow></value>\n  <value name=\"B\"><shadow type=\"math_number\"><field name=\"NUM\">4</field></shadow></value>\n</block>"
  },
  "procedures_defnoreturn": {
    "title": "Створити команду",
    "kid": "Створює власний блок-команду.",
    "analogy": "Як власна команда: придумав назву — і можеш використовувати багато разів.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"procedures_defnoreturn\"></block>"
  },
  "procedures_defreturn": {
    "title": "Створити функцію",
    "kid": "Створює власний блок, який повертає значення.",
    "analogy": "Як власна команда: придумав назву — і можеш використовувати багато разів.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"procedures_defreturn\"></block>"
  },
  "procedures_callnoreturn": {
    "title": "Виклик команди",
    "kid": "Запускає власну команду.",
    "analogy": "Як власна команда: придумав назву — і можеш використовувати багато разів.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"procedures_callnoreturn\"></block>"
  },
  "procedures_callreturn": {
    "title": "Виклик функції",
    "kid": "Отримує значення з власної функції.",
    "analogy": "Як власна команда: придумав назву — і можеш використовувати багато разів.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"procedures_callreturn\"></block>"
  },
  "procedures_ifreturn": {
    "title": "Повернути якщо",
    "kid": "Повертає значення, якщо умова правда.",
    "analogy": "Як власна команда: придумав назву — і можеш використовувати багато разів.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"procedures_ifreturn\"></block>"
  },
  "start_hat": {
    "title": "Старт",
    "kid": "Це як кнопка «ПОЇХАЛИ». Все під ним починає виконуватись.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"start_hat\"></block>\n  </next>\n</block>"
  },
  "robot_move": {
    "title": "Рух L/R",
    "kid": "Керує лівим і правим мотором. Рівно — прямо, різно — поворот.",
    "analogy": "Як керувати машинкою: мотори — це ноги/колеса, датчики — очі.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"robot_move\"></block>\n  </next>\n</block>"
  },
  "robot_move_soft": {
    "title": "Плавний розгін",
    "kid": "Плавно доходить до швидкості за час.",
    "analogy": "Як керувати машинкою: мотори — це ноги/колеса, датчики — очі.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"robot_move_soft\"></block>\n  </next>\n</block>"
  },
  "robot_turn_timed": {
    "title": "Поворот на час",
    "kid": "Повертає вліво/вправо певну кількість секунд.",
    "analogy": "Як керувати машинкою: мотори — це ноги/колеса, датчики — очі.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"robot_turn_timed\"></block>\n  </next>\n</block>"
  },
  "robot_set_speed": {
    "title": "Ліміт швидкості",
    "kid": "Обмежує максимальну потужність.",
    "analogy": "Як керувати машинкою: мотори — це ноги/колеса, датчики — очі.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"robot_set_speed\"></block>\n  </next>\n</block>"
  },
  "robot_stop": {
    "title": "Стоп",
    "kid": "Зупиняє мотори.",
    "analogy": "Як керувати машинкою: мотори — це ноги/колеса, датчики — очі.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"robot_stop\"></block>\n  </next>\n</block>"
  },
  "move_4_motors": {
    "title": "4 мотори",
    "kid": "Керує кожним мотором окремо.",
    "analogy": "Як керувати машинкою: мотори — це ноги/колеса, датчики — очі.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"move_4_motors\"></block>\n  </next>\n</block>"
  },
  "motor_single": {
    "title": "Один мотор",
    "kid": "Вмикає один вибраний мотор.",
    "analogy": "Як керувати машинкою: мотори — це ноги/колеса, датчики — очі.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"motor_single\"></block>\n  </next>\n</block>"
  },
  "sensor_get": {
    "title": "Датчик",
    "kid": "Читає число з датчика.",
    "analogy": "Як керувати машинкою: мотори — це ноги/колеса, датчики — очі.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"sensor_get\"></block>\n  </next>\n</block>"
  },
  "wait_until_sensor": {
    "title": "Чекати датчик",
    "kid": "Чекає, поки датчик стане як треба.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"wait_until_sensor\"></block>\n  </next>\n</block>"
  },
  "wait_seconds": {
    "title": "Чекати секунди",
    "kid": "Пауза на час.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"wait_seconds\"></block>\n  </next>\n</block>"
  },
  "timer_get": {
    "title": "Таймер",
    "kid": "Показує, скільки часу пройшло.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"timer_get\"></block>\n  </next>\n</block>"
  },
  "timer_reset": {
    "title": "Таймер reset",
    "kid": "Обнуляє таймер.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"timer_reset\"></block>\n  </next>\n</block>"
  },
  "logic_edge_detect": {
    "title": "Край сигналу",
    "kid": "Ловить момент зміни 0↔1.",
    "analogy": "Як правило: «якщо ... то ...». Це допомагає приймати рішення.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"logic_edge_detect\"></block>\n  </next>\n</block>"
  },
  "logic_schmitt": {
    "title": "Фільтр шуму",
    "kid": "Робить рішення стабільним, коли значення стрибає.",
    "analogy": "Як правило: «якщо ... то ...». Це допомагає приймати рішення.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"logic_schmitt\"></block>\n  </next>\n</block>"
  },
  "math_pid": {
    "title": "PID",
    "kid": "Розумно підправляє керування, щоб їхати рівно.",
    "analogy": "Як калькулятор: допомагає рахувати і порівнювати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"math_pid\"></block>\n  </next>\n</block>"
  },
  "math_smooth": {
    "title": "Згладити",
    "kid": "Прибирає різкі стрибки числа.",
    "analogy": "Як калькулятор: допомагає рахувати і порівнювати.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"math_smooth\"></block>\n  </next>\n</block>"
  },
  "record_start": {
    "title": "Запис",
    "kid": "Запам’ятовує твоє керування, щоб потім повторити.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"record_start\"></block>\n  </next>\n</block>"
  },
  "replay_track": {
    "title": "Відтворити",
    "kid": "Повторює записане керування.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"replay_track\"></block>\n  </next>\n</block>"
  },
  "replay_loop": {
    "title": "Повторити N",
    "kid": "Відтворює запис кілька разів.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"replay_loop\"></block>\n  </next>\n</block>"
  },
  "count_laps": {
    "title": "Кола",
    "kid": "Рахує кола/повтори маршруту.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"count_laps\"></block>\n  </next>\n</block>"
  },
  "wait_start": {
    "title": "Чекати старт-лінію",
    "kid": "Чекає, поки датчик побачить старт.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"wait_start\"></block>\n  </next>\n</block>"
  },
  "stop_at_start": {
    "title": "Стоп на старті",
    "kid": "Зупиняє робота на стартовій лінії.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"stop_at_start\"></block>\n  </next>\n</block>"
  },
  "go_home": {
    "title": "Go Home",
    "kid": "Скидає стан/повертає у базу.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"go_home\"></block>\n  </next>\n</block>"
  },
  "spider_center": {
    "title": "Павук: центр",
    "kid": "Ставить лапи в базове рівне положення.",
    "analogy": "Як керувати іграшкою-павуком: команди руху і налаштування.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"spider_center\"></block>\n  </next>\n</block>"
  },
  "spider_step": {
    "title": "Павук: крок",
    "kid": "Робить один крок.",
    "analogy": "Як керувати іграшкою-павуком: команди руху і налаштування.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"spider_step\"></block>\n  </next>\n</block>"
  },
  "spider_walk_while": {
    "title": "Павук: йти поки",
    "kid": "Йде, поки умова правда.",
    "analogy": "Як керувати іграшкою-павуком: команди руху і налаштування.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"spider_walk_while\"></block>\n  </next>\n</block>"
  },
  "spider_walk_time": {
    "title": "Павук: йти час",
    "kid": "Йде певний час.",
    "analogy": "Як керувати іграшкою-павуком: команди руху і налаштування.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"spider_walk_time\"></block>\n  </next>\n</block>"
  },
  "spider_turn_smooth": {
    "title": "Павук: поворот",
    "kid": "Плавно повертає на кут.",
    "analogy": "Як керувати іграшкою-павуком: команди руху і налаштування.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"spider_turn_smooth\"></block>\n  </next>\n</block>"
  },
  "spider_leg_control": {
    "title": "Павук: лапа",
    "kid": "Керує однією лапою (кут).",
    "analogy": "Як керувати іграшкою-павуком: команди руху і налаштування.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"spider_leg_control\"></block>\n  </next>\n</block>"
  },
  "spider_config": {
    "title": "Павук: конфіг",
    "kid": "Налаштовує висоту/швидкість.",
    "analogy": "Як керувати іграшкою-павуком: команди руху і налаштування.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"spider_config\"></block>\n  </next>\n</block>"
  },
  "spider_anim": {
    "title": "Павук: анімація",
    "kid": "Запускає анімацію.",
    "analogy": "Як керувати іграшкою-павуком: команди руху і налаштування.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"spider_anim\"></block>\n  </next>\n</block>"
  },
  "spider_joystick_ctrl": {
    "title": "Павук: джойстик",
    "kid": "Керування джойстиком.",
    "analogy": "Як керувати іграшкою-павуком: команди руху і налаштування.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"spider_joystick_ctrl\"></block>\n  </next>\n</block>"
  },
  "spider_stop": {
    "title": "Павук: стоп",
    "kid": "Зупиняє павука.",
    "analogy": "Як керувати іграшкою-павуком: команди руху і налаштування.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"start_hat\">\n  <next>\n    <block type=\"spider_stop\"></block>\n  </next>\n</block>"
  },
  "custom_block_1": {
    "title": "Користувацький блок 1",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_1\"></block>"
  },
  "custom_block_2": {
    "title": "Користувацький блок 2",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_2\"></block>"
  },
  "custom_block_3": {
    "title": "Користувацький блок 3",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_3\"></block>"
  },
  "custom_block_4": {
    "title": "Користувацький блок 4",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_4\"></block>"
  },
  "custom_block_5": {
    "title": "Користувацький блок 5",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_5\"></block>"
  },
  "custom_block_6": {
    "title": "Користувацький блок 6",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_6\"></block>"
  },
  "custom_block_7": {
    "title": "Користувацький блок 7",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_7\"></block>"
  },
  "custom_block_8": {
    "title": "Користувацький блок 8",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_8\"></block>"
  },
  "custom_block_9": {
    "title": "Користувацький блок 9",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_9\"></block>"
  },
  "custom_block_10": {
    "title": "Користувацький блок 10",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_10\"></block>"
  },
  "custom_block_11": {
    "title": "Користувацький блок 11",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_11\"></block>"
  },
  "custom_block_12": {
    "title": "Користувацький блок 12",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_12\"></block>"
  },
  "custom_block_13": {
    "title": "Користувацький блок 13",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_13\"></block>"
  },
  "custom_block_14": {
    "title": "Користувацький блок 14",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_14\"></block>"
  },
  "custom_block_15": {
    "title": "Користувацький блок 15",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_15\"></block>"
  },
  "custom_block_16": {
    "title": "Користувацький блок 16",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_16\"></block>"
  },
  "custom_block_17": {
    "title": "Користувацький блок 17",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_17\"></block>"
  },
  "custom_block_18": {
    "title": "Користувацький блок 18",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_18\"></block>"
  },
  "custom_block_19": {
    "title": "Користувацький блок 19",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_19\"></block>"
  },
  "custom_block_20": {
    "title": "Користувацький блок 20",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_20\"></block>"
  },
  "custom_block_21": {
    "title": "Користувацький блок 21",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_21\"></block>"
  },
  "custom_block_22": {
    "title": "Користувацький блок 22",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_22\"></block>"
  },
  "custom_block_23": {
    "title": "Користувацький блок 23",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_23\"></block>"
  },
  "custom_block_24": {
    "title": "Користувацький блок 24",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_24\"></block>"
  },
  "custom_block_25": {
    "title": "Користувацький блок 25",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_25\"></block>"
  },
  "custom_block_26": {
    "title": "Користувацький блок 26",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_26\"></block>"
  },
  "custom_block_27": {
    "title": "Користувацький блок 27",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_27\"></block>"
  },
  "custom_block_28": {
    "title": "Користувацький блок 28",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_28\"></block>"
  },
  "custom_block_29": {
    "title": "Користувацький блок 29",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_29\"></block>"
  },
  "custom_block_30": {
    "title": "Користувацький блок 30",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_30\"></block>"
  },
  "custom_block_31": {
    "title": "Користувацький блок 31",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_31\"></block>"
  },
  "custom_block_32": {
    "title": "Користувацький блок 32",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_32\"></block>"
  },
  "custom_block_33": {
    "title": "Користувацький блок 33",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_33\"></block>"
  },
  "custom_block_34": {
    "title": "Користувацький блок 34",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_34\"></block>"
  },
  "custom_block_35": {
    "title": "Користувацький блок 35",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_35\"></block>"
  },
  "custom_block_36": {
    "title": "Користувацький блок 36",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_36\"></block>"
  },
  "custom_block_37": {
    "title": "Користувацький блок 37",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_37\"></block>"
  },
  "custom_block_38": {
    "title": "Користувацький блок 38",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_38\"></block>"
  },
  "custom_block_39": {
    "title": "Користувацький блок 39",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_39\"></block>"
  },
  "custom_block_40": {
    "title": "Користувацький блок 40",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_40\"></block>"
  },
  "custom_block_41": {
    "title": "Користувацький блок 41",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_41\"></block>"
  },
  "custom_block_42": {
    "title": "Користувацький блок 42",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_42\"></block>"
  },
  "custom_block_43": {
    "title": "Користувацький блок 43",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_43\"></block>"
  },
  "custom_block_44": {
    "title": "Користувацький блок 44",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_44\"></block>"
  },
  "custom_block_45": {
    "title": "Користувацький блок 45",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_45\"></block>"
  },
  "custom_block_46": {
    "title": "Користувацький блок 46",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_46\"></block>"
  },
  "custom_block_47": {
    "title": "Користувацький блок 47",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_47\"></block>"
  },
  "custom_block_48": {
    "title": "Користувацький блок 48",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_48\"></block>"
  },
  "custom_block_49": {
    "title": "Користувацький блок 49",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_49\"></block>"
  },
  "custom_block_50": {
    "title": "Користувацький блок 50",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_50\"></block>"
  },
  "custom_block_51": {
    "title": "Користувацький блок 51",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_51\"></block>"
  },
  "custom_block_52": {
    "title": "Користувацький блок 52",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_52\"></block>"
  },
  "custom_block_53": {
    "title": "Користувацький блок 53",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_53\"></block>"
  },
  "custom_block_54": {
    "title": "Користувацький блок 54",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_54\"></block>"
  },
  "custom_block_55": {
    "title": "Користувацький блок 55",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_55\"></block>"
  },
  "custom_block_56": {
    "title": "Користувацький блок 56",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_56\"></block>"
  },
  "custom_block_57": {
    "title": "Користувацький блок 57",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_57\"></block>"
  },
  "custom_block_58": {
    "title": "Користувацький блок 58",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_58\"></block>"
  },
  "custom_block_59": {
    "title": "Користувацький блок 59",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_59\"></block>"
  },
  "custom_block_60": {
    "title": "Користувацький блок 60",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_60\"></block>"
  },
  "custom_block_61": {
    "title": "Користувацький блок 61",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_61\"></block>"
  },
  "custom_block_62": {
    "title": "Користувацький блок 62",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_62\"></block>"
  },
  "custom_block_63": {
    "title": "Користувацький блок 63",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_63\"></block>"
  },
  "custom_block_64": {
    "title": "Користувацький блок 64",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_64\"></block>"
  },
  "custom_block_65": {
    "title": "Користувацький блок 65",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_65\"></block>"
  },
  "custom_block_66": {
    "title": "Користувацький блок 66",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_66\"></block>"
  },
  "custom_block_67": {
    "title": "Користувацький блок 67",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_67\"></block>"
  },
  "custom_block_68": {
    "title": "Користувацький блок 68",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_68\"></block>"
  },
  "custom_block_69": {
    "title": "Користувацький блок 69",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_69\"></block>"
  },
  "custom_block_70": {
    "title": "Користувацький блок 70",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_70\"></block>"
  },
  "custom_block_71": {
    "title": "Користувацький блок 71",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_71\"></block>"
  },
  "custom_block_72": {
    "title": "Користувацький блок 72",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_72\"></block>"
  },
  "custom_block_73": {
    "title": "Користувацький блок 73",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_73\"></block>"
  },
  "custom_block_74": {
    "title": "Користувацький блок 74",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_74\"></block>"
  },
  "custom_block_75": {
    "title": "Користувацький блок 75",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_75\"></block>"
  },
  "custom_block_76": {
    "title": "Користувацький блок 76",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_76\"></block>"
  },
  "custom_block_77": {
    "title": "Користувацький блок 77",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_77\"></block>"
  },
  "custom_block_78": {
    "title": "Користувацький блок 78",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_78\"></block>"
  },
  "custom_block_79": {
    "title": "Користувацький блок 79",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_79\"></block>"
  },
  "custom_block_80": {
    "title": "Користувацький блок 80",
    "kid": "Це ваш власний блок. Він робить дію, яку ви для нього придумали.",
    "analogy": "Уяви, що програма — це рецепт. Цей блок — один крок рецепта.",
    "steps": [
      "1) Постав блок у програму.",
      "2) З’єднай з іншими блоками зверху/знизу.",
      "3) Запусти і подивись, що змінилось."
    ],
    "example": "Це маленький приклад ідеї. Спробуй змінити числа або умову і подивись результат.",
    "example_xml": "<block type=\"custom_block_80\"></block>"
  }
};

  function getHelp(block) {
    const type = block?.type || "";
    let info = HELP[type];

    // Fallback if unknown
    if (!info) {
      const tooltip = (typeof block.getTooltip === "function") ? block.getTooltip() : "";
      info = {
        title: "Блок: " + safeStr(type || "невідомий"),
        kid: tooltip ? ("Простими словами: " + tooltip) : "Це блок програми. Він робить одну дію, коли до нього доходить черга.",
        analogy: "Уяви, що програма — це інструкція. Цей блок — один крок інструкції.",
        steps: [
          "1) Постав блок у програму.",
          "2) З’єднай з іншими блоками.",
          "3) Запусти і подивись результат."
        ],
        example: "Спробуй змінити числа/умову і перевірити ще раз.",
        example_xml: `<block type="${safeStr(type)}"></block>`
      };
    }

    // Block preview XML: try to serialize the actual block (keeps current fields)
    let block_xml = "";
    try {
      if (Blockly?.Xml?.blockToDom) {
        const dom = Blockly.Xml.blockToDom(block, true);
        dom.removeAttribute("id");
        dom.removeAttribute("x");
        dom.removeAttribute("y");
        block_xml = new XMLSerializer().serializeToString(dom);
      }
    } catch (_) {}

    if (!block_xml) block_xml = `<block type="${safeStr(type)}"></block>`;

    return {
      type,
      title: info.title || ("Блок: " + safeStr(type)),
      kid: info.kid || "—",
      analogy: info.analogy || "—",
      steps: Array.isArray(info.steps) ? info.steps : [],
      example: info.example || "—",
      block_xml,
      example_xml: info.example_xml || block_xml
    };
  }

  // ---------------------------
  // 2) UI
  // ---------------------------
  let uiReady = false;
  let panel, panelTitle, panelKid, panelAnalogy, panelSteps, panelExample;
  let miniBlockDiv, miniExampleDiv;
  let tabBlockBtn, tabExampleBtn;
  let miniBlockWs = null, miniExampleWs = null;
  let currentBlock = null;

  function ensureUI() {
    if (uiReady) return;

    const style = el("style", {}, [`
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

      .rc-help-backdrop{
        position: fixed;
        inset: 0;
        background: rgba(0,0,0,0.45);
        z-index: 9999;
        display: none;
      }

      .rc-help-panel{
        position: fixed;
        left: 50%;
        top: 50%;
        transform: translate(-50%, -50%);
        width: min(520px, 92vw);
        max-height: 86vh;
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
      .rc-help-panel header .t{ display:flex; flex-direction:column; gap:2px; }
      .rc-help-panel header .t .h{ font-size: 14px; font-weight: 900; color: #e2e8f0; letter-spacing: 0.02em; }
      .rc-help-panel header .t .s{ font-size: 10px; color: #94a3b8; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; }
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

      .rc-help-tabs{
        display:flex;
        gap: 8px;
        margin-bottom: 10px;
      }
      .rc-help-tab{
        flex: 1;
        padding: 8px 10px;
        border-radius: 12px;
        border: 1px solid rgba(148,163,184,0.2);
        background: rgba(30,41,59,0.55);
        color: #e2e8f0;
        font-weight: 900;
        font-size: 12px;
        cursor: pointer;
      }
      .rc-help-tab.active{
        background: rgba(59,130,246,0.85);
        color: #0b1220;
      }

      .rc-help-mini{
        height: 150px;
        width: 100%;
        border-radius: 12px;
        overflow: hidden;
        border: 1px solid rgba(148,163,184,0.18);
        background: rgba(15,23,42,0.6);
      }
      .rc-help-mini.small{ height: 130px; }

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
        background: rgba(30,41,59,0.7);
        color: #e2e8f0;
      }
    
      /* Make preview workspaces blend with dark UI */
      .rc-help-panel .blocklySvg { background: transparent !important; }
      .rc-help-panel .blocklyMainBackground { fill: transparent !important; }
      .rc-help-panel .blocklyFlyoutBackground { fill: rgba(15,23,42,0.35) !important; }

    `]);
    document.head.appendChild(style);

    panelTitle = el("div", { class: "h" }, ["Підказка"]);
    const sub = null;
    const titleWrap = el("div", { class: "t" }, [panelTitle]);

    const closeBtn = el("button", { title: "Закрити" }, ["✕"]);
    closeBtn.addEventListener("click", () => closeHelp());

    const header = el("header", {}, [titleWrap, closeBtn]);

    tabBlockBtn = el("button", { class: "rc-help-tab active", type: "button" }, ["Блок"]);
    tabExampleBtn = el("button", { class: "rc-help-tab", type: "button" }, ["Приклад"]);
    const tabs = el("div", { class: "rc-help-tabs" }, [tabBlockBtn, tabExampleBtn]);

    miniBlockDiv = el("div", { class: "rc-help-mini small", id: "rcMiniBlock" });
    miniExampleDiv = el("div", { class: "rc-help-mini", id: "rcMiniExample", style: { display: "none" } });

    tabBlockBtn.addEventListener("click", () => {
      tabBlockBtn.classList.add("active");
      tabExampleBtn.classList.remove("active");
      miniBlockDiv.style.display = "block";
      miniExampleDiv.style.display = "none";
      setTimeout(() => { try { if (miniBlockWs && Blockly.svgResize) Blockly.svgResize(miniBlockWs); } catch(_) {} }, 0);
    });
    tabExampleBtn.addEventListener("click", () => {
      tabExampleBtn.classList.add("active");
      tabBlockBtn.classList.remove("active");
      miniBlockDiv.style.display = "none";
      miniExampleDiv.style.display = "block";
      setTimeout(() => { try { if (miniExampleWs && Blockly.svgResize) Blockly.svgResize(miniExampleWs); } catch(_) {} }, 0);
    });

    const previewCard = el("div", { class: "rc-help-card" }, [
      el("div", { class: "label" }, ["Як виглядає"]),
      tabs,
      miniBlockDiv,
      miniExampleDiv
    ]);

    panelKid = el("div", { class: "text" }, ["—"]);
    panelAnalogy = el("div", { class: "text" }, ["—"]);
    panelExample = el("div", { class: "text" }, ["—"]);
    panelSteps = el("ul", { class: "rc-help-steps" });

    const card1 = el("div", { class: "rc-help-card" }, [el("div", { class: "label" }, ["Що робить"]), panelKid]);
    const card2 = el("div", { class: "rc-help-card" }, [el("div", { class: "label" }, ["Аналогія"]), panelAnalogy]);
    const card3 = el("div", { class: "rc-help-card" }, [el("div", { class: "label" }, ["Кроки"]), panelSteps]);
    const card4 = el("div", { class: "rc-help-card" }, [el("div", { class: "label" }, ["Приклад словами"]), panelExample]);

    const body = el("div", { class: "rc-help-body" }, [previewCard, card1, card2, card3, card4]);

    const closeBtn2 = el("button", {}, ["Закрити"]);
    closeBtn2.addEventListener("click", () => closeHelp());

    const actions = el("div", { class: "rc-help-actions" }, [closeBtn2]);

    panel = el("div", { class: "rc-help-panel" }, [header, body, actions]);
    document.body.appendChild(panel);

    const backdrop = el("div", { class: "rc-help-backdrop", id: "rcHelpBackdrop" });
    backdrop.addEventListener("click", () => closeHelp());
    document.body.appendChild(backdrop);

    const fab = el("div", { class: "rc-help-fab", id: "rcHelpFab", title: "Пояснення" }, ["?"]);
    fab.addEventListener("click", () => {
      if (currentBlock) openHelp(currentBlock);
    });
    document.body.appendChild(fab);

    uiReady = true;
  }

  function closeHelp() {
    ensureUI();
    panel.style.display = "none";
    const bd = document.getElementById("rcHelpBackdrop");
    if (bd) bd.style.display = "none";
  }

  // ---------------------------
  // 3) Mini workspaces
  // ---------------------------
  function ensureMiniBlockWs() {
    if (miniBlockWs) return miniBlockWs;
    miniBlockWs = Blockly.inject(miniBlockDiv, {
      readOnly: true,
      scrollbars: false,
      sounds: false,
      trashcan: false,
      renderer: "zelos",
      zoom: { controls: false, wheel: false, startScale: 0.9, maxScale: 2, minScale: 0.5 },
      move: { scrollbars: false, drag: false, wheel: false },
      toolbox: null
    });
    return miniBlockWs;
  }

  function ensureMiniExampleWs() {
    if (miniExampleWs) return miniExampleWs;
    miniExampleWs = Blockly.inject(miniExampleDiv, {
      readOnly: true,
      scrollbars: false,
      sounds: false,
      trashcan: false,
      renderer: "zelos",
      zoom: { controls: false, wheel: false, startScale: 0.9, maxScale: 2, minScale: 0.5 },
      move: { scrollbars: false, drag: false, wheel: false },
      toolbox: null
    });
    return miniExampleWs;
  }

  function renderWs(ws, xmlFragment) {
    try {
      ws.clear();
      const xmlText = `<xml xmlns="https://developers.google.com/blockly/xml">${xmlFragment}</xml>`;
      const xmlDoc = new DOMParser().parseFromString(xmlText, "text/xml");
      Blockly.Xml.domToWorkspace(xmlDoc.documentElement, ws);

      // Resize SVG to current div size
      if (Blockly.svgResize) Blockly.svgResize(ws);

      // Center the top-most block
      const tops = ws.getTopBlocks(false);
      if (tops && tops.length) {
        const b = tops[0];
        const hw = b.getHeightWidth ? b.getHeightWidth() : { height: 0, width: 0 };
        const metrics = ws.getMetrics ? ws.getMetrics() : null;
        if (metrics) {
          const scale = ws.scale || 1;
          const targetX = (metrics.viewWidth / 2 - hw.width / 2) / scale;
          const targetY = (metrics.viewHeight / 2 - hw.height / 2) / scale;
          // Move relative from current position
          const xy = b.getRelativeToSurfaceXY ? b.getRelativeToSurfaceXY() : { x: 0, y: 0 };
          b.moveBy(targetX - xy.x, targetY - xy.y);
        } else {
          b.moveBy(12, 12);
        }
      }
      ws.resizeContents();
    } catch (_) {}
  }

  // ---------------------------
  // 4) Open help
  // ---------------------------
  function openHelp(block) {
    ensureUI();
    currentBlock = block;

    const info = getHelp(block);
    panelTitle.textContent = info.title;

    panelKid.textContent = info.kid;
    panelAnalogy.textContent = info.analogy;
    panelExample.textContent = info.example;

    panelSteps.innerHTML = "";
    const steps = info.steps.length ? info.steps : ["Спробуй змінити числа/умову і перевірити результат."];
    steps.forEach(s => panelSteps.appendChild(el("li", {}, [safeStr(s)])));

    const wsBlock = ensureMiniBlockWs();
    const wsExample = ensureMiniExampleWs();
    renderWs(wsBlock, info.block_xml);
    renderWs(wsExample, info.example_xml);

    panel.style.display = "block";
    const bd = document.getElementById("rcHelpBackdrop");
    if (bd) bd.style.display = "block";

    // Ensure previews render correctly (workspaces need a visible size)
    setTimeout(() => {
      try { if (window.Blockly && window.Blockly.svgResize) {
        if (miniBlockWs) Blockly.svgResize(miniBlockWs);
        if (miniExampleWs) Blockly.svgResize(miniExampleWs);
      }} catch (_) {}
    }, 0);
  }

  // ---------------------------
  // 5) Phone (B): long-press -> show (?) near block
  // ---------------------------
  let pressTimer = null;
  let pressBlockId = null;
  let moved = false;

  function getFab() {
    ensureUI();
    return $("#rcHelpFab");
  }

  function hideFab() {
    const fab = getFab();
    fab.style.display = "none";
  }

  function findBlockIdFromEventTarget(ev) {
    let n = ev.target;
    for (let i = 0; i < 14 && n; i++) {
      if (n.getAttribute && n.getAttribute("data-id")) return n.getAttribute("data-id");
      n = n.parentNode;
    }
    return null;
  }

  function showFabNearBlock(block) {
    const fab = getFab();
    const svgRoot = block.getSvgRoot && block.getSvgRoot();
    const div = $("#blocklyDiv") || document.body;
    if (!svgRoot) return;

    const rBlock = svgRoot.getBoundingClientRect();
    const left = rBlock.right + 8;
    const top = rBlock.top + (rBlock.height / 2) - 19;

    const maxLeft = window.innerWidth - 44;
    const maxTop = window.innerHeight - 44;

    fab.style.left = clamp(left, 8, maxLeft) + "px";
    fab.style.top = clamp(top, 70, maxTop) + "px";
    fab.style.display = "flex";
  }

  function attachMobileLongPress(ws) {
    const div = $("#blocklyDiv");
    if (!div || div.__rcHelpMobileAttached) return;
    div.__rcHelpMobileAttached = true;

    div.addEventListener("pointerdown", (ev) => {
      if (!isMobileLayout()) return;
      moved = false;
      pressBlockId = findBlockIdFromEventTarget(ev);
      if (!pressBlockId) return;
      clearTimeout(pressTimer);
      pressTimer = setTimeout(() => {
        if (moved) return;
        const b = ws.getBlockById(pressBlockId);
        if (!b) return;
        currentBlock = b;
        showFabNearBlock(b);
      }, 380);
    }, { passive: true });

    div.addEventListener("pointermove", () => {
      moved = true;
      clearTimeout(pressTimer);
    }, { passive: true });

    div.addEventListener("pointerup", () => {
      clearTimeout(pressTimer);
    }, { passive: true });

    document.addEventListener("pointerdown", (ev) => {
      const fab = getFab();
      if (fab.style.display === "flex") {
        if (ev.target === fab || fab.contains(ev.target)) return;
        const bid = findBlockIdFromEventTarget(ev);
        if (!bid) hideFab();
      }
    }, { passive: true });
  }

  // ---------------------------
  // 6) Desktop (C): context menu item
  // ---------------------------
  let patchedContext = false;
  function patchContextMenuOnce() {
    if (patchedContext) return;
    patchedContext = true;

    const proto = Blockly?.BlockSvg?.prototype;
    if (!proto) return;

    const old = proto.customContextMenu;
    proto.customContextMenu = function (options) {
      try { if (typeof old === "function") old.call(this, options); } catch (_) {}
      if (!isDesktopLayout()) return;

      const block = this;
      options.push({
        text: "❓ Пояснення (для дітей)",
        enabled: true,
        callback: function () { openHelp(block); }
      });
    };
  }

  // ---------------------------
  // 7) Attach to main workspace
  // ---------------------------
  let lastWs = null;
  function getMainWorkspace() {
    return window.workspace || (Blockly?.getMainWorkspace && Blockly.getMainWorkspace());
  }

  function attach(ws) {
    if (!ws || ws === lastWs) return;
    lastWs = ws;

    ensureUI();
    patchContextMenuOnce();
    attachMobileLongPress(ws);

    // Put short kid tooltip on every block (helpful even without panel)
    ws.addChangeListener((e) => {
      try {
        if (e.type === Blockly.Events.BLOCK_CREATE || e.type === Blockly.Events.BLOCK_CHANGE) {
          const b = ws.getBlockById(e.blockId);
          if (!b) return;
          const info = getHelp(b);
          if (typeof b.setTooltip === "function") b.setTooltip(info.kid || info.title);
        }
        if (e.type === Blockly.Events.SELECTED && e.newElementId) {
          const b = ws.getBlockById(e.newElementId);
          if (b) currentBlock = b;
        }
      } catch (_) {}
    });
  }

  function boot() {
    if (!window.Blockly) return;
    ensureUI();
    setInterval(() => {
      const ws = getMainWorkspace();
      if (ws) attach(ws);
    }, 300);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

})();
