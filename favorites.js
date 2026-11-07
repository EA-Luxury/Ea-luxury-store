(() => {
  "use strict";
  const SUPABASE_URL = "https://jezqohivdiziuzfmllvq.supabase.co";
  const SUPABASE_KEY = "sb_publishable_hrP0-e5_ou1HHeKZpCu8jw_ORY_-zdh";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const grid = document.getElementById("favoritesPageGrid");
  const status = document.getElementById("favoritesPageStatus");
  const empty = document.getElementById("favoritesPageEmpty");
  let favoriteIds = readFavorites();
  let products = [];
  let variants = [];

  function readFavorites() {
    try {
      const value = JSON.parse(localStorage.getItem("eaLuxuryFavorites") || "[]");
      return Array.isArray(value) ? [...new Set(value.map(String))] : [];
    } catch (_) { return []; }
  }
  function writeFavorites() {
    try { localStorage.setItem("eaLuxuryFavorites", JSON.stringify(favoriteIds)); } catch (_) {}
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    })[char]);
  }
  function getImages(product) {
    const list = Array.isArray(product.image_urls) ? product.image_urls : [];
    return [...new Set([...list, product.image_url, product.image].filter(value =>
      typeof value === "string" && value.trim() && /^https?:\/\//i.test(value)
    ))].slice(0,5);
  }
  function effectivePrice(product) {
    const regular = Number(product.price || 0);
    const sale = Number(product.sale_price);
    const now = Date.now();
    const starts = product.sale_starts_at ? Date.parse(product.sale_starts_at) : null;
    const ends = product.sale_ends_at ? Date.parse(product.sale_ends_at) : null;
    const started = starts === null || (Number.isFinite(starts) && now >= starts);
    const notEnded = ends === null || (Number.isFinite(ends) && now < ends);
    return Number.isFinite(sale) && sale > 0 && sale < regular && started && notEnded ? sale : regular;
  }
  function money(value) {
    return Number(value || 0).toLocaleString("ar-EG") + " جنيه";
  }
  function render() {
    const saved = favoriteIds.map(id => products.find(product => String(product.id) === id)).filter(Boolean);
    grid.innerHTML = saved.map(product => {
      const image = getImages(product)[0] || "";
      const productVariants = variants.filter(item => String(item.product_id) === String(product.id) && Number(item.stock) > 0);
      const hasVariants = variants.some(item => String(item.product_id) === String(product.id));
      const options = hasVariants
        ? (productVariants.length
          ? '<label class="favorites-variant-label" for="favoriteVariant-' + escapeHTML(product.id) + '">اختار المقاس واللون</label><select class="favorites-variant-select" id="favoriteVariant-' + escapeHTML(product.id) + '" data-favorite-variant="' + escapeHTML(product.id) + '">' +
            productVariants.map(item => '<option value="' + escapeHTML(item.id) + '">' +
              escapeHTML([item.size || "بدون مقاس",item.color || "بدون لون","المتاح: "+Number(item.stock)].join(" - ")) +
            '</option>').join("") + '</select>'
          : '<p class="favorites-out-of-stock">نفدت جميع الاختيارات</p>')
        : (Number(product.stock || 0) > 0 ? "" : '<p class="favorites-out-of-stock">غير متوفر حاليًا</p>');
      const canAdd = hasVariants ? productVariants.length > 0 : Number(product.stock || 0) > 0;
      const price = effectivePrice(product);
      const regular = Number(product.price || 0);
      return '<article class="favorites-page-card">' +
        '<a class="favorites-page-image" href="product.html?id=' + encodeURIComponent(String(product.id)) + '">' +
          (image ? '<img src="' + escapeHTML(image) + '" alt="' + escapeHTML(product.name) + '" loading="lazy">' : '<span>EA LUXURY</span>') +
        '</a><div class="favorites-page-card-body">' +
          '<span class="favorites-page-category">' + escapeHTML(product.category || "EA LUXURY") + '</span>' +
          '<h2><a href="product.html?id=' + encodeURIComponent(String(product.id)) + '">' + escapeHTML(product.name) + '</a></h2>' +
          '<div class="favorites-page-price">' + (price < regular ? '<del>' + money(regular) + '</del>' : '') + '<strong>' + money(price) + '</strong></div>' +
          options +
          '<div class="favorites-page-actions"><button type="button" class="favorites-add-button" data-favorites-add="' + escapeHTML(product.id) + '" ' + (canAdd ? "" : "disabled") + '>أضف إلى السلة</button>' +
          '<button type="button" class="favorites-remove-button" data-favorites-remove="' + escapeHTML(product.id) + '">إزالة ♥</button></div>' +
        '</div></article>';
    }).join("");
    const missing = favoriteIds.filter(id => !products.some(product => String(product.id) === id));
    if (missing.length) {
      favoriteIds = favoriteIds.filter(id => !missing.includes(id));
      writeFavorites();
    }
    empty.hidden = saved.length !== 0;
    grid.hidden = saved.length === 0;
    status.hidden = true;
  }
  function updateCartCount() {
    try {
      const cart = JSON.parse(localStorage.getItem("eaLuxuryCart") || "[]");
      document.getElementById("favoritesCartCount").textContent = Array.isArray(cart)
        ? cart.reduce((sum,item) => sum + Math.max(0,Number(item.quantity)||0),0) : 0;
    } catch (_) { document.getElementById("favoritesCartCount").textContent = "0"; }
  }
  function addProductToCart(id) {
    const product = products.find(item => String(item.id) === String(id));
    if (!product) return;
    const hasVariants = variants.some(item => String(item.product_id) === String(id));
    let selected = null;
    if (hasVariants) {
      const select = document.querySelector('[data-favorite-variant="' + CSS.escape(String(id)) + '"]');
      selected = variants.find(item => select && String(item.id) === String(select.value) && Number(item.stock) > 0);
      if (!selected) { alert("اختار مقاسًا ولونًا متاحين."); return; }
    }
    const stock = selected ? Number(selected.stock) : Number(product.stock || 0);
    if (stock <= 0) { alert("هذا المنتج غير متوفر حاليًا."); return; }
    let cart = [];
    try {
      const saved = JSON.parse(localStorage.getItem("eaLuxuryCart") || "[]");
      cart = Array.isArray(saved) ? saved : [];
    } catch (_) {}
    const cartKey = String(product.id) + "_" + (selected ? String(selected.id) : "base");
    const existing = cart.find(item => item.cartKey === cartKey);
    const quantity = existing ? Math.max(0,Number(existing.quantity)||0) : 0;
    if (quantity + 1 > stock) { alert("الكمية المطلوبة تتجاوز المتاح من هذا الاختيار."); return; }
    if (existing) {
      existing.quantity = quantity + 1;
      existing.price = effectivePrice(product);
      existing.availableStock = stock;
    } else {
      cart.push({
        ...product,
        price: effectivePrice(product),
        quantity: 1,
        cartKey,
        variant_id: selected ? selected.id : null,
        selected_size: selected?.size || null,
        selected_color: selected?.color || null,
        availableStock: stock
      });
    }
    try { localStorage.setItem("eaLuxuryCart", JSON.stringify(cart)); }
    catch (_) { alert("تعذر حفظ السلة على هذا الجهاز."); return; }
    updateCartCount();
    const button = document.querySelector('[data-favorites-add="' + CSS.escape(String(id)) + '"]');
    if (button) {
      const original = button.textContent;
      button.textContent = "تمت الإضافة ✓";
      button.disabled = true;
      setTimeout(() => { if (button.isConnected) { button.textContent = original; button.disabled = false; } }, 1200);
    }
  }
  grid.addEventListener("click", event => {
    const add = event.target.closest("[data-favorites-add]");
    if (add) { addProductToCart(add.dataset.favoritesAdd); return; }
    const remove = event.target.closest("[data-favorites-remove]");
    if (remove) {
      favoriteIds = favoriteIds.filter(id => id !== String(remove.dataset.favoritesRemove));
      writeFavorites();
      render();
    }
  });
  document.getElementById("favoritesMobileMenuButton").addEventListener("click", () => {
    const nav = document.getElementById("favoritesMainNav");
    const button = document.getElementById("favoritesMobileMenuButton");
    const open = nav.classList.toggle("active");
    button.setAttribute("aria-expanded", String(open));
  });

  async function init() {
    updateCartCount();
    if (!favoriteIds.length) {
      status.hidden = true;
      empty.hidden = false;
      grid.hidden = true;
      return;
    }
    try {
      const [productResult, variantResult] = await Promise.all([
        db.from("products").select("*").eq("active", true).in("id", favoriteIds),
        db.from("product_variants").select("id,product_id,size,color,stock,is_active").eq("is_active", true)
      ]);
      if (productResult.error) throw productResult.error;
      products = productResult.data || [];
      variants = variantResult.error ? [] : (variantResult.data || []);
      render();
    } catch (error) {
      console.error("تعذر تحميل المفضلة:", error);
      status.textContent = "حصلت مشكلة أثناء تحميل المنتجات. حاول تحديث الصفحة.";
    }
  }
  init();
})();