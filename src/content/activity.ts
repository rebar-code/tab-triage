// Tells the worker the visible page changed, so its preview stays current.
let timer: ReturnType<typeof setTimeout> | undefined;

function changed(delay: number): void {
  clearTimeout(timer);
  timer = setTimeout(() => {
    chrome.runtime.sendMessage({ type: 'capture' }).catch(() => {});
  }, delay);
}

document.addEventListener('scrollend', () => changed(150), { capture: true, passive: true });
document.addEventListener('click', () => changed(800), { capture: true, passive: true });
