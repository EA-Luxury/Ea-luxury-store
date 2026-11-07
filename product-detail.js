const SUPABASE_URL = "https://jezqohivdiziuzfmllvq.supabase.co";
const SUPABASE_KEY = "sb_publishable_hrP0-e5_ou1HHeKZpCu8jw_ORY_-zdh";
const detailDb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const detailRoot = document.getElementById("productDetails");
const detailId = new URLSearchParams(window.location.search).get("id");
let detailProduct = null;
let detailVariants = [];
let detailImages = [];
let detailSelectedImage = 0;
let detailFavoriteIds = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem("eaLuxuryFavorites") || "[]");
    return Array.isArray(saved) ? saved.map(String) : [];
  } catch (_) { return []; }
})();
function detailIsFavorite() {
  return !!detailProduct && detailFavoriteIds.includes(String(detailProduct.id));
}
function detailToggleFavorite() {
  if (!detailProduct) return;
  const id = String(detailProduct.id);
  detailFavoriteIds = detailIsFavorite()
    ? detailFavoriteIds.filter(value => value !== id)
    : [...detailFavoriteIds, id];
  try { localStorage.setItem("eaLuxuryFavorites", JSON.stringify(detailFavoriteIds)); } catch (_) {}
  detailUpdateFavoriteButton();
}
function detailUpdateFavoriteButton() {
  const button = document.getElementById("detailFavoriteButton");
  if (!button) return;
  const active = detailIsFavorite();
  button.setAttribute("aria-pressed", String(active));
  button.setAttribute("aria-label", active ? "إزالة من المفضلة" : "أضف للمفضلة");
  button.innerHTML = (active ? "♥" : "♡") + '<span>' + (active ? "محفوظ في المفضلة" : "أضف إلى المفضلة") + '</span>';
}

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

let detailQuantity = 1;

function detailUpdateQuantity(nextValue) {
  const selected = detailVariants.find(v => String(v.id) === String(detailSelectedVariantId));
  const max = selected ? Number(selected.stock) : Number(detailProduct?.stock ?? 0);
  detailQuantity = Math.max(1, Math.min(max || 1, Number(nextValue) || 1));
  const input = document.getElementById("detailQuantityValue");
  if (input) { input.max = max || 1; input.value = detailQuantity; }
  const minus = document.getElementById("detailQuantityMinus");
  const plus = document.getElementById("detailQuantityPlus");
  if (minus) minus.disabled = detailQuantity <= 1;
  if (plus) plus.disabled = detailQuantity >= max;
}

function detailSelectVariant(id) {
  const variant = detailVariants.find(v => String(v.id) === String(id));
  if (!variant || Number(variant.stock) <= 0) return;
  detailSelectedVariantId = variant.id;
  detailUpdateQuantity(1);
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
  const now = Date.now();
  const startsAt = product?.sale_starts_at ? Date.parse(product.sale_starts_at) : null;
  const endsAt = product?.sale_ends_at ? Date.parse(product.sale_ends_at) : null;
  const hasStarted = startsAt === null || (Number.isFinite(startsAt) && now >= startsAt);
  const notEnded = endsAt === null || (Number.isFinite(endsAt) && now < endsAt);
  return Number.isFinite(sale) && sale > 0 && sale < regular && hasStarted && notEnded ? sale : regular;
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


let detailReviewSession = null;

async function detailLoadReviewSession() {
  const { data, error } = await detailDb.auth.getSession();
  if (error) console.warn("Review auth session:", error.message);
  detailReviewSession = data?.session || null;
  const loginBox = document.getElementById("detailReviewLogin");
  const formBox = document.getElementById("detailReviewForm");
  const accountNote = document.getElementById("detailReviewAccount");
  if (!loginBox || !formBox) return;
  loginBox.hidden = !!detailReviewSession;
  formBox.hidden = !detailReviewSession;
  if (accountNote && detailReviewSession) {
    accountNote.textContent = "تم تسجيل الدخول بالبريد: " + (detailReviewSession.user?.email || "");
  }
}

async function detailSendReviewLink() {
  const email = document.getElementById("detailReviewEmail")?.value.trim();
  const message = document.getElementById("detailReviewAuthMessage");
  const button = document.getElementById("detailReviewLoginButton");
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    message.textContent = "اكتب البريد الإلكتروني الصحيح الذي استخدمته عند الطلب.";
    return;
  }
  button.disabled = true;
  message.textContent = "جاري إرسال رابط الدخول إلى بريدك...";
  try {
    const { error } = await detailDb.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.href }
    });
    if (error) throw error;
    message.textContent = "تم إرسال رابط آمن إلى بريدك. افتحه من نفس الجهاز للعودة إلى صفحة المنتج وإكمال التقييم.";
  } catch (error) {
    message.textContent = "تعذر إرسال الرابط: " + (error.message || "حاول مرة أخرى");
  } finally {
    button.disabled = false;
  }
}

