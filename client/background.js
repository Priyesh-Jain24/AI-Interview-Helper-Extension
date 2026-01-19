// background.js

// 1. FORCE disable the "Open on Click" behavior
// This ensures the Popup opens by default, not the Side Panel
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: false })
  .catch((error) => console.error("Error setting panel behavior:", error));

// 2. Listen for the "Open Side Panel" message
chrome.runtime.onMessage.addListener((message, sender) => {
  if (message.action === "openSidePanel") {
    
    // PRIORITY: Use the windowId sent from the Popup
    // FALLBACK: Use sender.tab.windowId (if sent from a content script)
    const targetWindowId = message.windowId || (sender.tab ? sender.tab.windowId : null);

    if (targetWindowId) {
      chrome.sidePanel.open({ windowId: targetWindowId })
        .catch((err) => console.error("Failed to open panel:", err));
    } else {
      console.error("Could not determine window ID to open side panel.");
    }
  }
});