/* Tools tab: speed, fit to comp, create layers, anchor point. */
function ToolsManager(options) {
    this.csInterface = options.csInterface;
    this.status = options.status;
    this.speed = 100;
    this.reversed = false;
    this.slider = document.getElementById("speed");
    this.readout = document.getElementById("speed-value");
    this.reverseButton = document.getElementById("speed-reverse");
    this.defaultButton = document.getElementById("speed-default");
    this.speedMessage = document.getElementById("speed-message");
    this.anchorNote = document.getElementById("anchor-note");
    this.bindSubtabs();
    this.bindSpeed();
    this.bindFit();
    this.bindCreate();
    this.bindAnchor();
    this.updateSpeedUI();
}

/* Runs an ExtendScript call and reports "OK|text" / "ERROR|text" results in a toast and the status line. */
ToolsManager.prototype.run = function (script, done) {
    var manager = this;
    this.csInterface.evalScript(script, function (result) {
        var ok = typeof result === "string" && result.indexOf("OK|") === 0;
        var text;
        if (typeof result !== "string" || result === "") {
            text = "After Effects did not return a response.";
        } else if (ok) {
            text = result.substr(3);
        } else if (result.indexOf("ERROR|") === 0) {
            text = result.substr(6);
        } else {
            text = result;
        }
        manager.status.textContent = text;
        BezifyDialogs.toast(text, ok ? "success" : "error");
        if (done) { done(ok, text); }
    });
};

ToolsManager.prototype.bindSubtabs = function () {
    var buttons = document.querySelectorAll("#tools-switch [data-subtab]");
    var panels = document.querySelectorAll("[data-subpanel]");
    var index;
    for (index = 0; index < buttons.length; index++) {
        buttons[index].addEventListener("click", function (event) {
            var name = event.currentTarget.getAttribute("data-subtab");
            var item;
            for (item = 0; item < buttons.length; item++) {
                buttons[item].classList.toggle("active", buttons[item] === event.currentTarget);
            }
            for (item = 0; item < panels.length; item++) {
                panels[item].classList.toggle("active", panels[item].getAttribute("data-subpanel") === name);
            }
        });
    }
};

ToolsManager.prototype.updateSpeedUI = function () {
    var min = parseFloat(this.slider.min);
    var max = parseFloat(this.slider.max);
    var fill = ((this.speed - min) / (max - min)) * 100;
    this.slider.value = this.speed;
    this.readout.textContent = (this.reversed ? "-" : "") + this.speed + "%";
    this.slider.style.background = "linear-gradient(90deg,var(--accent) 0," + "var(--accent) " + fill + "%,#484848 " + fill + "%,#484848 100%)";
    this.reverseButton.classList.toggle("is-on", this.reversed);
    this.reverseButton.setAttribute("aria-pressed", this.reversed ? "true" : "false");
};

ToolsManager.prototype.applySpeed = function (onFail) {
    var manager = this;
    this.run("bezify.setSpeed(" + this.speed + "," + (this.reversed ? "true" : "false") + ")", function (ok, text) {
        manager.speedMessage.textContent = text;
        if (!ok && onFail) { onFail(); }
    });
};

ToolsManager.prototype.bindSpeed = function () {
    var manager = this;
    this.slider.addEventListener("input", function () {
        manager.speed = parseInt(manager.slider.value, 10);
        manager.updateSpeedUI();
    });
    /* apply once when the slider is released, so one drag is one undo step */
    this.slider.addEventListener("change", function () {
        manager.speed = parseInt(manager.slider.value, 10);
        manager.updateSpeedUI();
        manager.applySpeed();
    });
    this.reverseButton.addEventListener("click", function () {
        manager.reversed = !manager.reversed;
        manager.updateSpeedUI();
        manager.applySpeed(function () {
            manager.reversed = !manager.reversed;
            manager.updateSpeedUI();
        });
    });
    this.defaultButton.addEventListener("click", function () {
        manager.speed = 100;
        manager.reversed = false;
        manager.updateSpeedUI();
        manager.applySpeed();
    });
};

ToolsManager.prototype.bindFit = function () {
    var manager = this;
    var buttons = document.querySelectorAll("[data-fit]");
    var index;
    for (index = 0; index < buttons.length; index++) {
        buttons[index].addEventListener("click", function (event) {
            var mode = event.currentTarget.getAttribute("data-fit");
            var percent = event.currentTarget.getAttribute("data-percent") || "100";
            manager.run("bezify.fitToComp(\"" + mode + "\"," + parseFloat(percent) + ")");
        });
    }
};

ToolsManager.prototype.bindCreate = function () {
    var manager = this;
    var buttons = document.querySelectorAll("[data-create]");
    var index;
    for (index = 0; index < buttons.length; index++) {
        buttons[index].addEventListener("click", function (event) {
            manager.run("bezify.createLayer(\"" + event.currentTarget.getAttribute("data-create") + "\")");
        });
    }
};

ToolsManager.prototype.bindAnchor = function () {
    var manager = this;
    var points = document.querySelectorAll(".anchor");
    var index;
    for (index = 0; index < points.length; index++) {
        points[index].addEventListener("click", function (event) {
            var point = event.currentTarget;
            var item;
            var label = point.getAttribute("data-anchor");
            manager.run("bezify.setAnchorPoint(" + point.getAttribute("data-col") + "," + point.getAttribute("data-row") + ")", function (ok, text) {
                if (ok) {
                    for (item = 0; item < points.length; item++) { points[item].classList.toggle("selected", points[item] === point); }
                    manager.anchorNote.textContent = "Anchor set to " + label + ".";
                } else {
                    manager.anchorNote.textContent = text;
                }
            });
        });
    }
};
