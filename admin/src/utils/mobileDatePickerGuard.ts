const DATE_INPUT_SELECTOR = '.el-date-editor input';
const GUARDED_ATTRIBUTE = 'data-mobile-date-picker-guard';
const ORIGINAL_READONLY_ATTRIBUTE = 'data-mobile-date-picker-original-readonly';
const ORIGINAL_INPUT_MODE_ATTRIBUTE = 'data-mobile-date-picker-original-inputmode';

function dateInputs(root: ParentNode | Element): HTMLInputElement[] {
  const items: HTMLInputElement[] = [];
  if (root instanceof HTMLInputElement && root.matches(DATE_INPUT_SELECTOR)) items.push(root);
  root.querySelectorAll<HTMLInputElement>(DATE_INPUT_SELECTOR).forEach((input) => items.push(input));
  return items;
}

function guard(input: HTMLInputElement) {
  if (!input.hasAttribute(GUARDED_ATTRIBUTE)) {
    input.setAttribute(ORIGINAL_READONLY_ATTRIBUTE, input.readOnly ? 'true' : 'false');
    input.setAttribute(ORIGINAL_INPUT_MODE_ATTRIBUTE, input.getAttribute('inputmode') || '');
    input.setAttribute(GUARDED_ATTRIBUTE, 'true');
  }
  if (!input.readOnly) input.readOnly = true;
  if (input.getAttribute('inputmode') !== 'none') input.setAttribute('inputmode', 'none');
}

function restore(input: HTMLInputElement) {
  if (!input.hasAttribute(GUARDED_ATTRIBUTE)) return;
  input.readOnly = input.getAttribute(ORIGINAL_READONLY_ATTRIBUTE) === 'true';
  const inputMode = input.getAttribute(ORIGINAL_INPUT_MODE_ATTRIBUTE) || '';
  if (inputMode) input.setAttribute('inputmode', inputMode);
  else input.removeAttribute('inputmode');
  input.removeAttribute(GUARDED_ATTRIBUTE);
  input.removeAttribute(ORIGINAL_READONLY_ATTRIBUTE);
  input.removeAttribute(ORIGINAL_INPUT_MODE_ATTRIBUTE);
}

export function installMobileDatePickerGuard() {
  if (typeof window === 'undefined' || typeof document === 'undefined') return () => undefined;
  const mobileQuery = window.matchMedia('(max-width: 768px), (pointer: coarse)');
  const apply = (root: ParentNode | Element = document) => dateInputs(root).forEach(mobileQuery.matches ? guard : restore);
  const protectBeforeFocus = (event: Event) => {
    if (!mobileQuery.matches || !(event.target instanceof HTMLInputElement) || !event.target.matches(DATE_INPUT_SELECTOR)) return;
    guard(event.target);
  };
  const observer = new MutationObserver((mutations) => {
    if (!mobileQuery.matches) return;
    mutations.forEach((mutation) => {
      if (mutation.type === 'attributes' && mutation.target instanceof HTMLInputElement && mutation.target.matches(DATE_INPUT_SELECTOR)) guard(mutation.target);
      mutation.addedNodes.forEach((node) => { if (node instanceof Element) apply(node); });
    });
  });
  const onMediaChange = () => apply(document);

  apply(document);
  observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['readonly', 'inputmode'] });
  document.addEventListener('pointerdown', protectBeforeFocus, true);
  document.addEventListener('touchstart', protectBeforeFocus, true);
  document.addEventListener('focusin', protectBeforeFocus, true);
  mobileQuery.addEventListener?.('change', onMediaChange);

  return () => {
    observer.disconnect();
    document.removeEventListener('pointerdown', protectBeforeFocus, true);
    document.removeEventListener('touchstart', protectBeforeFocus, true);
    document.removeEventListener('focusin', protectBeforeFocus, true);
    mobileQuery.removeEventListener?.('change', onMediaChange);
    dateInputs(document).forEach(restore);
  };
}
