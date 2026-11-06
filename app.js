
const SUPABASE_URL = "https://jezqohivdiziuzfmllvq.supabase.co";
const SUPABASE_KEY = "sb_publishable_hrP0-e5_ou1HHeKZpCu8jw_ORY_-zdh";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// بيانات EmailJS تُضاف بعد إنشاء الحساب وربط البريد
const EMAILJS_SERVICE_ID = "YOUR_SERVICE_ID";
const EMAILJS_TEMPLATE_ID = "YOUR_TEMPLATE_ID";
const EMAILJS_PUBLIC_KEY = "YOUR_PUBLIC_KEY";
const OWNER_NOTIFICATION_EMAIL = "Ealuxury109@gmail.com";

async function sendOrderEmails(orderId, values, orderItems, orderTotal) {
  const configured = [EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, EMAILJS_PUBLIC_KEY]
    .every(value => value && !value.startsWith("YOUR_"));

  if (!configured || !window.emailjs) {
    return { ownerSent: false, customerSent: false, configured: false };
  }

  const itemsText = orderItems.map(item => {
    const variant = [item.selected_size, item.selected_color].filter(Boolean).join(" / ");
    return `${item.name}${variant ? " (" + variant + ")" : ""} × ${item.quantity} — ${(Number(item.price) * item.quantity).toLocaleString("ar-EG")} جنيه`;
  }).join("\\n");

  const common = {
    order_id: String(orderId),
    customer_name: values.customer_name,
    customer_email: values.customer_email,
    phone: values.phone,
    governorate: values.governorate,
    address: values.address,
    order_total: Number(orderTotal).toLocaleString("ar-EG") + " جنيه",
    items_text: itemsText,
    store_name: "EA Luxury"
  };

  const sendTo = async (toEmail, toName, subject, intro) => {
    await window.emailjs.send(EMAILJS_SERVICE_ID, EMAILJS_TEMPLATE_ID, {
      ...common,
      to_email: toEmail,
      to_name: toName,
      subject,
      intro
    }, { publicKey: EMAILJS_PUBLIC_KEY });
  };

  let ownerSent = false;
  let customerSent = false;

  try {
    await sendTo(
      OWNER_NOTIFICATION_EMAIL,
      "EA Luxury",
      "طلب جديد من EA Luxury #" + orderId,
      "تم استلام طلب جديد من المتجر."
    );
    ownerSent = true;
  } catch (error) {
    console.error("تعذر إرسال إشعار المتجر:", error);
  }

  // EmailJS يوصي بحد أقصى طلب إرسال واحد في الثانية
  await new Promise(resolve => setTimeout(resolve, 1100));

  try {
    await sendTo(
      values.customer_email,
      values.customer_name,
      "تأكيد طلبك من EA Luxury #" + orderId,
      "شكرًا لطلبك من EA Luxury. تم استلام طلبك بنجاح."
    );
    customerSent = true;
  } catch (error) {
    console.error("تعذر إرسال تأكيد العميل:", error);
  }

  return { ownerSent, customerSent, configured: true };
}

let products = [];
let productVariants = [];
let cart = [];
let selectedCategory = "الكل";

const grid = document.getElementById("productGrid");
const cartCount = document.getElementById("cartCount");
const cartSection = document.getElementById("cartSection");
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

// عرض المنتجات ومعرض الصور
function showProducts() {
  const filtered = selectedCategory === "الكل"
    ? products
    : products.filter(p => p.category === selectedCategory);

  if (!filtered.length) {
    grid.innerHTML = "<p>لا توجد منتجات حاليًا.</p>";
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

        <img
          class="product-main-image"
          data-product-id="${escapeHTML(p.id)}"
          src="${escapeHTML(mainImage)}"
          alt="${escapeHTML(p.name)}"
          style="cursor:zoom-in"
          onerror="this.style.display='none'"
        >

        ${thumbnails}

        <h3>${escapeHTML(p.name)}</h3>

        <p>
          ${Number(p.price).toLocaleString("ar-EG")} جنيه
        </p>

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

  const mainImage = event.target.closest(".product-main-image");

  if (mainImage) {
    const product = products.find(
      p => String(p.id) === String(mainImage.dataset.productId)
    );

    if (!product) return;

    const images = getProductImages(product);
    const index = Number(mainImage.dataset.imageIndex || 0);

    openImageViewer(images, index);
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
      quantity: 1,
      cartKey,
      variant_id: selectedVariant ? selectedVariant.id : null,
      selected_size: selectedVariant?.size || null,
      selected_color: selectedVariant?.color || null,
      availableStock: stock
    });
  }

  updateCart();

  cartSection.hidden = false;
  cartSection.scrollIntoView({ behavior: "smooth" });
}

// تحديث السلة
function updateCart() {
  cartCount.textContent = cart.reduce(
    (sum, item) => sum + item.quantity, 0
  );

  document.getElementById("cartItems").innerHTML =
    cart.map(item => `
      <div class="cartItem">
        <span>
          ${escapeHTML(item.name)}
          ${item.selected_size || item.selected_color
            ? ` (${escapeHTML(item.selected_size || "")}${item.selected_size && item.selected_color ? " / " : ""}${escapeHTML(item.selected_color || "")})`
            : ""}
          × ${item.quantity}
        </span>

        <span>
          ${(Number(item.price) * item.quantity)
            .toLocaleString("ar-EG")} جنيه
        </span>

        <button type="button"
          onclick="removeFromCart('${escapeHTML(item.cartKey || String(item.id) + "_base")}')">
          حذف
        </button>
      </div>
    `).join("");

  const total = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity, 0
  );

  document.getElementById("cartTotal").textContent =
    total.toLocaleString("ar-EG");

  return total;
}

// حذف منتج من السلة
function removeFromCart(cartKey) {
  cart = cart.filter(
    item => (item.cartKey || String(item.id) + "_base") !== String(cartKey)
  );

  updateCart();
}

window.addToCart = addToCart;
window.removeFromCart = removeFromCart;

// تصنيف المنتجات
document.querySelectorAll(".category").forEach(button => {
  button.addEventListener("click", () => {
    selectedCategory = button.dataset.category;

    document.querySelectorAll(".category").forEach(b =>
      b.classList.remove("active")
    );

    button.classList.add("active");
    showProducts();
  });
});

// فتح السلة
document.getElementById("cartButton")
  .addEventListener("click", () => {
    cartSection.hidden = false;
    cartSection.scrollIntoView({ behavior: "smooth" });
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
      } else if (emailResult.ownerSent && emailResult.customerSent) {
        message.textContent += " تم إرسال تأكيد الطلب إلى بريدك وإشعار المتجر.";
      } else {
        message.textContent += " تم حفظ الطلب، لكن تعذر إرسال إحدى رسائل البريد.";
      }

      cart = [];
      updateCart();
      form.reset();

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

    <a href="tel:01065938516"
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

    <a href="https://wa.me/201065938516"
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

    <a href="https://www.facebook.com/share/1F6UFaUhmj/?mibextid=wwXIfr"
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

document.body.appendChild(contactSection);