async function detailSubmitReview() {
  const message = document.getElementById("detailReviewSubmitMessage");
  const button = document.getElementById("detailReviewSubmitButton");
  const orderId = Number(document.getElementById("detailReviewOrderId")?.value);
  const rating = Number(document.getElementById("detailReviewRating")?.value);
  const comment = document.getElementById("detailReviewComment")?.value.trim() || "";
  if (!Number.isSafeInteger(orderId) || orderId <= 0) {
    message.textContent = "اكتب رقم الطلب بشكل صحيح.";
    return;
  }
  if (comment.length > 1000) {
    message.textContent = "التعليق يجب ألا يتجاوز 1000 حرف.";
    return;
  }
  button.disabled = true;
  message.textContent = "جاري إرسال تقييمك للتحقق والمراجعة...";
  try {
    const { error } = await detailDb.rpc("submit_product_review", {
      p_product_id: Number(detailProduct.id),
      p_order_id: orderId,
      p_rating: rating,
      p_comment: comment
    });
    if (error) throw error;
    message.textContent = "وصل تقييمك بنجاح، وسيظهر على المنتج بعد موافقة الإدارة. شكرًا لثقتك في EA Luxury.";
    document.getElementById("detailReviewForm").querySelector("form")?.reset();
  } catch (error) {
    message.textContent = error.message || "تعذر إرسال التقييم. راجع رقم الطلب والبريد المستخدم عند الشراء.";
  } finally {
    button.disabled = false;
  }
}

async function detailLoadReviews() {
  const list = document.getElementById("detailReviewsList");
  const summary = document.getElementById("detailReviewsSummary");
  if (!list || !summary || !detailProduct) return;
  list.textContent = "جاري تحميل التقييمات...";
  const { data, error } = await detailDb.from("product_reviews")
    .select("id,rating,comment,created_at")
    .eq("product_id", detailProduct.id)
    .eq("status", "approved")
    .order("created_at", { ascending: false });
  if (error) {
    console.error("Product reviews load error:", error);
    list.textContent = "تعذر تحميل التقييمات حاليًا.";
    return;
  }
  const reviews = data || [];
  const average = reviews.length
    ? reviews.reduce((sum, item) => sum + Number(item.rating || 0), 0) / reviews.length
    : 0;
  summary.textContent = reviews.length
    ? "★ " + average.toFixed(1) + " من 5 — " + reviews.length + " تقييم"
    : "لا توجد تقييمات منشورة لهذا المنتج حتى الآن.";
  if (!reviews.length) {
    list.textContent = "كن أول من يشارك رأيه بعد إتمام الشراء.";
    return;
  }
  list.innerHTML = reviews.map(item => {
    const date = item.created_at
      ? new Date(item.created_at).toLocaleDateString("ar-EG")
      : "";
    return '<article style="padding:14px 0;border-bottom:1px solid #e9e1d3">' +
      '<div style="color:#b18a45;font-size:20px;letter-spacing:2px">' +
      "★".repeat(Number(item.rating)) + "☆".repeat(5 - Number(item.rating)) +
      '</div><p style="margin:7px 0;white-space:pre-wrap">' + detailEscape(item.comment || "بدون تعليق") +
      '</p><small style="color:#88795f">' + detailEscape(date) + " · مشتري موثّق" + '</small></article>';
  }).join("");
}

