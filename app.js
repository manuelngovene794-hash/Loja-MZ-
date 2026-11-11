// LOJA MZ FINAL - DONA: Márcia Justino Mabunda 853165207 - SEM DEMO - TODO MÊS PAGA - NOTIF COM SOM
let produtos = JSON.parse(localStorage.getItem("produtos")||"[]");
let vendas = JSON.parse(localStorage.getItem("vendas")||"[]");
let clientes = JSON.parse(localStorage.getItem("clientes")||"[]");
let despesas = JSON.parse(localStorage.getItem("despesas")||"[]");
let user = JSON.parse(localStorage.getItem("usuarioLojaMZ")||"null");

const PLANOS = {
  "LOJA100": { nome:"Pequena - 100 MT / mês", dias:30, maxProdutos:1000, maxVendasMes:1000, maxClientes:1000, maxDespesasMes:1000 },
  "LOJA200": { nome:"Média - 200 MT / mês", dias:30, maxProdutos:2000, maxVendasMes:2000, maxClientes:2000, maxDespesasMes:2000 },
  "LOJA300": { nome:"Super - 300 MT / mês", dias:30, maxProdutos:999999, maxVendasMes:999999, maxClientes:999999, maxDespesasMes:999999 }
};
function getPlanoAtual(){
  if(!user) return null;
  if(user.planoCodigo && PLANOS[user.planoCodigo]) return PLANOS[user.planoCodigo];
  if(!user.pagoAte) return { nome:"Teste Grátis 7 Dias", dias:7, maxProdutos:999999, maxVendasMes:999999, maxClientes:999999, maxDespesasMes:999999 };
  return null;
}
function contarEsteMes(lista){
  let agora=new Date(); return lista.filter(x=>{ let d=new Date(x.data); return d.getFullYear()==agora.getFullYear() && d.getMonth()==agora.getMonth(); }).length;
}
function mostrarSenha(){ let c=document.getElementById("senha"); c.type=c.type==="password"?"text":"password"; }

let somLigado = localStorage.getItem("somNotif") !== "off";
function tocarSom(){
  if(!somLigado) return;
  try{
    if(navigator.vibrate) navigator.vibrate([200,100,200]);
    let ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.3].forEach((delay)=>{
      let osc = ctx.createOscillator(); let gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.frequency.value = 880; osc.type = "sine";
      gain.gain.setValueAtTime(0.3, ctx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.25);
      osc.start(ctx.currentTime + delay); osc.stop(ctx.currentTime + delay + 0.3);
    });
  }catch(e){}
}
function ligarDesligarSom(){
  somLigado = !somLigado;
  localStorage.setItem("somNotif", somLigado ? "on" : "off");
  let b=document.getElementById("botaoSom"); if(b) b.innerText = somLigado ? "🔊" : "🔇";
  if(somLigado) tocarSom();
  alert(somLigado ? "Som ligado 🔊 - Vais ouvir todas notificações" : "Som desligado 🔇");
}

