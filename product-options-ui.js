(function () {
  const root = document.getElementById("productDetails");
  if (!root) return;

  function fireChange(select) {
    select.dispatchEvent(new Event("change", { bubbles: true }));
  }

  function isCombinationAvailable(sizeSelect, colorSelect, sizeValue, colorValue) {
    const oldSize = sizeSelect ? sizeSelect.value : "";
    const oldColor = colorSelect ? colorSelect.value : "";
    if (sizeSelect) sizeSelect.value = sizeValue || "";
    if (colorSelect) colorSelect.value = colorValue || "";
    if (sizeSelect) fireChange(sizeSelect);
    else if (colorSelect) fireChange(colorSelect);
    const hint = root.querySelector("#detailVariantHint");
    const available = !!hint && /المتاح من اختيارك|متاح [0-9٠-٩]+ قطعة/.test(hint.textContent);
    if (sizeSelect) sizeSelect.value = oldSize;
    if (colorSelect) colorSelect.value = oldColor;
    if (sizeSelect) fireChange(sizeSelect);
    else if (colorSelect) fireChange(colorSelect);
    return available;
  }

  function enhanceSelect(id, otherId, type) {
    const select = root.querySelector("#" + id);
    if (!select || select.dataset.chipsEnhanced === "true") return;
    const other = root.querySelector("#" + otherId);
    const values = Array.from(select.options).filter(option => option.value);
    if (!values.length) return;

    select.dataset.chipsEnhanced = "true";
    select.classList.add("detail-native-option-select");
    const group = document.createElement("div");
    group.className = "detail-option-chip-group";
    group.setAttribute("role", "group");
    group.setAttribute("aria-label", type === "size" ? "اختيار المقاس" : "اختيار اللون");

    values.forEach(option => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "detail-option-chip";
      button.textContent = option.textContent;
      button.dataset.optionValue = option.value;

      const combinations = other
        ? Array.from(other.options).filter(item => item.value).map(item => type === "size"
          ? [option.value, item.value]
          : [item.value, option.value])
        : [[type === "size" ? option.value : "", type === "color" ? option.value : ""]];
      const available = combinations.some(([size, color]) =>
        isCombinationAvailable(
          type === "size" ? select : other,
          type === "color" ? select : other,
          size,
          color
        )
      );
      button.disabled = !available;
      if (!available) {
        button.classList.add("unavailable");
        button.title = "نفد هذا الاختيار";
      }

      button.addEventListener("click", () => {
        if (button.disabled) return;
        select.value = option.value;
        fireChange(select);
        updateSelected();
      });
      group.appendChild(button);
    });

    select.insertAdjacentElement("afterend", group);
    select.setAttribute("aria-hidden", "true");
    select.tabIndex = -1;

    function updateSelected() {
      group.querySelectorAll("button").forEach(button => {
        const selected = button.dataset.optionValue === select.value;
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    }
    select.addEventListener("change", updateSelected);
    updateSelected();
  }

  function enhance() {
    enhanceSelect("detailSizeSelect", "detailColorSelect", "size");
    enhanceSelect("detailColorSelect", "detailSizeSelect", "color");
  }

  const observer = new MutationObserver(enhance);
  observer.observe(root, { childList: true, subtree: true });
  enhance();
})();