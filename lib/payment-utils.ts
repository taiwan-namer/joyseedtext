import { createHash, createDecipheriv } from "crypto";

// ========== 綠界 ECPay ==========

import { ecpayCheckMacValue } from "@/lib/crypto-utils";

// ========== 藍新 NewebPay ==========

function newebpayNormTradeInfoHex(encryptedHex: string): string {
  let hex = encryptedHex.trim().replace(/^\ufeff/, "").replace(/[\u200B-\u200D\uFEFF]/g, "");
  hex = hex.replace(/\s+/g, "");
  if ((hex.startsWith('"') && hex.endsWith('"')) || (hex.startsWith("'") && hex.endsWith("'"))) {
    hex = hex.slice(1, -1).trim().replace(/\s+/g, "");
  }
  return hex;
}

/** 解密結果是否像藍新 MPG 明文（query string 或 JSON），避免誤採垃圾字串。 */
function newebpayDecryptedLooksPlausible(plain: string): boolean {
  const t = plain.trim();
  if (t.length < 12) return false;
  if (t.startsWith("{")) return /"Status"|MerchantOrderNo|TradeStatus/i.test(t);
  return (
    /MerchantOrderNo/i.test(t) ||
    /TradeStatus/i.test(t) ||
    /TradeNo/i.test(t) ||
    /Status=/i.test(t) ||
    /Amt=/i.test(t) ||
    (/[&=]/.test(t) && /MerchantID/i.test(t))
  );
}

/**
 * 藍新 AES 解密（callback 回傳的 TradeInfo 解密）。
 * TradeInfo 官方為 hex；若含空白／BOM／零寬字元會導致 ERR_OSSL_BAD_DECRYPT，先正規化。
 *
 * 實務上 TradeSha 已通過時，少數回傳的 ciphertext 與 Node 預設 PKCS7 驗證不完全一致
 * （與 PHP/openssl 版本或填補方式有關），故依序嘗試：
 * 1) PKCS7 auto 2) 手動 PKCS7 3) 不驗 padding + 尾端剥除控制字元 4) depresto SDK 式：不驗 padding + 剥除 \x00-\x20
 */
