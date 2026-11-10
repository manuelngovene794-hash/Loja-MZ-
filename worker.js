export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const jsonH = { "Content-Type": "application/json" };

    const getUserId = () => {
      const c = request.headers.get("Cookie") || "";
      const m = c.match(/loja_session=([^;]+)/);
      return m ? decodeURIComponent(m[1]) : null;
    };
    const hash = async (p) => [...new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(p)))].map(b=>b.toString(16).padStart(2,"0")).join("");
    const ok = (obj, extra={}) => new Response(JSON.stringify(obj), { headers: { ...jsonH, ...extra } });
    const err = (msg, status=400) => new Response(JSON.stringify({ error: msg }), { status, headers: jsonH });
    const cookie = (uid) => `loja_session=${encodeURIComponent(uid)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000`;

    // --- REGISTER ---
    if (url.pathname === "/api/register" && request.method === "POST") {
      try {
        const { name, email, password } = await request.json();
        if(!name || !email || !password) return err("Preenche tudo");
        const id = crypto.randomUUID();
        await env.DB.prepare("INSERT INTO users (id,name,email,password) VALUES (?,?,?,?)").bind(id, name, email.toLowerCase(), await hash(password)).run();
        return ok({ user: { id, name, email } }, { "Set-Cookie": cookie(id) });
      } catch(e){ return err("Email já existe"); }
    }

    // --- LOGIN ---
    if (url.pathname === "/api/login" && request.method === "POST") {
      const { email, password } = await request.json();
      const u = await env.DB.prepare("SELECT id,name,email FROM users WHERE email=? AND password=?").bind(email.toLowerCase(), await hash(password)).first();
      if(!u) return err("Email ou senha errada", 401);
      return ok({ user: u }, { "Set-Cookie": cookie(u.id) });
    }

    // --- LOGOUT ---
    if (url.pathname === "/api/logout" && request.method === "POST") {
      return ok({ ok:true }, { "Set-Cookie": "loja_session=; Path=/; Max-Age=0" });
    }

    const uid = getUserId();
    if (url.pathname.startsWith("/api/") && !uid) return err("Sessão inválida", 401);

    // --- ME ---
    if (url.pathname === "/api/me") {
      const u = await env.DB.prepare("SELECT id,name,email,plan,expires_at FROM users WHERE id=?").bind(uid).first();
      if(!u) return err("Sessão inválida", 401);
      return ok({ user: u });
    }

    // --- DASHBOARD ---
    if (url.pathname === "/api/dashboard") {
      const sales = await env.DB.prepare("SELECT COALESCE(SUM(total),0) as t FROM sales WHERE user_id=?").bind(uid).first();
      const prods = await env.DB.prepare("SELECT COUNT(*) as c, COALESCE(SUM(stock),0) as s, SUM(CASE WHEN stock<=2 THEN 1 ELSE 0 END) as low FROM products WHERE user_id=?").bind(uid).first();
      const exps = await env.DB.prepare("SELECT COALESCE(SUM(amount),0) as t FROM expenses WHERE user_id=?").bind(uid).first();
      return ok({ stats: { sales_total: sales.t, product_count: prods.c, stock_units: prods.s, low_stock: prods.low, expenses_total: exps.t } });
    }

    // --- PRODUCTS ---
    if (url.pathname === "/api/products" && request.method === "GET") {
      const r = await env.DB.prepare("SELECT * FROM products WHERE user_id=? ORDER BY created_at DESC").bind(uid).all();
      return ok({ products: r.results });
    }
    if (url.pathname === "/api/products" && request.method === "POST") {
      const { name, category, cost_price, sale_price, stock } = await request.json();
      const id = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO products (id,user_id,name,category,cost_price,sale_price,stock) VALUES (?,?,?,?,?,?,?)").bind(id, uid, name, category||"", cost_price||0, sale_price||0, stock||0).run();
      return ok({ ok:true, id });
    }

    // --- SALES ---
    if (url.pathname === "/api/sales" && request.method === "GET") {
      const r = await env.DB.prepare("SELECT * FROM sales WHERE user_id=? ORDER BY created_at DESC").bind(uid).all();
      return ok({ sales: r.results });
    }
    if (url.pathname === "/api/sales" && request.method === "POST") {
      const { items } = await request.json();
      let total = 0;
      for (const it of items) {
        const p = await env.DB.prepare("SELECT * FROM products WHERE id=? AND user_id=?").bind(it.product_id, uid).first();
        if(!p || p.stock < it.quantity) return err("Stock insuficiente");
        total += p.sale_price * it.quantity;
        await env.DB.prepare("UPDATE products SET stock=stock-? WHERE id=?").bind(it.quantity, it.product_id).run();
      }
      const id = crypto.randomUUID();
      await env.DB.prepare("INSERT INTO sales (id,user_id,total) VALUES (?,?,?)").bind(id, uid, total).run();
      return ok({ ok:true, total });
    }

    // --- CUSTOMERS ---
    if (url.pathname === "/api/customers" && request.method === "GET") {
      const r = await env.DB.prepare("SELECT * FROM customers WHERE user_id=? ORDER BY created_at DESC").bind(uid).all();
      return ok({ customers: r.results });
    }
    if (url.pathname === "/api/customers" && request.method === "POST") {
      const { name, phone } = await request.json();
      await env.DB.prepare("INSERT INTO customers (id,user_id,name,phone) VALUES (?,?,?,?)").bind(crypto.randomUUID(), uid, name, phone||"").run();
      return ok({ ok:true });
    }

    // --- EXPENSES ---
    if (url.pathname === "/api/expenses" && request.method === "GET") {
      const r = await env.DB.prepare("SELECT * FROM expenses WHERE user_id=? ORDER BY created_at DESC").bind(uid).all();
      return ok({ expenses: r.results });
    }
    if (url.pathname === "/api/expenses" && request.method === "POST") {
      const { description, amount } = await request.json();
      await env.DB.prepare("INSERT INTO expenses (id,user_id,description,amount) VALUES (?,?,?,?)").bind(crypto.randomUUID(), uid, description, amount).run();
      return ok({ ok:true });
    }

    return env.ASSETS.fetch(request);
  }
};
