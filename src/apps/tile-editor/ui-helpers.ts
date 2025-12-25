export function setupValuesToggle(
  toggleBtn: HTMLElement | null,
  valuesDisplay: HTMLElement | null,
  onResize: () => void
): void {
  if (!toggleBtn || !valuesDisplay) return;
  toggleBtn.onclick = () => {
    valuesDisplay.classList.toggle("collapsed");
    toggleBtn.classList.toggle("collapsed");

    // Force resize after transition
    setTimeout(() => {
      onResize();
    }, 350); // Slightly longer than CSS transition
  };
}
