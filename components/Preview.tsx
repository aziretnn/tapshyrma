"use client";

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

/**
 * Рендер документа по структуре ГОСТ 34.602.
 *
 * Единственный источник содержания — модель. Здесь нет ни одного поля,
 * которое пользователь мог бы отредактировать напрямую: документ выводится,
 * а не пишется. Тот же обход разделов позже переиспользует генератор DOCX
 * (этап 5–6 плана), поэтому логика подстановки живёт в lib/tz/derive.ts,
 * а не в этом компоненте.
 */

/** Заглушка для незаполненного места: документ честно показывает пробел. */
function Blank({ what }: { what: string }) {
  return <span className="doc-empty">[{what}]</span>;
}

function Text({ value, what }: { value: string; what: string }) {
  const v = value.trim();
  return v ? <>{v}</> : <Blank what={what} />;
}

export default function Preview({ model }: { model: TzModel }) {
  const d = derive(model);

  return (
    <article className="doc">
      <div className="doc-approve">
        <div>УТВЕРЖДАЮ</div>
        <div>
          <Text value={model.meta.headPosition} what="должность руководителя" />
        </div>
        <div>
          <Text value={model.meta.customerShortName} what="наименование органа" />
        </div>
        <div style={{ marginTop: "0.6rem" }}>
          ______________ <Text value={model.meta.headName} what="Ф. И. О." />
        </div>
        <div>«____» ______________ 20___ г.</div>
      </div>

      <header className="doc-title">
        <h3>Техническое задание</h3>
        <p>
          на <Text value={SYSTEM_KINDS[model.systemKind].toLowerCase()} what="предмет" />
        </p>
        <p style={{ fontWeight: 600, marginTop: "0.4rem" }}>
          «<Text value={model.meta.title} what="наименование системы" />»
        </p>
      </header>

      {/* 1 */}
      <h4>1. Общие сведения</h4>
      <p>
        1.1. Полное наименование системы: «<Text value={model.meta.title} what="наименование системы" />».
      </p>
      <p>
        1.2. Заказчик: <Text value={model.meta.customerName} what="наименование заказчика" />
        {model.meta.customerAddress ? `, ${model.meta.customerAddress}` : ""}.
      </p>
      <p>
        1.3. Основание для проведения работ: <Text value={model.meta.basis} what="основание" />.
      </p>
      <p>
        1.4. Код Общего классификатора государственных закупок:{" "}
        {model.meta.okgzCode ? (
          <span className="doc-code">{model.meta.okgzCode}</span>
        ) : (
          <Blank what="код ОКГЗ" />
        )}
        .
      </p>
      <p>
        1.5. Источник финансирования: <Text value={model.meta.financing} what="источник финансирования" />.
      </p>
      <p>
        1.6. Плановые сроки: начало работ —{" "}
        {model.meta.startDate ? formatDate(model.meta.startDate) : <Blank what="дата начала" />}
        {d.totalDays > 0 ? (
          <>
            , общая продолжительность — {d.totalDays} календарных дней
            {d.endDate ? `, окончание — ${formatDate(d.endDate)}` : ""}
          </>
        ) : null}
        .
      </p>

      {/* 2 */}
      <h4>2. Назначение и цели создания системы</h4>
      <h5>2.1. Назначение системы</h5>
      <p>
        <Text value={model.purpose.problem} what="описание решаемой проблемы" />
      </p>
      <h5>2.2. Цели создания системы</h5>
      {model.purpose.goals.length === 0 ? (
        <p>
          <Blank what="цели не заданы" />
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: "8%" }}>№</th>
              <th style={{ width: "46%" }}>Цель</th>
              <th>Показатель достижения</th>
            </tr>
          </thead>
          <tbody>
            {model.purpose.goals.map((g, i) => (
              <tr key={g.id}>
                <td className="doc-code">{i + 1}</td>
                <td>
                  <Text value={g.statement} what="цель" />
                </td>
                <td>
                  <Text value={g.indicator} what="показатель не задан" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 3 */}
      <h4>3. Характеристика объекта автоматизации</h4>
      <h5>3.1. Автоматизируемые процессы</h5>
      <p>
        <Text value={model.object.processes} what="описание процессов" />
      </p>
      <h5>3.2. Пользователи системы</h5>
      {model.object.userGroups.length === 0 ? (
        <p>
          <Blank what="группы пользователей не заданы" />
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Группа пользователей</th>
              <th style={{ width: "15%" }}>Численность</th>
              <th style={{ width: "40%" }}>Выполняемые функции</th>
            </tr>
          </thead>
          <tbody>
            {model.object.userGroups.map((u) => (
              <tr key={u.id}>
                <td>
                  <Text value={u.name} what="наименование" />
                </td>
                <td className="doc-code">{u.headcount || "—"}</td>
                <td>
                  <Text value={u.duties} what="—" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <h5>3.3. Объёмы обрабатываемых данных</h5>
      <p>
        <Text value={model.object.volumes} what="объёмы данных" />
      </p>
      {model.object.existingSystems.trim() ? (
        <>
          <h5>3.4. Существующие системы</h5>
          <p>{model.object.existingSystems}</p>
        </>
      ) : null}

      {/* 4 */}
      <h4>4. Требования к системе</h4>

      <h5>4.1. Требования к системе в целом</h5>
      <p>
        4.1.1. Система должна обеспечивать одновременную работу не менее{" "}
        {model.whole.concurrentUsers} пользователей при времени отклика на типовую операцию не более{" "}
        {model.whole.responseTimeMs} мс.
      </p>
      <p>
        4.1.2. Коэффициент готовности системы — не ниже {model.whole.availabilityPercent} %.
      </p>
      <p>
        4.1.3. Срок хранения данных в системе — не менее {model.whole.retentionYears} лет.
      </p>
      <p>
        4.1.4. Интерфейс системы и эксплуатационная документация выполняются на{" "}
        {model.whole.languages.length > 0 ? (
          model.whole.languages.map((l) => LANG_NAMES[l] ?? l).join(" и ")
        ) : (
          <Blank what="языки не выбраны" />
        )}{" "}
        {model.whole.languages.length > 1 ? "языках" : "языке"}.
      </p>
      <p>
        4.1.5. Аутентификация пользователей:{" "}
        <Text value={model.whole.authMethod} what="способ аутентификации" />.
      </p>

      <p>4.1.6. Требования к защите информации. Система должна обеспечивать:</p>
      {model.whole.securityMeasures.length === 0 ? (
        <p>
          <Blank what="меры защиты не выбраны" />
        </p>
      ) : (
        <ul>
          {model.whole.securityMeasures.map((m) => (
            <li key={m}>{MEASURE_NAMES[m] ?? m}</li>
          ))}
        </ul>
      )}
      {model.flags.isStateIS ? (
        <p>
          Система относится к государственным информационным системам, в связи с чем защита
          информации, содержащейся в её базах данных, обеспечивается в соответствии с требованиями,
          установленными Правительством Кыргызской Республики.
        </p>
      ) : null}

      {model.flags.processesPersonalData ? (
        <>
          <h5>4.1.7. Требования к обработке информации персонального характера</h5>
          <p>
            Система обрабатывает информацию персонального характера следующих категорий:{" "}
            {model.pdn.categories.length > 0 ? (
              model.pdn.categories.map((c) => PDN_NAMES[c] ?? c).join("; ")
            ) : (
              <Blank what="категории не указаны" />
            )}
            . Предполагаемое число субъектов —{" "}
            <Text value={model.pdn.subjectsCount} what="число субъектов" />.
          </p>
          <p>
            Основание обработки: <Text value={model.pdn.basis} what="основание обработки" />.
            Обработка осуществляется с соблюдением требований законодательства Кыргызской Республики
            об информации персонального характера.
          </p>
          {model.pdn.crossBorder ? (
            <p>
              Предполагается трансграничная передача информации персонального характера. Исполнитель
              обязан обосновать обеспечение принимающей стороной уровня защиты прав субъектов
              данных, не ниже установленного законодательством Кыргызской Республики.
            </p>
          ) : (
            <p>
              Трансграничная передача информации персонального характера не предусматривается.
              Размещение баз данных за пределами Кыргызской Республики без согласования с заказчиком
              не допускается.
            </p>
          )}
        </>
      ) : null}

      {model.flags.needsTunduk ? (
        <>
          <h5>4.1.8. Требования к межведомственному взаимодействию</h5>
          <p>
            Обмен данными с информационными системами иных государственных органов осуществляется
            через систему межведомственного электронного взаимодействия «Түндүк». Прямое подключение
            к базам данных иных органов не допускается.
          </p>
        </>
      ) : null}

      {model.whole.integrations.trim() ? (
        <>
          <h5>4.1.9. Прочие требования к интеграции</h5>
          <p>{model.whole.integrations}</p>
        </>
      ) : null}

      <h5>4.2. Требования к функциям</h5>
      {d.functions.length === 0 ? (
        <p>
          <Blank what="функциональные требования не заданы" />
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: "10%" }}>Код</th>
              <th style={{ width: "26%" }}>Функция</th>
              <th>Содержание требования</th>
              <th style={{ width: "14%" }}>Приоритет</th>
            </tr>
          </thead>
          <tbody>
            {d.functions.map((f) => (
              <tr key={f.id}>
                <td className="doc-code">{f.code}</td>
                <td>
                  <Text value={f.title} what="наименование" />
                </td>
                <td>
                  <Text value={f.description} what="описание требования" />
                </td>
                <td>{PRIORITIES[f.priority]}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h5>4.3. Требования к видам обеспечения</h5>
      <p>
        4.3.1. Информационное обеспечение:{" "}
        <Text value={model.support.information} what="не заполнено" />
      </p>
      <p>
        4.3.2. Программное обеспечение: <Text value={model.support.software} what="не заполнено" />
      </p>
      <p>
        4.3.3. Техническое обеспечение: <Text value={model.support.hardware} what="не заполнено" />
      </p>
      <p>
        4.3.4. Лингвистическое обеспечение:{" "}
        <Text value={model.support.linguistic} what="не заполнено" />
      </p>
      <p>
        4.3.5. Организационное обеспечение:{" "}
        <Text value={model.support.organizational} what="не заполнено" />
      </p>

      {/* 5 */}
      <h4>5. Состав и содержание работ по созданию системы</h4>
      {d.stages.length === 0 ? (
        <p>
          <Blank what="этапы работ не заданы" />
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: "8%" }}>Этап</th>
              <th style={{ width: "32%" }}>Наименование</th>
              <th>Результат</th>
              <th style={{ width: "18%" }}>Срок</th>
            </tr>
          </thead>
          <tbody>
            {d.stages.map((s) => (
              <tr key={s.id}>
                <td className="doc-code">{s.code}</td>
                <td>
                  <Text value={s.name} what="наименование этапа" />
                </td>
                <td>
                  <Text value={s.deliverables} what="результат не указан" />
                </td>
                <td className="doc-code">
                  {s.startDay}–{s.endDay} дн.
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p>
        5.1. Гарантийный срок на созданную систему — {model.works.warrantyMonths} месяцев с даты
        подписания акта приёмки.
      </p>
      {model.works.sourceCodeTransfer ? (
        <p>
          5.2. Исполнитель передаёт заказчику исходный код созданной системы вместе с инструкцией по
          сборке и развёртыванию.
        </p>
      ) : (
        <p>
          5.2. <span className="doc-empty">Передача исходного кода заказчику не предусмотрена.</span>
        </p>
      )}
      {model.works.exclusiveRightsTransfer ? (
        <p>
          5.3. Исключительные права на созданное программное обеспечение переходят к заказчику в
          полном объёме с момента подписания акта приёмки.
        </p>
      ) : (
        <p>
          5.3.{" "}
          <span className="doc-empty">
            Передача исключительных прав заказчику не предусмотрена.
          </span>
        </p>
      )}

      {/* 6 */}
      <h4>6. Порядок контроля и приёмки системы</h4>
      <p>
        6.1. <Text value={model.acceptance.order} what="порядок приёмки не описан" />
      </p>
      <p>6.2. Виды испытаний:</p>
      {model.acceptance.testTypes.length === 0 ? (
        <p>
          <Blank what="виды испытаний не выбраны" />
        </p>
      ) : (
        <ul>
          {model.acceptance.testTypes.map((t) => (
            <li key={t}>{TEST_NAMES[t] ?? t}</li>
          ))}
        </ul>
      )}
      <p>6.3. Соответствие требований и критериев приёмки:</p>
      {d.traceability.length === 0 ? (
        <p>
          <Blank what="таблица строится из раздела 4.2" />
        </p>
      ) : (
        <table>
          <thead>
            <tr>
              <th style={{ width: "10%" }}>Код</th>
              <th style={{ width: "30%" }}>Требование</th>
              <th>Критерий приёмки</th>
            </tr>
          </thead>
          <tbody>
            {d.traceability.map((t) => (
              <tr key={t.code}>
                <td className="doc-code">{t.code}</td>
                <td>
                  <Text value={t.title} what="наименование" />
                </td>
                <td>
                  <Text value={t.acceptance} what="критерий не задан" />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* 7 */}
      <h4>7. Требования к подготовке объекта автоматизации к вводу системы в действие</h4>
      <p>
        7.1. Обучение пользователей: <Text value={model.preparation.training} what="не заполнено" />
      </p>
      <p>
        7.2. Перенос данных: <Text value={model.preparation.migration} what="не заполнено" />
      </p>
      <p>
        7.3. Организационные изменения:{" "}
        <Text value={model.preparation.orgChanges} what="не заполнено" />
      </p>

      {/* 8 */}
      <h4>8. Требования к документированию</h4>
      <p>Исполнитель передаёт заказчику следующие документы:</p>
      <table>
        <thead>
          <tr>
            <th style={{ width: "8%" }}>№</th>
            <th>Наименование документа</th>
            <th style={{ width: "25%" }}>Основание</th>
          </tr>
        </thead>
        <tbody>
          {d.documentation.map((doc, i) => (
            <tr key={doc.id}>
              <td className="doc-code">{i + 1}</td>
              <td>{doc.name}</td>
              <td className="doc-code">{doc.standard}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* 9 */}
      <h4>9. Источники разработки</h4>
      <ol>
        {d.sources.map((s) => (
          <li key={s.actId}>{s.citation}</li>
        ))}
      </ol>
      <p className="field-hint" style={{ fontFamily: "var(--ff-body)" }}>
        Раздел собран автоматически из справочника нормативных актов по фактически применённым в
        документе нормам и вручную не редактируется.
      </p>
    </article>
  );
}
