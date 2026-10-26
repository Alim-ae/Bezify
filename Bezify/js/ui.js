/* Small, framework-free interface behaviors. */
function BezifyUI() {
    this.tabs = document.querySelectorAll(".tab");
    this.panels = document.querySelectorAll(".tab-panel");
    this.indicator = document.querySelector(".tab-indicator");
    this.curveText = "";
    this.bindTabs();
    this.bindCollapsibles();
    this.bindRipples();
    this.placeIndicator(document.querySelector(".tab.active"));
}

BezifyUI.prototype.placeIndicator = function (tab) {
    if (!tab) { return; }
    this.indicator.style.width = tab.offsetWidth + "px";
    this.indicator.style.transform = "translateX(" + tab.offsetLeft + "px)";
};

BezifyUI.prototype.bindTabs = function () {
    var ui = this;
    var index;
    for (index = 0; index < this.tabs.length; index++) {
        this.tabs[index].addEventListener("click", function (event) {
            var name = event.currentTarget.getAttribute("data-tab");
            var itemIndex;
            for (itemIndex = 0; itemIndex < ui.tabs.length; itemIndex++) {
                ui.tabs[itemIndex].classList.remove("active");
                ui.panels[itemIndex].classList.remove("active");
            }
            event.currentTarget.classList.add("active");
            document.querySelector("[data-tab-panel='" + name + "']").classList.add("active");
            ui.placeIndicator(event.currentTarget);
            window.dispatchEvent(new Event("resize"));
        });
    }
    window.addEventListener("resize", function () { ui.placeIndicator(document.querySelector(".tab.active")); });
    window.addEventListener("load", function () { ui.placeIndicator(document.querySelector(".tab.active")); });
};

BezifyUI.prototype.bindCollapsibles = function () {
    var cards = document.querySelectorAll("[data-collapsible]");
    var index;
    this.menus = [];
    for (index = 0; index < cards.length; index++) {
        this.menus.push(this.makeCollapsible(cards[index]));
    }
    this.bindMenuDismissal();
};

BezifyUI.prototype.makeCollapsible = function (card) {
    var toggle = card.querySelector(".section-toggle");
    var content = card.querySelector(".section-content");
    var menu = {};
    card.classList.add("is-collapsed");
    menu.card = card;
    menu.open = function () {
        if (!card.classList.contains("is-collapsed")) { return; }
        card.classList.remove("is-collapsed");
        content.style.height = "0px";
        window.requestAnimationFrame(function () { content.style.height = content.scrollHeight + "px"; });
        window.setTimeout(function () { if (!card.classList.contains("is-collapsed")) { content.style.height = "auto"; } }, 240);
    };
    menu.close = function () {
        if (card.classList.contains("is-collapsed")) { return; }
        content.style.height = content.offsetHeight + "px";
        window.requestAnimationFrame(function () { card.classList.add("is-collapsed"); });
    };
    toggle.addEventListener("click", function () {
        if (card.classList.contains("is-collapsed")) { menu.open(); } else { menu.close(); }
    });
    return menu;
};

BezifyUI.prototype.bindMenuDismissal = function () {
    var ui = this;
    document.addEventListener("click", function (event) {
        var index;
        var target = event.target;
        for (index = 0; index < ui.menus.length; index++) {
            if (!ui.menus[index].card.contains(target)) { ui.menus[index].close(); }
        }
        if (target.closest && ui.menus.length) {
            var choice = target.closest(".preset-card, .saved-curves li button:first-child");
            if (choice && ui.menus[0].card.contains(choice)) { ui.menus[0].close(); }
        }
    });
    document.addEventListener("keydown", function (event) {
        var index;
        if (event.key === "Escape" || event.keyCode === 27) {
            for (index = 0; index < ui.menus.length; index++) { ui.menus[index].close(); }
        }
    });
};

