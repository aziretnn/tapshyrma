import type { TzModel } from "@/lib/tz/model";
import { SYSTEM_KINDS, PRIORITIES } from "@/lib/tz/model";
import { derive } from "@/lib/tz/derive";
import {
  LANG_NAMES,
  MEASURE_NAMES,
  PDN_NAMES,
  TEST_NAMES,
  formatDate,
} from "@/lib/tz/vocabulary";
import { buildZip, type ZipEntry } from "@/lib/export/zip";

/**
 * Генератор .docx (стадия 06 конвейера).
 *
 * Разделы и их содержание — те же, что в components/Preview.tsx, и берутся
 * из тех же словарей (lib/tz/vocabulary.ts) и того же компилятора
 * (lib/tz/derive.ts). Документ на экране и документ в файле не должны
 * расходиться: пользователь подписывает то, что видел.
 *
 * Оформление — под требования к служебным документам: A4, Times New Roman 12 пт,
 * поля 3 см слева и 1,5 см справа.
 *
 * Чего здесь пока нет: вывода на фирменный бланк органа (для этого нужен
 * .docx-шаблон самого органа — этап 5–6 плана предполагает docxtemplater
 * поверх загруженного бланка) и колонтитулов с номерами страниц.
 */

const USABLE_WIDTH_TWIPS = 9355; // A4 минус поля 3 см слева и 1,5 см справа

