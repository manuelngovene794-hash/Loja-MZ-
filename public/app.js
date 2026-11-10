let user = JSON.parse(localStorage.getItem("user") || "null");
let selectedPlan = 'basico';

async function register(){
  const name = document.getElementById('regName').value;
  const email = document.getElementById('regEmail').value;
  const pass = document.getElementById('regPass').value;
  const r = await fetch("/api/register", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ name, email, password: pass }) }).then(r=>r.json());
  if(r.ok){ localStorage.setItem("user", JSON.stringify(r)); location.reload(); }
  else alert(r.error);
}

async function login(){
  const email = document.getElementById('loginEmail').value;
  const pass = document.getElementById('loginPass').value;
  const r = await fetch("/api/login", { method: "POST", headers: {"Content-Type":"application/json"}, body: JSON.stringify({ email, password: pass }) }).then(r=>r.json());
  if(r.ok){ localStorage.setItem("user", JSON.stringify(r)); location.reload(); }
  else alert(r.error);
}

// VERIFICA 7 DIAS GRÁTIS / PAGAMENTO
async function checkSub(){
  if(!user) return;
  const sub = await fetch(`/api/my-sub?user_id=${user.id}`).then(r=>r.json());
  const now = new Date();
  const exp = new Date(sub.expires_at);
  if(now > exp){
    showPayScreen();
    return false;
  }
  if(sub.status === 'trial'){
    const dias = Math.ceil((exp - now)/(1000*60*60*24));
    const el = document.getElementById('trialMsg');
    if(el) el.innerHTML = `🎁 Tens <b>${dias} dias grátis</b>. Depois paga para continuar.`;
  }
  return true;
}

function showPayScreen(){
  document.body.innerHTML = `
  <style>
    .pay-box{ max-width:420px; margin:20px auto; padding:20px; font-family:sans-serif; text-align:center; }
    .plan-btn{ width:100%; padding:18px; margin:8px 0; font-size:18px; font-weight:bold; border-radius:12px; border:2px solid #16a34a; background:#fff; cursor:pointer; }
    .plan-btn.active{ background:#16a34a; color:#fff; }
    .pay-btn{ width:100%; padding:18px; margin-top:15px; font-size:19px; font-weight:bold; border:none; border-radius:12px; background:#16a34a; color:#fff; cursor:pointer; }
    .mpesa-box{ background:#f0fdf4; border:1px solid #16a34a; padding:15px; border-radius:12px; margin:15px 0; }
    input{ width:100%; padding:15px; font-size:17px; border-radius:10px; border:1px solid #ccc; box-sizing:border-box; }
  </style>
  <div class="pay-box">
    <h2>O teu teste grátis acabou</h2>
    <p>Escolhe um plano para continuar:</p>
    <button class="plan-btn active" id="btn-basico" onclick="selectPlan('basico')">BÁSICO<br>100 MT / mês</button>
    <button class="plan-btn" id="btn-padrao" onclick="selectPlan('padrao')">PADRÃO<br>200 MT / mês</button>
    <button class="plan-btn" id="btn-premium" onclick="selectPlan('premium')">PREMIUM<br>300 MT / mês</button>
    <div class="mpesa-box">
      <b>PASSO 1 - Paga agora:</b><br>
      Envia para M-Pesa:<br>
      <span style="font-size:26px; font-weight:bold;">853165207</span><br>
      Nome: <b>Márcia</b><br>
      Valor: <b id="valorPlano">100 MT</b>
    </div>
    <p><b>PASSO 2 - Cola o código:</b></p>
    <input id="mpesaCode" placeholder="Ex: QK7X123ABC">
    <button class="pay-btn" onclick="sendPay()">✅ JÁ PAGUEI</button>
    <p style="color:#666; font-size:14px;">O Admin confirma e desbloqueia por 30 dias.</p>
  </div>`;
}

function selectPlan(plan){
  selectedPlan = plan;
  document.querySelectorAll('.plan-btn').forEach(b=>b.classList.remove('active'));
  document.getElementById('btn-'+plan).classList.add('active');
  const v = { basico:'100 MT', padrao:'200 MT', premium:'300 MT' };
  document.getElementById('valorPlano').innerText = v[plan];
}

async function sendPay(){
  const code = document.getElementById('mpesaCode').value.trim();
  if(!code) return alert("Cola primeiro o código da M-Pesa");
  await fetch("/api/pay", { method:"POST", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ user_id: user.id, user_email: user.email, plan: selectedPlan, mpesa_code: code }) });
  alert("Recebido! Aguarda aprovação do Admin.");
}

async function loadProducts(){
  const ok = await checkSub();
  if(!ok) return;
  const list = await fetch(`/api/products?user_id=${user.id}`).then(r=>r.json());
  const el = document.getElementById('productList');
  if(el) el.innerHTML = list.map(p=>`<div>${p.name} - ${p.sell_price} MT - Stock: ${p.qty}</div>`).join('');
}

if(user) loadProducts();