BezifyUI.prototype.attachCurveClipboard = function (editor) {
    var ui = this;
    var keys = ["x1", "y1", "x2", "y2"];
    var index;
    var copyButton = document.getElementById("curve-copy");
    var pasteButton = document.getElementById("curve-paste");
    var overshootInput = document.getElementById("curve-overshoot");

    for (index = 0; index < keys.length; index++) { this.bindCurveInput(keys[index], editor); }

    function readNumbers(text) {
        var values = text && String(text).match(/-?\d*\.?\d+/g);
        if (values && values.length >= 4) {
            return { x1: parseFloat(values[0]), y1: parseFloat(values[1]), x2: parseFloat(values[2]), y2: parseFloat(values[3]) };
        }
        return null;
    }
    function applyPasted(text) {
        var curve = readNumbers(text);
        if (!curve) { return false; }
        editor.animateTo(curve, 180);
        BezifyDialogs.toast("Pasted curve values", "success");
        return true;
    }
    function askForValues() {
        BezifyDialogs.askText({ title: "Paste curve values", placeholder: "0.25, 0.10, 0.25, 1.00", value: ui.curveText || "", okLabel: "Apply" }, function (text) {
            if (!applyPasted(text)) { BezifyDialogs.toast("Need four numbers: x1, y1, x2, y2", "error"); }
        });
    }

    copyButton.addEventListener("click", function () {
        var field = document.createElement("textarea");
        var copied = false;
        ui.curveText = [editor.values.x1.toFixed(2), editor.values.y1.toFixed(2), editor.values.x2.toFixed(2), editor.values.y2.toFixed(2)].join(", ");
        field.value = ui.curveText;
        field.style.position = "fixed";
        field.style.opacity = "0";
        document.body.appendChild(field);
        field.select();
        try { copied = document.execCommand("copy"); } catch (error) { copied = false; }
        document.body.removeChild(field);
        if (copied) {
            BezifyDialogs.toast("Copied " + ui.curveText, "success");
        } else {
            BezifyDialogs.askText({ title: "Copy these values", value: ui.curveText, okLabel: "Done" }, function () {});
        }
    });
    pasteButton.addEventListener("click", function () {
        if (navigator.clipboard && navigator.clipboard.readText) {
            navigator.clipboard.readText().then(function (text) {
                if (!applyPasted(text)) { askForValues(); }
            }, askForValues);
        } else {
            askForValues();
        }
    });
    for (index = 0; index < keys.length; index++) {
        document.getElementById("curve-" + keys[index]).addEventListener("paste", function (event) {
            var data = event.clipboardData || window.clipboardData;
            var curve = data && readNumbers(data.getData("text"));
            if (curve) { event.preventDefault(); editor.animateTo(curve, 180); BezifyDialogs.toast("Pasted curve values", "success"); }
        });
    }
    overshootInput.addEventListener("change", function () { editor.setOvershoot(overshootInput.checked); });
};

BezifyUI.prototype.bindCurveInput = function (key, editor) {
    var input = document.getElementById("curve-" + key);
    editor.outputs[key] = input;
    input.value = editor.values[key].toFixed(2);
    input.addEventListener("focus", function () { input.select(); });
    input.addEventListener("change", function () {
        var values = editor.getValues();
        values[key] = parseFloat(input.value);
        if (isNaN(values[key])) { values[key] = 0; }
        editor.setValues(values);
        input.value = editor.values[key].toFixed(2);
    });
};

BezifyUI.prototype.bindRipples = function () {
    var buttons = document.querySelectorAll(".ripple-button");
    var index;
    for (index = 0; index < buttons.length; index++) {
        buttons[index].addEventListener("click", function (event) {
            var ripple = document.createElement("span");
            ripple.className = "ripple";
            ripple.style.left = (event.offsetX || event.currentTarget.clientWidth / 2) + "px";
            ripple.style.top = (event.offsetY || event.currentTarget.clientHeight / 2) + "px";
            event.currentTarget.appendChild(ripple);
            window.setTimeout(function () { if (ripple.parentNode) { ripple.parentNode.removeChild(ripple); } }, 500);
        });
    }
};

BezifyUI.prototype.showSuccess = function (button) {
    button.classList.add("is-success");
    window.setTimeout(function () { button.classList.remove("is-success"); }, 1000);
};
