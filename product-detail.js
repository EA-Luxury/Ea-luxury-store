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
    button.setAttribute("aria-pressed", String(i === index));
  });
  const count = document.getElementById("detailImageCount");
  if (count) count.textContent = (index + 1) + " / " + detailImages.length;
  const lightboxCount = document.getElementById("detailLightboxCount");
  if (lightboxCount) lightboxCount.textContent = (index + 1) + " / " + detailImages.length;
  const lightboxImage = document.getElementById("detailLightboxImage");
  if (lightboxImage) lightboxImage.src = detailImages[index];
}

let detailSelectedVariantId = null;

function detailSelectVariant(id) {
  const variant = detailVariants.find(v => String(v.id) === String(id));
  if (!variant || Number(variant.stock) <= 0) return;
  detailSelectedVariantId = variant.id;
  document.querySelectorAll("[data-detail-variant]").forEach(button => {
    const selected = String(button.dataset.detailVariant) === String(id);
    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
  const hint = document.getElementById("detailVariantHint");
  if (hint) hint.textContent = "اختيارك: " + (variant.size || "بدون مقاس") + " - " + (variant.color || "بدون لون") + " | متاح " + Number(variant.stock) + " قطعة";
}

function detailRenderLightbox() {
  if (!detailImages.length || document.getElementById("detailLightbox")) return;
  const overlay = document.createElement("div");
  overlay.id = "detailLightbox";
  overlay.className = "product-detail-lightbox";
  overlay.hidden = true;
  overlay.innerHTML = `
    <button type="button" class="product-detail-lightbox-close" aria-label="إغلاق">×</button>
    <button type="button" class="product-detail-lightbox-nav prev" aria-label="الصورة السابقة">‹</button>
    <img id="detailLightboxImage" src="${detailEscape(detailImages[0])}" alt="صورة المنتج مكبرة">
    <button type="button" class="product-detail-lightbox-nav next" aria-label="الصورة التالية">›</button>
    <span class="product-detail-lightbox-count" id="detailLightboxCount">1 / ${detailImages.length}</span>`;
  document.body.append(overlay);
  overlay.querySelector(".product-detail-lightbox-close").addEventListener("click", detailCloseLightbox);
  overlay.querySelector(".prev").addEventListener("click", () => detailShowImage((detailSelectedImage - 1 + detailImages.length) % detailImages.length));
  overlay.querySelector(".next").addEventListener("click", () => detailShowImage((detailSelectedImage + 1) % detailImages.length));
  overlay.addEventListener("click", event => { if (event.target === overlay) detailCloseLightbox(); });
}

function detailOpenLightbox() {
  const overlay = document.getElementById("detailLightbox");
  if (!overlay) return;
  overlay.hidden = false;
  document.body.classList.add("detail-lightbox-open");
  detailShowImage(detailSelectedImage);
}

function detailCloseLightbox() {
  const overlay = document.getElementById("detailLightbox");
  if (overlay) overlay.hidden = true;
  document.body.classList.remove("detail-lightbox-open");
}

document.addEventListener("keydown", event => {
  if (event.key === "Escape") detailCloseLightbox();
  if (document.getElementById("detailLightbox")?.hidden === false && detailImages.length > 1) {
    if (event.key === "ArrowLeft") detailShowImage((detailSelectedImage + 1) % detailImages.length);
    if (event.key === "ArrowRight") detailShowImage((detailSelectedImage - 1 + detailImages.length) % detailImages.length);
  }
});

function detailEffectivePrice(product) {
  const regular = Number(product?.price || 0);
  const sale = Number(product?.sale_price);
  return Number.isFinite(sale) && sale > 0 && sale < regular ? sale : regular;
}

function detailPriceMarkup(product) {
  const regular = Number(product?.price || 0);
  const sale = detailEffectivePrice(product);
  if (sale < regular) {
    const discount = Math.round((1 - sale / regular) * 100);
    return '<strong class="product-sale-price">' + sale.toLocaleString("ar-EG") +
      ' جنيه</strong> <del class="product-old-price">' + regular.toLocaleString("ar-EG") +
      ' جنيه</del> <span class="product-discount-badge">خصم ' + discount + '%</span>';
  }
  return sale.toLocaleString("ar-EG") + " جنيه";
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

  const firstAvailableVariant = availableVariants[0] || null;
  const variantControl = hasVariants ? `
    <div class="product-detail-options">
      <div class="product-detail-options-heading">
        <label>اختار المقاس واللون</label>
        <span id="detailVariantHint">${firstAvailableVariant ? "اختار التركيبة المناسبة لك" : "نفدت جميع الاختيارات"}</span>
      </div>
      <div class="product-detail-variant-list" role="group" aria-label="اختيارات المقاس واللون">
        ${detailVariants.map(v => `
          <button type="button"
            class="product-detail-variant ${firstAvailableVariant && String(v.id) === String(firstAvailableVariant.id) ? "selected" : ""}"
            data-detail-variant="${detailEscape(v.id)}"
            aria-pressed="${firstAvailableVariant && String(v.id) === String(firstAvailableVariant.id) ? "true" : "false"}"
            ${Number(v.stock) <= 0 ? "disabled" : ""}>
            <strong>${detailEscape(v.size || "بدون مقاس")}</strong>
            <span>${detailEscape(v.color || "بدون لون")}</span>
            <small>${Number(v.stock) > 0 ? "متاح " + Number(v.stock) + " قطعة" : "غير متاح"}</small>
          </button>
        `).join("")}
      </div>
    </div>` : "";

  detailRoot.className = "";
  detailRoot.innerHTML = `
    <section class="product-detail-layout">
      <div class="product-detail-gallery">
        <div class="product-detail-image-stage">
          <img id="detailMainImage" class="product-detail-main-image"
            src="${detailEscape(detailImages[0] || "")}" alt="${detailEscape(p.name)}"
            ${detailImages.length ? "" : "hidden"} ${detailImages.length ? 'tabindex="0" role="button" aria-label="تكبير صورة المنتج"' : ""}>
          ${detailImages.length > 1 ? `
            <button type="button" class="product-detail-image-nav prev" id="detailPrevImage" aria-label="الصورة السابقة">‹</button>
            <button type="button" class="product-detail-image-nav next" id="detailNextImage" aria-label="الصورة التالية">›</button>
            <span class="product-detail-image-count" id="detailImageCount">1 / ${detailImages.length}</span>` : ""}
          ${!detailImages.length ? '<div class="product-detail-no-image">EA LUXURY</div>' : ""}
        </div>
        ${detailImages.length > 1 ? `
          <div class="product-detail-thumbnails" aria-label="صور المنتج">
            ${detailImages.map((url, i) => `
              <button type="button" class="product-detail-thumbnail ${i === 0 ? "active" : ""}" data-detail-image="${i}" aria-label="عرض الصورة ${i + 1}" aria-pressed="${i === 0 ? "true" : "false"}">
                <img src="${detailEscape(url)}" alt="صورة ${i + 1}" loading="lazy">
              </button>`).join("")}
          </div>` : ""}
        <p class="product-detail-gallery-note">اضغط على الصورة لمشاهدتها بحجم أكبر</p>
      </div>
      <div class="product-detail-info">
        <span class="product-detail-category">${detailEscape(p.category || "EA LUXURY")}</span>
        <h1>${detailEscape(p.name)}</h1>
        <div class="product-detail-price">${detailPriceMarkup(p)}</div>
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
  detailRoot.querySelectorAll("[data-detail-variant]").forEach(button => {
    button.addEventListener("click", () => detailSelectVariant(button.dataset.detailVariant));
  });
  const mainImage = document.getElementById("detailMainImage");
  if (mainImage && detailImages.length) {
    mainImage.addEventListener("click", detailOpenLightbox);
    mainImage.addEventListener("keydown", event => {
      if (event.key === "Enter" || event.key === " ") { event.preventDefault(); detailOpenLightbox(); }
    });
  }
  document.getElementById("detailPrevImage")?.addEventListener("click", () => detailShowImage((detailSelectedImage - 1 + detailImages.length) % detailImages.length));
  document.getElementById("detailNextImage")?.addEventListener("click", () => detailShowImage((detailSelectedImage + 1) % detailImages.length));
  document.getElementById("detailAddToCart").addEventListener("click", detailAddToCart);
  detailRenderLightbox();
}

function detailAddToCart() {
  const p = detailProduct;
  const hasVariants = detailVariants.length > 0;
  let selectedVariant = null;

  if (hasVariants) {
    selectedVariant = detailVariants.find(v => String(v.id) === String(detailSelectedVariantId));
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
    item.price = detailEffectivePrice(p);
    if (Number(item.quantity) >= availableStock) {
      document.getElementById("detailMessage").textContent = "وصلت للكمية المتاحة من هذا الاختيار.";
      return;
    }
    item.quantity = Number(item.quantity) + 1;
  } else {
    saved.push({
      ...p,
      price: detailEffectivePrice(p),
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
  detailSelectedVariantId = detailVariants.find(v => Number(v.stock) > 0)?.id ?? null;
  document.title = data.name + " | EA Luxury";
  detailRender();
}

document.getElementById("detailCartButton").addEventListener("click", () => {
  window.location.href = "cart.html";
});
detailUpdateCartCount();
detailLoadProduct();
