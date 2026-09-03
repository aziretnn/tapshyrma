/**
 * Минимальный писатель ZIP-архива. Файл .docx — это ZIP с XML внутри.
 *
 * Почему свой, а не библиотека: на машине разработки не было npm, и брать
 * зависимость, которую нельзя ни установить, ни проверить, — плохая ставка.
 * Здесь ~80 строк, полностью детерминированных.
 *
 * Записи кладутся без сжатия (метод STORE). Word такие архивы открывает,
 * а отсутствие deflate убирает целый класс ошибок; документы весят десятки
 * килобайт, так что экономить нечего. Если размер когда-нибудь станет
 * проблемой — здесь добавляется zlib.deflateRawSync и метод 8.
 */

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[i] = c >>> 0;
  }
  return table;
})();

/** Экспортируется ради самопроверки scripts/check-docx.ts: она пересчитывает
 * контрольные суммы разобранного архива и сверяет их с записанными. */
export function crc32(data: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Растущий буфер: собирать архив кусками проще, чем считать размер заранее. */
class ByteWriter {
  private parts: Uint8Array[] = [];
  length = 0;

  bytes(data: Uint8Array): void {
    this.parts.push(data);
    this.length += data.length;
  }

  u16(value: number): void {
    this.bytes(new Uint8Array([value & 0xff, (value >>> 8) & 0xff]));
  }

  u32(value: number): void {
    this.bytes(
      new Uint8Array([
        value & 0xff,
        (value >>> 8) & 0xff,
        (value >>> 16) & 0xff,
        (value >>> 24) & 0xff,
      ]),
    );
  }

  concat(): Uint8Array<ArrayBuffer> {
    const out = new Uint8Array(this.length);
    let offset = 0;
    for (const part of this.parts) {
      out.set(part, offset);
      offset += part.length;
    }
    return out;
  }
}

export type ZipEntry = { name: string; data: Uint8Array };

/**
 * Отметка времени внутри архива фиксирована.
 *
 * Это не небрежность: одна и та же модель обязана давать байт в байт
 * одинаковый файл, иначе два экспорта одной версии документа различаются,
 * и сравнить их между собой невозможно.
 */
const DOS_TIME = 0;
const DOS_DATE = 0x2821; // 1 января 2000 года

export function buildZip(entries: ZipEntry[]): Uint8Array<ArrayBuffer> {
  const out = new ByteWriter();
  const central: { name: Uint8Array; crc: number; size: number; offset: number }[] = [];
  const encoder = new TextEncoder();

  for (const entry of entries) {
    const name = encoder.encode(entry.name);
    const crc = crc32(entry.data);
    const offset = out.length;

    out.u32(0x04034b50); // сигнатура локального заголовка
    out.u16(20); // минимальная версия
    out.u16(0x0800); // имена в UTF-8
    out.u16(0); // метод: без сжатия
    out.u16(DOS_TIME);
    out.u16(DOS_DATE);
    out.u32(crc);
    out.u32(entry.data.length); // сжатый размер
    out.u32(entry.data.length); // исходный размер
    out.u16(name.length);
    out.u16(0); // extra
    out.bytes(name);
    out.bytes(entry.data);

    central.push({ name, crc, size: entry.data.length, offset });
  }

  const centralOffset = out.length;

  for (const item of central) {
    out.u32(0x02014b50); // сигнатура записи каталога
    out.u16(20); // версия создателя
    out.u16(20); // минимальная версия
    out.u16(0x0800);
    out.u16(0);
    out.u16(DOS_TIME);
    out.u16(DOS_DATE);
    out.u32(item.crc);
    out.u32(item.size);
    out.u32(item.size);
    out.u16(item.name.length);
    out.u16(0); // extra
    out.u16(0); // комментарий
    out.u16(0); // номер диска
    out.u16(0); // внутренние атрибуты
    out.u32(0); // внешние атрибуты
    out.u32(item.offset);
    out.bytes(item.name);
  }

  const centralSize = out.length - centralOffset;

  out.u32(0x06054b50); // конец центрального каталога
  out.u16(0);
  out.u16(0);
  out.u16(central.length);
  out.u16(central.length);
  out.u32(centralSize);
  out.u32(centralOffset);
  out.u16(0); // комментарий архива

  return out.concat();
}
