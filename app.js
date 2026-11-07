
const SUPABASE_URL = "https://jezqohivdiziuzfmllvq.supabase.co";
const SUPABASE_KEY = "sb_publishable_hrP0-e5_ou1HHeKZpCu8jw_ORY_-zdh";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// بيانات EmailJS تُضاف بعد إنشاء الحساب وربط البريد
const EMAILJS_SERVICE_ID = "service_m4fzbxg";
const EMAILJS_TEMPLATE_ID = "template_nbfsenl";
const EMAILJS_PUBLIC_KEY = "cFAgCWXvFOilVQI7p";
const OWNER_NOTIFICATION_EMAIL = "Ealuxury109@gmail.com";

async function ensureEmailJSSDK() {
  if (window.emailjs && typeof window.emailjs.send === "function") return true;

  const urls = [
    "https://cdn.jsdelivr.net/npm/@emailjs/browser@5.0.3/dist/email.min.js",
    "https://unpkg.com/@emailjs/browser@5.0.3/dist/email.min.js"
  ];

  for (const url of urls) {
    try {
      await new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = url;
        script.async = true;
        script.onload = resolve;
        script.onerror = () => reject(new Error("تعذر تحميل مكتبة البريد"));
        document.head.appendChild(script);
      });
      if (window.emailjs && typeof window.emailjs.send === "function") return true;
    } catch (error) {
      console.warn("فشل تحميل EmailJS من:", url, error);
    }
  }
  return false;
}

async function sendOrderEmails(orderId, values, orderItems, orderTotal, shippingFee) {
  const configured = [EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY]
    .every(value => value && !value.startsWith("YOUR_"));

  if (!configured) {
    return { sent: false, configured: false };
  }

  const sdkReady = await ensureEmailJSSDK();
  if (!sdkReady) {
    console.error("EmailJS SDK لم يتم تحميله من مصادر CDN.");
    return { sent: false, configured: true };
  }

  const itemsText = orderItems.map(item => {
    const variant = [item.selected_size, item.selected_color].filter(Boolean).join(" / ");
    return `${item.name}${variant ? " (" + variant + ")" : ""} × ${item.quantity} — ${(Number(item.price) * item.quantity).toLocaleString("ar-EG")} جنيه`;
  }).join("\\n");

  const templateParams = {
    order_id: String(orderId),
    customer_name: values.customer_name,
    customer_email: values.customer_email,
    phone: values.phone,
    governorate: values.governorate,
    address: values.address,
    order_total: Number(orderTotal).toLocaleString("ar-EG") + " جنيه",
    shipping_fee: Number(shippingFee).toLocaleString("ar-EG") + " جنيه",
    coupon_code: appliedCoupon?.code || "",
    discount_amount: Number(appliedCoupon?.discount_amount || 0).toLocaleString("ar-EG") + " جنيه",
    items_text: itemsText,
    store_name: "EA Luxury",
    to_email: values.customer_email,
    to_name: values.customer_name,
    subject: "تأكيد طلبك من EA Luxury #" + orderId,
    intro: "شكرًا لطلبك من EA Luxury. تم استلام طلبك بنجاح."
  };

  try {
    // رسالة واحدة للعميل، مع نسخة BCC مخفية للمتجر من إعدادات القالب.
    await window.emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      { publicKey: EMAILJS_PUBLIC_KEY }
    );
    return { sent: true, configured: true };
  } catch (error) {
    console.error("تعذر إرسال تأكيد الطلب بالبريد:", error);
    const detail = error?.text || error?.message || error?.status || "خطأ غير معروف من خدمة البريد";
    return { sent: false, configured: true, error: String(detail).slice(0, 220) };
  }
}

let products = [];
let productVariants = [];
let cart = (() => { try { const saved = JSON.parse(localStorage.getItem("eaLuxuryCart") || "[]"); return Array.isArray(saved) ? saved.filter(item => item && item.id != null && Number(item.quantity) > 0) : []; } catch (_) { return []; } })();
let appliedCoupon = null;
let lastCouponCartFingerprint = "";
let selectedCategory = "الكل";
let storefrontSettings = {};
const EGYPT_GOVERNORATES = [
  "القاهرة","الجيزة","الإسكندرية","الدقهلية","دمياط","الشرقية","القليوبية",
  "كفر الشيخ","الغربية","المنوفية","البحيرة","بورسعيد","الإسماعيلية","السويس",
  "بني سويف","الفيوم","المنيا","أسيوط","سوهاج","قنا","الأقصر","أسوان",
  "البحر الأحمر","مطروح","الوادي الجديد","شمال سيناء","جنوب سيناء"
];
function getShippingQuote(governorate) {
  const rates = storefrontSettings.shippingRates || {};
  const raw = rates[governorate];
  if (raw === null || raw === undefined || raw === "" || !Number.isFinite(Number(raw)) || Number(raw) < 0) return null;
  const subtotal = cart.reduce((sum,item) => sum + Number(item.price || 0) * Number(item.quantity || 0),0);
  const freeThreshold = Number(storefrontSettings.freeShipping || 0);
  return freeThreshold > 0 && subtotal >= freeThreshold ? 0 : Number(raw);
}
function populateGovernorateSelect() {
  const select = document.querySelector('#checkoutForm select[name="governorate"]');
  if (!select) return;
  const current = select.value;
  select.innerHTML = '<option value="">اختر المحافظة</option>' + EGYPT_GOVERNORATES.map(name =>
    '<option value="' + escapeHTML(name) + '">' + escapeHTML(name) + '</option>'
  ).join("");
  if (EGYPT_GOVERNORATES.includes(current)) select.value = current;
}
let productSearchTerm = "";
let productSortMode = "default";
let selectedProductSizes = [];
let selectedProductColors = [];
let selectedProductCategories = [];
let filterMinPrice = "";
let filterMaxPrice = "";
let filterAvailableOnly = false;
let filterOffersOnly = false;

