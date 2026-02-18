// mobile-menu.js
(function () {
  function setupMobileMenu() {
    const header      = document.getElementById("mobile-header");
    const mobileBtn   = document.getElementById("mobile-menu-btn");
    const mobileAnim  = document.getElementById("mobile-menu-anim");
    const artistsBtn  = document.getElementById("artists-toggle");
    const artistsAnim = document.getElementById("artists-anim");

    if (!header || !mobileBtn || !mobileAnim || !artistsBtn || !artistsAnim) return;
    if (mobileBtn.dataset.mmBound === "1") return;
    mobileBtn.dataset.mmBound = "1";
    artistsBtn.dataset.mmBound = "1";

    const mobileIcon = mobileBtn.querySelector("svg");
    const artistIcon = artistsBtn.querySelector("svg");

    const isExpanded = (btn) => btn.getAttribute("aria-expanded") === "true";

    const getTransitionMs = (el) => {
      const cs = getComputedStyle(el);
      const toMs = (s) =>
        s.split(",").map((x) => x.trim()).map((x) => (x.endsWith("ms") ? parseFloat(x) : parseFloat(x) * 1000)).filter((n) => !Number.isNaN(n));
      const maxDur = Math.max(0, ...(toMs(cs.transitionDuration) || [0]));
      const maxDel = Math.max(0, ...(toMs(cs.transitionDelay) || [0]));
      return maxDur + maxDel + 50;
    };

    const lock = (btn, panel) => {
      btn.disabled = true;
      btn.style.pointerEvents = "none";
      panel.style.pointerEvents = "none";
      panel.dataset.animating = "1";
    };

    const unlock = (btn, panel) => {
      delete panel.dataset.animating;
      btn.disabled = false;
      btn.style.pointerEvents = "";
      panel.style.pointerEvents = "";
    };

    const expand = (panel) => {
      const cs = getComputedStyle(panel);
      if (cs.height === "auto" || panel.style.height === "auto") {
        panel.style.height = panel.scrollHeight + "px";
        void panel.offsetHeight;
      }
      panel.style.height = panel.scrollHeight + "px";
      const onEnd = (e) => {
        if (e.propertyName !== "height") return;
        panel.style.height = "auto";
        panel.removeEventListener("transitionend", onEnd);
      };
      panel.addEventListener("transitionend", onEnd, { once: true });
    };

    const collapse = (panel) => {
      const cs = getComputedStyle(panel);
      if (cs.height === "auto" || panel.style.height === "auto") {
        panel.style.height = panel.scrollHeight + "px";
        void panel.offsetHeight;
      }
      panel.style.height = "0px";
    };

    const snapClosed = (panel) => {
      const prev = panel.style.transition;
      panel.style.transition = "none";
      if (getComputedStyle(panel).height === "auto" || panel.style.height === "auto") {
        panel.style.height = panel.scrollHeight + "px";
        void panel.offsetHeight;
      }
      panel.style.height = "0px";
      void panel.offsetHeight;
      panel.style.transition = prev;
    };

    const setExpanded = (btn, panel, expanded, icon) => {
      if (panel.dataset.animating === "1") return;
      btn.setAttribute("aria-expanded", expanded ? "true" : "false");
      if (icon) icon.classList.toggle("rotate-180", expanded);

      lock(btn, panel);
      const totalMs = getTransitionMs(panel);
      let ended = false;
      const finish = () => {
        if (ended) return;
        ended = true;
        unlock(btn, panel);
      };
      const onEnd = (e) => {
        if (e.propertyName !== "height") return;
        panel.removeEventListener("transitionend", onEnd);
        finish();
      };
      panel.addEventListener("transitionend", onEnd);

      const fallback = setTimeout(() => {
        panel.removeEventListener("transitionend", onEnd);
        finish();
      }, totalMs);
      const clearFallback = () => {
        clearTimeout(fallback);
        panel.removeEventListener("transitionend", clearFallback);
      };
      panel.addEventListener("transitionend", clearFallback);

      expanded ? expand(panel) : collapse(panel);
    };

    // Ensure consistent initial state
    setExpanded(mobileBtn, mobileAnim, false, mobileIcon);
    setExpanded(artistsBtn, artistsAnim, false, artistIcon);

    // Close both menus (used by outside click / ESC)
    const closeAll = () => {
      // if already closed, do nothing
      if (!isExpanded(mobileBtn) && !isExpanded(artistsBtn)) return;

      // First snap-close artists (and update its state)
      artistsBtn.setAttribute("aria-expanded", "false");
      if (artistIcon) artistIcon.classList.toggle("rotate-180", false);
      snapClosed(artistsAnim);

      // Then smoothly collapse outer
      setExpanded(mobileBtn, mobileAnim, false, mobileIcon);
    };

    // --- interactions
    mobileBtn.addEventListener("click", () => {
      const open = !isExpanded(mobileBtn);
      if (!open) {
        // closing outer => ensure artists is closed first
        artistsBtn.setAttribute("aria-expanded", "false");
        if (artistIcon) artistIcon.classList.toggle("rotate-180", false);
        snapClosed(artistsAnim);
      }
      setExpanded(mobileBtn, mobileAnim, open, mobileIcon);
    });

    artistsBtn.addEventListener("click", () => {
      if (mobileAnim.dataset.animating === "1") return;
      const open = !isExpanded(artistsBtn);
      setExpanded(artistsBtn, artistsAnim, open, artistIcon);
    });

    // --- close on outside click/touch ---------------------------------------
    if (!header.dataset.mmOutsideBound) {
      header.dataset.mmOutsideBound = "1";

      // Use pointerdown for immediate response on touch + mouse.
      document.addEventListener(
        "pointerdown",
        (e) => {
          // Ignore if click is inside the header (menus/buttons/links)
          if (header.contains(e.target)) return;

          // Also ignore while outer is animating (avoids races)
          if (mobileAnim.dataset.animating === "1") return;

          closeAll();
        },
        { passive: true }
      );

      // Optional: close on Escape key for accessibility
      document.addEventListener("keydown", (e) => {
        if (e.key === "Escape") closeAll();
      });
    }
  }

  // First load
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", setupMobileMenu, { once: true });
  } else {
    setupMobileMenu();
  }

  // Astro client-side navigations
  document.addEventListener("astro:page-load", setupMobileMenu);
  document.addEventListener("astro:after-swap", setupMobileMenu);

  // bfcache restores
  window.addEventListener("pageshow", (e) => {
    if (e.persisted) setupMobileMenu();
  });
})();
