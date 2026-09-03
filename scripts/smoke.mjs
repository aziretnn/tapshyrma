/**
 * Сквозная проверка интерфейса в настоящем браузере: `npm run smoke`.
 *
 * Требует запущенного приложения и однократной установки puppeteer:
 *
 *     npm install --no-save puppeteer
 *     npm run dev            # в другом окне
 *     npm run smoke
 *
 * Puppeteer намеренно не в зависимостях: он тянет отдельную сборку Chromium
 * почти на 200 МБ, и платить за это при каждой установке проекта незачем.
 *
 * Зачем это вообще: ошибка, из-за которой не работали кнопки «Добавить»,
 * не ловилась ни typecheck, ни самопроверками — crypto.randomUUID есть
 * на http://localhost и отсутствует по адресу вида http://10.0.0.187:3000,
 * потому что второй не является защищённым контекстом. Такое видно только
 * в браузере, поэтому проверку стоит гонять и по сетевому адресу:
 *
 *     BASE=http://10.0.0.187:3000 npm run smoke
 */

import puppeteer from "puppeteer";

const BASE = process.env.BASE || "http://localhost:3000";
const errors = [];
let failed = 0;

const browser = await puppeteer.launch({ headless: "new" });
const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 1100 });
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));
page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("404")) errors.push("[console] " + m.text()); });

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const count = (sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);
const text = (sel) => page.evaluate((s) => document.querySelector(s)?.textContent?.trim() ?? "", sel);

function check(name, ok, detail = "") {
  if (!ok) failed++;
  console.log(`  ${ok ? "ок  " : "СБОЙ"}  ${name}${detail ? " — " + detail : ""}`);
}

async function clickByText(tag, needle) {
  const els = await page.$$(tag);
  for (const el of els) {
    const t = await page.evaluate((e) => e.textContent, el);
    if (t && t.includes(needle)) { await el.click(); return true; }
  }
  return false;
}

async function openTab(needle) {
  const tabs = await page.$$(".step-tab");
  for (const t of tabs) {
    const txt = await page.evaluate((e) => e.textContent, t);
    if (txt.includes(needle)) { await t.click(); await wait(600); return true; }
  }
  return false;
}

console.log("Адрес:", BASE);

// ── Вход ──────────────────────────────────────────────────────────────
console.log("\nВход и список");
await page.goto(BASE + "/login", { waitUntil: "networkidle0" });
await page.type("#email", "drafter@example.kg");
await page.type("#password", "tapshyrma");
await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}), page.click('button[type="submit"]')]);
check("вход выполнен", page.url().includes("/documents"), page.url());

// ── Создание документа ────────────────────────────────────────────────
const rowsBefore = await count(".row");
await page.type('input[name="title"]', "Проверка кнопок");
// Не button[type=submit]: первой в DOM идёт кнопка «Выйти» в шапке.
await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle0" }).catch(() => {}),
  clickByText("button", "Создать ТЗ"),
]);
check("документ создан", /\/documents\/[0-9a-f-]{36}/.test(page.url()), page.url());
await wait(2500);

// ── Заголовок и превью ────────────────────────────────────────────────
console.log("\nСтраница документа");
check("панель аудита отрисована", (await count(".finding")) > 0, (await count(".finding")) + " замечаний");
check("документ справа отрисован", (await count(".doc p")) > 10);
check("вкладки разделов есть", (await count(".step-tab")) >= 10);

// ── Списки: добавить и удалить ────────────────────────────────────────
console.log("\nПовторяемые списки");
await openTab("Требования к функциям");
const i0 = await count(".item");
await clickByText("button", "Добавить требование");
await wait(700);
const i1 = await count(".item");
check("«Добавить требование» добавляет", i1 === i0 + 1, `${i0} → ${i1}`);

await clickByText("button", "Удалить");
await wait(700);
const i2 = await count(".item");
check("«Удалить» убирает", i2 === i1 - 1, `${i1} → ${i2}`);

