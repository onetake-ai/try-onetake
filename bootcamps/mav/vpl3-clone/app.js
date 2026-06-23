/* ============================================================
   MAV VPL3 — Page interactivity
   Bonus modal, Hyvor Talk integration, keyboard handling
   ============================================================ */

/* ---------- Bonus Modal ---------- */
function openBonusModal(email) {
  var modal = document.getElementById("bonusModal");
  var btn = document.getElementById("modalBtn");
  var url = "https://contraband.onetake.ai/mav/plan/";
  if (email) url += "?email=" + encodeURIComponent(email);
  btn.href = url;
  modal.hidden = false;
  document.body.style.overflow = "hidden";
}

function closeBonusModal() {
  document.getElementById("bonusModal").hidden = true;
  document.body.style.overflow = "";
}

// Close on backdrop click
document.addEventListener("click", function (e) {
  if (e.target.id === "bonusModal") closeBonusModal();
});
// Close on Escape
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") closeBonusModal();
});

/* ---------- Hyvor Talk ---------- */
document.addEventListener("DOMContentLoaded", function () {
  var section = document.getElementById("comments");
  var ht = section ? section.querySelector("hyvor-talk-comments") : null;
  if (!ht) return;

  customElements.whenDefined("hyvor-talk-comments").then(function () {
    // Lazy-load when visible
    if ("IntersectionObserver" in window) {
      var obs = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (e) {
            if (e.isIntersecting) {
              ht.load();
              obs.disconnect();
            }
          });
        },
        { rootMargin: "300px" }
      );
      obs.observe(section);
    } else {
      ht.load();
    }
  });

  // Show bonus modal when a comment is published
  ht.addEventListener("comment:published", function (ev) {
    var email = "";
    try { email = ev.detail.user.email; } catch (_) {}
    openBonusModal(email);
  });
});
