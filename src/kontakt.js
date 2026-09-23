// Kontaktformular: schickt die Felder an /api/kontakt und zeigt die Antwort an.
// Ohne JavaScript bleibt das Formular ein normales POST-Formular (der Worker
// antwortet dann mit einer schlichten Dankeseite).
(function () {
  const form = document.getElementById("kontaktform");
  if (!form) return;
  const note = document.getElementById("k-note");
  const button = form.querySelector("button.send");

  form.addEventListener("submit", async (e) => {
    if (!form.reportValidity()) return;
    e.preventDefault();
    note.className = "formnote";
    note.textContent = "Wird gesendet …";
    button.disabled = true;

    try {
      const res = await fetch("/api/kontakt", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify(Object.fromEntries(new FormData(form).entries())),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        form.reset();
        note.className = "formnote ok";
        note.textContent = "Danke — die Nachricht ist unterwegs. Ich melde mich.";
      } else {
        note.className = "formnote err";
        note.textContent =
          data.error || "Das hat leider nicht geklappt. Schreib mir bitte direkt per E-Mail.";
      }
    } catch {
      note.className = "formnote err";
      note.textContent = "Keine Verbindung. Schreib mir bitte direkt per E-Mail.";
    } finally {
      button.disabled = false;
    }
  });
})();
