/* ==========================================
   FEATURE 1: MANUAL HIGHLIGHT (Any Website)
   Select text to save it as the "Last Question"
========================================== */
document.addEventListener("mouseup", () => {
  const selected = window.getSelection().toString().trim();
  
  if (selected.length > 5) { // Lowered limit slightly to catch short questions
    chrome.storage.local.set({ lastQuestion: selected });
    console.log("Saved selection:", selected);
  }
});


/* ==========================================
   FEATURE 2: GOOGLE MEET CAPTIONS (The "Pro" Way)
   Auto-detects speech in Google Meet captions
========================================== */
if (window.location.hostname === "meet.google.com") {
  startMeetingScraper();
}

function startMeetingScraper() {
  // This class (.a4cQT) is the standard container for Google Meet captions
  // Note: Google changes this sometimes. If it breaks, inspect the caption box to find the new class.
  const CAPTION_SELECTOR = '.a4cQT'; 

  console.log("AI Interview Helper: Google Meet detected. Waiting for captions...");

  const observer = new MutationObserver((mutations) => {
    const captionDiv = document.querySelector(CAPTION_SELECTOR);
    
    // If captions are visible and have text
    if (captionDiv && captionDiv.innerText) {
      const text = captionDiv.innerText;
      
      // Send the text directly to the Popup (if it's open)
      chrome.runtime.sendMessage({
        action: "newCaption",
        text: text
      });
    }
  });

  // Start watching the page body for changes
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}