function esc(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type RunOpts = { bold?: boolean; italic?: boolean; grey?: boolean; mono?: boolean };

function run(text: string, opts: RunOpts = {}): string {
  const props: string[] = [];
  if (opts.mono) props.push('<w:rFonts w:ascii="Courier New" w:hAnsi="Courier New"/>');
  if (opts.bold) props.push("<w:b/>");
  if (opts.italic) props.push("<w:i/>");
  if (opts.grey) props.push('<w:color w:val="808080"/>');

  const rPr = props.length ? `<w:rPr>${props.join("")}</w:rPr>` : "";
  return `<w:r>${rPr}<w:t xml:space="preserve">${esc(text)}</w:t></w:r>`;
}

/** Незаполненное место: документ честно показывает пробел, а не прячет его. */
function blank(what: string): string {
  return run(`[${what}]`, { italic: true, grey: true });
}

/** Значение либо пометка о том, что его нет. */
function value(text: string, what: string, opts: RunOpts = {}): string {
  const v = (text ?? "").trim();
  return v ? run(v, opts) : blank(what);
}

type ParaOpts = { align?: "center" | "right" | "both"; style?: string; spaceBefore?: number };

function para(runs: string, opts: ParaOpts = {}): string {
  const props: string[] = [];
  if (opts.style) props.push(`<w:pStyle w:val="${opts.style}"/>`);
  if (opts.align) props.push(`<w:jc w:val="${opts.align}"/>`);
  if (opts.spaceBefore) props.push(`<w:spacing w:before="${opts.spaceBefore}"/>`);

  const pPr = props.length ? `<w:pPr>${props.join("")}</w:pPr>` : "";
  return `<w:p>${pPr}${runs}</w:p>`;
}

/** Абзац основного текста с выключкой по ширине — как в служебных документах. */
function text(runs: string): string {
  return para(runs, { align: "both" });
}

function h1(caption: string): string {
  return para(run(caption, { bold: true }), { style: "Heading1", spaceBefore: 240 });
}

function h2(caption: string): string {
  return para(run(caption, { bold: true }), { style: "Heading2", spaceBefore: 160 });
}

function bullet(item: string): string {
  return para(run("— " + item), { align: "both" });
}

type Cell = { text: string; what?: string; mono?: boolean };

function cell(width: number, content: Cell, header: boolean): string {
  const runs = content.what
    ? value(content.text, content.what, { mono: content.mono })
    : run(content.text, { bold: header, mono: content.mono });

  const shading = header ? '<w:shd w:val="clear" w:fill="F2F2F2"/>' : "";
  return (
    `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shading}</w:tcPr>` +
    `<w:p><w:pPr><w:spacing w:after="0"/></w:pPr>${runs}</w:p></w:tc>`
  );
}

/**
 * Таблица во всю ширину полосы набора.
 * `weights` — доли колонок; сумма приводится к ширине страницы.
 */
function table(weights: number[], headers: string[], rows: Cell[][]): string {
  const total = weights.reduce((a, b) => a + b, 0);
  const widths = weights.map((w) => Math.round((w / total) * USABLE_WIDTH_TWIPS));

  const borders =
    "<w:tblBorders>" +
    ["top", "left", "bottom", "right", "insideH", "insideV"]
      .map((side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="999999"/>`)
      .join("") +
    "</w:tblBorders>";

  const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");

  const headerRow =
    "<w:tr><w:trPr><w:tblHeader/></w:trPr>" +
    headers.map((t, i) => cell(widths[i], { text: t }, true)).join("") +
    "</w:tr>";

  const bodyRows = rows
    .map(
      (row) =>
        "<w:tr>" + row.map((c, i) => cell(widths[i], c, false)).join("") + "</w:tr>",
    )
    .join("");

  return (
    `<w:tbl><w:tblPr><w:tblW w:w="${USABLE_WIDTH_TWIPS}" w:type="dxa"/>${borders}</w:tblPr>` +
    `<w:tblGrid>${grid}</w:tblGrid>${headerRow}${bodyRows}</w:tbl>` +
    // Пустой абзац после таблицы: без него Word склеивает две таблицы подряд.
    "<w:p/>"
  );
}

/* ══════════════════════════════════════════════════════════
   Тело документа
   ══════════════════════════════════════════════════════════ */

function body(m: TzModel): string {
  const d = derive(m);
  const out: string[] = [];

  /* Гриф утверждения */
  out.push(para(run("УТВЕРЖДАЮ"), { align: "right" }));
  out.push(para(value(m.meta.headPosition, "должность руководителя"), { align: "right" }));
  out.push(para(value(m.meta.customerShortName, "наименование органа"), { align: "right" }));
  out.push(
    para(run("______________  ") + value(m.meta.headName, "Ф. И. О."), {
      align: "right",
      spaceBefore: 120,
    }),
  );
  out.push(para(run("«____» ______________ 20___ г."), { align: "right" }));
  out.push(para("", { spaceBefore: 240 }));

  /* Заголовок */
  out.push(para(run("ТЕХНИЧЕСКОЕ ЗАДАНИЕ", { bold: true }), { align: "center" }));
  out.push(para(run("на " + SYSTEM_KINDS[m.systemKind].toLowerCase()), { align: "center" }));
  out.push(
    para(run("«", { bold: true }) + value(m.meta.title, "наименование системы", { bold: true }) + run("»", { bold: true }), {
      align: "center",
      spaceBefore: 120,
    }),
  );
  out.push(para("", { spaceBefore: 240 }));

  /* 1 */
  out.push(h1("1. Общие сведения"));
  out.push(text(run("1.1. Полное наименование системы: «") + value(m.meta.title, "наименование системы") + run("».")));
  out.push(
    text(
      run("1.2. Заказчик: ") +
        value(m.meta.customerName, "наименование заказчика") +
        run(m.meta.customerAddress ? `, ${m.meta.customerAddress}.` : "."),
    ),
  );
  out.push(text(run("1.3. Основание для проведения работ: ") + value(m.meta.basis, "основание") + run(".")));
  out.push(
    text(
      run("1.4. Код Общего классификатора государственных закупок: ") +
        value(m.meta.okgzCode, "код ОКГЗ", { mono: true }) +
        run("."),
    ),
  );
  out.push(text(run("1.5. Источник финансирования: ") + value(m.meta.financing, "источник финансирования") + run(".")));
  out.push(
    text(
      run("1.6. Плановые сроки: начало работ — ") +
        (m.meta.startDate ? run(formatDate(m.meta.startDate)) : blank("дата начала")) +
        run(
          d.totalDays > 0
            ? `, общая продолжительность — ${d.totalDays} календарных дней` +
              (d.endDate ? `, окончание — ${formatDate(d.endDate)}.` : ".")
            : ".",
        ),
    ),
  );

  /* 2 */
  out.push(h1("2. Назначение и цели создания системы"));
  out.push(h2("2.1. Назначение системы"));
  out.push(text(value(m.purpose.problem, "описание решаемой проблемы")));
  out.push(h2("2.2. Цели создания системы"));
  if (m.purpose.goals.length === 0) {
    out.push(text(blank("цели не заданы")));
  } else {
    out.push(
      table(
        [8, 46, 46],
        ["№", "Цель", "Показатель достижения"],
        m.purpose.goals.map((g, i) => [
          { text: String(i + 1), mono: true },
          { text: g.statement, what: "цель" },
          { text: g.indicator, what: "показатель не задан" },
        ]),
      ),
    );
  }

  /* 3 */
  out.push(h1("3. Характеристика объекта автоматизации"));
  out.push(h2("3.1. Автоматизируемые процессы"));
  out.push(text(value(m.object.processes, "описание процессов")));
  out.push(h2("3.2. Пользователи системы"));
  if (m.object.userGroups.length === 0) {
    out.push(text(blank("группы пользователей не заданы")));
  } else {
    out.push(
      table(
        [45, 15, 40],
        ["Группа пользователей", "Численность", "Выполняемые функции"],
        m.object.userGroups.map((u) => [
          { text: u.name, what: "наименование" },
          { text: u.headcount ? String(u.headcount) : "—", mono: true },
          { text: u.duties, what: "—" },
        ]),
      ),
    );
  }
  out.push(h2("3.3. Объёмы обрабатываемых данных"));
  out.push(text(value(m.object.volumes, "объёмы данных")));
  if (m.object.existingSystems.trim()) {
    out.push(h2("3.4. Существующие системы"));
    out.push(text(run(m.object.existingSystems)));
  }

  /* 4 */
  out.push(h1("4. Требования к системе"));
  out.push(h2("4.1. Требования к системе в целом"));
  out.push(
    text(
      run(
        `4.1.1. Система должна обеспечивать одновременную работу не менее ${m.whole.concurrentUsers} пользователей при времени отклика на типовую операцию не более ${m.whole.responseTimeMs} мс.`,
      ),
    ),
  );
  out.push(text(run(`4.1.2. Коэффициент готовности системы — не ниже ${m.whole.availabilityPercent} %.`)));
  out.push(text(run(`4.1.3. Срок хранения данных в системе — не менее ${m.whole.retentionYears} лет.`)));
  out.push(
    text(
      run("4.1.4. Интерфейс системы и эксплуатационная документация выполняются на ") +
        (m.whole.languages.length
          ? run(m.whole.languages.map((l) => LANG_NAMES[l] ?? l).join(" и "))
          : blank("языки не выбраны")) +
        run(` ${m.whole.languages.length > 1 ? "языках" : "языке"}.`),
    ),
  );
  out.push(text(run("4.1.5. Аутентификация пользователей: ") + value(m.whole.authMethod, "способ аутентификации") + run(".")));

  out.push(text(run("4.1.6. Требования к защите информации. Система должна обеспечивать:")));
  if (m.whole.securityMeasures.length === 0) {
    out.push(text(blank("меры защиты не выбраны")));
  } else {
    m.whole.securityMeasures.forEach((code) => out.push(bullet(MEASURE_NAMES[code] ?? code)));
  }
  if (m.flags.isStateIS) {
    out.push(
      text(
        run(
          "Система относится к государственным информационным системам, в связи с чем защита информации, содержащейся в её базах данных, обеспечивается в соответствии с требованиями, установленными Правительством Кыргызской Республики.",
        ),
      ),
    );
  }

  if (m.flags.processesPersonalData) {
    out.push(h2("4.1.7. Требования к обработке информации персонального характера"));
    out.push(
      text(
        run("Система обрабатывает информацию персонального характера следующих категорий: ") +
          (m.pdn.categories.length
            ? run(m.pdn.categories.map((c) => PDN_NAMES[c] ?? c).join("; "))
            : blank("категории не указаны")) +
          run(". Предполагаемое число субъектов — ") +
          value(m.pdn.subjectsCount, "число субъектов") +
          run("."),
      ),
    );
    out.push(
      text(
        run("Основание обработки: ") +
          value(m.pdn.basis, "основание обработки") +
          run(
            ". Обработка осуществляется с соблюдением требований законодательства Кыргызской Республики об информации персонального характера.",
          ),
      ),
    );
    out.push(
      text(
        run(
          m.pdn.crossBorder
            ? "Предполагается трансграничная передача информации персонального характера. Исполнитель обязан обосновать обеспечение принимающей стороной уровня защиты прав субъектов данных, не ниже установленного законодательством Кыргызской Республики."
            : "Трансграничная передача информации персонального характера не предусматривается. Размещение баз данных за пределами Кыргызской Республики без согласования с заказчиком не допускается.",
        ),
      ),
    );
  }

  if (m.flags.needsTunduk) {
    out.push(h2("4.1.8. Требования к межведомственному взаимодействию"));
    out.push(
      text(
        run(
          "Обмен данными с информационными системами иных государственных органов осуществляется через систему межведомственного электронного взаимодействия «Түндүк». Прямое подключение к базам данных иных органов не допускается.",
        ),
      ),
    );
  }
  if (m.whole.integrations.trim()) {
    out.push(h2("4.1.9. Прочие требования к интеграции"));
    out.push(text(run(m.whole.integrations)));
  }

  out.push(h2("4.2. Требования к функциям"));
  if (d.functions.length === 0) {
    out.push(text(blank("функциональные требования не заданы")));
  } else {
    out.push(
      table(
        [10, 26, 50, 14],
        ["Код", "Функция", "Содержание требования", "Приоритет"],
        d.functions.map((f) => [
          { text: f.code, mono: true },
          { text: f.title, what: "наименование" },
          { text: f.description, what: "описание требования" },
          { text: PRIORITIES[f.priority] },
        ]),
      ),
    );
  }

  out.push(h2("4.3. Требования к видам обеспечения"));
  out.push(text(run("4.3.1. Информационное обеспечение: ") + value(m.support.information, "не заполнено")));
  out.push(text(run("4.3.2. Программное обеспечение: ") + value(m.support.software, "не заполнено")));
  out.push(text(run("4.3.3. Техническое обеспечение: ") + value(m.support.hardware, "не заполнено")));
  out.push(text(run("4.3.4. Лингвистическое обеспечение: ") + value(m.support.linguistic, "не заполнено")));
  out.push(text(run("4.3.5. Организационное обеспечение: ") + value(m.support.organizational, "не заполнено")));

  /* 5 */
  out.push(h1("5. Состав и содержание работ по созданию системы"));
  if (d.stages.length === 0) {
    out.push(text(blank("этапы работ не заданы")));
  } else {
    out.push(
      table(
        [8, 32, 42, 18],
        ["Этап", "Наименование", "Результат", "Срок"],
        d.stages.map((s) => [
          { text: s.code, mono: true },
          { text: s.name, what: "наименование этапа" },
          { text: s.deliverables, what: "результат не указан" },
          { text: `${s.startDay}–${s.endDay} дн.`, mono: true },
        ]),
      ),
    );
  }
  out.push(
    text(
      run(
        `5.1. Гарантийный срок на созданную систему — ${m.works.warrantyMonths} месяцев с даты подписания акта приёмки.`,
      ),
    ),
  );
  out.push(
    m.works.sourceCodeTransfer
      ? text(
          run(
            "5.2. Исполнитель передаёт заказчику исходный код созданной системы вместе с инструкцией по сборке и развёртыванию.",
          ),
        )
      : text(run("5.2. ") + blank("Передача исходного кода заказчику не предусмотрена")),
  );
  out.push(
    m.works.exclusiveRightsTransfer
      ? text(
          run(
            "5.3. Исключительные права на созданное программное обеспечение переходят к заказчику в полном объёме с момента подписания акта приёмки.",
          ),
        )
      : text(run("5.3. ") + blank("Передача исключительных прав заказчику не предусмотрена")),
  );

  /* 6 */
  out.push(h1("6. Порядок контроля и приёмки системы"));
  out.push(text(run("6.1. ") + value(m.acceptance.order, "порядок приёмки не описан")));
  out.push(text(run("6.2. Виды испытаний:")));
  if (m.acceptance.testTypes.length === 0) {
    out.push(text(blank("виды испытаний не выбраны")));
  } else {
    m.acceptance.testTypes.forEach((t) => out.push(bullet(TEST_NAMES[t] ?? t)));
  }
  out.push(text(run("6.3. Соответствие требований и критериев приёмки:")));
  if (d.traceability.length === 0) {
    out.push(text(blank("таблица строится из раздела 4.2")));
  } else {
    out.push(
      table(
        [10, 30, 60],
        ["Код", "Требование", "Критерий приёмки"],
        d.traceability.map((t) => [
          { text: t.code, mono: true },
          { text: t.title, what: "наименование" },
          { text: t.acceptance, what: "критерий не задан" },
        ]),
      ),
    );
  }

  /* 7 */
  out.push(h1("7. Требования к подготовке объекта автоматизации к вводу системы в действие"));
  out.push(text(run("7.1. Обучение пользователей: ") + value(m.preparation.training, "не заполнено")));
  out.push(text(run("7.2. Перенос данных: ") + value(m.preparation.migration, "не заполнено")));
  out.push(text(run("7.3. Организационные изменения: ") + value(m.preparation.orgChanges, "не заполнено")));

  /* 8 */
  out.push(h1("8. Требования к документированию"));
  out.push(text(run("Исполнитель передаёт заказчику следующие документы:")));
  out.push(
    table(
      [8, 67, 25],
      ["№", "Наименование документа", "Основание"],
      d.documentation.map((doc, i) => [
        { text: String(i + 1), mono: true },
        { text: doc.name },
        { text: doc.standard, mono: true },
      ]),
    ),
  );

  /* 9 */
  out.push(h1("9. Источники разработки"));
  d.sources.forEach((s, i) => out.push(text(run(`${i + 1}. ${s.citation}`))));
  out.push(
    text(
      run(
        "Раздел собран автоматически из справочника нормативных актов по фактически применённым в документе нормам.",
        { italic: true, grey: true },
      ),
    ),
  );

  return out.join("");
}

/* ══════════════════════════════════════════════════════════
   Части пакета OOXML
   ══════════════════════════════════════════════════════════ */

const XML_HEAD = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';

const CONTENT_TYPES =
  XML_HEAD +
  '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
  '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
  '<Default Extension="xml" ContentType="application/xml"/>' +
  '<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>' +
  '<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>' +
  "</Types>";

const ROOT_RELS =
  XML_HEAD +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>' +
  "</Relationships>";

const DOCUMENT_RELS =
  XML_HEAD +
  '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
  '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
  "</Relationships>";

const STYLES =
  XML_HEAD +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
  "<w:docDefaults><w:rPrDefault><w:rPr>" +
  '<w:rFonts w:ascii="Times New Roman" w:hAnsi="Times New Roman" w:cs="Times New Roman"/>' +
  '<w:sz w:val="24"/><w:szCs w:val="24"/><w:lang w:val="ru-RU"/>' +
  "</w:rPr></w:rPrDefault>" +
  '<w:pPrDefault><w:pPr><w:spacing w:after="120" w:line="276" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
  "</w:docDefaults>" +
  '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/>' +
  '<w:pPr><w:outlineLvl w:val="0"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="26"/></w:rPr></w:style>' +
  '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/>' +
  '<w:pPr><w:outlineLvl w:val="1"/><w:keepNext/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>' +
  "</w:styles>";

/** A4 книжной ориентации, поля 3 см слева и 1,5 см справа, 2 см сверху и снизу. */
const SECT_PR =
  '<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>' +
  '<w:pgMar w:top="1134" w:right="850" w:bottom="1134" w:left="1701" w:header="708" w:footer="708" w:gutter="0"/>' +
  "</w:sectPr>";

/** Собирает готовый .docx как последовательность байт. */
export function buildDocx(model: TzModel): Uint8Array<ArrayBuffer> {
  const document =
    XML_HEAD +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">' +
    "<w:body>" +
    body(model) +
    SECT_PR +
    "</w:body></w:document>";

  const encoder = new TextEncoder();
  const entries: ZipEntry[] = [
    // [Content_Types].xml обязан идти первым: некоторые читатели пакетов
    // ищут его в начале архива, не разбирая центральный каталог.
    { name: "[Content_Types].xml", data: encoder.encode(CONTENT_TYPES) },
    { name: "_rels/.rels", data: encoder.encode(ROOT_RELS) },
    { name: "word/document.xml", data: encoder.encode(document) },
    { name: "word/_rels/document.xml.rels", data: encoder.encode(DOCUMENT_RELS) },
    { name: "word/styles.xml", data: encoder.encode(STYLES) },
  ];

  return buildZip(entries);
}

/** Имя файла: «ТЗ — наименование системы.docx», без символов, ломающих путь. */
export function docxFileName(model: TzModel): string {
  const title = (model.meta.title || "без наименования").replace(/[\\/:*?"<>|]/g, " ").trim();
  return `ТЗ — ${title}.docx`;
}
