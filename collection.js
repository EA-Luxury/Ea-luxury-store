(() => {
  const SUPABASE_URL = "https://jezqohivdiziuzfmllvq.supabase.co";
  const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImplenFvaGl2ZGl6aXV6Zm1sbHZxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4NDQxNDUsImV4cCI6MjEwOTQyMDE0NX0.kb-acCzpL5wREtcH5tMUojydfp68-mFjzPxKbgvHIJg";
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  const params = new URLSearchParams(location.search);
  const category = params.get("category") || "أحذية";
  const allowed = ["أحذية", "ملابس حريمي"];
  const title = document.getElementById("collectionTitle");
  const subtitle = document.getElementById("collectionSubtitle");
  const brandGrid = document.getElementById("collectionBrandGrid");
  const productGrid = document.getElementById("collectionProductGrid");
  const backButton = document.getElementById("collectionBackButton");
  let categoryProducts = [];
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const imagesOf = product => {
    let source = product.image_urls;
    if (typeof source === "string") {
      try { source = JSON.parse(source); } catch (_) { source = [source]; }
    }
    const images = Array.isArray(source)
      ? source.filter(v => typeof v === "string" && v.trim())
      : [];
    if (product.image_url && typeof product.image_url === "string" && product.image_url.trim()) {
      images.push(product.image_url.trim());
    }
    return [...new Set(images)].slice(0,5);
  };
  function renderProductCards(items, brandLabel) {
    return items.map(product => {
      const image = imagesOf(product)[0] || "";
      const actualBrand = String(product.brand || "").trim();
      const brand = brandLabel || actualBrand;
      return '<a class="collection-product-card' + (category === "ملابس حريمي" ? ' collection-women-card' : '') + '" href="product.html?id=' + encodeURIComponent(product.id) + '">' +
        '<span class="collection-product-image">' +
        (image ? '<img src="' + escapeHTML(image) + '" alt="' + escapeHTML(product.name) + '" loading="lazy" onerror="this.hidden=true;this.nextElementSibling.hidden=false">' : '') +
        '<span class="collection-image-fallback" ' + (image ? 'hidden' : '') + '>EA LUXURY</span>' +
        '</span><span class="collection-product-info">' +
        (brand ? '<small class="collection-product-brand">' + escapeHTML(brand) + '</small>' : '') +
        '<strong>' + escapeHTML(product.name) + '</strong><span class="collection-product-price">' + money(product) + '</span></span></a>';
    }).join("") || '<p class="collection-empty">لا توجد منتجات متاحة حاليًا.</p>';
  }
  function showAllProducts() {
    brandGrid.hidden = true;
    productGrid.hidden = false;
    backButton.hidden = true;
    title.textContent = "ملابس حريمي";
    subtitle.textContent = categoryProducts.length.toLocaleString("ar-EG") + " منتج متاح — اختاري المنتج المناسب لك";
    productGrid.innerHTML = renderProductCards(categoryProducts);
  }
  const money = product => Number(product.sale_price > 0 && product.sale_price < product.price ? product.sale_price : product.price || 0).toLocaleString("ar-EG") + (product.currency === "AED" ? " درهم" : " جنيه");
  function showBrands() {
    brandGrid.hidden = false;
    productGrid.hidden = true;
    backButton.hidden = true;
    title.textContent = category === "أحذية" ? "ماركات الأحذية" : "ماركات الملابس الحريمي";
    subtitle.textContent = "اختار الماركة وشوف كل المنتجات المتاحة منها";
  }
  function showBrandProducts(brand) {
    const items = categoryProducts.filter(p => (String(p.brand || "").trim() || "ماركات أخرى") === brand);
    brandGrid.hidden = true;
    productGrid.hidden = false;
    backButton.hidden = false;
    title.textContent = brand;
    subtitle.textContent = "منتجات " + brand + " — " + items.length.toLocaleString("ar-EG") + " منتج";
    productGrid.innerHTML = renderProductCards(items, brand);
    window.scrollTo({top:0,behavior:"smooth"});
  }
  backButton.addEventListener("click", showBrands);
  brandGrid.addEventListener("click", event => {
    const card = event.target.closest("[data-brand]");
    if (card) showBrandProducts(card.dataset.brand);
  });
  async function init() {
    if (!allowed.includes(category)) {
      title.textContent = "القسم غير متاح";
      brandGrid.innerHTML = '<p class="collection-empty">القسم المطلوب غير متاح.</p>';
      return;
    }
    title.textContent = "جاري تحميل القسم...";
    const {data,error} = await db.from("products").select("*").eq("active",true).eq("category",category).order("created_at",{ascending:false});
    if (error) {
      brandGrid.innerHTML = '<p class="collection-empty">تعذر تحميل المنتجات. حاول مرة أخرى.</p>';
      console.error(error);
      return;
    }
    categoryProducts = data || [];
    if (category === "ملابس حريمي") {
      showAllProducts();
      return;
    }
    const counts = new Map();
    categoryProducts.forEach(product => {
      const brand = String(product.brand || "").trim() || "ماركات أخرى";
      counts.set(brand,(counts.get(brand)||0)+1);
    });
    const brands = [...counts.entries()].sort((a,b) => b[1]-a[1] || a[0].localeCompare(b[0],"ar"));
    if (!brands.length) {
      brandGrid.innerHTML = '<p class="collection-empty">لا توجد منتجات متاحة في هذا القسم حاليًا.</p>';
      return;
    }
    brandGrid.innerHTML = brands.map(([brand,count]) => {
      const product = categoryProducts.find(p => (String(p.brand || "").trim() || "ماركات أخرى") === brand && imagesOf(p).length);
      const image = product ? imagesOf(product)[0] : "";
      return '<button type="button" class="collection-brand-card" data-brand="' + escapeHTML(brand) + '"><span class="collection-brand-image">' + (image ? '<img src="' + escapeHTML(image) + '" alt="" loading="lazy">' : 'EA') + '</span><span class="collection-brand-copy"><strong>' + escapeHTML(brand === "On" ? "On Cloud" : brand) + '</strong><small>' + count.toLocaleString("ar-EG") + ' منتج</small><em>تسوق الماركة ←</em></span></button>';
    }).join("");
    showBrands();
  }
  init();
})();