await openTab("Назначение и цели");
const g0 = await count(".item");
await clickByText("button", "Добавить цель");
await wait(700);
check("«Добавить цель» работает", (await count(".item")) === g0 + 1);

await openTab("Характеристика объекта");
const u0 = await count(".item");
await clickByText("button", "Добавить группу");
await wait(700);
check("«Добавить группу» работает", (await count(".item")) === u0 + 1);

// ── Ветвление: флажок открывает шаг ───────────────────────────────────
console.log("\nВетвление анкеты");
await openTab("Тип предмета закупки");
const tabsBefore = await count(".step-tab");
const pdnBox = await page.$$('input[type="checkbox"]');
// Второй флажок шага — «обрабатывает информацию персонального характера»
if (pdnBox.length > 1) await pdnBox[1].click();
await wait(800);
const tabsAfter = await count(".step-tab");
check("флажок ПДн меняет набор шагов", tabsAfter !== tabsBefore, `${tabsBefore} → ${tabsAfter}`);

// ── Радио: автозаполнение этапов ──────────────────────────────────────
const radios = await page.$$('input[type="radio"]');
if (radios.length > 1) await radios[1].click();
await wait(800);
await openTab("Состав и содержание работ");
check("этапы предзаполнились по типу закупки", (await count(".item")) > 0, (await count(".item")) + " этапов");

// ── Обоснование замечания ─────────────────────────────────────────────
console.log("\nПанель аудита");
const justTa = await page.$(".just textarea");
if (justTa) {
  await justTa.click();
  await page.keyboard.type("обоснование для проверки");
  await wait(900);
  const v = await page.evaluate((e) => e.value, justTa);
  check("обоснование вводится", v.includes("обоснование"), JSON.stringify(v.slice(0, 30)));
} else check("поле обоснования найдено", false);

const before = await text("h2");
const went = await clickByText(".finding button", "Перейти");
await wait(700);
check("«Перейти» у замечания ведёт к шагу", went && (await text("h2")) !== before, `${before} → ${await text("h2")}`);

// ── Сохранение версии ─────────────────────────────────────────────────
console.log("\nСохранение");
const stateBefore = await text(".savebar span");
await clickByText("button", "Сохранить версию");
await wait(3000);
const stateAfter = await text(".savebar span");
check("версия сохранена", stateAfter.includes("Версия 2") || stateAfter !== stateBefore, `${stateBefore} → ${stateAfter}`);

// ── Выгрузка .docx ────────────────────────────────────────────────────
console.log("\nВыгрузка");
const href = await page.evaluate(() => document.querySelector('a[download]')?.getAttribute("href"));
if (href) {
  const res = await page.evaluate(async (u) => {
    const r = await fetch(u);
    return { status: r.status, type: r.headers.get("content-type"), size: (await r.arrayBuffer()).byteLength };
  }, href);
  check("ссылка отдаёт .docx", res.status === 200 && res.type.includes("wordprocessingml") && res.size > 10000,
    `HTTP ${res.status}, ${res.size} байт`);
} else check("ссылка на .docx есть", false);

// ── Прочие страницы ───────────────────────────────────────────────────
console.log("\nОстальные страницы");
await page.goto(BASE + "/org", { waitUntil: "networkidle0" });
check("страница организации", (await count(".row")) > 0);
await page.goto(BASE + "/documents", { waitUntil: "networkidle0" });
check("список документов вырос", (await count(".row")) > rowsBefore, `${rowsBefore} → ${await count(".row")}`);
await clickByText("button", "Выйти");
await wait(2000);
check("выход работает", page.url().includes("/login"), page.url());

// ── Итог ──────────────────────────────────────────────────────────────
console.log("\nОшибки в консоли браузера");
const real = errors.filter((e) => !e.includes("ERR_ABORTED"));
if (real.length === 0) console.log("  нет");
real.slice(0, 15).forEach((e) => console.log("  " + e));

console.log(failed === 0 && real.length === 0 ? "\nВсё работает.\n" : `\nПроблем: ${failed + real.length}\n`);
await browser.close();
process.exit(failed + real.length === 0 ? 0 : 1);
