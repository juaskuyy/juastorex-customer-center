const API = "https://juastorex-customer-api.jhonyoga01.workers.dev";
let currentOrder = null;

const checkForm = document.getElementById("checkForm");
const claimForm = document.getElementById("claimForm");
const message = document.getElementById("message");
const claimMessage = document.getElementById("claimMessage");
const orderResult = document.getElementById("orderResult");
const orderDetails = document.getElementById("orderDetails");
const claimPhoto = document.getElementById("claimPhoto");
const photoText = document.getElementById("photoText");
const photoPreview = document.getElementById("photoPreview");
const claimButton = document.getElementById("claimButton");

function rupiah(value){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(value||0))}
function setMessage(element,text,type=""){element.textContent=text;element.className=`message ${type}`.trim()}
function escapeHtml(value){return String(value??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;")}

checkForm.addEventListener("submit",async(event)=>{
  event.preventDefault();currentOrder=null;orderResult.classList.add("hidden");setMessage(message,"Memeriksa data...");
  const code=document.getElementById("orderCode").value.trim();
  const wa=document.getElementById("customerWa").value.trim();
  try{
    const response=await fetch(`${API}/api/check`,{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({code,wa})});
    const result=await response.json();
    if(!response.ok)throw new Error(result.error||"Data order tidak ditemukan.");
    currentOrder=result.order;
    orderDetails.innerHTML=`
      <div class="detail"><span>Kode order</span><strong>${escapeHtml(currentOrder.code)}</strong></div>
      <div class="detail"><span>Customer</span><strong>${escapeHtml(currentOrder.customer_name||"-")}</strong></div>
      <div class="detail"><span>WhatsApp</span><strong>${escapeHtml(currentOrder.wa||"-")}</strong></div>
      <div class="detail"><span>Produk</span><strong>${escapeHtml(currentOrder.product||"-")}</strong></div>
      <div class="detail"><span>Harga</span><strong>${rupiah(currentOrder.price)}</strong></div>
      <div class="detail"><span>Tanggal order</span><strong>${escapeHtml(currentOrder.order_date||"-")}</strong></div>
      <div class="detail"><span>Garansi sampai</span><strong>${escapeHtml(currentOrder.warranty_end||"-")}</strong></div>
      <div class="detail"><span>Detail akun</span><strong>${escapeHtml(currentOrder.account_info||"-")}</strong></div>
      <div class="detail"><span>Akses</span><strong>${escapeHtml(currentOrder.access_info||"-")}</strong></div>`;
    orderResult.classList.remove("hidden");setMessage(message,"Data order ditemukan.","success");orderResult.scrollIntoView({behavior:"smooth"});
  }catch(error){setMessage(message,error.message,"error")}
});

claimPhoto.addEventListener("change",()=>{
  const file=claimPhoto.files?.[0];photoPreview.innerHTML="";
  if(!file){photoText.textContent="Pilih foto atau screenshot";return}
  if(file.size>5*1024*1024){claimPhoto.value="";photoText.textContent="Pilih foto atau screenshot";setMessage(claimMessage,"Ukuran foto maksimal 5 MB.","error");return}
  photoText.textContent=file.name;const previewUrl=URL.createObjectURL(file);photoPreview.innerHTML=`<img src="${previewUrl}" alt="Preview bukti kendala">`;
});

claimForm.addEventListener("submit",async(event)=>{
  event.preventDefault();
  if(!currentOrder){setMessage(claimMessage,"Silakan cek order terlebih dahulu.","error");return}
  const reason=document.getElementById("claimReason").value.trim();const photo=claimPhoto.files?.[0];
  if(!reason||!photo){setMessage(claimMessage,"Alasan dan foto bukti kendala wajib diisi.","error");return}
  const formData = new FormData();

formData.append("order_code", currentOrder.code);
formData.append("wa", currentOrder.wa);
formData.append("problem", reason);
formData.append("photo", photo);
  claimButton.disabled=true;claimButton.textContent="Mengirim foto...";setMessage(claimMessage,"Mohon tunggu, foto sedang dikirim.");
  try{
    const response=await fetch(`${API}/api/claims`,{method:"POST",body:formData});
    const result=await response.json();if(!response.ok)throw new Error(result.error||"Klaim gagal dikirim.");
    claimForm.reset();photoText.textContent="Pilih foto atau screenshot";photoPreview.innerHTML="";setMessage(claimMessage,result.message,"success");
  }catch(error){setMessage(claimMessage,error.message,"error")}finally{claimButton.disabled=false;claimButton.textContent="Kirim klaim"}
});
