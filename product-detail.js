const SUPABASE_URL = "https://jezqohivdiziuzfmllvq.supabase.co";
const SUPABASE_KEY = "sb_publishable_hrP0-e5_ou1HHeKZpCu8jw_ORY_-zdh";
const detailDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const detailRoot = document.getElementById("productDetails");
const detailId = new URLSearchParams(window.location.search).get("id");
let detailProduct = null;
let detailVariants = [];
let detailImages = [];
let detailSelectedImage = 0;

function detailEscape(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}

function detailGetImages(product) {
  const list = Array.isArray(product.image_urls)
    ? product.image_urls.filter(url => typeof url === "string" && url.trim())
    : [];
  if (!list.length && product.image_url) list.push(product.image_url);
  return [...new Set(list)].slice(0, 5);
}

function detailUpdateCartCount() {
  let saved = [];
  try {
    const parsed = JSON.parse(localStorage.getItem("eaLuxuryCart") || "[]");
    saved = Array.isArray(parsed) ? parsed : [];
  } catch (_) {}
  document.getElementById("detailCartCount").textContent =
    saved.reduce((sum, item) => sum + Math.max(0, Number(item.quantity) || 0), 0);
}

function detailShowImage(index) {
  if (!detailImages.length) return;
  detailSelectedImage = index;
  const main = document.getElementById("detailMainImage");
  if (main) main.src = detailImages[index];
  document.querySelectorAll(".product-detail-thumbnail").forEach((button, i) => {
    button.classList.toggle("active", i === index);
  });
}

function detailRender() {
  const p = detailProduct;
  const hasVariants = detailVariants.length > 0;
  const availableVariants = detailVariants.filter(v => Number(v.stock) > 0);
  const totalStock = hasVariants
    ? availableVariants.reduce((sum, v) => sum + Number(v.stock), 0)
    : Number(p.stock ?? 0);
  const description = p.description && String(p.description).trim()
    ? p.description
    : "تفاصيل المنتج متاحة من خلال الصور والمقاسات والألوان الموضحة.";
  const sizes = Array.isArray(p.sizes) ? p.sizes.filter(Boolean) : [];
  const colors = Array.isArray(p.colors) ? p.colors.filter(Boolean) : [];

  const variantControl = hasVariants ? `
    <div class="product-detail-options">
      <label for="detailVariant">اختار المقاس واللون</label>
      <select id="detailVariant">
        ${detailVariants.map(v => `
          <option value="${detailEscape(v.id)}" ${Number(v.stock) <= 0 ? "disabled" : ""}>
            ${detailEscape(v.size || "بدون مقاس")} - ${detailEscape(v.color || "بدون لون")} - المتاح: ${Number(v.stock)}
          </option>
        `).join("")}
      </select>
    </div>` : "";

  detailRoot.className = "";
  detailRoot.innerHTML = `
    <section class="product-detail-layout">
      <div class="product-detail-gallery">
        <img id="detailMainImage" class="product-detail-main-image"
          src="${detailEscape(detailImages[0] || "")}" alt="${detailEscape(p.name)}"
          ${detailImages.length ? "" : "hidden"}>
        ${detailImages.length > 1 ? `
          <div class="product-detail-thumbnails">
            ${detailImages.map((url, i) => `
              <button type="button" class="product-detail-thumbnail ${i === 0 ? "active" : ""}" data-detail-image="${i}" aria-label="عرض الصورة ${i + 1}">
                <img src="${detailEscape(url)}" alt="صورة ${i + 1}">
              </button>`).join("")}
          </div>` : ""}
      </div>
      <div class="product-detail-info">
        <span class="product-detail-category">${detailEscape(p.category || "EA LUXURY")}</span>
        <h1>${detailEscape(p.name)}</h1>
        <div class="product-detail-price">${Number(p.price || 0).toLocaleString("ar-EG")} جنيه</div>
        <p class="product-detail-description">${detailEscape(description)}</p>
        <div class="product-detail-meta">
          <span>القسم: ${detailEscape(p.category || "غير محدد")}</span>
          ${sizes.length ? `<span>المقاسات: ${sizes.map(detailEscape).join(" - ")}</span>` : ""}
          ${colors.length ? `<span>الألوان: ${colors.map(detailEscape).join(" - ")}</span>` : ""}
          <span>المتاح: ${totalStock} قطعة</span>
        </div>
        ${variantControl}
        <button id="detailAddToCart" class="product-detail-add" type="button" ${totalStock <= 0 ? "disabled" : ""}>
          ${totalStock <= 0 ? "غير متوفر حاليًا" : "أضف إلى السلة"}
        </button>
        <p id="detailMessage" class="product-detail-message" role="status" aria-live="polite"></p>
        <a class="product-detail-back" href="index.html#products">← الرجوع إلى المنتجات</a>
      </div>
    </section>`;

  detailRoot.querySelectorAll("[data-detail-image]").forEach(button => {
    button.addEventListener("click", () => detailShowImage(Number(button.dataset.detailImage)));
  });
  document.getElementById("detailAddToCart").addEventListener("click", detailAddToCart);
}

