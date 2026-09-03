/**
 * Словесные формулировки для кодов модели.
 *
 * Живут отдельно, потому что их используют два рендерера — экранное превью
 * (components/Preview.tsx) и генератор DOCX (lib/export/docx.ts). Если бы
 * каждый держал свою копию, документ на экране и документ в файле
 * разошлись бы при первой же правке формулировки.
 */

export const LANG_NAMES: Record<string, string> = {
  ky: "кыргызском",
  ru: "русском",
  en: "английском",
};

export const MEASURE_NAMES: Record<string, string> = {
  rbac: "разграничение доступа по ролям пользователей",
  audit: "журналирование действий пользователей с сохранением журнала",
  tls: "шифрование данных при передаче по каналам связи",
  at_rest: "шифрование данных при хранении",
  backup: "резервное копирование с возможностью восстановления",
  mfa: "двухфакторная аутентификация",
  pentest: "тестирование на проникновение до ввода в эксплуатацию",
};

export const TEST_NAMES: Record<string, string> = {
  functional: "функциональное тестирование",
  integration: "интеграционное тестирование",
  load: "нагрузочное тестирование",
  security: "проверка выполнения требований к защите информации",
  trial: "опытная эксплуатация",
};

export const PDN_NAMES: Record<string, string> = {
  fio: "фамилия, имя, отчество",
  pin: "персональный идентификационный номер",
  contacts: "контактные данные",
  address: "адрес проживания",
  biometric: "биометрические данные",
  special: "данные особой категории",
};

/** Дата в формате официального документа: 01 октября 2026 г. */
export function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "long", year: "numeric" });
}
