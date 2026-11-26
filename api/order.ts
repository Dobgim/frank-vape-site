/**
 * POST /api/order — emails a wholesale order from a licensed retailer.
 *
 * Vercel environment variables (Project → Settings → Environment Variables):
 *   ORDER_EMAIL     required. Inbox that receives orders. Kept server-side so
 *                   it never appears in the public bundle or repository.
 *   RESEND_API_KEY  optional. If set, mail is sent through Resend (resend.com).
 *   ORDER_FROM      optional, with Resend: verified sender, e.g.
 *                   "Wholesale <orders@yourdomain.com>". Defaults to Resend's
 *                   test sender, which can only deliver to your Resend login email.
 * Without RESEND_API_KEY the order goes through FormSubmit (formsubmit.co):
 * no account needed, but the first order triggers a one-time activation email
 * to ORDER_EMAIL that must be confirmed before orders are delivered.
 */

interface Req {
  method?: string;
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
}
interface Res {
  status: (code: number) => Res;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
}

interface OrderLine { slug: string; name: string; type: string; units: number }
interface OrderBody {
  business?: string;
  license?: string;
  contact?: string;
  email?: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  zip?: string;
  notes?: string;
  attest?: boolean;
  hp?: string;
  lines?: OrderLine[];
}

const clean = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u001f\u007f]+/g, " ").trim().slice(0, max);
const cleanBlock = (v: unknown, max: number) => String(v ?? "").replace(/[\u0000-\u0009\u000b-\u001f\u007f]+/g, " ").trim().slice(0, max);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SLUG_RE = /^[a-z0-9-]{1,48}$/;

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export default async function handler(req: Req, res: Res) {
  res.setHeader("Cache-Control", "no-store");
  if (req.method !== "POST") return res.status(405).json({ error: "method_not_allowed" });

  const to = process.env.ORDER_EMAIL;
  if (!to) return res.status(503).json({ error: "not_configured" });

  let body: OrderBody;
  try {
    body = (typeof req.body === "string" ? JSON.parse(req.body) : req.body) as OrderBody;
  } catch {
    return res.status(400).json({ error: "invalid_json" });
  }
  if (!body || typeof body !== "object") return res.status(400).json({ error: "invalid" });

  const ref = "WO-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  if (body.hp) return res.status(200).json({ ok: true, ref }); // honeypot: drop quietly

  const order = {
    business: clean(body.business, 160),
    license: clean(body.license, 40),
    contact: clean(body.contact, 120),
    email: clean(body.email, 254).toLowerCase(),
    phone: clean(body.phone, 40),
    address: clean(body.address, 200),
    city: clean(body.city, 100),
    state: clean(body.state, 40),
    zip: clean(body.zip, 10),
    notes: cleanBlock(body.notes, 2000),
  };
  const lines = (Array.isArray(body.lines) ? body.lines : [])
    .slice(0, 50)
    .map((l) => ({ slug: clean(l?.slug, 48), name: clean(l?.name, 80), type: clean(l?.type, 20), units: Math.floor(Number(l?.units)) }))
    .filter((l) => SLUG_RE.test(l.slug) && l.name && l.units > 0 && l.units <= 9999);

  const missing = (["business", "license", "contact", "email", "phone", "address", "city", "state"] as const).filter((k) => !order[k]);
  if (missing.length || !EMAIL_RE.test(order.email) || body.attest !== true || !lines.length) {
    return res.status(400).json({ error: "invalid", missing });
  }

  const totalUnits = lines.reduce((a, l) => a + l.units, 0);
  const subject = `Wholesale order ${ref} — ${order.business} (${totalUnits} units)`;
  const text = [
    `Wholesale order ${ref}`,
    `Received: ${new Date().toISOString()}`,
    "",
    "RETAILER",
    `Business: ${order.business}`,
    `License #: ${order.license}`,
    `Contact: ${order.contact}`,
    `Email: ${order.email}`,
    `Phone: ${order.phone}`,
    `Address: ${order.address}, ${order.city}, ${order.state} ${order.zip}`.trim(),
    "",
    "ORDER",
    ...lines.map((l) => `${String(l.units).padStart(5)} × ${l.name} (${l.type})`),
    `${String(totalUnits).padStart(5)} units total`,
    "",
    "NOTES",
    order.notes || "—",
    "",
    "The retailer confirmed it holds an active state cannabis retail license. Verify the license before fulfilling.",
  ].join("\n");

  const rows = lines.map((l) => `<tr><td style="padding:4px 12px 4px 0;text-align:right">${l.units}</td><td style="padding:4px 12px 4px 0">${escapeHtml(l.name)}</td><td style="padding:4px 0;color:#555">${escapeHtml(l.type)}</td></tr>`).join("");
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#000">
<h2 style="margin:0 0 4px">Wholesale order ${ref}</h2>
<p style="margin:0 0 16px;color:#555">${escapeHtml(new Date().toUTCString())}</p>
<h3 style="margin:16px 0 6px">Retailer</h3>
<p style="margin:0;line-height:1.6"><b>${escapeHtml(order.business)}</b><br>License #: ${escapeHtml(order.license)}<br>${escapeHtml(order.contact)} · <a href="mailto:${escapeHtml(order.email)}">${escapeHtml(order.email)}</a> · ${escapeHtml(order.phone)}<br>${escapeHtml(`${order.address}, ${order.city}, ${order.state} ${order.zip}`)}</p>
<h3 style="margin:16px 0 6px">Order</h3>
<table style="border-collapse:collapse">${rows}<tr><td style="padding:6px 12px 0 0;text-align:right;border-top:1px solid #ddd"><b>${totalUnits}</b></td><td colspan="2" style="padding:6px 0 0;border-top:1px solid #ddd"><b>units total</b></td></tr></table>
<h3 style="margin:16px 0 6px">Notes</h3>
<p style="margin:0;white-space:pre-wrap">${escapeHtml(order.notes || "—")}</p>
<p style="margin:16px 0 0;color:#555;font-size:12px">The retailer confirmed it holds an active state cannabis retail license. Verify the license before fulfilling.</p>
</div>`;

  try {
    if (process.env.RESEND_API_KEY) {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: process.env.ORDER_FROM || "Wholesale Orders <onboarding@resend.dev>",
          to: [to],
          reply_to: order.email,
          subject,
          text,
          html,
        }),
      });
      if (!r.ok) throw new Error("resend " + r.status + " " + (await r.text()).slice(0, 300));
    } else {
      const origin = `https://${String(req.headers["x-forwarded-host"] || req.headers.host || "localhost")}`;
      const r = await fetch(`https://formsubmit.co/ajax/${encodeURIComponent(to)}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json", Origin: origin, Referer: origin + "/wholesale" },
        body: JSON.stringify({
          _subject: subject,
          _replyto: order.email,
          _template: "box",
          _captcha: "false",
          "Order reference": ref,
          Business: order.business,
          "License #": order.license,
          Contact: order.contact,
          Email: order.email,
          Phone: order.phone,
          Address: `${order.address}, ${order.city}, ${order.state} ${order.zip}`.trim(),
          Order: lines.map((l) => `${l.units} × ${l.name} (${l.type})`).join("\n"),
          "Total units": String(totalUnits),
          Notes: order.notes || "—",
        }),
      });
      const data = (await r.json().catch(() => ({}))) as { success?: string | boolean; message?: string };
      if (!r.ok || String(data.success) === "false") throw new Error("formsubmit " + r.status + " " + (data.message || ""));
    }
  } catch (err) {
    console.error("[order] email delivery failed", err);
    return res.status(502).json({ error: "delivery_failed" });
  }

  return res.status(200).json({ ok: true, ref });
}
