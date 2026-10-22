/** Public half of the owner's key. The private half never ships in this app. */
export const PUBLIC_JWK = {
  kty: "EC",
  crv: "P-256",
  x: "3b65LiY0Z98GCNs3wGShKGUGmM0eesWSM8y7vtT5Q7Q",
  y: "VkMjNIHyYHKFr3eKLniZ9rMfl2jLP6kVXMK5OtESyCY",
};

const PREFIX = "AMANAT1";

function b64urlToBytes(s) {
  const pad = s.length % 4 === 0 ? "" : "=".repeat(4 - (s.length % 4));
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function verifyLicense(code) {
  try {
    const parts = String(code || "").trim().split(".");
    if (parts.length !== 3 || parts[0] !== PREFIX) return null;
    const payloadBytes = b64urlToBytes(parts[1]);
    const sig = b64urlToBytes(parts[2]);
    const payload = JSON.parse(new TextDecoder().decode(payloadBytes));
    if (payload.v !== 1 || payload.product !== "amanat") return null;
    if (typeof payload.name !== "string" || payload.name.length > 80) return null;
    const key = await crypto.subtle.importKey(
      "jwk",
      PUBLIC_JWK,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      sig,
      payloadBytes,
    );
    return ok ? payload : null;
  } catch {
    return null;
  }
}
