"""Чистый Python scrypt (RFC 7914).

Нужен потому, что в системном Python на этой машине hashlib.scrypt
отсутствует (LibreSSL 2.8.3), а хеш пароля обязан совпасть с тем, что
считает Node в lib/password.ts. Проверяется контрольным вектором RFC.
"""

import hashlib
import struct

MASK = 0xFFFFFFFF


def salsa20_8(b):
    """b — список из 16 32-битных слов; возвращает перемешанный список."""
    x = b[:]
    for _ in range(4):  # 8 раундов = 4 двойных
        # столбцы
        x[4] ^= (((x[0] + x[12]) & MASK) << 7 | ((x[0] + x[12]) & MASK) >> 25) & MASK
        x[8] ^= (((x[4] + x[0]) & MASK) << 9 | ((x[4] + x[0]) & MASK) >> 23) & MASK
        x[12] ^= (((x[8] + x[4]) & MASK) << 13 | ((x[8] + x[4]) & MASK) >> 19) & MASK
        x[0] ^= (((x[12] + x[8]) & MASK) << 18 | ((x[12] + x[8]) & MASK) >> 14) & MASK

        x[9] ^= (((x[5] + x[1]) & MASK) << 7 | ((x[5] + x[1]) & MASK) >> 25) & MASK
        x[13] ^= (((x[9] + x[5]) & MASK) << 9 | ((x[9] + x[5]) & MASK) >> 23) & MASK
        x[1] ^= (((x[13] + x[9]) & MASK) << 13 | ((x[13] + x[9]) & MASK) >> 19) & MASK
        x[5] ^= (((x[1] + x[13]) & MASK) << 18 | ((x[1] + x[13]) & MASK) >> 14) & MASK

        x[14] ^= (((x[10] + x[6]) & MASK) << 7 | ((x[10] + x[6]) & MASK) >> 25) & MASK
        x[2] ^= (((x[14] + x[10]) & MASK) << 9 | ((x[14] + x[10]) & MASK) >> 23) & MASK
        x[6] ^= (((x[2] + x[14]) & MASK) << 13 | ((x[2] + x[14]) & MASK) >> 19) & MASK
        x[10] ^= (((x[6] + x[2]) & MASK) << 18 | ((x[6] + x[2]) & MASK) >> 14) & MASK

        x[3] ^= (((x[15] + x[11]) & MASK) << 7 | ((x[15] + x[11]) & MASK) >> 25) & MASK
        x[7] ^= (((x[3] + x[15]) & MASK) << 9 | ((x[3] + x[15]) & MASK) >> 23) & MASK
        x[11] ^= (((x[7] + x[3]) & MASK) << 13 | ((x[7] + x[3]) & MASK) >> 19) & MASK
        x[15] ^= (((x[11] + x[7]) & MASK) << 18 | ((x[11] + x[7]) & MASK) >> 14) & MASK

        # строки
        x[1] ^= (((x[0] + x[3]) & MASK) << 7 | ((x[0] + x[3]) & MASK) >> 25) & MASK
        x[2] ^= (((x[1] + x[0]) & MASK) << 9 | ((x[1] + x[0]) & MASK) >> 23) & MASK
        x[3] ^= (((x[2] + x[1]) & MASK) << 13 | ((x[2] + x[1]) & MASK) >> 19) & MASK
        x[0] ^= (((x[3] + x[2]) & MASK) << 18 | ((x[3] + x[2]) & MASK) >> 14) & MASK

        x[6] ^= (((x[5] + x[4]) & MASK) << 7 | ((x[5] + x[4]) & MASK) >> 25) & MASK
        x[7] ^= (((x[6] + x[5]) & MASK) << 9 | ((x[6] + x[5]) & MASK) >> 23) & MASK
        x[4] ^= (((x[7] + x[6]) & MASK) << 13 | ((x[7] + x[6]) & MASK) >> 19) & MASK
        x[5] ^= (((x[4] + x[7]) & MASK) << 18 | ((x[4] + x[7]) & MASK) >> 14) & MASK

        x[11] ^= (((x[10] + x[9]) & MASK) << 7 | ((x[10] + x[9]) & MASK) >> 25) & MASK
        x[8] ^= (((x[11] + x[10]) & MASK) << 9 | ((x[11] + x[10]) & MASK) >> 23) & MASK
        x[9] ^= (((x[8] + x[11]) & MASK) << 13 | ((x[8] + x[11]) & MASK) >> 19) & MASK
        x[10] ^= (((x[9] + x[8]) & MASK) << 18 | ((x[9] + x[8]) & MASK) >> 14) & MASK

        x[12] ^= (((x[15] + x[14]) & MASK) << 7 | ((x[15] + x[14]) & MASK) >> 25) & MASK
        x[13] ^= (((x[12] + x[15]) & MASK) << 9 | ((x[12] + x[15]) & MASK) >> 23) & MASK
        x[14] ^= (((x[13] + x[12]) & MASK) << 13 | ((x[13] + x[12]) & MASK) >> 19) & MASK
        x[15] ^= (((x[14] + x[13]) & MASK) << 18 | ((x[14] + x[13]) & MASK) >> 14) & MASK

    return [(x[i] + b[i]) & MASK for i in range(16)]


def block_mix(b, r):
    """b — список из 32*r слов (2r блоков по 16 слов)."""
    x = b[16 * (2 * r - 1):16 * (2 * r)]
    even, odd = [], []
    for i in range(2 * r):
        blk = b[16 * i:16 * (i + 1)]
        x = salsa20_8([x[j] ^ blk[j] for j in range(16)])
        (even if i % 2 == 0 else odd).append(x)
    out = []
    for blk in even + odd:
        out.extend(blk)
    return out


def romix(b, n, r):
    x = b
    v = []
    for _ in range(n):
        v.append(x)
        x = block_mix(x, r)
    for _ in range(n):
        j = x[16 * (2 * r - 1)] % n          # Integerify: младшее слово последнего блока
        vj = v[j]
        x = block_mix([x[i] ^ vj[i] for i in range(len(x))], r)
    return x


def scrypt(password, salt, n, r, p, dklen):
    b = hashlib.pbkdf2_hmac("sha256", password, salt, 1, p * 128 * r)
    words = list(struct.unpack("<" + "I" * (len(b) // 4), b))

    per = 32 * r
    out_words = []
    for i in range(p):
        out_words.extend(romix(words[i * per:(i + 1) * per], n, r))

    b2 = struct.pack("<" + "I" * len(out_words), *out_words)
    return hashlib.pbkdf2_hmac("sha256", password, b2, 1, dklen)
