
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

async function sendOrderEmails(orderId, values, orderItems, orderTotal) {
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
let selectedCategory = "الكل";
let storefrontSettings = {};
let productSearchTerm = "";
let productSortMode = "default";

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
    const shippingFee = Number(settings.shippingFee || 0);
    const freeShipping = Number(settings.freeShipping || 0);
    let shippingText = "التوصيل متاح لجميع محافظات مصر.";
    if (shippingFee > 0) shippingText = "مصاريف الشحن تبدأ من " + shippingFee.toLocaleString("ar-EG") + " جنيه.";
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
  return Number.isFinite(sale) && sale > 0 && sale < regular ? sale : regular;
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
  let filtered = selectedCategory === "الكل"
    ? [...products]
    : products.filter(p => p.category === selectedCategory);

  if (productSearchTerm) {
    const term = productSearchTerm.toLocaleLowerCase("ar");
    filtered = filtered.filter(p =>
      [p.name, p.description, p.category].some(value =>
        String(value || "").toLocaleLowerCase("ar").includes(term)
      )
    );
  }

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
  if (count) count.textContent = "عدد المنتجات: " + filtered.length;

  if (!filtered.length) {
    grid.innerHTML = '<div class="store-empty-state"><strong>ملقيناش منتجات مطابقة</strong><span>جرّب تغيّر كلمة البحث أو اختيار الترتيب.</span></div>';
    return;
  }

  grid.innerHTML = filtered.map(p => {
    const variants = productVariants.filter(
      v => String(v.product_id) === String(p.id)
    );
    const hasVariants = variants.length > 0;
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
}

// الضغط على الصور الصغيرة أو الكبيرة
grid.addEventListener("click", event => {
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

  const count = cart.reduce((sum, item) => sum + Number(item.quantity || 0), 0);
  if (cartCount) cartCount.textContent = count;

  const cartItemsElement = document.getElementById("cartItems");
  const totalElement = document.getElementById("cartTotal");
  const total = cart.reduce((sum, item) => sum + Number(item.price || 0) * Number(item.quantity || 0), 0);

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

// التنقل بين السلة وخطوة إتمام الطلب
const checkoutPanel = document.getElementById("checkoutPanel");
const cartActions = document.getElementById("cartActions");

document.getElementById("cartButton").addEventListener("click", () => {
  window.location.href = "cart.html";
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
          }))
        }
      );

      if (error) throw error;

      const orderSnapshot = cart.map(item => ({ ...item }));
      const orderTotal = orderSnapshot.reduce(
        (sum, item) => sum + Number(item.price) * item.quantity, 0
      );

      message.textContent =
        "تم استلام طلبك بنجاح! رقم طلبك: #" + data +
        ". احتفظ بالرقم لمتابعة طلبك، وسنتواصل معك لتأكيده.";

      const emailResult = await sendOrderEmails(data, values, orderSnapshot, orderTotal);
      if (!emailResult.configured) {
        message.textContent += " سيتم تفعيل رسائل التأكيد بالبريد بعد ربط خدمة البريد.";
      } else if (emailResult.sent) {
        message.textContent += " تم إرسال تأكيد الطلب، وستصلك نسخة على بريد المتجر.";
      } else {
        message.textContent += " تم حفظ الطلب، لكن تعذر إرسال رسالة البريد. سبب الخطأ: " + (emailResult.error || "غير معروف");
      }

      cart = [];
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

      resultBox.classList.add("found");
      const canCancel = ["جديد", "قيد التجهيز"].includes(order.status);
      resultBox.innerHTML = `
        <div class="trackingOrderNumber">طلبك رقم #${escapeHTML(order.order_id)}</div>
        <div class="trackingStatus">${escapeHTML(statusLabel)}</div>
        ${dateText ? `<p>تاريخ الطلب: ${escapeHTML(dateText)}</p>` : ""}
        ${canCancel ? '<button type="button" id="customerCancelOrderButton" class="customerCancelOrderButton">إلغاء الطلب</button>' : ""}
        <p class="trackingNote">شكرًا لاختيارك EA Luxury</p>
      `;

      const cancelButton = document.getElementById("customerCancelOrderButton");
      if (cancelButton) {
        cancelButton.addEventListener("click", async () => {
          if (!window.confirm("هل أنت متأكد من إلغاء هذا الطلب؟ سيتم إرجاع الكمية إلى المخزون.")) return;

          cancelButton.disabled = true;
          cancelButton.textContent = "جاري إلغاء الطلب...";
          try {
            const { data: cancelResult, error: cancelError } = await db.rpc("customer_cancel_order", {
              p_order_id: orderId,
              p_phone: values.phone
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
            cancelButton.disabled = false;
            cancelButton.textContent = "إلغاء الطلب";
            resultBox.insertAdjacentHTML("beforeend", `<p class="trackingCancelError">${escapeHTML(cancelError.message || "تعذر إلغاء الطلب حاليًا. حاول مرة أخرى.")}</p>`);
          }
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
