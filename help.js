/*!
 * help.js — Text-only help (fast, no lag)
 * - No previews, no intervals, no heavy workspace listeners
 * - Mobile: long-press block -> small menu -> "Пояснення"
 * - Desktop: block context menu item -> "❓ Пояснення"
 *
 * Install:
 *   <script src="help.js"></script>
 */
(function() {
  "use strict";

  const HELP_DB = {
  "start_hat": {
    "title": "Старт",
    "does": "Початок сценарію. Блоки під ним виконуються після запуску.",
    "fields": [],
    "how": [
      "Ставиться один раз зверху програми.",
      "Під’єднуй під нього інші блоки послідовно."
    ],
    "idea": "Старт → їхати → якщо умова → стоп."
  },
  "robot_move": {
    "title": "Рух (L / R)",
    "does": "Керує лівою і правою стороною приводу. Однаково — прямо, різні — поворот.",
    "fields": [
      {
        "name": "L",
        "meaning": "швидкість лівої сторони/мотора",
        "range": "-100…100"
      },
      {
        "name": "R",
        "meaning": "швидкість правої сторони/мотора",
        "range": "-100…100"
      }
    ],
    "how": [
      "L=80, R=80 → прямо вперед.",
      "L=-60, R=-60 → назад.",
      "L=80, R=30 → плавний поворот вправо."
    ],
    "idea": "Їхати прямо і трохи підрулювати різницею між L і R."
  },
  "robot_move_soft": {
    "title": "Плавно до швидкості",
    "does": "Плавно змінює швидкість до TARGET за SEC секунд (без ривків).",
    "fields": [
      {
        "name": "TARGET",
        "meaning": "цільова швидкість",
        "range": "-100…100"
      },
      {
        "name": "SEC",
        "meaning": "час розгону/гальмування",
        "range": "0.1…5+ сек"
      }
    ],
    "how": [
      "Більше SEC = плавніше, але повільніше реакція.",
      "Корисно для старту/зупинки і стабільності."
    ],
    "idea": "Плавно розігнатись до 80 за 1.5с, потім плавно зупинитись."
  },
  "robot_turn_timed": {
    "title": "Поворот на час",
    "does": "Повертає LEFT/RIGHT протягом SEC секунд.",
    "fields": [
      {
        "name": "DIR",
        "meaning": "напрям (LEFT/RIGHT)",
        "range": "список"
      },
      {
        "name": "SEC",
        "meaning": "час повороту",
        "range": "0.1…3+ сек"
      }
    ],
    "how": [
      "Малі значення (0.2–0.6с) — легка корекція.",
      "Після повороту часто додають рух прямо."
    ],
    "idea": "Їхати → повернути RIGHT 0.4с → їхати далі."
  },
  "robot_set_speed": {
    "title": "Ліміт швидкості",
    "does": "Обмежує максимальну швидкість/потужність, щоб керування було спокійніше.",
    "fields": [
      {
        "name": "SPEED",
        "meaning": "ліміт (відсоток)",
        "range": "0…100"
      }
    ],
    "how": [
      "Якщо керування занадто різке — зменш ліміт до 30–60.",
      "Для швидкого режиму — 80–100."
    ],
    "idea": "Постав ліміт 50% перед тренуванням."
  },
  "robot_stop": {
    "title": "Стоп",
    "does": "Зупиняє мотори (швидкість стає 0).",
    "fields": [],
    "how": [
      "Став у кінці руху або як аварійне гальмо в if."
    ],
    "idea": "Якщо датчик < 15 → стоп."
  },
  "move_4_motors": {
    "title": "4 мотори (M1–M4)",
    "does": "Керує кожним мотором окремо (4WD/спец шасі).",
    "fields": [
      {
        "name": "M1",
        "meaning": "швидкість мотора 1",
        "range": "-100…100"
      },
      {
        "name": "M2",
        "meaning": "швидкість мотора 2",
        "range": "-100…100"
      },
      {
        "name": "M3",
        "meaning": "швидкість мотора 3",
        "range": "-100…100"
      },
      {
        "name": "M4",
        "meaning": "швидкість мотора 4",
        "range": "-100…100"
      }
    ],
    "how": [
      "Щоб їхати прямо: всі M однакові.",
      "Для повороту: внутрішні колеса повільніше (або зовнішні швидше)."
    ],
    "idea": "У повороті зменшити швидкість лівих або правих коліс."
  },
  "motor_single": {
    "title": "Один мотор",
    "does": "Керує одним вибраним мотором — зручно для тесту підключення.",
    "fields": [
      {
        "name": "MOTOR",
        "meaning": "який мотор",
        "range": "список"
      },
      {
        "name": "SPEED",
        "meaning": "швидкість",
        "range": "-100…100"
      }
    ],
    "how": [
      "Перевіряй напрям обертання кожного мотора по черзі.",
      "Якщо крутиться не туди — інверсія/дроти."
    ],
    "idea": "Протестувати M1..M4 на 30% і перевірити напрям."
  },
  "sensor_get": {
    "title": "Датчик (значення)",
    "does": "Читає число з датчика на PORT. Значення можна порівнювати/фільтрувати/записувати.",
    "fields": [
      {
        "name": "PORT",
        "meaning": "порт/канал датчика",
        "range": "1…4 або список"
      }
    ],
    "how": [
      "Використовуй у порівнянні: (датчик < 20).",
      "Або запиши в змінну і використовуй кілька разів."
    ],
    "idea": "Якщо відстань менша за поріг — зупинка або від’їзд назад."
  },
  "wait_until_sensor": {
    "title": "Чекати, поки датчик…",
    "does": "Зупиняє виконання, доки умова по датчику не стане істинною.",
    "fields": [
      {
        "name": "SENS",
        "meaning": "порт датчика",
        "range": "1…4"
      },
      {
        "name": "OP",
        "meaning": "оператор (<, >, =)",
        "range": "список"
      },
      {
        "name": "VAL",
        "meaning": "поріг",
        "range": "число"
      }
    ],
    "how": [
      "Добре для: чекати старт/чекати перешкоду/чекати кнопку.",
      "Якщо покази шумлять — додай згладження або гістерезис."
    ],
    "idea": "Чекати поки distance < 25 → стоп."
  },
  "wait_seconds": {
    "title": "Чекати (секунди)",
    "does": "Пауза на вказаний час; після паузи програма йде далі.",
    "fields": [
      {
        "name": "SECONDS",
        "meaning": "час паузи",
        "range": "0…будь-яке"
      }
    ],
    "how": [
      "У циклах роби маленькі паузи (0.02–0.1), щоб не навантажувати систему.",
      "У сценаріях 1–5 секунд для демонстрацій."
    ],
    "idea": "Їхати 1 сек → чекати 0.2 → повернути → їхати 1 сек."
  },
  "timer_reset": {
    "title": "Таймер: скинути",
    "does": "Обнуляє таймер (час стає 0).",
    "fields": [],
    "how": [
      "Став там, де хочеш почати відлік."
    ],
    "idea": "Скинути → їхати → якщо таймер > 3 → стоп."
  },
  "timer_get": {
    "title": "Таймер: значення",
    "does": "Повертає, скільки секунд пройшло після останнього скидання.",
    "fields": [],
    "how": [
      "Використовуй у if / while для обмеження часу дії."
    ],
    "idea": "Якщо таймер > 5 → зупинити рух."
  },
  "wait_start": {
    "title": "Чекати старт-лінію",
    "does": "Чекає сигнал старту (наприклад чорна лінія/мітка) перед початком дії.",
    "fields": [],
    "how": [
      "Став на початку сценарію, щоб запуск був у правильному місці."
    ],
    "idea": "Чекати старт → стартувати рух."
  },
  "stop_at_start": {
    "title": "Стоп на старті",
    "does": "Зупиняє рух тоді, коли знову знайдено стартову мітку/лінію.",
    "fields": [],
    "how": [
      "Корисно для заїздів по колу: старт → кілька кіл → зупинитись на старті."
    ],
    "idea": "Запустити → проїхати кола → стоп на старті."
  },
  "count_laps": {
    "title": "Лічильник кіл",
    "does": "Рахує перетини стартової лінії (або події), щоб знати скільки кіл проїхали.",
    "fields": [
      {
        "name": "N",
        "meaning": "скільки кіл/перетинів потрібно",
        "range": "1…"
      }
    ],
    "how": [
      "Після досягнення N можна зупиняти або міняти режим."
    ],
    "idea": "Рахувати 3 кола → потім зупинитись."
  },
  "record_start": {
    "title": "Запис керування",
    "does": "Починає запис твоїх команд руху/поворотів для подальшого відтворення.",
    "fields": [],
    "how": [
      "Записують під час ручного керування.",
      "Потім можна відтворити трек."
    ],
    "idea": "Запис → покерувати вручну → зупинити → відтворити."
  },
  "replay_track": {
    "title": "Відтворити трек",
    "does": "Відтворює записані команди керування (що було записано).",
    "fields": [],
    "how": [
      "Працює тільки якщо перед цим є запис."
    ],
    "idea": "Відтворити записаний маршрут."
  },
  "replay_loop": {
    "title": "Повторити трек N разів",
    "does": "Відтворює записаний трек кілька разів.",
    "fields": [
      {
        "name": "N",
        "meaning": "кількість повторів",
        "range": "1…"
      }
    ],
    "how": [
      "Зручно для тесту стабільності: чи повторюється маршрут однаково."
    ],
    "idea": "Повторити трек 5 разів і дивитись відхилення."
  },
  "go_home": {
    "title": "Go Home",
    "does": "Скидає стан/режим або повертає систему в базовий стан (залежить від реалізації).",
    "fields": [],
    "how": [
      "Став у кінці програми або після аварійних ситуацій."
    ],
    "idea": "Після стопу → go_home (скинути режим)."
  },
  "spider_center": {
    "title": "Павук: центр",
    "does": "Ставить лапи в базове положення (вирівнює).",
    "fields": [],
    "how": [
      "Використовуй перед кроками або якщо лапи “з’їхали”."
    ],
    "idea": "Центр → кроки."
  },
  "spider_step": {
    "title": "Павук: крок",
    "does": "Робить один крок у вибраному напрямі.",
    "fields": [
      {
        "name": "DIR",
        "meaning": "напрям (FWD/BWD/LEFT/RIGHT)",
        "range": "список"
      }
    ],
    "how": [
      "Один крок — це один цикл руху лап.",
      "Для руху на відстань роби кілька кроків у циклі."
    ],
    "idea": "Повторити 6 разів: крок FWD."
  },
  "spider_walk_while": {
    "title": "Павук: йти поки…",
    "does": "Йде в напрямі DIR, поки умова істинна (логічний вираз).",
    "fields": [
      {
        "name": "DIR",
        "meaning": "напрям",
        "range": "список"
      },
      {
        "name": "COND",
        "meaning": "умова (true/false)",
        "range": "логіка"
      }
    ],
    "how": [
      "Всередині зазвичай є датчики/таймер/умови зупинки."
    ],
    "idea": "Йти FWD поки (датчик > 30)."
  },
  "spider_walk_time": {
    "title": "Павук: йти час",
    "does": "Йде в напрямі DIR певний час SEC.",
    "fields": [
      {
        "name": "DIR",
        "meaning": "напрям",
        "range": "список"
      },
      {
        "name": "SEC",
        "meaning": "час руху",
        "range": "0.1…сек"
      }
    ],
    "how": [
      "Добре для простих демонстрацій без датчиків."
    ],
    "idea": "Йти FWD 2 секунди → стоп."
  },
  "spider_turn_smooth": {
    "title": "Павук: поворот плавно",
    "does": "Повертає на кут ANGLE плавно, щоб не смикало.",
    "fields": [
      {
        "name": "ANGLE",
        "meaning": "кут повороту",
        "range": "0…360"
      }
    ],
    "how": [
      "Малі кути 10–30 — корекція, 90 — розворот."
    ],
    "idea": "Повернути 90° → йти вперед."
  },
  "spider_leg_control": {
    "title": "Павук: керування лапою",
    "does": "Задає значення (кут/позицію) для лапи/суглоба.",
    "fields": [
      {
        "name": "LEG",
        "meaning": "яку лапу/суглоб",
        "range": "список"
      },
      {
        "name": "VAL",
        "meaning": "кут/позиція",
        "range": "0…180 (типово)"
      }
    ],
    "how": [
      "Корисно для калібрування і тесту сервоприводів."
    ],
    "idea": "Виставити лапу на 90° (нейтраль)."
  },
  "spider_config": {
    "title": "Павук: налаштування",
    "does": "Налаштовує параметри ходи (висота, швидкість тощо).",
    "fields": [
      {
        "name": "HEIGHT",
        "meaning": "висота підйому лапи/кроку",
        "range": "0…"
      },
      {
        "name": "SPEED",
        "meaning": "швидкість руху",
        "range": "0…100"
      }
    ],
    "how": [
      "Висота більше — легше переступати, але може бути менш стабільно.",
      "Швидкість більше — швидше, але важче керувати."
    ],
    "idea": "Постав HEIGHT 40, SPEED 70 для стабільності."
  },
  "spider_anim": {
    "title": "Павук: анімація",
    "does": "Запускає готову анімацію (наприклад WAVE).",
    "fields": [
      {
        "name": "ANIM",
        "meaning": "яка анімація",
        "range": "список"
      }
    ],
    "how": [
      "Показовий блок для демонстрацій."
    ],
    "idea": "ANIM=WAVE → павук “махає”."
  },
  "spider_joystick_ctrl": {
    "title": "Павук: джойстик-керування",
    "does": "Перемикає керування павуком з джойстика/пульта.",
    "fields": [],
    "how": [
      "Став перед рухом, якщо хочеш ручне керування."
    ],
    "idea": "Увімкнути джойстик-контроль → керувати вручну."
  },
  "spider_stop": {
    "title": "Павук: стоп",
    "does": "Зупиняє рух павука / ставить у безпечний стан.",
    "fields": [],
    "how": [
      "Став як аварійну зупинку або в кінці сценарію."
    ],
    "idea": "Йти → стоп."
  },
  "logic_boolean": {
    "title": "Логічне значення (true/false)",
    "does": "Константа істина/хиба. Використовується як умова.",
    "fields": [
      {
        "name": "BOOL",
        "meaning": "вибір TRUE або FALSE",
        "range": "список"
      }
    ],
    "how": [
      "Став у місця, де потрібна умова, або для тесту."
    ],
    "idea": "Поки TRUE → цикл без кінця (обережно)."
  },
  "logic_edge_detect": {
    "title": "Детектор фронту (зміни 0↔1)",
    "does": "Ловить момент, коли сигнал змінився (натиснули кнопку/перетнули лінію).",
    "fields": [
      {
        "name": "VAL",
        "meaning": "поточний сигнал (0/1 або true/false)",
        "range": "0/1"
      }
    ],
    "how": [
      "Корисно, щоб подію рахувати один раз, а не багато разів поки сигнал тримається."
    ],
    "idea": "Коли лінія вперше стала чорна — збільшити лічильник."
  },
  "logic_schmitt": {
    "title": "Гістерезис (Schmitt)",
    "does": "Стабілізує рішення біля порогу: має LOW і HIGH, щоб не “дрижало”.",
    "fields": [
      {
        "name": "VAL",
        "meaning": "значення",
        "range": "число"
      },
      {
        "name": "LOW",
        "meaning": "нижній поріг",
        "range": "число"
      },
      {
        "name": "HIGH",
        "meaning": "верхній поріг",
        "range": "число"
      }
    ],
    "how": [
      "VAL>HIGH → стан ON; VAL<LOW → стан OFF; між ними стан не змінюється."
    ],
    "idea": "Для шумного датчика зроби LOW=40, HIGH=60."
  },
  "math_number": {
    "title": "Число",
    "does": "Числова константа. Підставляється у поля швидкості, пороги, час.",
    "fields": [
      {
        "name": "NUM",
        "meaning": "значення числа",
        "range": "будь-яке"
      }
    ],
    "how": [
      "Змінюй число і дивись як змінюється поведінка."
    ],
    "idea": "SPEED=50, SEC=0.5, поріг=20 — це все числа."
  },
  "math_random_int": {
    "title": "Випадкове ціле",
    "does": "Дає випадкове ціле число від A до B включно.",
    "fields": [
      {
        "name": "A",
        "meaning": "мінімум",
        "range": "ціле"
      },
      {
        "name": "B",
        "meaning": "максимум",
        "range": "ціле"
      }
    ],
    "how": [
      "Корисно для рандомних сценаріїв/тестів."
    ],
    "idea": "Випадково вибрати поворот: 0 або 1 → LEFT або RIGHT."
  },
  "math_single": {
    "title": "Математична функція",
    "does": "Робить одну математичну операцію над числом (|x|, √x, sin, cos тощо).",
    "fields": [
      {
        "name": "OP",
        "meaning": "яка функція",
        "range": "список"
      },
      {
        "name": "NUM",
        "meaning": "вхідне число",
        "range": "число"
      }
    ],
    "how": [
      "|x| (модуль) прибирає знак.",
      "√x (корінь) — тільки для x≥0.",
      "sin/cos — якщо потрібні кути/плавні рухи."
    ],
    "idea": "ABS(error) для оцінки величини помилки."
  },
  "math_pid": {
    "title": "PID-регулятор",
    "does": "Рахує корекцію за ERROR і коефіцієнтами KP/KI/KD для стабільного керування.",
    "fields": [
      {
        "name": "ERROR",
        "meaning": "помилка (ціль - поточне)",
        "range": "+/-"
      },
      {
        "name": "KP",
        "meaning": "пропорційний",
        "range": "0…"
      },
      {
        "name": "KI",
        "meaning": "інтегральний",
        "range": "0…"
      },
      {
        "name": "KD",
        "meaning": "диференціальний",
        "range": "0…"
      }
    ],
    "how": [
      "Старт: KI=0, KD=0, підбирай KP.",
      "Потім додай трохи KD, щоб пригасити ривки.",
      "KI — малими, якщо є постійний зсув."
    ],
    "idea": "BaseSpeed ± correction, де correction = PID(ERROR)."
  },
  "math_smooth": {
    "title": "Згладити (фільтр)",
    "does": "Зменшує стрибки значень (корисно для датчиків).",
    "fields": [
      {
        "name": "VAL",
        "meaning": "поточне значення",
        "range": "число"
      },
      {
        "name": "ALPHA",
        "meaning": "сила фільтра",
        "range": "0…1"
      }
    ],
    "how": [
      "ALPHA→0: дуже плавно, але повільно реагує.",
      "ALPHA→1: майже без фільтра."
    ],
    "idea": "Згладити distance перед порівнянням з порогом."
  },
  "controls_if": {
    "title": "Якщо (if)",
    "does": "Виконує вкладені блоки лише якщо умова true.",
    "fields": [
      {
        "name": "Умова",
        "meaning": "логічний вираз",
        "range": "true/false"
      }
    ],
    "how": [
      "Умова зазвичай з порівняння: (датчик < 20)."
    ],
    "idea": "Якщо перешкода близько → стоп."
  },
  "controls_repeat_ext": {
    "title": "Повторити N разів",
    "does": "Повторює вкладені блоки N разів.",
    "fields": [
      {
        "name": "TIMES",
        "meaning": "кількість повторів",
        "range": "0…"
      }
    ],
    "how": [
      "Усередині зроби маленький сценарій."
    ],
    "idea": "Повторити 4 рази: їхати 0.5с → чекати 0.1с."
  },
  "controls_whileUntil": {
    "title": "Поки / Доки",
    "does": "Повторює блоки поки умова (WHILE) або доки умова не стане true (UNTIL).",
    "fields": [
      {
        "name": "MODE",
        "meaning": "WHILE/UNTIL",
        "range": "список"
      },
      {
        "name": "Умова",
        "meaning": "логічний вираз",
        "range": "true/false"
      }
    ],
    "how": [
      "У циклі бажано мати маленьку паузу."
    ],
    "idea": "WHILE (датчик > 25) → їхати повільно → чекати 0.05."
  },
  "controls_for": {
    "title": "Цикл for (лічильник)",
    "does": "Змінює лічильник i від FROM до TO з кроком BY.",
    "fields": [
      {
        "name": "VAR",
        "meaning": "лічильник",
        "range": "змінна"
      },
      {
        "name": "FROM",
        "meaning": "початок",
        "range": "число"
      },
      {
        "name": "TO",
        "meaning": "кінець",
        "range": "число"
      },
      {
        "name": "BY",
        "meaning": "крок",
        "range": "число"
      }
    ],
    "how": [
      "Добре для поступової зміни швидкості/параметра."
    ],
    "idea": "i=0..100 крок 10 → поступово збільшувати швидкість."
  },
  "logic_compare": {
    "title": "Порівняння",
    "does": "Порівнює A і B та повертає true/false.",
    "fields": [
      {
        "name": "OP",
        "meaning": "оператор",
        "range": ">, <, =, ≠, ≥, ≤"
      },
      {
        "name": "A",
        "meaning": "перше значення",
        "range": "число/вираз"
      },
      {
        "name": "B",
        "meaning": "друге значення",
        "range": "число/вираз"
      }
    ],
    "how": [
      "Результат використовують у if / while."
    ],
    "idea": "(датчик < 20) → true."
  },
  "logic_operation": {
    "title": "І / АБО",
    "does": "Об’єднує дві умови AND/OR.",
    "fields": [
      {
        "name": "OP",
        "meaning": "AND або OR",
        "range": "список"
      },
      {
        "name": "A",
        "meaning": "умова 1",
        "range": "true/false"
      },
      {
        "name": "B",
        "meaning": "умова 2",
        "range": "true/false"
      }
    ],
    "how": [
      "AND: обидві умови мають бути true.",
      "OR: достатньо однієї умови."
    ],
    "idea": "(d1<20) OR (d2<20) → стоп."
  },
  "logic_negate": {
    "title": "НЕ",
    "does": "Перевертає умову (true↔false).",
    "fields": [
      {
        "name": "BOOL",
        "meaning": "умова",
        "range": "true/false"
      }
    ],
    "how": [
      "Корисно для інверсії логіки."
    ],
    "idea": "NOT(d<20) означає d≥20."
  },
  "math_arithmetic": {
    "title": "Арифметика",
    "does": "+ − × ÷ над двома числами.",
    "fields": [
      {
        "name": "OP",
        "meaning": "операція",
        "range": "ADD/SUB/MUL/DIV"
      },
      {
        "name": "A",
        "meaning": "перше",
        "range": "число"
      },
      {
        "name": "B",
        "meaning": "друге",
        "range": "число"
      }
    ],
    "how": [
      "Для формул керування: base + correction."
    ],
    "idea": "speed = base + correction."
  }
};

  const $ = (sel, root=document) => root.querySelector(sel);
  const clamp = (n,a,b) => Math.max(a, Math.min(b,n));
  const safe = (x) => (x == null) ? "" : String(x);

  function isMobile() {
    return document.body.classList.contains("layout-mobile") || window.matchMedia("(pointer: coarse)").matches;
  }
  function isDesktop() {
    return document.body.classList.contains("layout-desktop") || window.matchMedia("(pointer: fine)").matches;
  }

  function el(tag, attrs={}, children=[]) {
    const n = document.createElement(tag);
    for (const [k,v] of Object.entries(attrs)) {
      if (k === "class") n.className = v;
      else if (k === "style") Object.assign(n.style, v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else n.setAttribute(k, v);
    }
    for (const c of children) n.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    return n;
  }

  function getMainWorkspace() {
    return window.workspace || (window.Blockly && Blockly.getMainWorkspace && Blockly.getMainWorkspace());
  }

  function getHelpFor(block) {
    const type = block?.type || "";
    const h = HELP_DB[type];

    let tooltip = "";
    try {
      tooltip = (block && typeof block.getTooltip === "function") ? (block.getTooltip() || "") : "";
    } catch(_) {}

    const out = {
      type,
      title: (h && h.title) ? h.title : ("Блок: " + safe(type || "невідомий")),
      does: (h && h.does) ? h.does : (tooltip ? tooltip : "Опис для цього блоку не задано."),
      fields: Array.isArray(h?.fields) ? h.fields : [],
      how: Array.isArray(h?.how) ? h.how : [],
      idea: (h && h.idea) ? h.idea : "—"
    };

    if (out.how.length === 0) {
      out.how = [
        "Постав блок у програму і з’єднай з іншими блоками.",
        "Зміни значення в полях і подивись, як змінюється поведінка.",
        "Якщо блок використовується в циклі — додай маленьку паузу (wait), щоб не перевантажувати систему."
      ];
    }

    return out;
  }

  let uiReady = false;
  let backdrop, panel, titleEl, doesEl, fieldsEl, howEl, ideaEl;
  let touchMenu, currentBlock = null;

  function ensureUI() {
    if (uiReady) return;

    const style = el("style", {}, [`
      .rc-help-backdrop {
        position: fixed; inset: 0;
        background: rgba(0,0,0,0.45);
        z-index: 9998;
        display: none;
      }
      .rc-help-panel {
        position: fixed;
        left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        width: min(560px, 92vw);
        max-height: 86vh;
        background: rgba(15, 23, 42, 0.97);
        border: 1px solid rgba(148,163,184,0.25);
        border-radius: 18px;
        box-shadow: 0 20px 50px rgba(0,0,0,0.65);
        z-index: 9999;
        display: none;
        overflow: hidden;
        backdrop-filter: blur(12px);
      }
      .rc-help-panel header {
        display:flex; align-items:center; justify-content:space-between;
        gap: 10px;
        padding: 12px 14px;
        border-bottom: 1px solid rgba(148,163,184,0.18);
      }
      .rc-help-title {
        font-size: 14px;
        font-weight: 900;
        color: #e2e8f0;
        letter-spacing: 0.02em;
      }
      .rc-help-x {
        width: 34px; height: 34px;
        border-radius: 10px;
        border: 1px solid rgba(148,163,184,0.25);
        background: rgba(30,41,59,0.6);
        color: #cbd5e1;
        cursor: pointer;
      }
      .rc-help-body {
        padding: 12px 14px;
        overflow: auto;
        max-height: calc(86vh - 70px);
      }
      .rc-card {
        background: rgba(2,6,23,0.35);
        border: 1px solid rgba(148,163,184,0.14);
        border-radius: 14px;
        padding: 10px 12px;
        margin-bottom: 10px;
      }
      .rc-label {
        font-size: 10px;
        font-weight: 900;
        color: #94a3b8;
        letter-spacing: 0.14em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }
      .rc-text {
        font-size: 13px;
        line-height: 1.35;
        color: #e2e8f0;
        white-space: pre-wrap;
      }
      .rc-list li {
        margin: 6px 0;
        color: #e2e8f0;
        font-size: 13px;
        line-height: 1.25;
      }
      .rc-fields li {
        margin: 6px 0;
        color: #e2e8f0;
        font-size: 13px;
        line-height: 1.25;
      }
      .rc-fields code {
        font-weight: 900;
        color: #93c5fd;
      }

      .rc-help-touchmenu {
        position: fixed;
        min-width: 190px;
        background: rgba(15, 23, 42, 0.98);
        border: 1px solid rgba(148,163,184,0.22);
        border-radius: 14px;
        box-shadow: 0 18px 40px rgba(0,0,0,0.6);
        z-index: 10001;
        display: none;
        overflow: hidden;
        backdrop-filter: blur(10px);
      }
      .rc-help-touchmenu .item {
        display:flex;
        align-items:center;
        gap:10px;
        padding: 12px 12px;
        color: #e2e8f0;
        font-weight: 900;
        font-size: 13px;
        border-bottom: 1px solid rgba(148,163,184,0.14);
        user-select:none;
      }
      .rc-help-touchmenu .item:last-child { border-bottom: none; }
      .rc-help-touchmenu .item:active { background: rgba(59,130,246,0.20); }
      .rc-help-touchmenu .icon { width: 22px; text-align:center; opacity: 0.95; }
    `]);
    document.head.appendChild(style);

    backdrop = el("div", { class: "rc-help-backdrop", id: "rcHelpBackdrop" });
    backdrop.addEventListener("click", () => closeHelp());
    document.body.appendChild(backdrop);

    titleEl = el("div", { class: "rc-help-title" }, ["Пояснення"]);
    const x = el("button", { class: "rc-help-x", type: "button", title: "Закрити" }, ["✕"]);
    x.addEventListener("click", () => closeHelp());
    const header = el("header", {}, [titleEl, x]);

    doesEl = el("div", { class: "rc-text" }, ["—"]);
    fieldsEl = el("ul", { class: "rc-fields" });
    howEl = el("ul", { class: "rc-list" });
    ideaEl = el("div", { class: "rc-text" }, ["—"]);

    const body = el("div", { class: "rc-help-body" }, [
      el("div", { class: "rc-card" }, [el("div", { class: "rc-label" }, ["Що робить"]), doesEl]),
      el("div", { class: "rc-card" }, [el("div", { class: "rc-label" }, ["Поля / Входи"]), fieldsEl]),
      el("div", { class: "rc-card" }, [el("div", { class: "rc-label" }, ["Як використовувати"]), howEl]),
      el("div", { class: "rc-card" }, [el("div", { class: "rc-label" }, ["Ідея прикладу"]), ideaEl]),
    ]);

    panel = el("div", { class: "rc-help-panel", id: "rcHelpPanel" }, [header, body]);
    document.body.appendChild(panel);

    touchMenu = el("div", { class: "rc-help-touchmenu", id: "rcHelpTouchMenu" }, [
      el("div", { class: "item", id: "rcHelpTouchHelp" }, [
        el("div", { class: "icon" }, ["❓"]),
        el("div", {}, ["Пояснення"])
      ]),
      el("div", { class: "item", id: "rcHelpTouchClose" }, [
        el("div", { class: "icon" }, ["✕"]),
        el("div", {}, ["Закрити меню"])
      ])
    ]);
    document.body.appendChild(touchMenu);

    $("#rcHelpTouchHelp").addEventListener("click", () => {
      hideTouchMenu();
      if (currentBlock) openHelp(currentBlock);
    });
    $("#rcHelpTouchClose").addEventListener("click", () => hideTouchMenu());

    uiReady = true;
  }

  function openHelp(block) {
    ensureUI();
    currentBlock = block;
    const h = getHelpFor(block);

    titleEl.textContent = h.title;
    doesEl.textContent = h.does || "—";

    fieldsEl.innerHTML = "";
    if (h.fields && h.fields.length) {
      for (const f of h.fields) {
        const name = safe(f.name);
        const meaning = safe(f.meaning);
        const range = safe(f.range);
        fieldsEl.appendChild(el("li", {}, [
          el("code", {}, [name]),
          document.createTextNode(" — " + meaning + (range ? (" (" + range + ")") : ""))
        ]));
      }
    } else {
      fieldsEl.appendChild(el("li", {}, ["Немає окремих полів. Блок виконує дію як є."]));
    }

    howEl.innerHTML = "";
    for (const s of (h.how || [])) howEl.appendChild(el("li", {}, [safe(s)]));

    ideaEl.textContent = h.idea || "—";

    hideTouchMenu();
    panel.style.display = "block";
    backdrop.style.display = "block";
  }

  function closeHelp() {
    ensureUI();
    panel.style.display = "none";
    backdrop.style.display = "none";
  }

  function hideTouchMenu() {
    ensureUI();
    touchMenu.style.display = "none";
  }

  function showTouchMenuNearBlock(block) {
    ensureUI();
    const svgRoot = block.getSvgRoot && block.getSvgRoot();
    if (!svgRoot) return;

    touchMenu.style.display = "block";
    touchMenu.style.left = "8px";
    touchMenu.style.top = "70px";

    const r = svgRoot.getBoundingClientRect();
    const w = touchMenu.offsetWidth || 200;
    const h = touchMenu.offsetHeight || 110;

    let left = r.right + 10;
    let top = r.top + 10;

    if (left + w > window.innerWidth - 8) left = (r.left - w - 10);
    if (left < 8) left = clamp(r.left, 8, window.innerWidth - w - 8);

    if (top + h > window.innerHeight - 8) top = (r.bottom - h - 10);
    if (top < 70) top = clamp(r.bottom + 8, 70, window.innerHeight - h - 8);

    touchMenu.style.left = left + "px";
    touchMenu.style.top = top + "px";
  }

  function findBlockIdFromEventTarget(ev) {
    let n = ev.target;
    for (let i=0; i<14 && n; i++) {
      if (n.getAttribute && n.getAttribute("data-id")) return n.getAttribute("data-id");
      n = n.parentNode;
    }
    return null;
  }

  function attachOnce() {
    const ws = getMainWorkspace();
    if (!ws || !window.Blockly) return false;

    ensureUI();

    // Mobile long-press
    const div = $("#blocklyDiv");
    if (div && !div.__rcHelpMobileAttached) {
      div.__rcHelpMobileAttached = true;

      let pressTimer = null;
      let pressBlockId = null;
      let moved = false;

      div.addEventListener("pointerdown", (ev) => {
        if (!isMobile()) return;
        moved = false;
        pressBlockId = findBlockIdFromEventTarget(ev);
        if (!pressBlockId) return;
        clearTimeout(pressTimer);
        pressTimer = setTimeout(() => {
          if (moved) return;
          const b = ws.getBlockById(pressBlockId);
          if (!b) return;
          currentBlock = b;
          showTouchMenuNearBlock(b);
        }, 380);
      }, { passive: true });

      div.addEventListener("pointermove", () => {
        moved = true;
        clearTimeout(pressTimer);
      }, { passive: true });

      div.addEventListener("pointerup", () => clearTimeout(pressTimer), { passive: true });

      document.addEventListener("pointerdown", (ev) => {
        if (!touchMenu || touchMenu.style.display !== "block") return;
        if (touchMenu.contains(ev.target)) return;
        const bid = findBlockIdFromEventTarget(ev);
        if (!bid) hideTouchMenu();
      }, { passive: true });
    }

    // Desktop context menu (safe)
    try {
      const reg = Blockly?.ContextMenuRegistry?.registry;
      if (reg && reg.register) {
        const ID = "rc_help_text_only_full";
        if (!(reg.getItem && reg.getItem(ID))) {
          reg.register({
            id: ID,
            scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
            displayText: function() { return "❓ Пояснення"; },
            preconditionFn: function(scope) {
              if (!isDesktop()) return "hidden";
              return (scope && scope.block) ? "enabled" : "hidden";
            },
            callback: function(scope) {
              if (scope && scope.block) openHelp(scope.block);
            },
            weight: 50
          });
        }
      }
    } catch(_) {}

    return true;
  }

  function boot() {
    // A few retries with backoff, then stop (no infinite loops)
    let tries = 0;
    let delay = 80;
    const tick = () => {
      tries++;
      if (window.Blockly && attachOnce()) return;
      if (tries >= 25) return;
      delay = Math.min(700, Math.floor(delay * 1.25));
      setTimeout(tick, delay);
    };
    tick();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
