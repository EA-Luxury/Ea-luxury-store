
const SUPABASE_URL = "https://jezqohivdiziuzfmllvq.supabase.co";
const SUPABASE_KEY = "sb_publishable_hrP0-e5_ou1HHeKZpCu8jw_ORY_-zdh";

const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

let products = [];
let cart = [];
let selectedCategory = "الكل";

const grid = document.getElementById("productGrid");
const cartCount = document.getElementById("cartCount");
const cartSection = document.getElementById("cartSection");

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

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

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

    return `
      <article class="product">
        <img src="${escapeHTML(p.image_url || "")}"
             alt="${escapeHTML(p.name)}"
             onerror="this.style.display='none'">

        <h3>${escapeHTML(p.name)}</h3>

        <p>${Number(p.price).toLocaleString("ar-EG")} جنيه</p>

        <p>المقاسات: ${
          Array.isArray(p.sizes)
            ? p.sizes.join(" - ")
            : "حسب المتاح"
        }</p>

        <p>${unavailable ? "غير متوفر حاليًا" : `المتاح: ${stock} قطعة`}</p>

        <button type="button"
          ${unavailable ? "disabled" : ""}
          onclick="addToCart('${p.id}')">
          ${unavailable ? "غير متوفر" : "أضف إلى السلة"}
        </button>
      </article>
    `;
  }).join("");
}

function addToCart(id) {
  const product = products.find(p => String(p.id) === String(id));

  if (!product) {
    alert("لم يتم العثور على المنتج.");
    return;
  }

  const stock = Number(product.stock ?? 0);

  if (stock <= 0) {
    alert("هذا المنتج غير متوفر حاليًا.");
    return;
  }

  const item = cart.find(i => String(i.id) === String(id));
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

function updateCart() {
  cartCount.textContent = cart.reduce(
    (sum, item) => sum + item.quantity, 0
  );

  document.getElementById("cartItems").innerHTML = cart.map(item => `
    <div class="cartItem">
      <span>${escapeHTML(item.name)} × ${item.quantity}</span>
      <span>${(Number(item.price) * item.quantity).toLocaleString("ar-EG")} جنيه</span>
      <button type="button" onclick="removeFromCart('${item.id}')">حذف</button>
    </div>
  `).join("");

  const total = cart.reduce(
    (sum, item) => sum + Number(item.price) * item.quantity, 0
  );

  document.getElementById("cartTotal").textContent =
    total.toLocaleString("ar-EG");

  return total;
}

function removeFromCart(id) {
  cart = cart.filter(item => String(item.id) !== String(id));
  updateCart();
}

window.addToCart = addToCart;
window.removeFromCart = removeFromCart;

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

document.getElementById("cartButton").addEventListener("click", () => {
  cartSection.hidden = false;
  cartSection.scrollIntoView({ behavior: "smooth" });
});

document.getElementById("checkoutForm").addEventListener("submit", async event => {
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
    const values = Object.fromEntries(new FormData(form).entries());

    const { data, error } = await db.rpc("create_order_with_stock", {
      p_customer_name: values.customer_name,
      p_phone: values.phone,
      p_governorate: values.governorate,
      p_address: values.address,
      p_items: cart.map(item => ({
        id: item.id,
        quantity: item.quantity
      }))
    });

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
      "لم يكتمل الطلب: " + (error.message || "حدث خطأ");
  } finally {
    button.disabled = false;
    button.textContent = "تأكيد الطلب - الدفع عند الاستلام";
  }
});

loadProducts();
