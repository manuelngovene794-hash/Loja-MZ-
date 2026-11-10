const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      ...headers
    }
  });

const id = () => crypto.randomUUID();

async function hash(value) {
  const bytes = new TextEncoder().encode(value);
  const result = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(result)]
    .map(x => x.toString(16).padStart(2, "0")).join("");
}

async function passwordHash(password, salt) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(password),
    "PBKDF2",
    false,
    ["deriveBits"]
  );
  const bits = await crypto.subtle.deriveBits({
    name: "PBKDF2",
    salt: new TextEncoder().encode(salt),
    iterations: 150000,
    hash: "SHA-256"
  }, key, 256);
  return [...new Uint8Array(bits)]
    .map(x => x.toString(16).padStart(2, "0")).join("");
}

function cookie(token) {
  return `loja_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=604800`;
}

function clearCookie() {
  return "loja_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0";
}

async function body(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

async function auth(request, env) {
  const raw = request.headers.get("Cookie") || "";
  const token = raw.match(/(?:^|;\s*)loja_session=([A-Za-z0-9-]+)/)?.[1];
  if (!token) return null;

  const tokenHash = await hash(token);
  const session = await env.DB.prepare(
    `SELECT users.id, users.name, users.email
     FROM sessions JOIN users ON users.id = sessions.user_id
     WHERE sessions.token_hash = ? AND sessions.expires_at > datetime('now')`
  ).bind(tokenHash).first();

  return session || null;
}

function validText(value, max = 120) {
  return typeof value === "string" && value.trim().length > 0 &&
    value.trim().length <= max;
}

async function requireUser(request, env) {
  const user = await auth(request, env);
  if (!user) return { error: json({ error: "Sessão inválida. Inicia sessão novamente." }, 401) };
  return { user };
}

async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (path === "/api/health") {
    return json({ success: true, application: "Loja MZ", status: "running" });
  }

  if (path === "/api/register" && method === "POST") {
    const data = await body(request);
    if (!data || !validText(data.name, 80) ||
        !validText(data.email, 160) ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email) ||
        typeof data.password !== "string" || data.password.length < 10) {
      return json({ error: "Preenche nome, email válido e palavra-passe com pelo menos 10 caracteres." }, 400);
    }

    const email = data.email.trim().toLowerCase();
    const exists = await env.DB.prepare(
      "SELECT id FROM users WHERE email = ?"
    ).bind(email).first();

    if (exists) return json({ error: "Este email já está registado." }, 409);

    const userId = id();
    const salt = id();
    const storedHash = `${salt}:${await passwordHash(data.password, salt)}`;

    try {
      await env.DB.batch([
        env.DB.prepare(
          "INSERT INTO users (id,name,email,password_hash) VALUES (?,?,?,?)"
        ).bind(userId, data.name.trim(), email, storedHash),
        env.DB.prepare(
          "INSERT INTO subscriptions (user_id,plan,status,starts_at,expires_at) VALUES (?,'trial','trial',datetime('now'),datetime('now','+3 days'))"
        ).bind(userId)
      ]);
    } catch {
      return json({ error: "Não foi possível criar a conta." }, 400);
    }

    const token = id() + id();
    await env.DB.prepare(
      "INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,datetime('now','+7 days'))"
    ).bind(await hash(token), userId).run();

    return json({ success: true, user: { id: userId, name: data.name.trim(), email } }, 201, {
      "Set-Cookie": cookie(token)
    });
  }

  if (path === "/api/login" && method === "POST") {
    const data = await body(request);
    if (!data || !validText(data.email, 160) ||
        typeof data.password !== "string") {
      return json({ error: "Email e palavra-passe obrigatórios." }, 400);
    }

    const user = await env.DB.prepare(
      "SELECT id,name,email,password_hash FROM users WHERE email = ?"
    ).bind(data.email.trim().toLowerCase()).first();

    if (!user) return json({ error: "Dados de acesso incorrectos." }, 401);

    const [salt, saved] = user.password_hash.split(":");
    const candidate = await passwordHash(data.password, salt);
    if (candidate !== saved) {
      return json({ error: "Dados de acesso incorrectos." }, 401);
    }

    const token = id() + id();
    await env.DB.prepare(
      "INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,datetime('now','+7 days'))"
    ).bind(await hash(token), user.id).run();

    return json({ success: true, user: { id: user.id, name: user.name, email: user.email } }, 200, {
      "Set-Cookie": cookie(token)
    });
  }

  if (path === "/api/logout" && method === "POST") {
    const raw = request.headers.get("Cookie") || "";
    const token = raw.match(/(?:^|;\s*)loja_session=([A-Za-z0-9-]+)/)?.[1];
    if (token) {
      await env.DB.prepare("DELETE FROM sessions WHERE token_hash = ?")
        .bind(await hash(token)).run();
    }
    return json({ success: true }, 200, { "Set-Cookie": clearCookie() });
  }

  const result = await requireUser(request, env);
  if (result.error) return result.error;
  const user = result.user;

  if (path === "/api/me" && method === "GET") {
    const subscription = await env.DB.prepare(
      "SELECT plan,status,expires_at FROM subscriptions WHERE user_id = ?"
    ).bind(user.id).first();
    return json({ user, subscription });
  }

  if (path === "/api/products" && method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT * FROM products WHERE user_id = ? ORDER BY created_at DESC"
    ).bind(user.id).all();
    return json({ products: rows.results });
  }

  if (path === "/api/products" && method === "POST") {
    const data = await body(request);
    if (!data || !validText(data.name, 120) ||
        !Number.isFinite(data.cost_price) || data.cost_price < 0 ||
        !Number.isFinite(data.sale_price) || data.sale_price < 0 ||
        !Number.isInteger(data.stock) || data.stock < 0) {
      return json({ error: "Verifica o nome, os preços e a quantidade." }, 400);
    }
    const productId = id();
    await env.DB.prepare(
      "INSERT INTO products (id,user_id,name,category,cost_price,sale_price,stock) VALUES (?,?,?,?,?,?,?)"
    ).bind(productId, user.id, data.name.trim(),
      typeof data.category === "string" ? data.category.trim().slice(0, 80) : "",
      data.cost_price, data.sale_price, data.stock).run();
    return json({ success: true, id: productId }, 201);
  }

  if (path.startsWith("/api/products/") && method === "DELETE") {
    const productId = path.split("/").pop();
    const used = await env.DB.prepare(
      "SELECT id FROM sale_items WHERE product_id = ? LIMIT 1"
    ).bind(productId).first();
    if (used) return json({ error: "Este produto já tem vendas registadas. Não pode ser eliminado." }, 409);
    await env.DB.prepare(
      "DELETE FROM products WHERE id = ? AND user_id = ?"
    ).bind(productId, user.id).run();
    return json({ success: true });
  }

  if (path === "/api/customers" && method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT * FROM customers WHERE user_id = ? ORDER BY created_at DESC"
    ).bind(user.id).all();
    return json({ customers: rows.results });
  }

  if (path === "/api/customers" && method === "POST") {
    const data = await body(request);
    if (!data || !validText(data.name, 120)) {
      return json({ error: "Nome do cliente obrigatório." }, 400);
    }
    const customerId = id();
    await env.DB.prepare(
      "INSERT INTO customers (id,user_id,name,phone) VALUES (?,?,?,?)"
    ).bind(customerId, user.id, data.name.trim(),
      typeof data.phone === "string" ? data.phone.trim().slice(0, 30) : "").run();
    return json({ success: true, id: customerId }, 201);
  }

  if (path === "/api/expenses" && method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT * FROM expenses WHERE user_id = ? ORDER BY created_at DESC"
    ).bind(user.id).all();
    return json({ expenses: rows.results });
  }

  if (path === "/api/expenses" && method === "POST") {
    const data = await body(request);
    if (!data || !validText(data.description, 180) ||
        !Number.isFinite(data.amount) || data.amount <= 0) {
      return json({ error: "Descrição e valor válido são obrigatórios." }, 400);
    }
    const expenseId = id();
    await env.DB.prepare(
      "INSERT INTO expenses (id,user_id,description,amount) VALUES (?,?,?,?)"
    ).bind(expenseId, user.id, data.description.trim(), data.amount).run();
    return json({ success: true, id: expenseId }, 201);
  }

  if (path === "/api/sales" && method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT * FROM sales WHERE user_id = ? ORDER BY created_at DESC LIMIT 100"
    ).bind(user.id).all();
    return json({ sales: rows.results });
  }

  if (path === "/api/sales" && method === "POST") {
    const data = await body(request);
    if (!data || !Array.isArray(data.items) ||
        data.items.length < 1 || data.items.length > 30) {
      return json({ error: "Adiciona pelo menos um produto à venda." }, 400);
    }

    const quantities = new Map();
    for (const item of data.items) {
      if (!item || typeof item.product_id !== "string" ||
          !Number.isInteger(item.quantity) || item.quantity < 1) {
        return json({ error: "Produto ou quantidade inválida." }, 400);
      }
      quantities.set(item.product_id, (quantities.get(item.product_id) || 0) + item.quantity);
    }

    const saleId = id();
    const statements = [];
    let total = 0;
    const saleItems = [];

    for (const [productId, quantity] of quantities) {
      const product = await env.DB.prepare(
        "SELECT id,name,sale_price,stock FROM products WHERE id = ? AND user_id = ?"
      ).bind(productId, user.id).first();

      if (!product || product.stock < quantity) {
        return json({ error: `Stock insuficiente ou produto inexistente: ${product?.name || "produto"}.` }, 409);
      }

      total += product.sale_price * quantity;
      saleItems.push({ productId, quantity, price: product.sale_price });
      statements.push(env.DB.prepare(
        "UPDATE products SET stock = stock - ? WHERE id = ? AND user_id = ? AND stock >= ?"
      ).bind(quantity, productId, user.id, quantity));
    }

    if (!Number.isFinite(total) || total <= 0) {
      return json({ error: "Total de venda inválido." }, 400);
    }

    statements.push(env.DB.prepare(
      "INSERT INTO sales (id,user_id,total) VALUES (?,?,?)"
    ).bind(saleId, user.id, total));

    for (const item of saleItems) {
      statements.push(env.DB.prepare(
        "INSERT INTO sale_items (id,sale_id,product_id,quantity,unit_price) VALUES (?,?,?,?,?)"
      ).bind(id(), saleId, item.productId, item.quantity, item.price));
    }

    try {
      await env.DB.batch(statements);
    } catch {
      return json({ error: "Não foi possível concluir a venda. Verifica o stock e tenta novamente." }, 409);
    }

    return json({ success: true, sale_id: saleId, total });
  }

  if (path === "/api/dashboard" && method === "GET") {
    const stats = await env.DB.prepare(`
      SELECT
        (SELECT COUNT(*) FROM products WHERE user_id = ?) AS product_count,
        (SELECT COALESCE(SUM(stock),0) FROM products WHERE user_id = ?) AS stock_units,
        (SELECT COUNT(*) FROM products WHERE user_id = ? AND stock <= 5) AS low_stock,
        (SELECT COALESCE(SUM(total),0) FROM sales WHERE user_id = ?) AS sales_total,
        (SELECT COALESCE(SUM(amount),0) FROM expenses WHERE user_id = ?) AS expenses_total
    `).bind(user.id, user.id, user.id, user.id, user.id).first();

    return json({ stats });
  }

  return json({ error: "Rota não encontrada." }, 404);
}

export default {
  async fetch(request, env) {
    try {
      if (new URL(request.url).pathname.startsWith("/api/")) {
        return await handle(request, env);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      return json({ error: "Erro interno do servidor." }, 500);
    }
  }
};
    
