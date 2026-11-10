const $ = id => document.getElementById(id);
let mode = "login";
let products = [];

const money = value =>
  new Intl.NumberFormat("pt-MZ", {
    style: "currency",
    currency: "MZN"
  }).format(Number(value || 0));

async function api(path, options = {}) {
  const response = await fetch("/api" + path, {
    credentials: "same-origin",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Ocorreu um erro.");
  return data;
}

function message(element, text) {
  $(element).textContent = text || "";
}

function showApp(user) {
  $("auth").classList.add("hidden");
  $("app").classList.remove("hidden");
  $("logout").classList.remove("hidden");
  $("greeting").textContent = `Olá, ${user.name}`;
  loadAll();
}

function showAuth() {
  $("app").classList.add("hidden");
  $("auth").classList.remove("hidden");
  $("logout").classList.add("hidden");
}

function setMode(next) {
  mode = next;
  $("nameLabel").classList.toggle("hidden", mode !== "register");
  $("loginTab").classList.toggle("active", mode === "login");
  $("registerTab").classList.toggle("active", mode === "register");
  $("authSubmit").textContent = mode === "login" ? "Entrar" : "Criar conta";
  $("password").autocomplete = mode === "login" ? "current-password" : "new-password";
  message("authMessage", "");
}

$("loginTab").addEventListener("click", () => setMode("login"));
$("registerTab").addEventListener("click", () => setMode("register"));

$("authForm").addEventListener("submit", async event => {
  event.preventDefault();
  const button = $("authSubmit");
  button.disabled = true;

  try {
    const data = {
      email: $("email").value.trim(),
      password: $("password").value
    };

    let result;
    if (mode === "register") {
      data.name = $("name").value.trim();
      result = await api("/register", {
        method: "POST",
        body: JSON.stringify(data)
      });
    } else {
      result = await api("/login", {
        method: "POST",
        body: JSON.stringify(data)
      });
    }

    showApp(result.user);
  } catch (error) {
    message("authMessage", error.message);
  } finally {
    button.disabled = false;
  }
});

$("logout").addEventListener("click", async () => {
  try {
    await api("/logout", { method: "POST" });
  } finally {
    products = [];
    showAuth();
  }
});

async function loadDashboard() {
  const result = await api("/dashboard");
  const stats = result.stats;
  $("salesTotal").textContent = money(stats.sales_total);
  $("productCount").textContent = stats.product_count;
  $("stockUnits").textContent = stats.stock_units;
  $("lowStock").textContent = stats.low_stock;
  $("expensesTotal").textContent = money(stats.expenses_total);
}

function renderRecords(target, rows, title, detail, amount) {
  const container = $(target);
  container.replaceChildren();

  if (!rows.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "Ainda não existem registos.";
    container.append(empty);
    return;
  }

  for (const row of rows) {
    const article = document.createElement("article");
    article.className = "record";

    const left = document.createElement("div");
    const heading = document.createElement("strong");
    heading.textContent = title(row);
    left.append(heading);

    const small = document.createElement("small");
    small.textContent = detail(row);
    left.append(small);

    const right = document.createElement("strong");
    right.textContent = amount(row);

    article.append(left, right);
    container.append(article);
  }
}

async function loadProducts() {
  const result = await api("/products");
  products = result.products || [];

  renderRecords(
    "productList",
    products,
    row => row.name,
    row => `${row.category || "Sem categoria"} · Stock: ${row.stock}`,
    row => money(row.sale_price)
  );

  const select = $("saleProduct");
  select.replaceChildren();
  for (const product of products.filter(p => p.stock > 0)) {
    const option = document.createElement("option");
    option.value = product.id;
    option.textContent = `${product.name} — ${product.stock} em stock`;
    select.append(option);
  }
  if (!select.options.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Não há produtos com stock";
    select.append(option);
  }
}

async function loadSales() {
  const result = await api("/sales");
  renderRecords(
    "saleList",
    result.sales || [],
    row => "Venda",
    row => new Date(row.created_at + "Z").toLocaleString("pt-PT"),
    row => money(row.total)
  );
}

async function loadCustomers() {
  const result = await api("/customers");
  renderRecords(
    "customerList",
    result.customers || [],
    row => row.name,
    row => row.phone || "Sem telefone",
    () => "Cliente"
  );
}

async function loadExpenses() {
  const result = await api("/expenses");
  renderRecords(
    "expenseList",
    result.expenses || [],
    row => row.description,
    row => new Date(row.created_at + "Z").toLocaleString("pt-PT"),
    row => money(row.amount)
  );
}

async function loadAll() {
  try {
    await Promise.all([
      loadDashboard(),
      loadProducts(),
      loadSales(),
      loadCustomers(),
      loadExpenses()
    ]);
  } catch (error) {
    if (error.message.includes("Sessão inválida")) showAuth();
    else alert(error.message);
  }
}

$("productForm").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    await api("/products", {
      method: "POST",
      body: JSON.stringify({
        name: $("productName").value.trim(),
        category: $("productCategory").value.trim(),
        cost_price: Number($("costPrice").value),
        sale_price: Number($("salePrice").value),
        stock: Number($("productStock").value)
      })
    });
    event.target.reset();
    message("productMessage", "Produto adicionado.");
    await loadProducts();
    await loadDashboard();
  } catch (error) {
    message("productMessage", error.message);
  }
});

$("saleForm").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const productId = $("saleProduct").value;
    const quantity = Number($("saleQuantity").value);
    if (!productId) throw new Error("Adiciona primeiro um produto com stock.");

    const result = await api("/sales", {
      method: "POST",
      body: JSON.stringify({
        items: [{ product_id: productId, quantity }]
      })
    });

    message("saleMessage", `Venda registada: ${money(result.total)}.`);
    await loadProducts();
    await loadSales();
    await loadDashboard();
  } catch (error) {
    message("saleMessage", error.message);
  }
});

$("customerForm").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    await api("/customers", {
      method: "POST",
      body: JSON.stringify({
        name: $("customerName").value.trim(),
        phone: $("customerPhone").value.trim()
      })
    });
    event.target.reset();
    message("customerMessage", "Cliente adicionado.");
    await loadCustomers();
  } catch (error) {
    message("customerMessage", error.message);
  }
});

$("expenseForm").addEventListener("submit", async event => {
  event.preventDefault();
  try {
    await api("/expenses", {
      method: "POST",
      body: JSON.stringify({
        description: $("expenseDescription").value.trim(),
        amount: Number($("expenseAmount").value)
      })
    });
    event.target.reset();
    message("expenseMessage", "Despesa registada.");
    await loadExpenses();
    await loadDashboard();
  } catch (error) {
    message("expenseMessage", error.message);
  }
});

document.querySelectorAll(".nav").forEach(button => {
  button.addEventListener("click", () => {
    document.querySelectorAll(".nav").forEach(item => item.classList.remove("active"));
    button.classList.add("active");

    document.querySelectorAll(".page").forEach(page => page.classList.add("hidden"));
    $(button.dataset.page + "Page").classList.remove("hidden");
  });
});

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => {});
  });
}

(async () => {
  try {
    const result = await api("/me");
    showApp(result.user);
  } catch {
    showAuth();
  }
})();
    
