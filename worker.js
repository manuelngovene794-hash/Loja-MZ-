const PLANS = {
  basico: { name: "Básico", price: 100 },
  padrao: { name: "Padrão", price: 200 },
  premium: { name: "Premium", price: 300 }
};
const MPESA_NUM = "853165207";
const MPESA_NOME = "Márcia";
const ADMIN_EMAIL = "manuelngovene794@gmail.com";

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // --- PLANOS ---
    if (url.pathname === "/api/plans") {
      return Response.json({ plans: PLANS, mpesa: MPESA_NUM, titular: MPESA_NOME });
    }

    // --- REGISTO COM 7 DIAS GRÁTIS ---
    if (url.pathname === "/api/register" && request.method === "POST") {
      const { name, email, password } = await request.json();
      const hash = await sha256(password);
      const r = await env.DB.prepare("INSERT INTO users (name, email, password) VALUES (?,?,?)").bind(name, email, hash).run();
      const userId = r.meta.last_row_id;
      const trialEnd = new Date(Date.now() + 7*24*60*60*1000).toISOString();
      await env.DB.prepare("INSERT INTO subscriptions (user_id, plan, price, status, expires_at) VALUES (?,?,?,?,?)").bind(userId, 'trial', 0, 'trial', trialEnd).run();
      return Response.json({ ok: true, id: userId, name, email });
    }

    // --- LOGIN ---
    if (url.pathname === "/api/login" && request.method === "POST") {
      const { email, password } = await request.json();
      const hash = await sha256(password);
      const user = await env.DB.prepare("SELECT id, name, email FROM users WHERE email=? AND password=?").bind(email, hash).first();
      if (!user) return Response.json({ ok: false, error: "Email ou senha errada" });
      return Response.json({ ok: true, ...user });
    }

    // --- VER SUBSCRIÇÃO ---
    if (url.pathname === "/api/my-sub") {
      const user_id = url.searchParams.get("user_id");
      const sub = await env.DB.prepare("SELECT * FROM subscriptions WHERE user_id=?").bind(user_id).first();
      return Response.json(sub || { status: 'trial', expires_at: new Date().toISOString() });
    }

    // --- CLIENTE DIZ QUE PAGOU ---
    if (url.pathname === "/api/pay" && request.method === "POST") {
      const { user_id, user_email, plan, mpesa_code } = await request.json();
      const p = PLANS[plan];
      await env.DB.prepare("INSERT INTO payments (user_id, user_email, plan, price, mpesa_code) VALUES (?,?,?,?,?)").bind(user_id, user_email, plan, p.price, mpesa_code).run();
      return Response.json({ ok: true });
    }

    // --- LISTAR PAGAMENTOS PENDENTES (ADMIN) ---
    if (url.pathname === "/api/admin/payments") {
      const list = await env.DB.prepare("SELECT * FROM payments WHERE status='pending' ORDER BY id DESC").all();
      return Response.json(list.results);
    }

    // --- APROVAR PAGAMENTO - 30 DIAS ---
    if (url.pathname === "/api/admin/approve" && request.method === "POST") {
      const { payment_id } = await request.json();
      const pay = await env.DB.prepare("SELECT * FROM payments WHERE id=?").bind(payment_id).first();
      const exp = new Date(Date.now() + 30*24*60*60*1000).toISOString();
      await env.DB.prepare("UPDATE payments SET status='approved' WHERE id=?").bind(payment_id).run();
      await env.DB.prepare("UPDATE subscriptions SET plan=?, price=?, status='active', expires_at=? WHERE user_id=?").bind(pay.plan, pay.price, exp, pay.user_id).run();
      return Response.json({ ok: true });
    }

    // --- PRODUTOS (teu código antigo continua aqui) ---
    if (url.pathname === "/api/products") {
      if (request.method === "GET") {
        const user_id = url.searchParams.get("user_id");
        const list = await env.DB.prepare("SELECT * FROM products WHERE user_id=?").bind(user_id).all();
        return Response.json(list.results);
      }
      if (request.method === "POST") {
        const { user_id, name, category, buy_price, sell_price, qty } = await request.json();
        await env.DB.prepare("INSERT INTO products (user_id, name, category, buy_price, sell_price, qty) VALUES (?,?,?,?,?,?)").bind(user_id, name, category, buy_price, sell_price, qty).run();
        return Response.json({ ok: true });
      }
    }

    return new Response("Not found", { status: 404 });
  }
};

async function sha256(str){
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(str));
  return [...new Uint8Array(buf)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
