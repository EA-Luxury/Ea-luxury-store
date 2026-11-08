(() => {
  const SUPABASE_URL = "https://jezqohivdiziuzfmllvq.supabase.co";
  const SUPABASE_KEY = "sb_publishable_hrP0-e5_ou1HHeZKpCu8jw_ORY_-zdh";
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
  const sortInput = document.getElementById("collectionSort");
  const minInput = document.getElementById("collectionMinPrice");
  const maxInput = document.getElementById("collectionMaxPrice");
  const sizeInput = document.getElementById("collectionSize");
  const colorInput = document.getElementById("collectionColor");
  const availableInput = document.getElementById("collectionAvailable");
  const countOutput = document.getElementById("collectionResultsCount");
  let categoryProducts = [];
  let productVariants = [];
  let currentBrand = "";
  let aedToEgpRate = 14.67;
  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, ch => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]));
  const normalize = value => String(value || "").normalize("NFKC").toLocaleLowerCase("ar").replace(/[\u064B-\u065F\u0670]/g,"").replace(/[أإآٱ]/g,"ا").replace(/ى/g,"ي").replace(/ة/g,"ه").replace(/[^\p{L}\p{N}\s]/gu," ").replace(/\s+/g," ").trim();
  const imagesOf = product => {
    let source = product.image_urls;
    if (typeof source === "string") { try { source = JSON.parse(source); } catch (_) { source = [source]; } }
    const images = Array.isArray(source) ? source.filter(v => typeof v === "string" && v.trim()) : [];
    if (product.image_url && typeof product.image_url === "string" && product.image_url.trim()) images.push(product.image_url.trim());
    return [...new Set(images)].slice(0,5);
  };
  const priceEgp = product => {
    const price = Number(product.sale_price > 0 && product.sale_price < product.price ? product.sale_price : product.price || 0);
    return product.currency === "AED" ? price * aedToEgpRate : price;
  };
  const money = product => {
    const amount = Number(product.sale_price > 0 && product.sale_price < product.price ? product.sale_price : product.price || 0);
    return amount.toLocaleString("ar-EG") + (product.currency === "AED" ? " درهم" : " جنيه");
  };
  function variantsFor(product) { return productVariants.filter(v => String(v.product_id) === String(product.id)); }
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
    }).join("") || '<p class="collection-empty">لا توجد منتجات مطابقة للتصفية الحالية.</p>';
  }
  function fillVariantOptions() {
    const base = currentBrand ? categoryProducts.filter(p => (String(p.brand || "").trim() || "ماركات أخرى") === currentBrand) : categoryProducts;
    const ids = new Set(base.map(p => String(p.id)));
    const variants = productVariants.filter(v => ids.has(String(v.product_id)));
    const sizes = [...new Set(variants.map(v => String(v.size || "").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar",{numeric:true}));
    const colors = [...new Set(variants.map(v => String(v.color || "").trim()).filter(Boolean))].sort((a,b)=>a.localeCompare(b,"ar"));
    if (sizeInput) sizeInput.innerHTML = '<option value="">كل المقاسات</option>' + sizes.map(v=>'<option value="'+escapeHTML(v)+'">'+escapeHTML(v)+'</option>').join("");
    if (colorInput) colorInput.innerHTML = '<option value="">كل الألوان</option>' + colors.map(v=>'<option value="'+escapeHTML(v)+'">'+escapeHTML(v)+'</option>').join("");
  }
  function filteredProducts() {
    let items = currentBrand ? categoryProducts.filter(p => (String(p.brand || "").trim() || "ماركات أخرى") === currentBrand) : [...categoryProducts];
    const terms = normalize(searchInput?.value || "").split(/\s+/).filter(Boolean);
    if (terms.length) items = items.filter(p => {
      const text = normalize([p.name,p.description,p.brand,p.category,p.sku,p.code,p.color,p.size,...variantsFor(p).flatMap(v=>[v.size,v.color])].join(" "));
      return terms.every(term=>text.includes(term));
    });
    const min = minInput?.value === "" ? null : Number(minInput.value);
    const max = maxInput?.value === "" ? null : Number(maxInput.value);
    if (min !== null && Number.isFinite(min)) items = items.filter(p=>priceEgp(p)>=min);
    if (max !== null && Number.isFinite(max)) items = items.filter(p=>priceEgp(p)<=max);
    const size = sizeInput?.value || "", color = colorInput?.value || "";
    if (size || color) items = items.filter(p => {
      const variants = variantsFor(p);
      if (variants.length) return variants.some(v=>(!size || String(v.size||"").trim()===size)&&(!color || String(v.color||"").trim()===color)&&Number(v.stock)>0);
      const sizes = Array.isArray(p.sizes) ? p.sizes.map(String) : [String(p.size||"")];
      const colors = Array.isArray(p.colors) ? p.colors.map(String) : [String(p.color||"")];
      return (!size || sizes.includes(size)) && (!color || colors.includes(color));
    });
    if (availableInput?.checked) items = items.filter(p => {
      const variants = variantsFor(p);
      return variants.length ? variants.some(v=>Number(v.stock)>0) : Number(p.stock||0)>0;
    });
    const sort = sortInput?.value || "default";
    if (sort === "newest") items.sort((a,b)=>new Date(b.created_at||0)-new Date(a.created_at||0));
    if (sort === "price-asc") items.sort((a,b)=>priceEgp(a)-priceEgp(b));
    if (sort === "price-desc") items.sort((a,b)=>priceEgp(b)-priceEgp(a));
    return items;
  }
  function renderFilteredProducts() {
    const items = filteredProducts();
    productGrid.innerHTML = renderProductCards(items,currentBrand);
    if (countOutput) countOutput.textContent = "عرض " + items.length.toLocaleString("ar-EG") + " من " + (currentBrand ? categoryProducts.filter(p=>(String(p.brand||"").trim()||"ماركات أخرى")===currentBrand).length : categoryProducts.length).toLocaleString("ar-EG") + " منتج";
  }
  function showProductList() {
    brandGrid.hidden = true;
    productGrid.hidden = false;
    filters.hidden = false;
    backButton.hidden = category === "ملابس حريمي";
    fillVariantOptions();
    title.textContent = currentBrand || "ملابس حريمي";
    const count = currentBrand ? categoryProducts.filter(p=>(String(p.brand||"").trim()||"ماركات أخرى")===currentBrand).length : categoryProducts.length;
    subtitle.textContent = currentBrand ? "منتجات " + currentBrand + " — " + count.toLocaleString("ar-EG") + " منتج" : count.toLocaleString("ar-EG") + " منتج متاح — اختاري المنتج المناسب لك";
    renderFilteredProducts();
    window.scrollTo({top:0,behavior:"smooth"});
  }
  function showBrands() {
    currentBrand = "";
    brandGrid.hidden = false;
    productGrid.hidden = true;
    filters.hidden = true;
    backButton.hidden = true;
    title.textContent = "ماركات الأحذية";
    subtitle.textContent = "اختار الماركة وشوف كل المنتجات المتاحة منها";
  }
  function showBrandProducts(brand) {
    currentBrand = brand;
    if (searchInput) searchInput.value = "";
    if (minInput) minInput.value = "";
    if (maxInput) maxInput.value = "";
    if (sizeInput) sizeInput.value = "";
    if (colorInput) colorInput.value = "";
    if (availableInput) availableInput.checked = false;
    if (sortInput) sortInput.value = "default";
    showProductList();
  }
  backButton.addEventListener("click", showBrands);
  brandGrid.addEventListener("click", event => {
    const card = event.target.closest("[data-brand]");
    if (card) showBrandProducts(card.dataset.brand);
  });
  [searchInput,minInput,maxInput,sizeInput,colorInput,availableInput,sortInput].forEach(el=>el?.addEventListener("input",renderFilteredProducts));
  [sizeInput,colorInput,sortInput].forEach(el=>el?.addEventListener("change",renderFilteredProducts));
  document.getElementById("collectionClearFilters")?.addEventListener("click",()=>{
    if(searchInput) searchInput.value="";
    if(minInput) minInput.value="";
    if(maxInput) maxInput.value="";
    if(sizeInput) sizeInput.value="";
    if(colorInput) colorInput.value="";
    if(availableInput) availableInput.checked=false;
    if(sortInput) sortInput.value="default";
    renderFilteredProducts();
  });
  async function init() {
    if (!allowed.includes(category)) {
      title.textContent = "القسم غير متاح";
      brandGrid.innerHTML = '<p class="collection-empty">القسم المطلوب غير متاح.</p>';
      return;
    }
    title.textContent = "جاري تحميل القسم...";
    const [productsResult,variantsResult,settingsResult] = await Promise.all([
      db.from("products").select("*").eq("active",true).eq("category",category).order("created_at",{ascending:false}),
      db.from("product_variants").select("id,product_id,size,color,stock,is_active").eq("is_active",true),
      db.from("store_settings").select("settings").eq("id",1).maybeSingle()
    ]);
    if (productsResult.error) {
      brandGrid.innerHTML = '<p class="collection-empty">تعذر تحميل المنتجات. حاول مرة أخرى.</p>';
      console.error(productsResult.error);
      return;
    }
    categoryProducts = productsResult.data || [];
    productVariants = variantsResult.error ? [] : (variantsResult.data || []);
    if (settingsResult.data?.settings?.aedToEgpRate && Number(settingsResult.data.settings.aedToEgpRate)>0) aedToEgpRate=Number(settingsResult.data.settings.aedToEgpRate);
    if (variantsResult.error) console.warn("تعذر تحميل خيارات المقاسات والألوان:",variantsResult.error);
    if (category === "ملابس حريمي") {
      showProductList();
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