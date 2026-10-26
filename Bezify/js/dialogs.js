/* In-panel dialogs, toasts and two-step confirmation (replaces native browser popups). */
var BezifyDialogs = (function () {
    var toastTimer = null;
    var closeTimer = null;
    var pending = null;
    var ready = false;

    function trim(text) {
        return String(text).replace(/^\s+|\s+$/g, "");
    }

    function toast(message, kind) {
        var element = document.getElementById("toast");
        if (!element) { return; }
        element.className = "toast show" + (kind ? " " + kind : "");
        element.textContent = message;
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(function () { element.className = "toast" + (kind ? " " + kind : ""); }, 2400);
    }

    function closeDialog() {
        var backdrop = document.getElementById("dialog");
        pending = null;
        backdrop.className = "dialog-backdrop";
        window.clearTimeout(closeTimer);
        closeTimer = window.setTimeout(function () { backdrop.hidden = true; }, 200);
    }

    function submit() {
        var input = document.getElementById("dialog-input");
        var value = trim(input.value);
        var callback = pending;
        if (!value) {
            toast("Type something first", "error");
            input.focus();
            return;
        }
        closeDialog();
        if (callback) { callback(value); }
    }

    function init() {
        var backdrop = document.getElementById("dialog");
        var input = document.getElementById("dialog-input");
        if (ready) { return; }
        ready = true;
        document.getElementById("dialog-ok").addEventListener("click", submit);
        document.getElementById("dialog-cancel").addEventListener("click", closeDialog);
        backdrop.addEventListener("mousedown", function (event) { if (event.target === backdrop) { closeDialog(); } });
        input.addEventListener("keydown", function (event) {
            if (event.key === "Enter" || event.keyCode === 13) { event.preventDefault(); submit(); }
            if (event.key === "Escape" || event.keyCode === 27) { event.preventDefault(); closeDialog(); }
        });
    }

    function askText(options, callback) {
        var backdrop = document.getElementById("dialog");
        var input = document.getElementById("dialog-input");
        init();
        window.clearTimeout(closeTimer);
        document.getElementById("dialog-title").textContent = options.title || "";
        document.getElementById("dialog-ok").textContent = options.okLabel || "OK";
        input.value = options.value || "";
        input.placeholder = options.placeholder || "";
        pending = callback;
        backdrop.hidden = false;
        window.requestAnimationFrame(function () { backdrop.className = "dialog-backdrop open"; });
        window.setTimeout(function () { input.focus(); input.select(); }, 30);
    }

    function armConfirm(button, onConfirm) {
        var original;
        if (button.getAttribute("data-armed") === "1") {
            window.clearTimeout(button._armTimer);
            button.removeAttribute("data-armed");
            button.className = button.className.replace(" is-armed", "");
            button.textContent = button.getAttribute("data-label");
            onConfirm();
            return;
        }
        original = button.textContent;
        button.setAttribute("data-label", original);
        button.setAttribute("data-armed", "1");
        button.className += " is-armed";
        button.textContent = "Sure?";
        button._armTimer = window.setTimeout(function () {
            button.removeAttribute("data-armed");
            button.className = button.className.replace(" is-armed", "");
            button.textContent = original;
        }, 2500);
    }

    return { toast: toast, askText: askText, armConfirm: armConfirm };
}());