function detailRenderReviews() {
  const section = document.createElement("section");
  section.id = "detailProductReviews";
  section.style.cssText = "margin:28px 0;padding:22px;border:1px solid #e8dfce;border-radius:14px;background:#fff;direction:rtl";
  section.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">
      <div><span style="color:#b18a45;font-size:12px;letter-spacing:2px">EA LUXURY</span>
      <h2 style="margin:5px 0;color:#171717">آراء العملاء</h2></div>
      <strong id="detailReviewsSummary" style="color:#9b793e">جاري تحميل التقييمات...</strong>
    </div>
    <div id="detailReviewsList" style="margin:12px 0">جاري تحميل التقييمات...</div>
    <div style="border-top:1px solid #eee5d5;padding-top:18px;margin-top:18px">
      <h3 style="margin:0 0 8px;color:#9b793e">قيّم المنتج بعد الشراء</h3>
      <p style="color:#766b58;font-size:13px">التقييم متاح فقط بعد اكتمال الطلب، باستخدام نفس البريد الإلكتروني المسجل في الطلب. كل طلب يمكنه تقييم المنتج مرة واحدة.</p>
      <div id="detailReviewLogin">
        <input id="detailReviewEmail" type="email" autocomplete="email" placeholder="البريد الإلكتروني المستخدم عند الطلب" style="width:100%;padding:12px;border:1px solid #ddd;border-radius:8px;font:inherit">
        <button id="detailReviewLoginButton" type="button" style="margin-top:8px;padding:12px 18px;background:#171717;color:#d6b36a;border:0;border-radius:8px;font:inherit;font-weight:700">إرسال رابط دخول آمن</button>
        <p id="detailReviewAuthMessage" role="status" style="color:#766b58"></p>
      </div>
      <div id="detailReviewForm" hidden>
        <p id="detailReviewAccount" style="font-size:13px;color:#766b58"></p>
        <form>
          <input id="detailReviewOrderId" type="number" min="1" step="1" required placeholder="رقم الطلب" style="width:100%;padding:12px;margin:6px 0;border:1px solid #ddd;border-radius:8px;font:inherit">
          <label for="detailReviewRating" style="display:block;margin-top:8px">تقييمك</label>
          <select id="detailReviewRating" required style="width:100%;padding:12px;margin:6px 0;border:1px solid #ddd;border-radius:8px;font:inherit">
            <option value="5">★★★★★ — ممتاز</option><option value="4">★★★★☆ — جيد جدًا</option>
            <option value="3">★★★☆☆ — جيد</option><option value="2">★★☆☆☆ — مقبول</option><option value="1">★☆☆☆☆ — ضعيف</option>
          </select>
          <textarea id="detailReviewComment" rows="4" maxlength="1000" placeholder="اكتب رأيك في المنتج (اختياري)" style="width:100%;padding:12px;margin:6px 0;border:1px solid #ddd;border-radius:8px;font:inherit"></textarea>
          <button id="detailReviewSubmitButton" type="submit" style="padding:12px 18px;background:#171717;color:#d6b36a;border:0;border-radius:8px;font:inherit;font-weight:700">إرسال التقييم</button>
        </form>
        <p id="detailReviewSubmitMessage" role="status" style="color:#766b58"></p>
      </div>
    </div>`;
  detailRoot.append(section);
  document.getElementById("detailReviewLoginButton").addEventListener("click", detailSendReviewLink);
  document.getElementById("detailReviewForm").querySelector("form").addEventListener("submit", event => {
    event.preventDefault();
    detailSubmitReview();
  });
  detailLoadReviewSession();
  detailLoadReviews();
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
        <button type="button" id="detailFavoriteButton" class="detail-favorite-button" aria-pressed="false" aria-label="أضف للمفضلة">♡<span>أضف إلى المفضلة</span></button>
        <div class="product-detail-price">${detailPriceMarkup(p)}</div>
        <p class="product-detail-description">${detailEscape(description)}</p>
        <div class="product-detail-meta">
          <span>القسم: ${detailEscape(p.category || "غير محدد")}</span>
          ${sizes.length ? `<span>المقاسات: ${sizes.map(detailEscape).join(" - ")}</span>` : ""}
          ${colors.length ? `<span>الألوان: ${colors.map(detailEscape).join(" - ")}</span>` : ""}
          <span>المتاح: ${totalStock} قطعة</span>
        </div>
        ${variantControl}
        <div class="product-detail-purchase-panel">
          <div class="product-detail-quantity-row">
            <label for="detailQuantityValue">الكمية</label>
            <div class="product-detail-quantity-control">
              <button id="detailQuantityMinus" type="button" aria-label="تقليل الكمية" disabled>−</button>
              <input id="detailQuantityValue" type="number" min="1" max="${totalStock}" value="1" inputmode="numeric" aria-label="الكمية المطلوبة">
              <button id="detailQuantityPlus" type="button" aria-label="زيادة الكمية" ${totalStock <= 1 ? "disabled" : ""}>+</button>
            </div>
            <span class="product-detail-stock">${totalStock > 0 ? "متاح " + totalStock + " قطعة" : "نفد المخزون"}</span>
          </div>
          <button id="detailAddToCart" class="product-detail-add" type="button" ${totalStock <= 0 ? "disabled" : ""}>
            ${totalStock <= 0 ? "غير متوفر حاليًا" : "أضف إلى السلة"}
          </button>
          <p class="product-detail-cart-note">يمكنك مراجعة اختياراتك وتأكيد الطلب من سلة التسوق.</p>
        </div>
        <p id="detailMessage" class="product-detail-message" role="status" aria-live="polite"></p>
        <a class="product-detail-back" href="index.html#products">← الرجوع إلى المنتجات</a>
      </div>
    </section>`;

  detailRenderReviews();

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
  document.getElementById("detailFavoriteButton")?.addEventListener("click", detailToggleFavorite);
  detailUpdateFavoriteButton();
  document.getElementById("detailAddToCart").addEventListener("click", () => detailAddToCart());
  document.getElementById("detailQuantityMinus").addEventListener("click", () => detailUpdateQuantity(detailQuantity - 1));
  document.getElementById("detailQuantityPlus").addEventListener("click", () => detailUpdateQuantity(detailQuantity + 1));
  document.getElementById("detailQuantityValue").addEventListener("change", event => detailUpdateQuantity(event.target.value));
  if (firstAvailableVariant) detailSelectVariant(firstAvailableVariant.id);
  else detailUpdateQuantity(1);
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
  const requestedQuantity = Math.max(1, Number(detailQuantity) || 1);
  const cartKey = String(p.id) + "_" + (selectedVariant ? String(selectedVariant.id) : "base");
  let saved = [];
  try {
    const parsed = JSON.parse(localStorage.getItem("eaLuxuryCart") || "[]");
    saved = Array.isArray(parsed) ? parsed : [];
  } catch (_) {}

  const item = saved.find(row => row.cartKey === cartKey);
  const existingQuantity = item ? Math.max(0, Number(item.quantity) || 0) : 0;
  if (existingQuantity + requestedQuantity > availableStock) {
    document.getElementById("detailMessage").textContent = "الكمية المطلوبة تتجاوز المتاح. المتاح لك إضافته: " + Math.max(0, availableStock - existingQuantity) + " قطعة.";
    return;
  }
  if (item) {
    item.price = detailEffectivePrice(p);
    item.quantity = existingQuantity + requestedQuantity;
    item.availableStock = availableStock;
  } else {
    saved.push({
      ...p,
      price: detailEffectivePrice(p),
      quantity: requestedQuantity,
      cartKey,
      variant_id: selectedVariant ? selectedVariant.id : null,
      selected_size: selectedVariant?.size || null,
      selected_color: selectedVariant?.color || null,
      availableStock
    });
  }

  localStorage.setItem("eaLuxuryCart", JSON.stringify(saved));
  detailUpdateCartCount();
  document.getElementById("detailMessage").textContent = "تمت إضافة " + requestedQuantity + " قطعة إلى السلة بنجاح.";
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
  detailLoadRelatedProducts();
}