function detailAddToCart() {
  const p = detailProduct;
  const hasVariants = detailVariants.length > 0;
  let selectedVariant = null;

  if (hasVariants) {
    const selectedId = document.getElementById("detailVariant")?.value;
    selectedVariant = detailVariants.find(v => String(v.id) === String(selectedId));
    if (!selectedVariant || Number(selectedVariant.stock) <= 0) {
      document.getElementById("detailMessage").textContent = "اختار مقاسًا ولونًا متاحين.";
      return;
    }
  }

  const availableStock = selectedVariant ? Number(selectedVariant.stock) : Number(p.stock ?? 0);
  const cartKey = String(p.id) + "_" + (selectedVariant ? String(selectedVariant.id) : "base");
  let saved = [];
  try {
    const parsed = JSON.parse(localStorage.getItem("eaLuxuryCart") || "[]");
    saved = Array.isArray(parsed) ? parsed : [];
  } catch (_) {}

  const item = saved.find(row => row.cartKey === cartKey);
  if (item) {
    if (Number(item.quantity) >= availableStock) {
      document.getElementById("detailMessage").textContent = "وصلت للكمية المتاحة من هذا الاختيار.";
      return;
    }
    item.quantity = Number(item.quantity) + 1;
  } else {
    saved.push({
      ...p,
      quantity: 1,
      cartKey,
      variant_id: selectedVariant ? selectedVariant.id : null,
      selected_size: selectedVariant?.size || null,
      selected_color: selectedVariant?.color || null,
      availableStock
    });
  }

  localStorage.setItem("eaLuxuryCart", JSON.stringify(saved));
  detailUpdateCartCount();
  document.getElementById("detailMessage").textContent = "تمت إضافة المنتج إلى السلة.";
}

async function detailLoadProduct() {
  if (!detailId) {
    detailRoot.textContent = "رابط المنتج غير مكتمل. ارجع إلى صفحة المنتجات واختار المنتج مرة أخرى.";
    return;
  }

  const { data, error } = await detailDb.from("products")
    .select("*").eq("id", detailId).eq("active", true).maybeSingle();

  if (error || !data) {
    console.error("Product detail load error:", error);
    detailRoot.textContent = "تعذر العثور على المنتج أو أنه لم يعد متاحًا.";
    return;
  }

  detailProduct = data;
  detailImages = detailGetImages(data);

  const { data: variants, error: variantsError } = await detailDb.from("product_variants")
    .select("id,product_id,size,color,stock,is_active")
    .eq("product_id", detailId).eq("is_active", true).order("id", { ascending: true });

  if (variantsError) console.error("Variant load error:", variantsError);
  detailVariants = variantsError ? [] : (variants || []);
  document.title = data.name + " | EA Luxury";
  detailRender();
}

document.getElementById("detailCartButton").addEventListener("click", () => {
  window.location.href = "cart.html";
});
detailUpdateCartCount();
detailLoadProduct();
