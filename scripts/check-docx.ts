import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { emptyModel } from "../lib/tz/model";
import { exampleModel } from "../lib/tz/example";
import { buildDocx, docxFileName } from "../lib/export/docx";
import { crc32 } from "../lib/export/zip";

/**
 * Самопроверка экспорта: `npm run check:docx`.
 *
 * ZIP написан вручную, а самая частая ошибка в таком коде — сдвиг смещений
 * или неверная контрольная сумма: файл выглядит правдоподобно и не
 * открывается. Поэтому скрипт не просто собирает документ, а разбирает
 * получившийся архив обратно и сверяет каждую запись.
 *
 * Итоговый файл кладётся в ./out — откройте его в Word: только это
 * подтверждает, что документ действительно читается.
 */

let failed = 0;

function check(name: string, ok: boolean, detail?: string) {
  if (ok) {
    console.log(`  ок    ${name}`);
  } else {
    failed++;
    console.log(`  СБОЙ  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function u16(b: Uint8Array, at: number): number {
  return b[at] | (b[at + 1] << 8);
}
function u32(b: Uint8Array, at: number): number {
  return (b[at] | (b[at + 1] << 8) | (b[at + 2] << 16) | (b[at + 3] << 24)) >>> 0;
}

type Parsed = { name: string; data: Uint8Array; crcOk: boolean };

/** Разбор ZIP через центральный каталог — так же, как это делает Word. */
function parseZip(bytes: Uint8Array): Parsed[] {
  let eocd = -1;
  for (let i = bytes.length - 22; i >= 0; i--) {
    if (u32(bytes, i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("не найден конец центрального каталога");

  const count = u16(bytes, eocd + 10);
  const cdOffset = u32(bytes, eocd + 16);

  const decoder = new TextDecoder();
  const entries: Parsed[] = [];
  let p = cdOffset;

  for (let i = 0; i < count; i++) {
    if (u32(bytes, p) !== 0x02014b50) throw new Error("повреждена запись каталога " + i);

    const crc = u32(bytes, p + 16);
    const size = u32(bytes, p + 24);
    const nameLen = u16(bytes, p + 28);
    const extraLen = u16(bytes, p + 30);
    const commentLen = u16(bytes, p + 32);
    const localOffset = u32(bytes, p + 42);
    const name = decoder.decode(bytes.subarray(p + 46, p + 46 + nameLen));

    if (u32(bytes, localOffset) !== 0x04034b50) {
      throw new Error("смещение локального заголовка неверно: " + name);
    }
    const localNameLen = u16(bytes, localOffset + 26);
    const localExtraLen = u16(bytes, localOffset + 28);
    const dataStart = localOffset + 30 + localNameLen + localExtraLen;
    const data = bytes.subarray(dataStart, dataStart + size);

    entries.push({ name, data, crcOk: crc32(data) === crc });
    p += 46 + nameLen + extraLen + commentLen;
  }

  return entries;
}

console.log("\nСборка документа");

const model = exampleModel();
const bytes = buildDocx(model);

check("файл начинается сигнатурой ZIP", bytes[0] === 0x50 && bytes[1] === 0x4b);
check("размер правдоподобен", bytes.length > 4000, `получено ${bytes.length} байт`);

const again = buildDocx(exampleModel());
check(
  "две сборки одной модели дают одинаковые байты",
  again.length === bytes.length && again.every((b, i) => b === bytes[i]),
);

console.log("\nРазбор архива обратно");

let entries: Parsed[] = [];
try {
  entries = parseZip(bytes);
  check("архив разбирается через центральный каталог", true);
} catch (e) {
  check("архив разбирается через центральный каталог", false, String(e));
}

const expected = [
  "[Content_Types].xml",
  "_rels/.rels",
  "word/document.xml",
  "word/_rels/document.xml.rels",
  "word/styles.xml",
];

check("все обязательные части на месте", expected.every((n) => entries.some((e) => e.name === n)),
  "нет: " + expected.filter((n) => !entries.some((e) => e.name === n)).join(", "));
check("контрольные суммы совпадают", entries.length > 0 && entries.every((e) => e.crcOk));
check("[Content_Types].xml идёт первым", entries[0] && entries[0].name === "[Content_Types].xml");

const decoder = new TextDecoder();
const documentPart = entries.find((e) => e.name === "word/document.xml");
const xml = documentPart ? decoder.decode(documentPart.data) : "";

console.log("\nСодержание документа");
check("объявлен пролог XML", xml.startsWith('<?xml version="1.0"'));
check("корневой элемент закрыт", xml.trimEnd().endsWith("</w:document>"));
check(
  "число открытых и закрытых абзацев совпадает",
  (xml.match(/<w:p>/g) || []).length + (xml.match(/<w:p\/>/g) || []).length ===
    (xml.match(/<\/w:p>/g) || []).length + (xml.match(/<w:p\/>/g) || []).length,
);
check("число открытых и закрытых таблиц совпадает",
  (xml.match(/<w:tbl>/g) || []).length === (xml.match(/<\/w:tbl>/g) || []).length);
check("есть заголовок документа", xml.includes("ТЕХНИЧЕСКОЕ ЗАДАНИЕ"));
check("есть все девять разделов",
  ["1. Общие сведения", "2. Назначение", "3. Характеристика", "4. Требования к системе",
   "5. Состав", "6. Порядок контроля", "7. Требования к подготовке",
   "8. Требования к документированию", "9. Источники разработки"]
    .every((s) => xml.includes(s)));
check("раздел 9 заполнен из справочника", xml.includes("О государственных закупках"));
check("коды требований проставлены", xml.includes("ФТ-01"));
check("угловые скобки в тексте экранированы", !/<w:t[^>]*>[^<]*[<>][^<]*<\/w:t>/.test(xml));

console.log("\nПустой документ");
{
  const blankDocx = buildDocx(emptyModel());
  const blankXml = decoder.decode(
    parseZip(blankDocx).find((e) => e.name === "word/document.xml")!.data,
  );
  check("пустая модель тоже собирается", blankDocx.length > 3000);
  check("незаполненные места помечены", blankXml.includes("[наименование системы]"));
}

console.log("\nЗапись файла");
try {
  mkdirSync("out", { recursive: true });
  const path = join("out", docxFileName(model));
  writeFileSync(path, bytes);
  console.log(`  Файл: ${path}`);
  console.log("  Откройте его в Word — только это подтверждает, что документ читается.");
} catch (e) {
  check("файл записан", false, String(e));
}

console.log(failed === 0 ? "\nВсе проверки пройдены.\n" : `\nПровалено проверок: ${failed}.\n`);
process.exit(failed === 0 ? 0 : 1);
