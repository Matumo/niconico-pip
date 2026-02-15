document.addEventListener("DOMContentLoaded", () => {
  const title = chrome.i18n.getMessage("popupTitle") || "Niconico Video Picture-in-Picture with Comments";
  const description = chrome.i18n.getMessage("popupDescription") || "Phase 1 core platform framework is active.";

  document.title = title;

  const titleElement = document.getElementById("title");
  const descriptionElement = document.getElementById("description");

  if (titleElement) {
    titleElement.textContent = title;
  }

  if (descriptionElement) {
    descriptionElement.textContent = description;
  }
});