export function newebpayAesDecrypt(encryptedHex: string, hashKey: string, hashIv: string): string {
  const hex = newebpayNormTradeInfoHex(encryptedHex);
  if (!/^[0-9a-fA-F]+$/.test(hex)) {
    throw new Error("NewebPay TradeInfo 非有效 hex 字串");
  }
  if (hex.length % 2 !== 0) {
    throw new Error("NewebPay TradeInfo hex 長度須為偶數");
  }
  const key = Buffer.from(hashKey, "utf8");
  const iv = Buffer.from(hashIv, "utf8");
  if (key.length !== 32 || iv.length !== 16) {
    throw new Error(
      `NewebPay AES: HashKey 須 32 bytes、HashIV 須 16 bytes，目前 key=${key.length} iv=${iv.length}`
    );
  }
  const buf = Buffer.from(hex, "hex");

  const tryPkcs7Auto = (): string => {
    const decipher = createDecipheriv("aes-256-cbc", key, iv);
    decipher.setAutoPadding(true);
    return decipher.update(buf).toString("utf8") + decipher.final("utf8");
  };

  const tryPkcs7Manual = (): string => {
    const decipher2 = createDecipheriv("aes-256-cbc", key, iv);
    decipher2.setAutoPadding(false);
    let dec = Buffer.concat([decipher2.update(buf), decipher2.final()]);
    const n = dec[dec.length - 1] ?? 0;
    if (n >= 1 && n <= 16 && dec.length >= n) {
      const tail = dec.subarray(dec.length - n);
      if (tail.every((b) => b === n)) {
        dec = dec.subarray(0, dec.length - n);
        return dec.toString("utf8");
      }
    }
    throw new Error("manual pkcs7");
  };

  /** 不驗證 block padding，只剥掉尾端控制字元（常見於與 PHP ZERO_PADDING 混用時的尾碼）。 */
  const tryNoPadStripTail = (): string => {
    const d = createDecipheriv("aes-256-cbc", key, iv);
    d.setAutoPadding(false);
    const dec = Buffer.concat([d.update(buf), d.final()]);
    return dec
      .toString("utf8")
      .replace(/[\x00-\x08\x0b-\x1f]+$/g, "")
      .replace(/\x00/g, "");
  };

  /** depresto newebpay-mpg-sdk：decrypt 後整段剥除 [\x00-\x20]（Notify 明文通常無需保留空白）。 */
  const tryNoPadSdkStrip = (): string => {
    const d = createDecipheriv("aes-256-cbc", key, iv);
    d.setAutoPadding(false);
    const dec = Buffer.concat([d.update(buf), d.final()]);
    return dec.toString("utf8").replace(/[\x00-\x20]+/g, "");
  };

  const strategies: Array<{ name: string; fn: () => string }> = [
    { name: "pkcs7_auto", fn: tryPkcs7Auto },
    { name: "pkcs7_manual", fn: tryPkcs7Manual },
    { name: "no_pad_strip_tail", fn: tryNoPadStripTail },
    { name: "no_pad_sdk_strip_controls", fn: tryNoPadSdkStrip },
  ];

  let lastError: unknown;
  for (const s of strategies) {
    try {
      const out = s.fn();
      if (newebpayDecryptedLooksPlausible(out)) {
        return out;
      }
    } catch (e) {
      lastError = e;
    }
  }

  // 最後再接受 pkcs7_auto 結果（若未通過 plausibility 但沒拋錯，理論上不會走到這）
  try {
    const out = tryPkcs7Auto();
    if (newebpayDecryptedLooksPlausible(out)) return out;
  } catch (e) {
    lastError = e;
  }

  throw new Error(
    `NewebPay AES 解密失敗（padding）；最後錯誤: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

/**
 * 藍新 TradeSha（MPG 2.0）：HashKey=${HashKey}&${TradeInfoHex}&HashIV=${HashIV} → SHA256 → 大寫 hex。
 */
export function newebpayTradeSha(tradeInfoEncryptedHex: string, hashKey: string, hashIv: string): string {
  const hex = newebpayNormTradeInfoHex(tradeInfoEncryptedHex);
  const str = `HashKey=${hashKey}&${hex}&HashIV=${hashIv}`;
  return createHash("sha256").update(str, "utf8").digest("hex").toUpperCase();
}

/**
 * 驗證藍新回傳的 TradeSha；少數環境／文件版本組字串略有差異，逐一比對。
 */
export function newebpayVerifyTradeSha(
  receivedTradeSha: string,
  tradeInfoEncryptedHex: string,
  hashKey: string,
  hashIv: string
): { ok: boolean; matchedVariant?: string } {
  const recv = receivedTradeSha.trim().replace(/\s+/g, "").toUpperCase();
  const hex = newebpayNormTradeInfoHex(tradeInfoEncryptedHex);
  const variants: { label: string; piece: string }[] = [
    { label: "HashKey&hex&HashIV", piece: `HashKey=${hashKey}&${hex}&HashIV=${hashIv}` },
    { label: "HashKey&TradeInfo=&HashIV", piece: `HashKey=${hashKey}&TradeInfo=${hex}&HashIV=${hashIv}` },
    { label: "HashKey&lower(hex)&HashIV", piece: `HashKey=${hashKey}&${hex.toLowerCase()}&HashIV=${hashIv}` },
    { label: "HashKey&upper(hex)&HashIV", piece: `HashKey=${hashKey}&${hex.toUpperCase()}&HashIV=${hashIv}` },
  ];
  for (const v of variants) {
    const expected = createHash("sha256").update(v.piece, "utf8").digest("hex").toUpperCase();
    if (recv === expected) return { ok: true, matchedVariant: v.label };
  }
  return { ok: false };
}
