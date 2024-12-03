// --- function ----------------------------------------------------------------
let initNicoVideoObserver = null;
// -----------------------------------------------------------------------------

{
  let nicoVideoObserver = null;
  let currentNicoVideoElement = null;

  initNicoVideoObserver = function (_r5Element) {
    const r5Element = _r5Element;
    if (r5Element === null) {
      console.error("[Error] R5 element is null.");
      return;
    }

    if (r5Element === currentNicoVideoElement) return;
    currentNicoVideoElement = r5Element;

    if (nicoVideoObserver) nicoVideoObserver.disconnect();

    nicoVideoObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
          console.debug("Detected nico video element changed.");
          window.dispatchEvent(new CustomEvent(nicoVideoElementChangedEventName, {}));
        }
      });
    });

    nicoVideoObserver.observe(r5Element, {
      childList: true,
      attributes: false,
      subtree: false
    });
  }
}
