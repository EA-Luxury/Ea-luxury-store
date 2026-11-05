
const SUPABASE_URL = "https://jezqohivdiziuzfmllvq.supabase.co";
const SUPABASE_KEY = "sb_publishable_hrP0-e5_ou1HHeKZpCu8jw_ORY_-zdh";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let products = [];
let cart = [];
let selectedCategory = "الكل";

const grid = document.getElementById("productGrid");
const cartCount = document.getElementById("cartCount");
const cartSection = document.getElementById("cartSection");

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
    const stock = Number(p.stock ?? 0);
    const unavailable = stock <= 0;
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

        <p>المقاسات: ${
          Array.isArray(p.sizes)
            ? p.sizes.map(escapeHTML).join(" - ")
            : "حسب المتاح"
        }</p>

        <p>
          ${unavailable
            ? "غير متوفر حاليًا"
            : `المتاح: ${stock} قطعة`}
        </p>

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

// إضافة للسلة مع مراعاة المخزون
function addToCart(id) {
  const product = products.find(
    p => String(p.id) === String(id)
  );

  if (!product) {
    alert("لم يتم العثور على المنتج.");
    return;
  }

  const stock = Number(product.stock ?? 0);

  if (stock <= 0) {
    alert("هذا المنتج غير متوفر حاليًا.");
    return;
  }

  const item = cart.find(
    i => String(i.id) === String(id)
  );

  const currentQuantity = item ? item.quantity : 0;

  if (currentQuantity >= stock) {
    alert("وصلت للكمية المتاحة من هذا المنتج.");
    return;
  }

  if (item) {
    item.quantity++;
  } else {
    cart.push({ ...product, quantity: 1 });
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
          ${escapeHTML(item.name)} × ${item.quantity}
        </span>

        <span>
          ${(Number(item.price) * item.quantity)
            .toLocaleString("ar-EG")} جنيه
        </span>

        <button type="button"
          onclick="removeFromCart('${escapeHTML(item.id)}')">
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
function removeFromCart(id) {
  cart = cart.filter(
    item => String(item.id) !== String(id)
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
        "create_order_with_stock",
        {
          p_customer_name: values.customer_name,
          p_phone: values.phone,
          p_governorate: values.governorate,
          p_address: values.address,
          p_items: cart.map(item => ({
            id: item.id,
            quantity: item.quantity
          }))
        }
      );

      if (error) throw error;

      message.textContent =
        "تم استلام طلبك بنجاح. سنتواصل معك لتأكيده.";

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

// بدء تحميل المنتجات
loadProducts();