function populateProductVariantFilters() {
  const sizes = [...new Set(productVariants.map(v => String(v.size || "").trim()).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b, "ar", { numeric: true }));
  const colors = [...new Set(productVariants.map(v => String(v.color || "").trim()).filter(Boolean))]
    .sort((a,b) => a.localeCompare(b, "ar"));
  const sizeHost = document.getElementById("filterSizeOptions");
  const colorHost = document.getElementById("filterColorOptions");
  const categoryHost = document.getElementById("filterCategoryOptions");
  if (sizeHost) sizeHost.innerHTML = sizes.length ? sizes.map(value =>
    '<label class="filter-check"><input type="checkbox" data-filter-size value="' + escapeHTML(value) + '"><span>' + escapeHTML(value) + '</span><small>' + productVariants.filter(v => String(v.size || "").trim() === value).length + '</small></label>'
  ).join("") : '<p class="filter-muted">المقاسات غير محددة</p>';
  if (colorHost) colorHost.innerHTML = colors.length ? colors.map(value =>
    '<label class="filter-check"><input type="checkbox" data-filter-color value="' + escapeHTML(value) + '"><span>' + escapeHTML(value) + '</span><small>' + productVariants.filter(v => String(v.color || "").trim() === value).length + '</small></label>'
  ).join("") : '<p class="filter-muted">الألوان غير محددة</p>';
  const categories = [...new Set(products.map(p => String(p.category || "").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar"));
  if (categoryHost) categoryHost.innerHTML = ['الكل',...categories].map(value =>
    '<label class="filter-check"><input type="checkbox" data-filter-category value="' + escapeHTML(value) + '"><span>' + escapeHTML(value) + '</span><small>' + (value === "الكل" ? products.length : products.filter(p => p.category === value).length) + '</small></label>'
  ).join("");
  syncAdvancedFilterControls();
}
function syncAdvancedFilterControls() {
  document.querySelectorAll("[data-filter-size]").forEach(el => el.checked = selectedProductSizes.includes(el.value));
  document.querySelectorAll("[data-filter-color]").forEach(el => el.checked = selectedProductColors.includes(el.value));
  document.querySelectorAll("[data-filter-category]").forEach(el => el.checked = selectedProductCategories.includes(el.value) || (selectedProductCategories.length === 0 && el.value === "الكل"));
  const min = document.getElementById("filterMinPrice"), max = document.getElementById("filterMaxPrice");
  if (min) min.value = filterMinPrice;
  if (max) max.value = filterMaxPrice;
  const available = document.getElementById("filterAvailableOnly"), offers = document.getElementById("filterOffersOnly");
  if (available) available.checked = filterAvailableOnly;
  if (offers) offers.checked = filterOffersOnly;
  const activeCount = selectedProductSizes.length + selectedProductColors.length + selectedProductCategories.length + (filterMinPrice !== "" ? 1 : 0) + (filterMaxPrice !== "" ? 1 : 0) + Number(filterAvailableOnly) + Number(filterOffersOnly);
  const count = document.getElementById("activeFilterCount");
  if (count) { count.textContent = activeCount; count.hidden = activeCount === 0; }
  const chips = document.getElementById("activeFilterChips");
  if (chips) {
    const values = [...selectedProductSizes.map(v=>"المقاس: "+v),...selectedProductColors.map(v=>"اللون: "+v),...selectedProductCategories.map(v=>"القسم: "+v)];
    if(filterMinPrice!==""||filterMaxPrice!=="") values.push("السعر: "+(filterMinPrice||"0")+" - "+(filterMaxPrice||"∞")+" جنيه");
    if(filterAvailableOnly) values.push("المتاح فقط");
    if(filterOffersOnly) values.push("العروض فقط");
    chips.innerHTML = values.map(v=>'<span class="filter-chip">'+escapeHTML(v)+'</span>').join("");
  }
}
function setAdvancedFiltersFromPanel() {
  selectedProductSizes = [...document.querySelectorAll("[data-filter-size]:checked")].map(el=>el.value);
  selectedProductColors = [...document.querySelectorAll("[data-filter-color]:checked")].map(el=>el.value);
  selectedProductCategories = [...document.querySelectorAll("[data-filter-category]:checked")].map(el=>el.value).filter(v=>v!=="الكل");
  filterMinPrice = document.getElementById("filterMinPrice")?.value || "";
  filterMaxPrice = document.getElementById("filterMaxPrice")?.value || "";
  filterAvailableOnly = !!document.getElementById("filterAvailableOnly")?.checked;
  filterOffersOnly = !!document.getElementById("filterOffersOnly")?.checked;
}
let favoriteProductIds = (() => { try { const v = JSON.parse(localStorage.getItem("eaLuxuryFavorites") || "[]"); return Array.isArray(v) ? v.map(String) : []; } catch (_) { return []; } })();
function saveFavoriteProducts() { try { localStorage.setItem("eaLuxuryFavorites", JSON.stringify(favoriteProductIds)); } catch (_) {} const c = document.getElementById("favoritesCount"); if (c) c.textContent = favoriteProductIds.length; }
function toggleFavoriteProduct(id) { const key = String(id); favoriteProductIds = favoriteProductIds.includes(key) ? favoriteProductIds.filter(x => x !== key) : [...favoriteProductIds, key]; saveFavoriteProducts(); showProducts(); renderFavoritesSection(); }
window.toggleFavoriteProduct = toggleFavoriteProduct;
function renderFavoritesSection() {
 const target = document.getElementById("favoritesGrid"), section = document.getElementById("favoritesSection");
 if (!target || !section) return;
 const saved = favoriteProductIds.map(id => products.find(p => String(p.id) === id)).filter(Boolean);
 section.hidden = !saved.length;
 target.innerHTML = saved.map(p => { const image = getProductImages(p)[0] || ""; const href = "product.html?id=" + encodeURIComponent(String(p.id)); return '<article class="favorite-product-card"><a href="' + href + '" class="favorite-product-image">' + (image ? '<img src="' + escapeHTML(image) + '" alt="' + escapeHTML(p.name) + '" loading="lazy">' : "EA LUXURY") + '</a><div class="favorite-product-info"><strong>' + escapeHTML(p.name) + '</strong>' + renderProductPrice(p) + '<div class="favorite-product-actions"><a href="' + href + '">عرض المنتج</a><button type="button" data-favorite-remove="' + escapeHTML(p.id) + '">إزالة ♥</button></div></div></article>'; }).join("");
}

const grid = document.getElementById("productGrid");
const cartCount = document.getElementById("cartCount");
const cartSection = document.getElementById("cartSection");
// إنشاء أزرار الأقسام من إعدادات لوحة الإدارة.
function renderStoreCategories(names) {
  const nav = document.getElementById("categoryNavigation");
  if (!nav) return;
  const cleanNames = [...new Set((Array.isArray(names) ? names : [])
    .map(name => String(name || "").trim()).filter(Boolean))];
  if (!cleanNames.length) cleanNames.push("حريمي", "رجالي");
  if (selectedCategory !== "الكل" && !cleanNames.includes(selectedCategory)) {
    selectedCategory = "الكل";
  }
  nav.innerHTML = [
    '<button class="category' + (selectedCategory === "الكل" ? " active" : "") + '" data-category="الكل">الكل</button>',
    ...cleanNames.map(name =>
      '<button class="category' + (selectedCategory === name ? " active" : "") + '" data-category="' + escapeHTML(name) + '">' + escapeHTML(name) + '</button>'
    )
  ].join("");
}

// تحميل صورة غلاف المتجر من Supabase
async function loadStoreSettings() {
  const hero = document.querySelector(".hero");

  try {
    const { data, error } = await db
      .from("store_settings")
      .select("settings")
      .eq("id", 1)
      .maybeSingle();

    if (error) throw error;

    const settings = data?.settings || {};
    storefrontSettings = settings;
    populateGovernorateSelect();
    updateCart();
    applyStoreContactSettings(settings);

    renderStoreCategories(settings.productCategories);

    const storeName = typeof settings.storeName === "string" && settings.storeName.trim()
      ? settings.storeName.trim() : "EA Luxury";
    const logoSubtitle = document.querySelector(".logo-sub");
    if (logoSubtitle) logoSubtitle.textContent = storeName.toUpperCase();
    document.title = storeName + " | أناقتك تبدأ من هنا";

    const storeDescription = typeof settings.storeDescription === "string" && settings.storeDescription.trim()
      ? settings.storeDescription.trim() : "اكتشف أحدث صيحات الموضة الحريمي والرجالي";
    const heroDescription = document.querySelector(".heroContent p");
    if (heroDescription) heroDescription.textContent = storeDescription;

    const aboutText = document.getElementById("storeAboutText");
    if (aboutText && typeof settings.aboutStore === "string" && settings.aboutStore.trim()) {
      aboutText.textContent = settings.aboutStore.trim();
    }
    const returnText = document.getElementById("storeReturnPolicyText");
    if (returnText && typeof settings.returnPolicy === "string" && settings.returnPolicy.trim()) {
      returnText.textContent = settings.returnPolicy.trim();
    }
    const shippingRates = Object.values(settings.shippingRates || {}).filter(value => value !== null && value !== "" && Number.isFinite(Number(value)) && Number(value) >= 0);
    const minimumShippingFee = shippingRates.length ? Math.min(...shippingRates.map(Number)) : 0;
    const freeShipping = Number(settings.freeShipping || 0);
    let shippingText = "رسوم التوصيل تختلف حسب المحافظة وتظهر لك قبل تأكيد الطلب.";
    if (minimumShippingFee > 0) shippingText = "مصاريف الشحن تبدأ من " + minimumShippingFee.toLocaleString("ar-EG") + " جنيه وتختلف حسب المحافظة.";
    if (freeShipping > 0) shippingText += " الشحن مجاني للطلبات من " + freeShipping.toLocaleString("ar-EG") + " جنيه فأكثر.";
    ["storeShippingText", "faqShippingText"].forEach(id => {
      const element = document.getElementById(id);
      if (element) element.textContent = shippingText;
    });

    const logo = document.querySelector(".logo");
    if (logo && typeof settings.storeLogo === "string" && settings.storeLogo.trim()) {
      let logoImage = document.getElementById("storeLogoImage");
      if (!logoImage) {
        logoImage = document.createElement("img");
        logoImage.id = "storeLogoImage";
        logoImage.alt = storeName;
        logoImage.style.cssText = "width:74px;height:52px;object-fit:contain;";
        const mark = logo.querySelector(".logo-main");
        if (mark) mark.hidden = true;
        logo.insertBefore(logoImage, logo.querySelector(".logo-sub"));
      }
      logoImage.src = settings.storeLogo;
    }

    const announcementBar = document.getElementById("storeAnnouncementBar");
    const announcementText = document.getElementById("storeAnnouncementText");
    if (announcementBar && announcementText) {
      if (settings.announcementEnabled === false) {
        announcementBar.hidden = true;
      } else {
        announcementBar.hidden = false;
        if (typeof settings.storeAnnouncement === "string" && settings.storeAnnouncement.trim()) {
          announcementText.textContent = settings.storeAnnouncement.trim();
        }
      }
    }

    if (settings.storeCover) {
      const cover = settings.storeCover.replace(/'/g, "%27");

      hero.style.backgroundImage =
        `linear-gradient(rgba(0,0,0,.25), rgba(0,0,0,.25)), url('${cover}')`;

      hero.style.backgroundSize = "cover";
      hero.style.backgroundPosition = "center";
      hero.style.backgroundRepeat = "no-repeat";
      hero.style.minHeight = "320px";

      console.log("تم تحميل صورة الغلاف بنجاح");
    } else {
      console.log("لا توجد صورة غلاف محفوظة في إعدادات المتجر");
    }

  } catch (error) {
    console.error("خطأ تحميل صورة الغلاف:", error);
  }
}
// تجهيز نافذة عرض الصور
const imageViewer = document.createElement("div");
imageViewer.id = "imageViewer";

imageViewer.style.cssText = `
  display:none;
  position:fixed;
  inset:0;
  background:rgba(0,0,0,0.94);
  z-index:99999;
  align-items:center;
  justify-content:center;
  padding:15px;
`;

imageViewer.innerHTML = `
  <button id="closeImageViewer" type="button"
    style="position:absolute;top:20px;right:20px;
    background:white;color:#222;border:0;border-radius:50%;
    width:42px;height:42px;font-size:28px;z-index:3;">
    ×
  </button>

  <button id="prevImage" type="button"
    style="position:absolute;left:12px;top:50%;
    transform:translateY(-50%);font-size:30px;
    width:45px;height:50px;z-index:3;">
    ‹
  </button>

  <img id="largeProductImage"
    style="max-width:85%;max-height:82vh;
    object-fit:contain;border-radius:8px;">

  <button id="nextImage" type="button"
    style="position:absolute;right:12px;top:50%;
    transform:translateY(-50%);font-size:30px;
    width:45px;height:50px;z-index:3;">
    ›
  </button>

  <p id="imageCounter"
    style="position:absolute;bottom:15px;color:white;
    font-size:16px;"></p>
`;

document.body.appendChild(imageViewer);

let viewerImages = [];
let viewerIndex = 0;

function closeImageViewer() {
  imageViewer.style.display = "none";
  document.getElementById("largeProductImage").src = "";
}

function showViewerImage() {
  if (!viewerImages.length) return;

  document.getElementById("largeProductImage").src =
    viewerImages[viewerIndex];

  document.getElementById("imageCounter").textContent =
    (viewerIndex + 1) + " / " + viewerImages.length;
}

function openImageViewer(images, index = 0) {
  viewerImages = images;
  viewerIndex = index;

  if (!viewerImages.length) return;

  imageViewer.style.display = "flex";
  showViewerImage();
}

document.getElementById("closeImageViewer")
  .addEventListener("click", closeImageViewer);

document.getElementById("prevImage")
  .addEventListener("click", () => {
    if (viewerImages.length <= 1) return;

    viewerIndex =
      (viewerIndex - 1 + viewerImages.length) %
      viewerImages.length;

    showViewerImage();
  });

document.getElementById("nextImage")
  .addEventListener("click", () => {
    if (viewerImages.length <= 1) return;

    viewerIndex =
      (viewerIndex + 1) % viewerImages.length;

    showViewerImage();
  });

imageViewer.addEventListener("click", event => {
  if (event.target === imageViewer) {
    closeImageViewer();
  }
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeImageViewer();
  }

  if (imageViewer.style.display === "flex") {
    if (event.key === "ArrowRight") {
      document.getElementById("nextImage").click();
    }

    if (event.key === "ArrowLeft") {
      document.getElementById("prevImage").click();
    }
  }
});

// استخراج صور المنتج
function getProductImages(product) {
  let images = Array.isArray(product.image_urls)
    ? product.image_urls.filter(url =>
        typeof url === "string" && url.trim()
      )
    : [];

  if (!images.length && product.image_url) {
    images = [product.image_url];
  }

  return [...new Set(images)].slice(0, 5);
}

// تحميل المنتجات
async function loadProducts() {
  grid.innerHTML = "<p>جاري تحميل المنتجات...</p>";

  const { data, error } = await db
    .from("products")
    .select("*")
    .eq("active", true)
    .order("created_at", { ascending: false });

  if (error) {
    grid.innerHTML = "<p>تعذر تحميل المنتجات.</p>";
    console.error(error);
    return;
  }

  products = data || [];
  saveFavoriteProducts();

  // تحديث أسعار السلة المحفوظة عند فتح المتجر حتى لا يظهر سعر قديم بعد بدء/انتهاء عرض.
  cart = cart.map(item => {
    const currentProduct = products.find(product => String(product.id) === String(item.id));
    if (!currentProduct) return item;
    return {
      ...item,
      ...currentProduct,
      price: getEffectiveProductPrice(currentProduct),
      quantity: item.quantity,
      cartKey: item.cartKey,
      variant_id: item.variant_id,
      selected_size: item.selected_size,
      selected_color: item.selected_color,
      availableStock: item.availableStock
    };
  });
  updateCart();

  const variantsResult = await db
    .from("product_variants")
    .select("id,product_id,size,color,stock,is_active")
    .eq("is_active", true);

  if (variantsResult.error) {
    console.error("تعذر تحميل المقاسات والألوان:", variantsResult.error);
    productVariants = [];
  } else {
    productVariants = variantsResult.data || [];
  }

  populateProductVariantFilters();
  showProducts();
}

// حماية النصوص
function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function getEffectiveProductPrice(product) {
  const regular = Number(product?.price || 0);
  const sale = Number(product?.sale_price);
  const now = Date.now();
  const startsAt = product?.sale_starts_at ? Date.parse(product.sale_starts_at) : null;
  const endsAt = product?.sale_ends_at ? Date.parse(product.sale_ends_at) : null;
  const hasStarted = startsAt === null || (Number.isFinite(startsAt) && now >= startsAt);
  const notEnded = endsAt === null || (Number.isFinite(endsAt) && now < endsAt);
  return Number.isFinite(sale) && sale > 0 && sale < regular && hasStarted && notEnded ? sale : regular;
}

function renderProductPrice(product) {
  const regular = Number(product?.price || 0);
  const sale = getEffectiveProductPrice(product);
  if (sale < regular) {
    const discount = Math.round((1 - sale / regular) * 100);
    return '<div class="product-price-wrap"><strong class="product-sale-price">' +
      sale.toLocaleString("ar-EG") + ' جنيه</strong> <del class="product-old-price">' +
      regular.toLocaleString("ar-EG") + ' جنيه</del><span class="product-discount-badge">خصم ' +
      discount + '%</span></div>';
  }
  return '<p class="product-regular-price">' + regular.toLocaleString("ar-EG") + ' جنيه</p>';
}

// عرض المنتجات ومعرض الصور
function showProducts() {
  let filtered = selectedCategory === "الكل" ? [...products] : products.filter(p => p.category === selectedCategory);
  if (selectedProductCategories.length) filtered = filtered.filter(p => selectedProductCategories.includes(p.category));
  if (productSearchTerm) {
    const term = productSearchTerm.toLocaleLowerCase("ar");
    filtered = filtered.filter(p => [p.name,p.description,p.category].some(value => String(value||"").toLocaleLowerCase("ar").includes(term)));
  }
  if (selectedProductSizes.length || selectedProductColors.length) {
    filtered = filtered.filter(p => {
      const variants = productVariants.filter(v => String(v.product_id) === String(p.id));
      if (variants.length) return variants.some(v =>
        (!selectedProductSizes.length || selectedProductSizes.includes(String(v.size||""))) &&
        (!selectedProductColors.length || selectedProductColors.includes(String(v.color||"")))
      );
      const sizes = Array.isArray(p.sizes) ? p.sizes.map(String) : [String(p.size||"")];
      const colors = Array.isArray(p.colors) ? p.colors.map(String) : [String(p.color||"")];
      return (!selectedProductSizes.length || selectedProductSizes.some(v=>sizes.includes(v))) &&
        (!selectedProductColors.length || selectedProductColors.some(v=>colors.includes(v)));
    });
  }
  if (filterMinPrice !== "") filtered = filtered.filter(p => getEffectiveProductPrice(p) >= Number(filterMinPrice));
  if (filterMaxPrice !== "") filtered = filtered.filter(p => getEffectiveProductPrice(p) <= Number(filterMaxPrice));
  if (filterOffersOnly) filtered = filtered.filter(p => getEffectiveProductPrice(p) < Number(p.price||0));
  if (filterAvailableOnly || productSortMode === "available") filtered = filtered.filter(p => {
    const variants = productVariants.filter(v => String(v.product_id) === String(p.id));
    return variants.length ? variants.some(v=>Number(v.stock)>0) : Number(p.stock||0)>0;
  });
  if (productSortMode === "offers") {
    filtered = filtered.filter(p => getEffectiveProductPrice(p) < Number(p.price || 0));
  } else if (productSortMode === "available") {
    filtered = filtered.filter(p => {
      const variants = productVariants.filter(v => String(v.product_id) === String(p.id));
      return variants.length
        ? variants.some(v => Number(v.stock) > 0)
        : Number(p.stock || 0) > 0;
    });
  } else if (productSortMode === "price-asc") {
    filtered.sort((a, b) => getEffectiveProductPrice(a) - getEffectiveProductPrice(b));
  } else if (productSortMode === "price-desc") {
    filtered.sort((a, b) => getEffectiveProductPrice(b) - getEffectiveProductPrice(a));
  } else if (productSortMode === "newest") {
    filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  }

  const count = document.getElementById("productResultsCount");
  if (count) count.textContent = "عرض " + filtered.length + " منتج";
  const drawerCount = document.getElementById("filterResultsCount");
  if (drawerCount) drawerCount.textContent = "عرض " + filtered.length + " منتج";

  if (!filtered.length) {
    grid.innerHTML = '<div class="store-empty-state"><strong>ملقيناش منتجات مطابقة</strong><span>جرّب تغيّر كلمة البحث أو اختيار الترتيب.</span></div>';
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const allProductVariants = productVariants.filter(
      v => String(v.product_id) === String(p.id)
    );
    const variants = allProductVariants.filter(v =>
      (!selectedProductSizes.length || selectedProductSizes.includes(String(v.size || ""))) &&
      (!selectedProductColors.length || selectedProductColors.includes(String(v.color || "")))
    );
    const hasVariants = allProductVariants.length > 0;
    const availableVariants = variants.filter(v => Number(v.stock) > 0);
    const stock = hasVariants
      ? availableVariants.reduce((sum, v) => sum + Number(v.stock), 0)
      : Number(p.stock ?? 0);
    const unavailable = hasVariants
      ? availableVariants.length === 0
      : stock <= 0;
    const firstAvailableVariant = availableVariants[0];
    const variantOptions = hasVariants
      ? `
        <label style="display:block;margin:10px 0 5px;font-weight:bold">اختار المقاس واللون:</label>
        <select class="product-variant-select"
          data-product-id="${escapeHTML(p.id)}"
          style="width:100%;padding:10px;border:1px solid #ccc;border-radius:7px">
          ${variants.map(v => {
            const label = [
              v.size || "بدون مقاس",
              v.color || "بدون لون",
              "المتاح: " + Number(v.stock)
            ].join(" - ");
            return `<option value="${escapeHTML(v.id)}"
              ${Number(v.stock) <= 0 ? "disabled" : ""}
              ${firstAvailableVariant && String(v.id) === String(firstAvailableVariant.id) ? "selected" : ""}>
              ${escapeHTML(label)}
            </option>`;
          }).join("")}
        </select>
      `
      : "";
    const images = getProductImages(p);
    const mainImage = images[0] || "";

    const thumbnails = images.length > 1
      ? `
        <div style="
          display:flex;
          gap:7px;
          overflow-x:auto;
          margin:10px 0;
          justify-content:center;
        ">
          ${images.map((url, index) => `
            <button
              type="button"
              class="product-thumb"
              data-product-id="${escapeHTML(p.id)}"
              data-image-index="${index}"
              style="
                padding:2px;
                border:2px solid ${index === 0 ? "#b89550" : "#ddd"};
                background:white;
                border-radius:6px;
                flex:0 0 58px;
                width:58px;
                height:65px;
                overflow:hidden;
              ">
              <img
                src="${escapeHTML(url)}"
                alt="صورة ${index + 1}"
                style="
                  width:100%;
                  height:100%;
                  object-fit:cover;
                  cursor:pointer;
                ">
            </button>
          `).join("")}
        </div>
      `
      : "";

    return `
      <article class="product">
        <button type="button" class="product-favorite-button" data-favorite-id="${escapeHTML(p.id)}" aria-label="${favoriteProductIds.includes(String(p.id)) ? "إزالة من المفضلة" : "أضف للمفضلة"}" aria-pressed="${favoriteProductIds.includes(String(p.id))}">${favoriteProductIds.includes(String(p.id)) ? "♥" : "♡"}</button>

        <a class="product-detail-link product-image-link"
          href="product.html?id=${encodeURIComponent(String(p.id))}"
          aria-label="عرض تفاصيل ${escapeHTML(p.name)}">
          <img
            class="product-main-image"
            data-product-id="${escapeHTML(p.id)}"
            src="${escapeHTML(mainImage)}"
            alt="${escapeHTML(p.name)}"
            onerror="this.style.display='none'"
          >
        </a>

        ${thumbnails}

        <h3><a class="product-detail-link" href="product.html?id=${encodeURIComponent(String(p.id))}">${escapeHTML(p.name)}</a></h3>

        ${renderProductPrice(p)}

        ${hasVariants ? variantOptions : `
          <p>المقاسات: ${
            Array.isArray(p.sizes)
              ? p.sizes.map(escapeHTML).join(" - ")
              : "حسب المتاح"
          }</p>
          <p>المتاح: ${stock} قطعة</p>
        `}

        ${hasVariants && !unavailable
          ? `<p>إجمالي المتاح من الاختيارات: ${stock} قطعة</p>`
          : ""}

        <button type="button"
          ${unavailable ? "disabled" : ""}
          onclick="addToCart('${escapeHTML(p.id)}')">
          ${unavailable ? "غير متوفر" : "أضف إلى السلة"}
        </button>

      </article>
    `;
  }).join("");
  renderHomeCollections();
  renderFavoritesSection();
}

// مجموعات الصفحة الرئيسية: الأحدث والترشيحات والعروض الفعالة.
function renderHomeCollections() {
  const newestGrid = document.getElementById("newArrivalsGrid");
  const picksGrid = document.getElementById("editorsPicksGrid");
  const offersSection = document.getElementById("bestOffersSection");
  const offersGrid = document.getElementById("bestOffersGrid");
  if (!newestGrid || !picksGrid || !Array.isArray(products)) return;

  const getImage = product => getProductImages(product)[0] || "";
  const makeTile = (product, isOffer = false) => {
    const image = getImage(product);
    const href = "product.html?id=" + encodeURIComponent(String(product.id));
    const priceMarkup = isOffer
      ? renderProductPrice(product)
      : '<div class="homeCollectionPrice">' + getEffectiveProductPrice(product).toLocaleString("ar-EG") + ' جنيه</div>';
    return `
      <a class="homeCollectionCard${isOffer ? " homeOfferCard" : ""}" href="${href}">
        <div class="homeCollectionImage">
          ${image ? `<img src="${escapeHTML(image)}" alt="${escapeHTML(product.name)}" loading="lazy">` : '<span>EA LUXURY</span>'}
          ${isOffer ? '<span class="homeOfferRibbon">عرض خاص</span>' : ""}
        </div>
        <div class="homeCollectionDetails">
          <strong>${escapeHTML(product.name)}</strong>
          ${priceMarkup}
          <small>اكتشف التفاصيل ←</small>
        </div>
      </a>
    `;
  };

  const newest = [...products].sort((a,b) =>
    new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
  ).slice(0,4);
  const picks = [...products].sort((a,b) => {
    const score = p => Number(p.sales_count ?? p.sold_count ?? p.order_count ?? p.is_featured ?? p.featured ?? 0);
    return score(b) - score(a);
  }).slice(0,4);
  const offers = products
    .filter(product => getEffectiveProductPrice(product) < Number(product.price || 0))
    .sort((a,b) => (1 - getEffectiveProductPrice(b) / Number(b.price || 1)) -
                   (1 - getEffectiveProductPrice(a) / Number(a.price || 1)));

  const render = (target, items) => {
    target.innerHTML = items.length
      ? items.map(item => makeTile(item)).join("")
      : '<p class="homeCollectionEmpty">سيتم عرض المنتجات هنا قريبًا.</p>';
  };
  render(newestGrid, newest);
  render(picksGrid, picks);
  if (offersSection && offersGrid) {
    offersSection.hidden = offers.length === 0;
    offersGrid.innerHTML = offers.map(item => makeTile(item, true)).join("");
  }
  renderCategoryShowcase();
}

// بطاقات أقسام مرئية بصور منتجات فعلية، وتستخدم نفس أزرار تصفية القسم الحالية.
function renderCategoryShowcase() {
  const showcase = document.getElementById("categoryShowcaseGrid");
  const navigation = document.getElementById("categoryNavigation");
  if (!showcase || !navigation || !Array.isArray(products)) return;

  const categoryNames = [...navigation.querySelectorAll("[data-category]")]
    .map(button => button.dataset.category)
    .filter(name => name && name !== "الكل");

  showcase.innerHTML = categoryNames.map(name => {
    const product = products.find(item => item.category === name && getProductImages(item).length);
    const image = product ? getProductImages(product)[0] : "";
    const count = products.filter(item => item.category === name).length;
    return `
      <button class="category-showcase-card" type="button" data-showcase-category="${escapeHTML(name)}">
        <span class="category-showcase-image">
          ${image ? `<img src="${escapeHTML(image)}" alt="" loading="lazy">` : '<span class="category-showcase-placeholder">EA</span>'}
        </span>
        <span class="category-showcase-copy">
          <strong>${escapeHTML(name)}</strong>
          <small>${count.toLocaleString("ar-EG")} منتج</small>
          <span>تسوق القسم ←</span>
        </span>
      </button>
    `;
  }).join("");
}

document.getElementById("categoryShowcaseGrid")?.addEventListener("click", event => {
  const card = event.target.closest("[data-showcase-category]");
  if (!card) return;
  const target = document.querySelector('#categoryNavigation [data-category="' + CSS.escape(card.dataset.showcaseCategory) + '"]');
  target?.click();
  document.getElementById("products")?.scrollIntoView({ behavior: "smooth", block: "start" });
}

// الضغط على الصور الصغيرة أو الكبيرة
grid.addEventListener("click", event => {
  const favoriteButton = event.target.closest("[data-favorite-id]");
  if (favoriteButton) { toggleFavoriteProduct(favoriteButton.dataset.favoriteId); return; }
  const thumbnail = event.target.closest(".product-thumb");

  if (thumbnail) {
    const id = thumbnail.dataset.productId;
    const index = Number(thumbnail.dataset.imageIndex);

    const product = products.find(
      p => String(p.id) === String(id)
    );

    if (!product) return;

    const images = getProductImages(product);
    const mainImage = thumbnail.closest(".product")
      .querySelector(".product-main-image");

    mainImage.src = images[index];
    mainImage.dataset.imageIndex = index;

    thumbnail.parentElement
      .querySelectorAll(".product-thumb")
      .forEach((button, i) => {
        button.style.border =
          i === index ? "2px solid #b89550" : "2px solid #ddd";
      });

    return;
  }


});

// إضافة للسلة مع مراعاة مخزون المقاس واللون
function addToCart(id) {
  const product = products.find(
    p => String(p.id) === String(id)
  );

  if (!product) {
    alert("لم يتم العثور على المنتج.");
    return;
  }

  const variants = productVariants.filter(
    v => String(v.product_id) === String(id)
  );
  let selectedVariant = null;

  if (variants.length) {
    const selector = grid.querySelector(
      `.product-variant-select[data-product-id="${CSS.escape(String(id))}"]`
    );
    const variantId = selector?.value;
    selectedVariant = variants.find(v => String(v.id) === String(variantId));

    if (!selectedVariant || Number(selectedVariant.stock) <= 0) {
      alert("من فضلك اختار مقاسًا ولونًا متاحين.");
      return;
    }
  }

  const stock = selectedVariant
    ? Number(selectedVariant.stock)
    : Number(product.stock ?? 0);

  if (stock <= 0) {
    alert("هذا المنتج غير متوفر حاليًا.");
    return;
  }

  const cartKey = String(id) + "_" + (selectedVariant ? String(selectedVariant.id) : "base");
  const item = cart.find(i => i.cartKey === cartKey);
  const currentQuantity = item ? item.quantity : 0;

  if (currentQuantity >= stock) {
    alert("وصلت للكمية المتاحة من هذا الاختيار.");
    return;
  }

  if (item) {
    item.quantity++;
  } else {
    cart.push({
      ...product,
      price: getEffectiveProductPrice(product),
      quantity: 1,
      cartKey,
      variant_id: selectedVariant ? selectedVariant.id : null,
      selected_size: selectedVariant?.size || null,
      selected_color: selectedVariant?.color || null,
      availableStock: stock
    });
  }

  updateCart();
}

// تحديث السلة وعرض تفاصيل كل منتج بصورة واضحة.
function updateCart() {
  try { localStorage.setItem("eaLuxuryCart", JSON.stringify(cart)); }
  catch (error) { console.warn("تعذر حفظ السلة:", error); }

  const fingerprint = JSON.stringify(cart.map(item => [item.id,item.variant_id||null,item.quantity,Number(item.price||0)]));
  if (lastCouponCartFingerprint && fingerprint !== lastCouponCartFingerprint) {
    appliedCoupon = null;
    const couponMessage = document.getElementById("couponMessage");
    if (couponMessage) couponMessage.textContent = "تغيرت السلة؛ أعد تطبيق كود الخصم للتأكد من صلاحيته.";
  }
  lastCouponCartFingerprint = fingerprint;

  const count = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  if (cartCount) cartCount.textContent = count;

  const cartItemsElement = document.getElementById("cartItems");
  const totalElement = document.getElementById("cartTotal");
  const total = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);
  const governorateSelect = document.querySelector('#checkoutForm select[name="governorate"]');
  const selectedGovernorate = governorateSelect?.value || "";
  const shippingFee = selectedGovernorate ? getShippingQuote(selectedGovernorate) : null;
  const shippingElement = document.getElementById("cartShippingFee");
  const grandTotalElement = document.getElementById("cartGrandTotal");
  const quoteElement = document.getElementById("shippingQuote");
  if (shippingElement) shippingElement.textContent = shippingFee === null ? "يُحدد بعد اختيار المحافظة" : shippingFee.toLocaleString("ar-EG") + " جنيه";
  const discount = Number(appliedCoupon?.discount_amount || 0);
  const discountElement = document.getElementById("cartDiscount");
  if (discountElement) discountElement.textContent = discount.toLocaleString("ar-EG") + " جنيه";
  if (grandTotalElement) grandTotalElement.textContent = Math.max(0,total + (shippingFee ?? 0) - discount).toLocaleString("ar-EG");
  if (quoteElement) {
    quoteElement.textContent = !selectedGovernorate
      ? "اختار المحافظة لمعرفة تكلفة الشحن."
      : shippingFee === null
        ? "تكلفة الشحن لهذه المحافظة غير محددة حاليًا. تواصل معنا قبل تأكيد الطلب."
        : "رسوم الشحن إلى " + selectedGovernorate + ": " + shippingFee.toLocaleString("ar-EG") + " جنيه.";
  }

  if (cartItemsElement) {
    if (!cart.length) {
      cartItemsElement.innerHTML = `
        <div class="cartEmptyState">
          <span class="cartEmptyIcon">🛍️</span>
          <h3>سلتك لسه فاضية</h3>
          <p>اختار المنتجات اللي عجبتك، وهتلاقيها هنا جاهزة للمراجعة.</p>
          <a href="index.html#products">ابدأ التسوق</a>
        </div>`;
    } else {
      cartItemsElement.innerHTML = cart.map(item => {
        const key = String(item.cartKey || String(item.id) + "_base");
        const safeKey = escapeHTML(key);
        const images = getProductImages(item);
        const image = images.length ? `<img src="${escapeHTML(images[0])}" alt="${escapeHTML(item.name || "صورة المنتج")}" loading="lazy">` : `<span class="cartItemImageFallback">EA</span>`;
        const variant = [item.selected_size, item.selected_color].filter(Boolean).map(escapeHTML).join(" / ");
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const unitPrice = Number(item.price) || 0;
        return `
          <article class="cartItem cartItemCard">
            <div class="cartItemProduct">
              <div class="cartItemImage">${image}</div>
              <div class="cartItemDetails">
                <h3>${escapeHTML(item.name || "منتج")}</h3>
                ${variant ? `<p class="cartItemVariant">الاختيار: ${variant}</p>` : ""}
                <p class="cartItemUnitPrice">سعر القطعة: ${unitPrice.toLocaleString("ar-EG")} جنيه</p>
                <strong class="cartItemLineTotal">${(unitPrice * quantity).toLocaleString("ar-EG")} جنيه</strong>
              </div>
            </div>
            <div class="cartItemControls">
              <div class="cartQuantityControls" aria-label="تعديل الكمية">
                <button type="button" class="quantityButton" aria-label="تقليل الكمية" onclick="changeCartQuantity('${safeKey}', -1)">−</button>
                <strong>${quantity}</strong>
                <button type="button" class="quantityButton" aria-label="زيادة الكمية" onclick="changeCartQuantity('${safeKey}', 1)">+</button>
              </div>
              <button type="button" class="removeCartItemButton" onclick="removeFromCart('${safeKey}')">حذف المنتج</button>
            </div>
          </article>`;
      }).join("");
    }
  }

  if (totalElement) totalElement.textContent = total.toLocaleString("ar-EG");
  const countElement = document.getElementById("cartSummaryCount");
  if (countElement) countElement.textContent = count.toLocaleString("ar-EG");
  const actions = document.getElementById("cartActions");
  if (actions && !cart.length) actions.hidden = true;
  else if (actions && checkoutPanel?.hidden) actions.hidden = false;

  return total;
}

// تعديل كمية المنتج داخل السلة قطعة واحدة في كل مرة.
function changeCartQuantity(cartKey, delta) {
  const item = cart.find(i => (i.cartKey || String(i.id) + "_base") === String(cartKey));
  if (!item) return;
  const next = Number(item.quantity) + Number(delta);
  if (next <= 0) { removeFromCart(cartKey); return; }
  const limit = Number(item.availableStock ?? item.stock ?? Infinity);
  if (delta > 0 && next > limit) { alert("وصلت للكمية المتاحة من هذا الاختيار."); return; }
  item.quantity = next;
  updateCart();
}
window.changeCartQuantity = changeCartQuantity;

// حذف سطر المنتج بالكامل من السلة.
function removeFromCart(cartKey) {
  cart = cart.filter(
    item => (item.cartKey || String(item.id) + "_base") !== String(cartKey)
  );

  updateCart();
}

window.addToCart = addToCart;
window.removeFromCart = removeFromCart;

document.getElementById("favoritesGrid")?.addEventListener("click", event => { const button = event.target.closest("[data-favorite-remove]"); if (button) toggleFavoriteProduct(button.dataset.favoriteRemove); });

// تصنيف المنتجات: event delegation حتى تعمل الأزرار التي تُنشأ من إعدادات الإدارة.
const mobileMenuButton = document.getElementById("mobileMenuButton");
const mainNav = document.getElementById("mainNav");
if (mobileMenuButton && mainNav) {
  mobileMenuButton.addEventListener("click", () => {
    const isOpen = mainNav.classList.toggle("is-open");
    mobileMenuButton.setAttribute("aria-expanded", String(isOpen));
    mobileMenuButton.textContent = isOpen ? "×" : "☰";
  });
  mainNav.addEventListener("click", event => {
    if (event.target.closest("a")) {
      mainNav.classList.remove("is-open");
      mobileMenuButton.setAttribute("aria-expanded", "false");
      mobileMenuButton.textContent = "☰";
    }
  });
}

const categoryNavigation = document.getElementById("categoryNavigation");
if (categoryNavigation) {
  categoryNavigation.addEventListener("click", event => {
    const button = event.target.closest(".category");
    if (!button || !categoryNavigation.contains(button)) return;
    selectedCategory = button.dataset.category || "الكل";
    categoryNavigation.querySelectorAll(".category").forEach(item =>
      item.classList.toggle("active", item === button)
    );
    showProducts();
  });
}

// البحث وترتيب المنتجات — يعملان مع الأقسام دون إعادة تحميل الصفحة.
const productSearchInput = document.getElementById("productSearch");
if (productSearchInput) {
  productSearchInput.addEventListener("input", event => {
    productSearchTerm = event.target.value.trim();
    showProducts();
  });
}
const productSortSelect = document.getElementById("productSort");
if (productSortSelect) {
  productSortSelect.addEventListener("change", event => {
    productSortMode = event.target.value || "default";
    showProducts();
  });
}
const filterDrawer = document.getElementById("filterDrawer");
const openFilterButton = document.getElementById("openFilterDrawer");
function openAdvancedFilters() { if(filterDrawer){filterDrawer.hidden=false;document.body.classList.add("filter-drawer-open");} }
function closeAdvancedFilters() { if(filterDrawer){filterDrawer.hidden=true;document.body.classList.remove("filter-drawer-open");} }
if(openFilterButton) openFilterButton.addEventListener("click",openAdvancedFilters);
document.querySelectorAll("[data-close-filter]").forEach(el=>el.addEventListener("click",closeAdvancedFilters));
document.addEventListener("keydown",event=>{if(event.key==="Escape")closeAdvancedFilters();});
const applyFiltersButton=document.getElementById("applyAdvancedFilters");
if(applyFiltersButton) applyFiltersButton.addEventListener("click",()=>{const min=Number(document.getElementById("filterMinPrice")?.value||0),max=Number(document.getElementById("filterMaxPrice")?.value||0);if(document.getElementById("filterMinPrice")?.value!==""&&document.getElementById("filterMaxPrice")?.value!==""&&min>max){alert("السعر الأدنى لازم يكون أقل من أو يساوي السعر الأعلى.");return;}setAdvancedFiltersFromPanel();showProducts();syncAdvancedFilterControls();closeAdvancedFilters();});
const clearFiltersButton=document.getElementById("clearAdvancedFilters");
if(clearFiltersButton) clearFiltersButton.addEventListener("click",()=>{
  selectedProductSizes=[];selectedProductColors=[];selectedProductCategories=[];
  filterMinPrice="";filterMaxPrice="";filterAvailableOnly=false;filterOffersOnly=false;
  selectedCategory="الكل";
  if(categoryNavigation) categoryNavigation.querySelectorAll(".category").forEach(item=>item.classList.toggle("active",item.dataset.category==="الكل"));
  syncAdvancedFilterControls();showProducts();
});
const sortSelect=document.getElementById("productSort");
if(sortSelect) sortSelect.addEventListener("change",event=>{productSortMode=event.target.value||"default";showProducts();});
if(productSearchInput) productSearchInput.addEventListener("input",event=>{productSearchTerm=event.target.value.trim();showProducts();});
// التنقل بين السلة وخطوة إتمام الطلب
const checkoutPanel = document.getElementById("checkoutPanel");
const cartActions = document.getElementById("cartActions");

document.getElementById("cartButton").addEventListener("click", () => {
  window.location.href = "cart.html#cartSection";
});

document.getElementById("continueShoppingButton").addEventListener("click", () => {
  window.location.href = "index.html#products";
});

document.getElementById("proceedCheckoutButton").addEventListener("click", () => {
  if (!cart.length) {
    alert("السلة فارغة. أضف المنتجات أولًا.");
    return;
  }
  cartActions.hidden = true;
  checkoutPanel.hidden = false;
  checkoutPanel.scrollIntoView({ behavior: "smooth" });
  checkoutPanel.querySelector('input[name="customer_name"]').focus({ preventScroll: true });
});

document.getElementById("backToCartButton").addEventListener("click", () => {
  checkoutPanel.hidden = true;
  cartActions.hidden = false;
});

// تطبيق كود الخصم بعد إدخال رقم الهاتف.
async function applyStoreCoupon() {
  const form = document.getElementById("checkoutForm");
  const codeInput = document.getElementById("couponCode");
  const message = document.getElementById("couponMessage");
  if (!form || !codeInput || !message) return;
  const code = codeInput.value.trim().toUpperCase();
  const phone = form.querySelector('input[name="phone"]')?.value.trim() || "";
  const subtotal = cart.reduce((sum,item)=>sum+Number(item.price||0)*Number(item.quantity||0),0);
  if (!code) { message.textContent = "اكتب كود الخصم أولاً."; return; }
  if (phone.replace(/[^0-9]/g,"").length < 10) { message.textContent = "اكتب رقم هاتف صحيحًا أولاً."; return; }
  if (!cart.length) { message.textContent = "السلة فارغة."; return; }
  message.textContent = "جاري التحقق من الكود...";
  const button = document.getElementById("applyCouponButton");
  if (button) button.disabled = true;
  try {
    const {data,error}=await db.rpc("preview_store_coupon",{p_code:code,p_subtotal:subtotal,p_phone:phone});
    if(error) throw error;
    const result=Array.isArray(data)?data[0]:data;
    if(!result || !result.valid) { appliedCoupon=null; message.textContent=result?.message||"تعذر التحقق من كود الخصم."; updateCart(); return; }
    appliedCoupon={code:result.coupon_code,discount_amount:Number(result.discount_amount||0)};
    lastCouponCartFingerprint=JSON.stringify(cart.map(item=>[item.id,item.variant_id||null,item.quantity,Number(item.price||0)]));
    message.textContent=result.message+" — تم خصم "+appliedCoupon.discount_amount.toLocaleString("ar-EG")+" جنيه.";
    updateCart();
  } catch(error) {
    appliedCoupon=null;
    message.textContent="تعذر تطبيق الكود: "+(error.message||"حدث خطأ");
    updateCart();
  } finally { if(button) button.disabled=false; }
}

// تحديث رسوم الشحن عند اختيار المحافظة
document.querySelector('#checkoutForm select[name="governorate"]')?.addEventListener("change", updateCart);

// تأكيد الطلب وخصم المخزون
document.getElementById("checkoutForm")
  .addEventListener("submit", async event => {
    event.preventDefault();

    if (!cart.length) {
      alert("السلة فارغة");
      return;
    }

    const form = event.target;
    const button = form.querySelector('button[type="submit"]');
    const message = document.getElementById("orderMessage");

    button.disabled = true;
    button.textContent = "جاري إرسال الطلب...";
    message.textContent = "";

    try {
      const values = Object.fromEntries(
        new FormData(form).entries()
      );
      const shippingFee = getShippingQuote(values.governorate);
      if (shippingFee === null) {
        throw new Error("سعر الشحن للمحافظة المختارة غير متاح حاليًا. اختار محافظة أخرى أو تواصل معنا.");
      }

      const { data, error } = await db.rpc(
        "create_order_with_variants",
        {
          p_customer_name: values.customer_name,
          p_phone: values.phone,
          p_governorate: values.governorate,
          p_address: values.address,
          p_customer_email: values.customer_email,
          p_items: cart.map(item => ({
            id: item.id,
            quantity: item.quantity,
            variant_id: item.variant_id
          })),
          p_coupon_code: appliedCoupon?.code || ""
        }
      );

      if (error) throw error;

      const orderSnapshot = cart.map(item => ({ ...item }));
      const productsTotal = orderSnapshot.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity, 0
      );
      const discountAmount = Number(appliedCoupon?.discount_amount || 0);
      const orderTotal = Math.max(0,productsTotal + shippingFee - discountAmount);

      message.textContent =
        "تم استلام طلبك بنجاح! رقم طلبك: #" + data +
        ". احتفظ بالرقم لمتابعة طلبك، وسنتواصل معك لتأكيده.";

      const emailResult = await sendOrderEmails(data, values, orderSnapshot, orderTotal, shippingFee);
      if (!emailResult.configured) {
        message.textContent += " سيتم تفعيل رسائل التأكيد بالبريد بعد ربط خدمة البريد.";
      } else if (emailResult.sent) {
        message.textContent += " تم إرسال تأكيد الطلب، وستصلك نسخة على بريد المتجر.";
      } else {
        message.textContent += " تم حفظ الطلب، لكن تعذر إرسال رسالة البريد. سبب الخطأ: " + (emailResult.error || "غير معروف");
      }

      cart = [];
      appliedCoupon = null;
      lastCouponCartFingerprint = "";
      updateCart();
      form.reset();
      checkoutPanel.hidden = true;
      cartActions.hidden = true;

      await loadProducts();

    } catch (error) {
      console.error(error);

      message.textContent =
        "لم يكتمل الطلب: " +
        (error.message || "حدث خطأ");

    } finally {
      button.disabled = false;
      button.textContent = "تأكيد الطلب - الدفع عند الاستلام";
    }
  });

// ربط زر تطبيق كود الخصم.
document.getElementById("applyCouponButton")?.addEventListener("click", applyStoreCoupon);
document.getElementById("couponCode")?.addEventListener("input", () => { if (appliedCoupon && document.getElementById("couponCode").value.trim().toUpperCase() !== appliedCoupon.code) { appliedCoupon=null; updateCart(); } });
document.querySelector('#checkoutForm input[name="phone"]')?.addEventListener("input", () => { if(appliedCoupon){appliedCoupon=null;document.getElementById("couponMessage").textContent="تغير رقم الهاتف؛ أعد تطبيق الكود للتحقق من صلاحيته.";updateCart();} });

// عرض السلة المحفوظة عند فتح الموقع أو صفحة السلة.
updateCart();

// بدء تحميل إعدادات المتجر وصورة الغلاف
loadStoreSettings();

// بدء تحميل المنتجات
loadProducts();

// قسم التواصل الخاص بمتجر EA Luxury
const contactSection = document.createElement("section");

contactSection.id = "eaContact";

contactSection.style.cssText = `
  background:#111;
  color:#d6b36a;
  padding:30px 15px;
  margin-top:35px;
  text-align:center;
  border-radius:12px;
  direction:rtl;
`;

contactSection.innerHTML = `
  <h2 style="color:#d6b36a;margin-bottom:10px">
    تواصل معنا
  </h2>

  <p style="color:white;margin-bottom:22px">
    EA Luxury - يسعدنا تواصلك معنا
  </p>

  <div style="
    display:flex;
    flex-wrap:wrap;
    justify-content:center;
    gap:12px;
  ">

    <a id="storePhoneLink" href="tel:01065938516"
      style="
        background:#d6b36a;
        color:#111;
        padding:13px 20px;
        border-radius:8px;
        text-decoration:none;
        font-weight:bold;
      ">
      📞 اتصل بنا
    </a>

    <a id="storeWhatsappLink" href="https://wa.me/201065938516"
      target="_blank"
      rel="noopener"
      style="
        background:#25D366;
        color:white;
        padding:13px 20px;
        border-radius:8px;
        text-decoration:none;
        font-weight:bold;
      ">
      واتساب
    </a>

    <a id="storeFacebookLink" href="https://www.facebook.com/share/1F6UFaUhmj/?mibextid=wwXIfr"
      target="_blank"
      rel="noopener"
      style="
        background:#1877F2;
        color:white;
        padding:13px 20px;
        border-radius:8px;
        text-decoration:none;
        font-weight:bold;
      ">
      Facebook
    </a>

  </div>

  <p style="
    color:#aaa;
    font-size:13px;
    margin-top:25px;
  ">
    © EA Luxury - جميع الحقوق محفوظة
  </p>
`;

function applyStoreContactSettings(settings = {}) {
  const phone = String(settings.storePhone || "").trim();
  const whatsapp = String(settings.storeWhatsapp || "").trim();
  const facebook = String(settings.storeFacebook || "").trim();
  const tiktok = String(settings.storeTiktok || "").trim();
  const phoneLink = document.getElementById("storePhoneLink");
  const whatsappLink = document.getElementById("storeWhatsappLink");
  const facebookLink = document.getElementById("storeFacebookLink");

  if (phoneLink && phone) {
    phoneLink.href = "tel:" + phone.replace(/[^+0-9]/g, "");
  }
  if (whatsappLink && whatsapp) {
    let number = whatsapp.replace(/[^0-9]/g, "");
    if (number.startsWith("0")) number = "20" + number.slice(1);
    else if (number.startsWith("20")) number = number;
    whatsappLink.href = "https://wa.me/" + number;
  }
  const safeExternalUrl = value => {
    if (!value) return "";
    try {
      const url = new URL(/^https?:\/\//i.test(value) ? value : "https://" + value);
      return ["http:", "https:"].includes(url.protocol) ? url.href : "";
    } catch (_) {
      return "";
    }
  };
  if (facebookLink && facebook) {
    const url = safeExternalUrl(facebook);
    if (url) facebookLink.href = url;
  }
  if (tiktok) {
    const url = safeExternalUrl(tiktok);
    if (url) {
      let tiktokLink = document.getElementById("storeTiktokLink");
      if (!tiktokLink) {
        tiktokLink = document.createElement("a");
        tiktokLink.id = "storeTiktokLink";
        tiktokLink.target = "_blank";
        tiktokLink.rel = "noopener";
        tiktokLink.textContent = "TikTok";
        tiktokLink.style.cssText = "background:#292929;color:#fff;padding:13px 20px;border-radius:8px;text-decoration:none;font-weight:bold;";
        const links = contactSection.querySelector("div");
        if (links) links.appendChild(tiktokLink);
      }
      tiktokLink.href = url;
    }
  }
}

document.body.appendChild(contactSection);
applyStoreContactSettings(storefrontSettings);



// متابعة الطلب للعميل: لا يتم كشف بيانات الطلب إلا بعد مطابقة رقم الطلب ورقم الهاتف.
const trackingForm = document.getElementById("trackingForm");
if (trackingForm) {
  trackingForm.addEventListener("submit", async event => {
    event.preventDefault();
    const submitButton = trackingForm.querySelector('button[type="submit"]');
    const resultBox = document.getElementById("trackingResult");
    const values = Object.fromEntries(new FormData(trackingForm).entries());

    submitButton.disabled = true;
    submitButton.textContent = "جاري البحث...";
    resultBox.className = "trackingResult";
    resultBox.textContent = "";

    try {
      const orderId = Number(values.order_id);
      if (!Number.isSafeInteger(orderId) || orderId < 1) {
        throw new Error("من فضلك أدخل رقم طلب صحيح.");
      }

      const { data, error } = await db.rpc("track_customer_order", {
        p_order_id: orderId,
        p_phone: values.phone
      });

      if (error) throw error;

      const order = Array.isArray(data) ? data[0] : data;
      if (!order) {
        resultBox.classList.add("notFound");
        resultBox.textContent = "لم نعثر على طلب بهذه البيانات. تأكد من رقم الطلب ورقم الموبايل المسجل عند الشراء.";
        return;
      }

      const statusLabels = {
        "جديد": "تم استلام طلبك",
        "قيد التجهيز": "طلبك قيد التجهيز",
        "تم الشحن": "طلبك تم شحنه",
        "مكتمل": "تم اكتمال الطلب",
        "ملغي": "تم إلغاء الطلب"
      };
      const statusLabel = statusLabels[order.status] || order.status || "الحالة غير محددة";
      const dateText = order.created_at
        ? new Date(order.created_at).toLocaleString("ar-EG", { dateStyle: "medium", timeStyle: "short" })
        : "";
      const progressSteps = [
        { status: "جديد", label: "تم استلام الطلب" },
        { status: "قيد التجهيز", label: "جاري التجهيز" },
        { status: "تم الشحن", label: "خرج للتوصيل" },
        { status: "مكتمل", label: "تم التسليم" }
      ];
      const currentStep = progressSteps.findIndex(step => step.status === order.status);
      const progressMarkup = order.status === "ملغي"
        ? '<div class="trackingCancelled">تم إلغاء هذا الطلب</div>'
        : '<div class="trackingTimeline" aria-label="مراحل الطلب">' + progressSteps.map((step,index) => {
            const stepState = currentStep >= index ? " completed" : "";
            const current = currentStep === index ? " current" : "";
            return '<div class="trackingStep' + stepState + current + '"><span class="trackingStepDot">' + (currentStep > index ? "✓" : String(index + 1)) + '</span><span class="trackingStepLabel">' + step.label + '</span></div>';
          }).join("") + '</div>';

      resultBox.classList.add("found");
      const canCancel = ["جديد", "قيد التجهيز"].includes(order.status);
      resultBox.innerHTML = `
        <div class="trackingOrderNumber">طلبك رقم #${escapeHTML(order.order_id)}</div>
        <div class="trackingStatus">${escapeHTML(statusLabel)}</div>
        ${dateText ? `<p>تاريخ الطلب: ${escapeHTML(dateText)}</p>` : ""}
        ${progressMarkup}
        ${canCancel ? '<button type="button" id="customerCancelOrderButton" class="customerCancelOrderButton">إلغاء الطلب</button>' : ""}
        <p class="trackingNote">شكرًا لاختيارك EA Luxury</p>
      `;

      const cancelButton = document.getElementById("customerCancelOrderButton");
      if (cancelButton) {
        cancelButton.addEventListener("click", () => {
          if (document.getElementById("customerCancelReasonBox")) return;
          const reasonBox = document.createElement("div");
          reasonBox.id = "customerCancelReasonBox";
          reasonBox.className = "customerCancelReasonBox";
          reasonBox.innerHTML = `
            <label for="customerCancelReason">سبب إلغاء الطلب (اختياري)</label>
            <textarea id="customerCancelReason" maxlength="500" rows="3" placeholder="اكتب سبب الإلغاء لمساعدتنا على تحسين الخدمة..."></textarea>
            <div class="customerCancelReasonActions">
              <button type="button" id="confirmCustomerCancelButton" class="customerCancelOrderButton">تأكيد الإلغاء</button>
              <button type="button" id="keepCustomerOrderButton" class="customerKeepOrderButton">رجوع</button>
            </div>
          `;
          cancelButton.insertAdjacentElement("afterend", reasonBox);

          document.getElementById("keepCustomerOrderButton").addEventListener("click", () => reasonBox.remove());
          document.getElementById("confirmCustomerCancelButton").addEventListener("click", async () => {
            const reason = document.getElementById("customerCancelReason").value.trim();
            if (!window.confirm("هل أنت متأكد من إلغاء هذا الطلب؟ سيتم إرجاع الكمية إلى المخزون.")) return;

            const confirmButton = document.getElementById("confirmCustomerCancelButton");
            confirmButton.disabled = true;
            confirmButton.textContent = "جاري إلغاء الطلب...";
            try {
              const { error: cancelError } = await db.rpc("customer_cancel_order", {
                p_order_id: orderId,
                p_phone: values.phone,
                p_reason: reason
              });
              if (cancelError) throw cancelError;

              resultBox.classList.remove("notFound");
              resultBox.classList.add("found");
              resultBox.innerHTML = `
                <div class="trackingOrderNumber">طلبك رقم #${escapeHTML(order.order_id)}</div>
                <div class="trackingStatus">تم إلغاء الطلب بنجاح</div>
                <p>تم تسجيل الإلغاء وإرجاع الكمية إلى المخزون.</p>
                <p class="trackingNote">شكرًا لاختيارك EA Luxury</p>
              `;
            } catch (cancelError) {
              console.error("خطأ إلغاء الطلب:", cancelError);
              confirmButton.disabled = false;
              confirmButton.textContent = "تأكيد الإلغاء";
              reasonBox.insertAdjacentHTML("beforeend", `<p class="trackingCancelError">${escapeHTML(cancelError.message || "تعذر إلغاء الطلب حاليًا. حاول مرة أخرى.")}</p>`);
            }
          });
        });
      }
    } catch (error) {
      console.error("خطأ متابعة الطلب:", error);
      resultBox.classList.add("notFound");
      resultBox.textContent = "تعذر الاستعلام حاليًا. حاول مرة أخرى بعد قليل.";
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = "عرض حالة الطلب";
    }
  });
}


// فتح وإغلاق صندوق متابعة الطلب عند الضغط على الزر فقط.
const trackingSection = document.getElementById("trackOrder");
const openTrackingButton = document.getElementById("openTrackingButton");
const closeTrackingButton = document.getElementById("closeTrackingButton");

function openOrderTracking() {
  if (!trackingSection) return;
  trackingSection.hidden = false;
  trackingSection.scrollIntoView({ behavior: "smooth", block: "center" });
  const orderInput = trackingSection.querySelector('input[name="order_id"]');
  if (orderInput) setTimeout(() => orderInput.focus({ preventScroll: true }), 350);
}

function closeOrderTracking() {
  if (!trackingSection) return;
  trackingSection.hidden = true;
  const resultBox = document.getElementById("trackingResult");
  if (resultBox) {
    resultBox.className = "trackingResult";
    resultBox.textContent = "";
  }
}

if (openTrackingButton) openTrackingButton.addEventListener("click", openOrderTracking);
if (closeTrackingButton) closeTrackingButton.addEventListener("click", closeOrderTracking);

// رابط المتابعة في قائمة التنقل يفتح الصندوق بدل الانتقال إلى قسم ظاهر دائمًا.
document.querySelectorAll('a[href="#trackOrder"]').forEach(link => {
  link.addEventListener("click", event => {
    event.preventDefault();
    openOrderTracking();
  });
});


// تسجيل نسخة EA Luxury القابلة للتثبيت مع دعم محدود لفتح الواجهة دون اتصال.
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js")
      .catch(error => console.warn("تعذر تسجيل تطبيق EA Luxury:", error));
  });
}
