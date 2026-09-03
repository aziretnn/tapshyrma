/**
 * Выборка кодов Общего классификатора государственных закупок (ОКГЗ) по ИТ-предмету.
 *
 * Полный классификатор — http://zakupki.gov.kg/popp/resources/documents/okgz.pdf —
 * загружается в таблицу okgz_codes на этапе 7 плана. Здесь минимум для мастера:
 * код определяет профиль шаблона (АС или программное изделие).
 */

import type { SystemKind } from "@/lib/tz/model";

export type OkgzCode = {
  code: string;
  title: string;
  /** Профиль шаблона, который предлагается по умолчанию для этого кода. */
  suggests: SystemKind;
};

export const OKGZ_IT: OkgzCode[] = [
  { code: "72200000-7", title: "Услуги по разработке программного обеспечения и консультационные услуги", suggests: "software" },
  { code: "72212000-4", title: "Услуги по разработке прикладного программного обеспечения", suggests: "software" },
  { code: "72220000-3", title: "Услуги по системному и техническому консультированию", suggests: "new_as" },
  { code: "72230000-6", title: "Услуги по разработке заказного программного обеспечения", suggests: "new_as" },
  { code: "72240000-9", title: "Услуги по системному анализу и программированию", suggests: "new_as" },
  { code: "72250000-2", title: "Услуги по обслуживанию систем и услуги поддержки", suggests: "develop_as" },
  { code: "72260000-5", title: "Услуги, связанные с программным обеспечением", suggests: "develop_as" },
  { code: "72300000-8", title: "Услуги по обработке данных", suggests: "new_as" },
  { code: "72400000-4", title: "Интернет-услуги", suggests: "software" },
  { code: "48000000-8", title: "Пакеты программного обеспечения и информационные системы", suggests: "software" },
];

export function okgzByCode(code: string): OkgzCode | undefined {
  return OKGZ_IT.find((c) => c.code === code);
}
