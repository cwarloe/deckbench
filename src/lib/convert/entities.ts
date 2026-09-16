const AMP = String.fromCharCode(38);

export function escapeXml(value: string): string {
  return value
    .replaceAll("&", `${AMP}amp;`)
    .replaceAll("<", `${AMP}lt;`)
    .replaceAll(">", `${AMP}gt;`)
    .replaceAll('"', `${AMP}quot;`);
}

export function decodeBasicEntities(value: string): string {
  return value
    .replaceAll(`${AMP}nbsp;`, " ")
    .replaceAll(`${AMP}amp;`, "&")
    .replaceAll(`${AMP}lt;`, "<")
    .replaceAll(`${AMP}gt;`, ">")
    .replaceAll(`${AMP}quot;`, '"');
}
