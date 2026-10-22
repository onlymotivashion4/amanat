function pemToBuf(pem) {
  const b64 = String(pem).replace(/-----[^-]+-----/g, "").replace(/\s+/g, "");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

function b64url(bytes) {
  let bin = "";
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (const n of arr) bin += String.fromCharCode(n);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function issueCode(pem, name) {
  const clean = String(name || "").trim().slice(0, 80);
  if (!clean) throw new Error("Write the buyer’s name.");
  const key = await crypto.subtle.importKey(
    "pkcs8",
    pemToBuf(pem),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const payload = { v: 1, product: "amanat", name: clean, iat: new Date().toISOString().slice(0, 10) };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const sig = new Uint8Array(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, key, bytes));
  return `AMANAT1.${b64url(bytes)}.${b64url(sig)}`;
}
