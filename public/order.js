const API="https://juastorex-customer-api.jhonyoga01.workers.dev";
const p=new URLSearchParams(location.search);
const code=p.get("code")||"";
const key=p.get("key")||"";

fetch(`${API}/api/order?code=${encodeURIComponent(code)}&key=${encodeURIComponent(key)}`)
  .then(async r=>{
    const d=await r.json();
    if(!r.ok)throw new Error(d.error||"Order tidak ditemukan.");
    return d.order;
  })
  .then(o=>{
    document.getElementById("product").textContent=o.product;
    document.getElementById("message").textContent="Detail produk dan masa aktif garansi.";
    document.getElementById("code").textContent=o.code;
    document.getElementById("duration").textContent=`${o.duration_days} hari`;
    document.getElementById("productRemaining").textContent=
      o.product_remaining_days>=0?`${o.product_remaining_days} hari lagi`:"Masa produk telah habis";
    document.getElementById("warranty").textContent=`${o.warranty_days} hari`;
    document.getElementById("warrantyRemaining").textContent=
      o.warranty_remaining_days>=0?`${o.warranty_remaining_days} hari lagi`:"Garansi telah habis";
    document.getElementById("status").textContent=o.warranty_status;
    const claimLink = document.getElementById("claimLink");

claimLink.href =
  `https://garansi.juastorex.my.id/?code=${encodeURIComponent(o.code)}&key=${encodeURIComponent(key)}`;
    document.getElementById("details").classList.remove("hidden");
  })
  .catch(e=>{
    document.getElementById("product").textContent="Order tidak tersedia";
    document.getElementById("message").textContent=e.message;
  });
