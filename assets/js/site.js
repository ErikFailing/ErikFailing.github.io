// Site behavior moved out of PaperMod's inline <script> blocks (themes/PaperMod/layouts/_partials/footer.html)
// so the Content-Security-Policy can use script-src 'self' with no inline scripts allowed.
// Loaded once at the end of <body> by layouts/_partials/footer.html. Options arrive as data-* attributes
// on the script tag. When updating PaperMod, diff its footer.html scripts against this file.
(function () {
    const config = document.currentScript ? document.currentScript.dataset : {};

    // Menu: restore horizontal scroll position, and save it once scrolling settles.
    const menu = document.getElementById("menu");
    if (menu) {
        const scrollPosition = localStorage.getItem("menu-scroll-position");
        if (scrollPosition) {
            menu.scrollLeft = parseInt(scrollPosition, 10);
        }
        let menuScrollTimeout;
        menu.addEventListener("scroll", function () {
            clearTimeout(menuScrollTimeout);
            menuScrollTimeout = setTimeout(function () {
                localStorage.setItem("menu-scroll-position", menu.scrollLeft);
            }, 150);
        }, { passive: true });
    }

    // In-page anchors: smooth scroll (unless reduced motion is preferred) and move focus like native navigation.
    document.querySelectorAll('a[href^="#"]').forEach(function (anchor) {
        anchor.addEventListener("click", function (e) {
            const id = this.getAttribute("href").substring(1);
            const target = document.querySelector(`[id='${decodeURIComponent(id)}']`);
            if (!target) {
                return;
            }
            e.preventDefault();
            if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
                target.scrollIntoView({ behavior: "smooth" });
            } else {
                target.scrollIntoView();
            }
            if (target.tabIndex < 0 && !target.hasAttribute("tabindex")) {
                target.setAttribute("tabindex", "-1");
            }
            target.focus({ preventScroll: true });
            if (id === "top") {
                history.replaceState(null, null, " ");
            } else {
                history.pushState(null, null, `#${id}`);
            }
        });
    });

    // Scroll-to-top button: show after scrolling one screen, checking at most once per frame.
    const toplink = document.getElementById("top-link");
    if (toplink) {
        let scrollTicking = false;
        window.addEventListener("scroll", function () {
            if (scrollTicking) {
                return;
            }
            scrollTicking = true;
            requestAnimationFrame(function () {
                const scrollThreshold = window.innerHeight;
                const shown = document.body.scrollTop > scrollThreshold || document.documentElement.scrollTop > scrollThreshold;
                toplink.classList.toggle("hidden", !shown);
                scrollTicking = false;
            });
        }, { passive: true });
    }

    // Theme toggle: only present if disableThemeToggle is turned off in hugo.toml.
    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle) {
        themeToggle.addEventListener("click", function () {
            const html = document.querySelector("html");
            const next = html.dataset.theme === "dark" ? "light" : "dark";
            html.dataset.theme = next;
            localStorage.setItem("pref-theme", next);
        });
    }

    // Copy buttons on code blocks (post pages only; the footer sets data-copy-code).
    if (config.copyCode === "true") {
        const copyLabel = config.copyLabel || "copy";
        const copiedLabel = config.copiedLabel || "copied!";
        document.querySelectorAll("pre > code").forEach(function (codeblock) {
            const container = codeblock.parentNode.parentNode;

            const copybutton = document.createElement("button");
            copybutton.classList.add("copy-code");
            copybutton.textContent = copyLabel;

            function copyingDone() {
                copybutton.textContent = copiedLabel;
                setTimeout(function () {
                    copybutton.textContent = copyLabel;
                }, 2000);
            }

            copybutton.addEventListener("click", function () {
                if ("clipboard" in navigator) {
                    navigator.clipboard.writeText(codeblock.textContent);
                    copyingDone();
                    return;
                }
                const range = document.createRange();
                range.selectNodeContents(codeblock);
                const selection = window.getSelection();
                selection.removeAllRanges();
                selection.addRange(range);
                try {
                    document.execCommand("copy");
                    copyingDone();
                } catch (e) { }
                selection.removeRange(range);
            });

            if (container.classList.contains("highlight")) {
                container.appendChild(copybutton);
            } else if (container.parentNode.firstChild == container) {
                // td containing LineNos
            } else if (codeblock.parentNode.parentNode.parentNode.parentNode.parentNode.nodeName == "TABLE") {
                // table containing LineNos and code
                codeblock.parentNode.parentNode.parentNode.parentNode.parentNode.appendChild(copybutton);
            } else {
                // code blocks not having highlight as parent class
                codeblock.parentNode.appendChild(copybutton);
            }
        });
    }
})();