let notificacoes = JSON.parse(localStorage.getItem("notificacoes")||"[]");
function addNotif(tipo, texto){
  let hoje = new Date().toDateString();
  if(notificacoes.find(n=>n.texto==texto && new Date(n.data).toDateString()==hoje)) return;
  notificacoes.unshift({texto, tipo, data:new Date().toISOString(), lida:false});
  if(notificacoes.length>30) notificacoes = notificacoes.slice(0,30);
  localStorage.setItem("notificacoes", JSON.stringify(notificacoes));
  atualizarSininho();
  tocarSom();
}
function atualizarSininho(){
  let n = notificacoes.filter(x=>!x.lida).length;
  let c = document.getElementById("contadorNotif");
  if(c){ c.style.display = n>0 ? "block" : "none"; c.innerText = n; }
}
function abrirNotificacoes(){
  let caixa = document.getElementById("caixaNotif");
  caixa.style.display = caixa.style.display=="block" ? "none" : "block";
  let lista = document.getElementById("listaNotif");
  if(notificacoes.length==0) lista.innerHTML = "<p>Sem notificações. Tudo em dia ✅</p>";
  else lista.innerHTML = notificacoes.map(n=>`<div style="border-bottom:1px solid #eee;padding:8px 0"><small>${new Date(n.data).toLocaleString()}</small><br>${n.texto}</div>`).join("");
  notificacoes.forEach(n=>n.lida=true);
  localStorage.setItem("notificacoes", JSON.stringify(notificacoes));
  setTimeout(atualizarSininho, 500);
}
function fecharNotificacoes(){ document.getElementById("caixaNotif").style.display="none"; }
function limparNotificacoes(){ notificacoes=[]; localStorage.setItem("notificacoes", JSON.stringify(notificacoes)); abrirNotificacoes(); atualizarSininho(); }
function verificarNotificacoes(){
  if(!user) return;
  produtos.forEach(p=>{ if(p.stock<=p.min) addNotif("stock", `⚠️ <b>Stock Baixo!</b> ${p.nome} só tem ${p.stock} - Compra já!`); });
  vendas.filter(v=>!v.pago).forEach(v=>{ addNotif("fiado", `😤 <b>Fiado:</b> ${v.cliente} deve ${v.total} MT - ${v.produto}`); });
  if(user.dataCriacao && !user.pagoAte){
    let dias = Math.floor((new Date()-new Date(user.dataCriacao))/(1000*60*60*24));
    let restam = 7-dias;
    if(restam==2) addNotif("trial", `🎁 <b>Faltam 2 dias</b> de teste grátis! Depois paga 100 MT / 200 MT / 300 MT para Márcia Justino Mabunda 853165207`);
    if(restam==1) addNotif("trial", `🎁 <b>Amanhã acaba</b> teste grátis! Paga hoje para não travar.`);
  }
  if(user.pagoAte){
    let diasRestam = Math.ceil((new Date(user.pagoAte)-new Date())/(1000*60*60*24));
    if(diasRestam==3) addNotif("plano", `⏰ <b>Faltam 3 dias</b> para teu plano acabar! Paga de novo para Márcia Justino Mabunda 853165207`);
    if(diasRestam==1) addNotif("plano", `⏰ <b>Amanhã acaba</b> teu plano! Paga hoje para não travar.`);
    if(diasRestam<=0) addNotif("plano", `🚫 <b>Plano acabou!</b> Paga 100 / 200 / 300 MT para Márcia Justino Mabunda 853165207 para voltar.`);
  }
  let plano = getPlanoAtual();
  if(plano && plano.maxProdutos<999999){
    let perc = Math.floor(produtos.length/plano.maxProdutos*100);
    if(perc>=80 && perc<100) addNotif("limite", `🚫 <b>Limite a chegar:</b> Tens ${produtos.length} de ${plano.maxProdutos} produtos (${perc}%). Sobe para Super 300 MT - Ilimitado.`);
    if(perc>=100) addNotif("limite", `🚫 <b>Limite atingido!</b> Não podes meter mais produtos. Fala com Márcia Justino Mabunda 853165207.`);
  }
  atualizarSininho();
}
function salvarTudo(){
  localStorage.setItem("produtos", JSON.stringify(produtos));
  localStorage.setItem("vendas", JSON.stringify(vendas));
  localStorage.setItem("clientes", JSON.stringify(clientes));
  localStorage.setItem("despesas", JSON.stringify(despesas));
  localStorage.setItem("usuarioLojaMZ", JSON.stringify(user));
  atualizarPainel();
}
function verificarTrial(){
  if(!user) return;
  if(!user.dataCriacao){ user.dataCriacao=new Date().toISOString(); salvarTudo(); }
  if(user.pagoAte && new Date()<=new Date(user.pagoAte)){
    let a=document.getElementById("avisoTrial");
    if(a){ a.style.display="block"; a.innerText="✅ "+(user.plano||"")+" ativo até "+new Date(user.pagoAte).toLocaleDateString(); }
    return;
  }
  let dias=Math.floor((new Date()-new Date(user.dataCriacao))/(1000*60*60*24));
  let restam=7-dias; let aviso=document.getElementById("avisoTrial");
  if(restam>0){ if(aviso){ aviso.style.display="block"; aviso.innerText="🎁 Teste grátis: faltam "+restam+" dias | Dia "+(dias+1)+" de 7"; } }
  else mostrarTelaPagamento();
}
function mostrarTelaPagamento(){
  document.body.innerHTML=`
  <div style="padding:16px;font-family:Arial;max-width:480px;margin:0 auto;text-align:center">
    <h2>⏰ Os teus 7 dias grátis acabaram</h2><p>Loja: <b>${user.nomeLoja||""}</b></p><p>Escolhe plano - Todo mês paga:</p>
    <div style="text-align:left;background:#fff;border:1px solid #ddd;border-radius:12px;padding:12px">
      <label style="display:flex;gap:10px;padding:10px;border:1px solid #eee;border-radius:8px;margin-bottom:8px"><input type="radio" name="plano" value="100"><div><b>LOJA PEQUENA - 100 MT / MÊS</b><br><small>Todo mês paga 100 MT<br>✅ Até 1.000 produtos<br>✅ Até 1.000 vendas / mês</small></div></label>
      <label style="display:flex;gap:10px;padding:10px;border:2px solid #16a34a;border-radius:8px;margin-bottom:8px;background:#f0fdf4"><input type="radio" name="plano" value="200" checked><div><b>⭐ LOJA MÉDIA - 200 MT / MÊS</b><br><small>Todo mês paga 200 MT<br>✅ Até 2.000 produtos<br>✅ Até 2.000 vendas / mês</small></div></label>
      <label style="display:flex;gap:10px;padding:10px;border:1px solid #eee;border-radius:8px"><input type="radio" name="plano" value="300"><div><b>👑 LOJA SUPER - 300 MT / MÊS</b><br><small>Todo mês paga 300 MT<br>✅ Produtos ILIMITADOS ♾️<br>✅ Vendas ILIMITADAS dentro do mês ♾️</small></div></label>
    </div>
    <div style="background:#fef3c7;padding:14px;border-radius:12px;margin-top:10px"><b>PAGAR PARA A DONA DO APP:</b><br>M-Pesa / e-Mola para:<br><span style="font-size:24px;font-weight:bold">853165207</span><br>Titular: <b>Márcia Justino Mabunda</b><br><small>Todo mês paga de novo</small></div><br>
    <button onclick="pagarAgora()" style="padding:14px;width:100%;background:#16a34a;color:#fff;border:none;border-radius:8px;font-weight:bold">📲 Enviar Comprovativo no WhatsApp</button><br><br>
    <button onclick="ativarCodigo()" style="padding:12px;width:100%;background:#64748b;color:#fff;border:none;border-radius:8px">Já Paguei, Meter Código</button>
  </div>`;
}
function pagarAgora(){
  let plano=document.querySelector('input[name="plano"]:checked')?.value||"200";
  let nomePlano = plano=="100" ? "LOJA PEQUENA 100 MT / MÊS" : plano=="200" ? "LOJA MÉDIA 200 MT / MÊS" : "LOJA SUPER 300 MT / MÊS";
  window.open("https://wa.me/258853165207?text="+encodeURIComponent("Olá Márcia Justino Mabunda, sou "+(user.nomeLoja||"")+". Quero pagar "+nomePlano+" do LOJA MZ. Vou enviar comprovativo para 853165207."));
}
function ativarCodigo(){
  let c=prompt("Escreve código que a Márcia Justino Mabunda te mandou:"); if(!c) return;
  let codigo=c.trim().toUpperCase(); if(!PLANOS[codigo]) return alert("Código errado. Envia comprovativo para Márcia Justino Mabunda 853165207");
  let p=PLANOS[codigo]; let ate=new Date(); ate.setDate(ate.getDate()+p.dias);
  user.pagoAte=ate.toISOString(); user.plano=p.nome; user.planoCodigo=codigo; salvarTudo();
  alert("Ativado! "+p.nome+" até "+ate.toLocaleDateString()); location.reload();
}
document.getElementById("aba-de-registro")?.addEventListener("click", ()=>{
  ["nomeLoja","labelNomeLoja","titularMpesa","labelTitular","numeroMpesa","labelNumeroMpesa"].forEach(id=>document.getElementById(id)?.classList.remove("escondido"));
  document.querySelectorAll(".rotulo-do-nome").forEach(e=>e.classList.remove("escondido"));
  document.getElementById("nome")?.classList.remove("escondido");
  document.getElementById("autSubmit").innerText="Criar Conta - Começar 7 Dias Grátis";
});
document.getElementById("aba-de-login")?.addEventListener("click", ()=>{ document.getElementById("autSubmit").innerText="Entrar"; });
document.getElementById("formulario-de-autorizacao")?.addEventListener("submit",(e)=>{
  e.preventDefault();
  let isCriar=document.getElementById("autSubmit").innerText.includes("Criar");
  let nome=document.getElementById("nome").value; let email=document.getElementById("e-mail").value; let senha=document.getElementById("senha").value;
  if(isCriar){
    let nomeLoja=document.getElementById("nomeLoja").value;
    if(!nomeLoja) return alert("Escreve nome da tua loja");
    user={nome,email,senha,nomeLoja,titularMpesa:document.getElementById("titularMpesa")?.value||nome,numeroMpesa:document.getElementById("numeroMpesa")?.value||"",dataCriacao:new Date().toISOString(),pagoAte:null};
    salvarTudo(); alert("Loja criada! Tens 7 dias grátis!");
  } else { if(!user||user.email!==email||user.senha!==senha) return alert("Email ou senha errada"); }
  document.getElementById("autorizacao").classList.add("escondido");
  document.getElementById("aplicativo").classList.remove("escondido");
  document.getElementById("saudacao").innerText=user.nomeLoja+" - Painel da loja";
  verificarTrial(); atualizarPainel(); verificarNotificacoes();
});
document.getElementById("formulario-de-produto")?.addEventListener("submit",(e)=>{
  e.preventDefault();
  let plano=getPlanoAtual();
  if(plano && produtos.length>=plano.maxProdutos) return alert("⚠️ Limite do plano "+plano.nome+"\nTens "+produtos.length+" produtos. Limite: "+plano.maxProdutos+".\nFala com Márcia Justino Mabunda 853165207 para subir para Médio ou Super.");
  produtos.push({id:Date.now(),nome:document.getElementById("nome_do_produto").value,categoria:document.getElementById("categoria-do-produto").value||"Outra",precoCompra:Number(document.getElementById("preco-de-custo").value),precoVenda:Number(document.getElementById("preco-de-venda").value),stock:Number(document.getElementById("estoque-de-produtos").value),min:Number(document.getElementById("minStock")?.value||2)});
  salvarTudo(); e.target.reset(); alert("Produto guardado!");
});
function filtrarProdutos(){ atualizarPainel(); }
function editarProduto(id){ let p=produtos.find(x=>x.id==id); let nv=prompt("Novo preço venda:",p.precoVenda); if(nv){ p.precoVenda=Number(nv); salvarTudo(); } }
function apagarProduto(id){ if(confirm("Apagar?")){ produtos=produtos.filter(p=>p.id!=id); salvarTudo(); } }
document.getElementById("formulario-de-venda")?.addEventListener("submit",(e)=>{
  e.preventDefault();
  let plano=getPlanoAtual();
  let vendasMes=contarEsteMes(vendas);
  if(plano && vendasMes>=plano.maxVendasMes) return alert("⚠️ Atingiste limite de vendas deste mês: "+vendasMes+"/"+plano.maxVendasMes+" do plano "+plano.nome+".\nNo próximo mês volta a 0. Ou sobe para Super 300 MT - Ilimitado - fala com Márcia Justino Mabunda 853165207.");
  let id=Number(document.getElementById("produto-em-venda").value); let p=produtos.find(x=>x.id==id);
  let qtd=Number(document.getElementById("quantidade-de-venda").value); let forma=document.getElementById("formaPagamento").value; let cliente=document.getElementById("clienteVenda").value||"Cliente";
  if(!p) return alert("Adiciona produto primeiro");
  if(forma=="Fiado"&&cliente=="Cliente") return alert("Para Fiado escreve nome do cliente!");
  if(p.stock<qtd) return alert("Stock insuficiente! Só tens "+p.stock);
  let lucro=(p.precoVenda-p.precoCompra)*qtd; p.stock-=qtd;
  if(forma=="M-Pesa"||forma=="e-Mola"){
    let ok=confirm("Cliente vai pagar "+(p.precoVenda*qtd)+" MT via "+forma+" para:\n\nNúmero da loja: "+(user.numeroMpesa||"---")+"\nTitular da loja: "+(user.titularMpesa||user.nome)+"\n\nCliente já pagou? OK para confirmar.");
    if(!ok){ p.stock+=qtd; return; }
  }
  vendas.push({id:Date.now(),produto:p.nome,qtd,total:p.precoVenda*qtd,lucro,cliente,forma,pago:forma!="Fiado",data:new Date().toISOString()});
  addNotif("venda", `✅ <b>Venda feita!</b> ${p.nome} x${qtd} = ${p.precoVenda*qtd} MT - Lucro ${lucro} MT`);
  salvarTudo(); alert("Venda feita! Lucro "+lucro+" MT"); verificarNotificacoes();
});
function marcarPago(id){ let v=vendas.find(x=>x.id==id); v.pago=true; v.forma="Dinheiro"; addNotif("venda", `✅ <b>Fiado pago!</b> ${v.cliente} pagou ${v.total} MT`); salvarTudo(); }
document.getElementById("formulario-do-cliente")?.addEventListener("submit",(e)=>{
  e.preventDefault(); let plano=getPlanoAtual();
  if(plano && clientes.length>=plano.maxClientes) return alert("⚠️ Limite de clientes do plano "+plano.nome+": "+plano.maxClientes);
  clientes.push({nome:document.getElementById("nomeDoCliente").value,telefone:document.getElementById("telefone-do-cliente").value}); salvarTudo(); e.target.reset();
});
document.getElementById("formulario-de-despesas")?.addEventListener("submit",(e)=>{
  e.preventDefault(); let plano=getPlanoAtual(); let despMes=contarEsteMes(despesas);
  if(plano && despMes>=plano.maxDespesasMes) return alert("⚠️ Limite de despesas deste mês: "+despMes+"/"+plano.maxDespesasMes);
  despesas.push({desc:document.getElementById("descricao-da-despesa").value,valor:Number(document.getElementById("valor-da-despesa").value),data:new Date().toISOString()}); salvarTudo(); e.target.reset();
});
function atualizarPainel(){
  let totalV=vendas.reduce((s,v)=>s+v.total,0); let totalLucro=vendas.reduce((s,v)=>s+v.lucro,0); let totalDesp=despesas.reduce((s,d)=>s+d.valor,0); let fiado=vendas.filter(v=>!v.pago).reduce((s,v)=>s+v.total,0); let baixo=produtos.filter(p=>p.stock<=p.min).length; let unidades=produtos.reduce((s,p)=>s+p.stock,0);
  let plano=getPlanoAtual(); let vendasMes=contarEsteMes(vendas);
  let el=(id)=>document.getElementById(id);
  if(el("vendasTotal")) el("vendasTotal").innerText=totalV+" MT";
  if(el("contagem-de-produtos")) el("contagem-de-produtos").innerText=produtos.length;
  if(el("unidades-em-estoque")) el("unidades-em-estoque").innerText=unidades;
  if(el("lucroTotal")) el("lucroTotal").innerText=(totalLucro-totalDesp)+" MT";
  if(el("baixo-estoque")) el("baixo-estoque").innerText=baixo;
  if(el("despesasTotal")) el("despesasTotal").innerText