async function detailLoadRelatedProducts() {
  if (!detailProduct?.category) return;
  const { data, error } = await detailDb.from("products")
    .select("id,name,price,sale_price,sale_starts_at,sale_ends_at,image_url,image_urls,category,active")
    .eq("active", true).eq("category", detailProduct.category)
    .neq("id", detailProduct.id).limit(4);
  if (error) {
    console.error("Related products load error:", error);
    return;
  }
  const products = (data || []).filter(product => product.id != null);
  if (!products.length) return;
  const section = document.createElement("section");
  section.className = "product-related-section";
  section.innerHTML = `
    <div class="product-related-heading">
      <span>EA LUXURY</span>
      <h2>منتجات قد تعجبك</h2>
      <p>اكتشف المزيد من نفس القسم</p>
    </div>
    <div class="product-related-grid">
      ${products.map(product => {
        const images = detailGetImages(product);
        const imageMarkup = images.length
          ? `<img src="${detailEscape(images[0])}" alt="${detailEscape(product.name)}" loading="lazy">`
          : `<span class="product-related-placeholder">EA</span>`;
        return `<a class="product-related-card" href="product.html?id=${encodeURIComponent(product.id)}">
          <div class="product-related-image">${imageMarkup}</div>
          <div class="product-related-info"><strong>${detailEscape(product.name)}</strong>
            <span>${detailPriceMarkup(product)}</span><small>عرض التفاصيل</small></div>
        </a>`;
      }).join("")}
    </div>`;
  detailRoot.append(section);
}


const detailMenuButton = document.getElementById("detailMobileMenuButton");
const detailMainNav = document.getElementById("detailMainNav");
if (detailMenuButton && detailMainNav) {
  detailMenuButton.addEventListener("click", () => {
    const isOpen = detailMainNav.classList.toggle("is-open");
    detailMenuButton.setAttribute("aria-expanded", String(isOpen));
    detailMenuButton.setAttribute("aria-label", isOpen ? "إغلاق القائمة" : "فتح القائمة");
    detailMenuButton.textContent = isOpen ? "×" : "☰";
  });
  detailMainNav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      detailMainNav.classList.remove("is-open");
      detailMenuButton.setAttribute("aria-expanded", "false");
      detailMenuButton.setAttribute("aria-label", "فتح القائمة");
      detailMenuButton.textContent = "☰";
    });
  });
}

document.getElementById("detailCartButton").addEventListener("click", () => {
  window.location.href = "cart.html#cartSection";
});
detailUpdateCartCount();
detailLoadProduct();


// تسجيل نسخة EA Luxury القابلة للتثبيت على صفحة تفاصيل المنتج.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .catch(error => console.warn("تعذر تسجيل تطبيق EA Luxury:", error));
  });
}
