const API="https://juastorex-customer-api.jhonyoga01.workers.dev";
const $=id=>document.getElementById(id);
const token=()=>localStorage.getItem("jsx_admin_token")||"";
let orders=[];

async function api(path,opt={}){
  const r=await fetch(API+path,{
    ...opt,
    headers:{
      "Content-Type":"application/json",
      Authorization:`Bearer ${token()}`,
      ...(opt.headers||{})
    }
  });
  const d=await r.json().catch(()=>({}));
  if(!r.ok)throw new Error(d.error||"Terjadi kesalahan.");
  return d;
}

function normalizeWa(v){
  let n=String(v||"").replace(/\D/g,"");
  if(n.startsWith("0"))n="62"+n.slice(1);
  else if(n.startsWith("8"))n="62"+n;
  return n;
}

function money(v){
  return new Intl.NumberFormat("id-ID",{
    style:"currency",currency:"IDR",maximumFractionDigits:0
  }).format(Number(v||0));
}

function whatsappMessage(order){
  return `✅ ORDER JUASTORE BERHASIL

📦 Produk: ${order.product}
🔐 Kode order: ${order.code}

⏳ Durasi produk: ${order.duration_days} hari
🛡️ Durasi garansi: ${order.warranty_days} hari
📅 Garansi sampai: ${order.warranty_end}

📧 Detail akun:
${order.account_detail || "-"}

🔗 Cek order & garansi:
${order.order_link}

Simpan pesan ini untuk keperluan garansi.
— JuaStore`;
}

function whatsappUrl(order){
  return `https://wa.me/${normalizeWa(order.whatsapp)}?text=${encodeURIComponent(whatsappMessage(order))}`;
}

async function loadOrders(){
  const q=$("search").value.trim();
  const d=await api(`/api/admin/orders${q?`?q=${encodeURIComponent(q)}`:""}`);
  orders=d.orders||[];
  renderOrders();
}

function renderOrders(){
  $("orders").innerHTML=orders.map(o=>`
    <article class="order">
      <div class="order-head">
        <div>
          <strong>${o.product}</strong>
          <div class="muted">${o.code} • ${o.whatsapp}</div>
        </div>
        <strong>${money(o.price)}</strong>
      </div>
      <p>Produk: ${o.duration_days} hari • Garansi: ${o.warranty_days} hari</p>
      <p class="muted">Garansi sampai ${o.warranty_end}</p>
      <div class="actions">
        <a class="button" href="${whatsappUrl(o)}" target="_blank">Kirim WhatsApp</a>
        <a class="button secondary" href="${o.order_link}" target="_blank">Lihat Link Customer</a>
        <button class="secondary" onclick="removeOrder('${o.code}')">Hapus</button>
      </div>
    </article>
  `).join("")||"<p>Belum ada order.</p>";
}

window.removeOrder=async code=>{
  if(!confirm("Hapus order ini?"))return;
  await api(`/api/admin/orders/${encodeURIComponent(code)}`,{method:"DELETE"});
  await loadOrders();
};

$("loginBtn").onclick=async()=>{
  localStorage.setItem("jsx_admin_token",$("token").value.trim());
  try{
    await api("/api/admin/orders?limit=1");
    $("loginBox").classList.add("hidden");
    $("panel").classList.remove("hidden");
    loadOrders();
  }catch(e){
    localStorage.removeItem("jsx_admin_token");
    $("loginMsg").textContent=e.message;
  }
};

$("logoutBtn").onclick=()=>{
  localStorage.removeItem("jsx_admin_token");
  location.reload();
};

$("createBtn").onclick=async()=>{
  $("formMsg").textContent="Menyimpan...";
  try{
    const body={
      whatsapp:$("wa").value,
      product:$("product").value,
      price:Number($("price").value||0),
      duration_days:Number($("duration").value),
      warranty_days:Number($("warranty").value),
      account_detail:$("account").value,
      internal_note:$("note").value
    };
    const d=await api("/api/admin/orders",{method:"POST",body:JSON.stringify(body)});
    const o=d.order;
    $("resultData").innerHTML=`
      <p><b>Kode:</b> ${o.code}</p>
      <p><b>Produk:</b> ${o.product}</p>
      <p><b>Link customer:</b><br><a href="${o.order_link}" target="_blank">${o.order_link}</a></p>
    `;
    $("waButton").href=whatsappUrl(o);
    $("resultCard").classList.remove("hidden");
    $("formMsg").textContent="Order berhasil dibuat.";
    loadOrders();
  }catch(e){
    $("formMsg").textContent=e.message;
  }
};

let timer;
$("search").oninput=()=>{
  clearTimeout(timer);
  timer=setTimeout(loadOrders,350);
};

if(token()){
  $("loginBox").classList.add("hidden");
  $("panel").classList.remove("hidden");
  loadOrders();
}
