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
  const filters = document.getElementById("collectionFilters");
  const searchInput = document.getElementById("collectionSearch");
  const sortSelect = document.getElementById("collectionSort");
  const minPriceInput = document.getElementById("collectionMinPrice");
  const maxPriceInput = document.getElementById("collectionMaxPrice");
  const sizeSelect = document.getElementById("collectionSize");
  const colorSelect = document.getElementById("collectionColor");
  const availableInput = document.getElementById("collectionAvailable");
  const clearButton = document.getElementById("collectionClearFilters");
  const resultsCount = document.getElementById("collectionResultsCount");
  const minPriceLabel = minPriceInput?.closest("label")?.querySelector("span");
  const maxPriceLabel = maxPriceInput?.closest("label")?.querySelector("span");
  let categoryProducts = [];
  let visibleProducts = [];
  let variantsByProduct = new Map();

  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const listOf = value => {
    if (Array.isArray(value)) return value.map(v => String(v ?? "").trim()).filter(Boolean);
    if (typeof value === "string" && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed.map(v => String(v ?? "").trim()).filter(Boolean) : [value.trim()];
      } catch (_) { return [value.trim()]; }
    }
    return [];
  };
  const imagesOf = product => {
    let source = product.image_urls;
    if (typeof source === "string") {
      try { source = JSON.parse(source); } catch (_) { source = [source]; }
    }
    const images = Array.isArray(source) ? source.filter(v => typeof v === "string" && v.trim()) : [];
    if (product.image_url && typeof product.image_url === "string" && product.image_url.trim()) images.push(product.image_url.trim());
    return [...new Set(images)].slice(0,5);
  };
  const priceOf = product => Number(product.sale_price > 0 && product.sale_price < product.price ? product.sale_price : product.price || 0);
  const money = product => priceOf(product).toLocaleString("ar-EG") + (product.currency === "AED" ? " درهم" : " جنيه");
  const sizesOf = product => {
    const fromProduct = listOf(product.sizes);
    const fromVariants = (variantsByProduct.get(String(product.id)) || []).map(v => String(v.size || "").trim()).filter(Boolean);
    return [...new Set([...fromProduct, ...fromVariants])];
  };
  const colorsOf = product => {
    const fromProduct = listOf(product.colors);
    const fromVariants = (variantsByProduct.get(String(product.id)) || []).map(v => String(v.color || "").trim()).filter(Boolean);
    return [...new Set([...fromProduct, ...fromVariants])];
  };
  function updatePriceLabels(items) {
    const currencies = [...new Set(items.map(p => p.currency === "AED" ? "درهم" : "جنيه"))];
    const suffix = currencies.length === 1 ? " (" + currencies[0] + ")" : "";
    if (minPriceLabel) minPriceLabel.textContent = "السعر من" + suffix;
    if (maxPriceLabel) maxPriceLabel.textContent = "السعر إلى" + suffix;
  }
  async function loadVariants(items) {
    variantsByProduct = new Map();
    const ids = items.map(p => p.id).filter(id => id != null);
    if (!ids.length) return;
    try {
      const { data, error } = await db.from("product_variants")
        .select("product_id,size,color,stock,is_active")
        .in("product_id", ids);
      if (error) throw error;
      (data || []).forEach(variant => {
        const key = String(variant.product_id);
        if (!variantsByProduct.has(key)) variantsByProduct.set(key, []);
        variantsByProduct.get(key).push(variant);
      });
    } catch (error) {
      console.warn("تعذر تحميل تفاصيل المقاسات والمخزون؛ سيتم استخدام بيانات المنتج الأساسية.", error);
    }
  }
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
    }).join("") || '<p class="collection-empty">لا توجد منتجات تطابق التصفية الحالية.</p>';
  }
  function fillSelect(select, values, firstLabel) {
    if (!select) return;
    const previous = select.value;
    select.innerHTML = '<option value="">' + escapeHTML(firstLabel) + '</option>' +
      values.map(value => '<option value="' + escapeHTML(value) + '">' + escapeHTML(value) + '</option>').join("");
    select.disabled = values.length === 0;
    if (values.includes(previous)) select.value = previous;
  }
  function refreshFilterOptions(items) {
    const sizes = [...new Set(items.flatMap(sizesOf))].sort((a,b) => a.localeCompare(b,"ar",{numeric:true}));
    const colors = [...new Set(items.flatMap(colorsOf))].sort((a,b) => a.localeCompare(b,"ar"));
    fillSelect(sizeSelect, sizes, sizes.length ? "كل المقاسات" : "لا توجد مقاسات مسجلة");
    fillSelect(colorSelect, colors, colors.length ? "كل الألوان" : "لا توجد ألوان مسجلة حاليًا");
  }
  function isAvailable(product) {
    const variants = variantsByProduct.get(String(product.id)) || [];
    if (variants.length) {
      const matching = variants.filter(v => !sizeSelect?.value || String(v.size || "").trim() === sizeSelect.value)
        .filter(v => !colorSelect?.value || String(v.color || "").trim() === colorSelect.value);
      return matching.some(v => v.is_active !== false && Number(v.stock || 0) > 0);
    }
    return Number(product.stock || 0) > 0;
  }
  function applyFilters() {
    const query = String(searchInput?.value || "").trim().toLocaleLowerCase("ar");
    const min = minPriceInput?.value === "" ? null : Number(minPriceInput.value);
    const max = maxPriceInput?.value === "" ? null : Number(maxPriceInput.value);
    const selectedSize = sizeSelect?.value || "";
    const selectedColor = colorSelect?.value || "";
    let items = visibleProducts.filter(product => {
      const searchText = [product.name, product.brand, ...sizesOf(product), ...colorsOf(product)].join(" ").toLocaleLowerCase("ar");
      if (query && !searchText.includes(query)) return false;
      const price = priceOf(product);
      if (min !== null && Number.isFinite(min) && price < min) return false;
      if (max !== null && Number.isFinite(max) && price > max) return false;
      if (selectedSize && !sizesOf(product).includes(selectedSize)) return false;
      if (selectedColor && !colorsOf(product).includes(selectedColor)) return false;
      if (availableInput?.checked && !isAvailable(product)) return false;
      return true;
    });
    const sort = sortSelect?.value || "default";
    if (sort === "newest") items.sort((a,b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
    if (sort === "price-asc") items.sort((a,b) => priceOf(a) - priceOf(b));
    if (sort === "price-desc") items.sort((a,b) => priceOf(b) - priceOf(a));
    productGrid.innerHTML = renderProductCards(items);
    resultsCount.textContent = "عرض " + items.length.toLocaleString("ar-EG") + " من " + visibleProducts.length.toLocaleString("ar-EG") + " منتج";
    subtitle.textContent = "اختار المنتج المناسب لك — " + items.length.toLocaleString("ar-EG") + " منتج";
  }
  function resetFilters() {
    if (searchInput) searchInput.value = "";
    if (sortSelect) sortSelect.value = "default";
    if (minPriceInput) minPriceInput.value = "";
    if (maxPriceInput) maxPriceInput.value = "";
    if (sizeSelect) sizeSelect.value = "";
    if (colorSelect) colorSelect.value = "";
    if (availableInput) availableInput.checked = false;
  }
  function showFilters(items) {
    visibleProducts = items.slice();
    filters.hidden = false;
    updatePriceLabels(visibleProducts);
    refreshFilterOptions(visibleProducts);
    applyFilters();
  }
  function hideFilters() {
    filters.hidden = true;
    resetFilters();
  }
  function showAllProducts() {
    brandGrid.hidden = true;
    productGrid.hidden = false;
    backButton.hidden = true;
    title.textContent = "ملابس حريمي";
    showFilters(categoryProducts);
  }
  function showBrands() {
    hideFilters();
    brandGrid.hidden = false;
    productGrid.hidden = true;
    backButton.hidden = true;
    title.textContent = category === "أحذية" ? "ماركات الأحذية" : "ماركات الملابس الحريمي";
    subtitle.textContent = "اختار الماركة وشوف كل المنتجات المتاحة منها";
  }
  async function showBrandProducts(brand) {
    const items = categoryProducts.filter(p => (String(p.brand || "").trim() || "ماركات أخرى") === brand);
    brandGrid.hidden = true;
    productGrid.hidden = false;
    backButton.hidden = false;
    title.textContent = brand;
    subtitle.textContent = "جاري تجهيز منتجات " + brand + "...";
    resetFilters();
    await loadVariants(items);
    showFilters(items);
    window.scrollTo({top:0,behavior:"smooth"});
  }
  backButton.addEventListener("click", showBrands);
  brandGrid.addEventListener("click", event => {
    const card = event.target.closest("[data-brand]");
    if (card) showBrandProducts(card.dataset.brand);
  });
  [searchInput, sortSelect, minPriceInput, maxPriceInput, sizeSelect, colorSelect, availableInput].forEach(control => {
    if (!control) return;
    control.addEventListener(control === searchInput ? "input" : "change", applyFilters);
  });
  clearButton?.addEventListener("click", () => { resetFilters(); applyFilters(); });

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
      await loadVariants(categoryProducts);
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