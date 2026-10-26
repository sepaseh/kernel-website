export function textValue(data: FormData, key: string) {
  const value = data.get(key);
  return typeof value === "string" ? value.trim() : "";
}
export function passwordValue(data: FormData, key = "password") {
  const value = data.get(key);
  return typeof value === "string" ? value : "";
}
export function normalizeDigits(value: string) {
  // Each replacement receives one matched BMP digit, so its first code point exists.
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.codePointAt(0)! - 1776))
    .replace(/[٠-٩]/g, (digit) => String(digit.codePointAt(0)! - 1632));
}
export function mobileValue(data: FormData) {
  return normalizeDigits(textValue(data, "mobile")).replace(/[\s-]/g, "");
}
export function isMobile(value: string) {
  return /^09\d{9}$/.test(value);
}
