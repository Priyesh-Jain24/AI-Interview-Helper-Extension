const micBtn = document.getElementById("micBtn");
const askBtn = document.getElementById("askAI");
const questionInput = document.getElementById("question");
const responseDiv = document.getElementById("response");
const typeSelect = document.getElementById("typeSelector");
// 1. Get the new Side Panel button
const openSidePanelBtn = document.getElementById("openSidePanelBtn"); 

let recognition;

/* ======================
   ◳ SWITCH TO SIDE PANEL (FIXED)
====================== */
if (openSidePanelBtn) {
  openSidePanelBtn.addEventListener("click", () => {
    // 1. Get the current window ID
    // We rename the argument to 'currentWindow' to avoid conflict!
    chrome.windows.getCurrent((currentWindow) => {
      
      // 2. Send the Window ID to the background script
      chrome.runtime.sendMessage({ 
        action: "openSidePanel", 
        windowId: currentWindow.id 
      });

      // 3. Close the popup
      window.close(); 
    });
  });
}

/* ======================
   👂 CAPTION LISTENER
====================== */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "newCaption") {
    // Only update if the user isn't currently typing manually
    // This prevents the AI from overwriting what you are typing
    if (document.activeElement !== questionInput) {
      questionInput.value = message.text;
    }
  }
});

/* ======================
   🎤 SPEECH TO TEXT
====================== */
micBtn.addEventListener("click", () => {
  if (!("webkitSpeechRecognition" in window)) {
    alert("Speech Recognition not supported");
    return;
  }

  recognition = new webkitSpeechRecognition();
  recognition.lang = "en-US";
  recognition.continuous = false;
  recognition.interimResults = false;

  micBtn.innerText = "🎙️ Listening...";

  recognition.onresult = (event) => {
    questionInput.value = event.results[0][0].transcript;
    micBtn.innerText = "🎤 Speak Question";
  };

  recognition.onerror = (event) => {
    console.error("Speech recognition error", event.error);
    micBtn.innerText = "🎤 Speak Question";
  };

  recognition.start();
});

/* ======================
   🤖 GEMINI CALL
====================== */
async function askAI(question) {
  responseDiv.innerHTML = "<em>Thinking...</em>";

  // 2. Capture the selected type (default to behavioral if not found)
  const selectedType = typeSelect ? typeSelect.value : "behavioral";

  try {
    const res = await fetch("http://localhost:3000/api/ai/ask", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // 3. Send both question AND type to backend
      body: JSON.stringify({ 
        question: question,
        type: selectedType 
      })
    });

    const data = await res.json();
    handleResponse(data);

  } catch (err) {
    console.error(err);
    responseDiv.innerText = "❌ Error getting response";
  }
}

/* ======================
   🧠 RESPONSE HANDLER
====================== */
function handleResponse(data) {
  // ---- DSA ----
  if (data.type === "dsa" && data.explanation) {
    return renderDSA(data);
  }

  // ---- SQL ----
  if (data.type === "sql" && data.query) {
    return renderSQL(data);
  }

  // ---- BEHAVIORAL ----
  if (data.structured) {
    return renderBehavioral(data.structured);
  }

  // ---- TECH / FALLBACK ----
  if (data.answer) {
    // 🔥 FIX: Use marked.parse to render Markdown as HTML
    // This requires marked.min.js to be loaded in your HTML
    responseDiv.innerHTML = marked.parse(data.answer);
    return;
  }

  // ---- RAW FALLBACK ----
  responseDiv.innerText = data.rawAnswer || "No response from AI";
}

/* ======================
   📘 BEHAVIORAL (STAR)
====================== */
function renderBehavioral(star) {
  responseDiv.innerHTML = `
    <h4>Situation</h4><p>${star.situation}</p>
    <h4>Task</h4><p>${star.task}</p>
    <h4>Action</h4><p>${star.action}</p>
    <h4>Result</h4><p>${star.result}</p>
  `;
}

/* ======================
   💻 DSA
====================== */
function renderDSA(data) {
  responseDiv.innerHTML = `
    <h4>Approach</h4>
    <p>${data.explanation.approach}</p>

    <h4>Algorithm</h4>
    <ol>
      ${data.explanation.algorithm.map(step => `<li>${step}</li>`).join("")}
    </ol>

    <h4>Edge Cases</h4>
    <ul>
      ${data.explanation.edgeCases.map(e => `<li>${e}</li>`).join("")}
    </ul>

    <h4>Code (${data.code.language})</h4>
    <pre><code>${escapeHTML(data.code.content)}</code></pre>

    <h4>Complexity</h4>
    <p><b>Time:</b> ${data.complexity.time}</p>
    <p><b>Space:</b> ${data.complexity.space}</p>
  `;
}

/* ======================
   🧾 SQL
====================== */
function renderSQL(data) {
  responseDiv.innerHTML = `
    <h4>SQL Query</h4>
    <pre><code>${escapeHTML(data.query)}</code></pre>

    <h4>Explanation</h4>
    <p>${data.explanation}</p>

    <h4>Complexity</h4>
    <p>${data.complexity}</p>
  `;
}

/* ======================
   🔒 UTILS
====================== */
function escapeHTML(str) {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/* ======================
   🖱️ MANUAL BUTTON
====================== */
askBtn.addEventListener("click", () => {
  const question = questionInput.value.trim();
  if (!question) return alert("Please enter a question");
  askAI(question);
});