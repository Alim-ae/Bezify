/* Built-in and saved curve preset controls for the panel UI. */
function CurvePresetManager(options) {
    this.editor = options.editor;
    this.csInterface = options.csInterface;
    this.status = options.status;
    this.savedList = options.savedList;
    this.saveButton = options.saveButton;
    this.nameInput = options.nameInput || document.getElementById("curve-name");
    this.builtInCurves = {
        "ease-in": { x1: 0.42, y1: 0.00, x2: 0.99, y2: 1.00 },
        "ease-out": { x1: 0.001, y1: 0.00, x2: 0.58, y2: 1.00 },
        "ease-in-out": { x1: 0.42, y1: 0.00, x2: 0.58, y2: 1.00 },
        "overshoot": { x1: 0.34, y1: 1.56, x2: 0.64, y2: 1.00 },
        "snappy": { x1: 0.18, y1: 0.90, x2: 0.25, y2: 1.00 }
    };

    this.bindEvents();
    this.refreshSavedCurves();
}

CurvePresetManager.prototype.bindEvents = function () {
    var manager = this;
    var presetButtons = document.querySelectorAll("[data-curve-preset]");
    var buttonIndex;

    for (buttonIndex = 0; buttonIndex < presetButtons.length; buttonIndex++) {
        presetButtons[buttonIndex].addEventListener("click", function (event) {
            manager.useCurve(event.currentTarget.textContent, manager.builtInCurves[event.currentTarget.getAttribute("data-curve-preset")], true);
        });
    }

    this.saveButton.addEventListener("click", function () {
        manager.saveCurrentCurve();
    });
    this.nameInput.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.keyCode === 13) { event.preventDefault(); manager.saveCurrentCurve(); }
    });
};

CurvePresetManager.prototype.useCurve = function (name, rawCurve, animate) {
    var curve = { x1: Number(rawCurve.x1), y1: Number(rawCurve.y1), x2: Number(rawCurve.x2), y2: Number(rawCurve.y2), name: name };
    if (!isFinite(curve.x1) || !isFinite(curve.y1) || !isFinite(curve.x2) || !isFinite(curve.y2)) {
        this.setStatus("That saved curve is invalid. Choose another curve or delete it.");
        BezifyDialogs.toast("That saved curve is invalid", "error");
        if (window.console && console.error) { console.error("Invalid Bezify saved curve", rawCurve); }
        return false;
    }
    if (!this.editor.overshoot && (curve.y1 < 0 || curve.y1 > 1 || curve.y2 < 0 || curve.y2 > 1)) {
        this.setStatus("Turn on Overshoot to use " + name + ".");
        BezifyDialogs.toast("Turn on Overshoot to use this curve", "error");
        return false;
    }
    if (animate) { this.editor.animateTo(curve, 250); } else { this.editor.setCurve(curve.x1, curve.y1, curve.x2, curve.y2, name); }
    this.setStatus("Loaded: " + name + " (" + curve.x1.toFixed(2) + ", " + curve.y1.toFixed(2) + ", " + curve.x2.toFixed(2) + ", " + curve.y2.toFixed(2) + ")");
    return true;
};

CurvePresetManager.prototype.setStatus = function (text) {
    this.status.textContent = text;
};

CurvePresetManager.prototype.toExtendScriptString = function (value) {
    return JSON.stringify(String(value));
};

CurvePresetManager.prototype.saveCurrentCurve = function () {
    var manager = this;
    var name = this.nameInput.value.replace(/^\s+|\s+$/g, "");
    var values;
    var script;

    if (!name) {
        BezifyDialogs.toast("Type a name for the curve first", "error");
        this.nameInput.focus();
        return;
    }

    values = this.editor.getValues();
    script = "bezify.saveCurvePreset(" + this.toExtendScriptString(name) + "," + values.x1 + "," + values.y1 + "," + values.x2 + "," + values.y2 + ")";
    this.setStatus("Saving curve…");
    this.csInterface.evalScript(script, function (result) {
        if (result.indexOf("OK|") === 0) {
            manager.setStatus("Saved curve: " + result.split("|")[2]);
            BezifyDialogs.toast("Saved curve \u201c" + result.split("|")[2] + "\u201d", "success");
            manager.nameInput.value = "";
            manager.refreshSavedCurves();
        } else {
            manager.setStatus(result.replace("ERROR|", ""));
            BezifyDialogs.toast(result.replace("ERROR|", ""), "error");
        }
    });
};

CurvePresetManager.prototype.refreshSavedCurves = function () {
    var manager = this;

    this.csInterface.evalScript("bezify.listCurvePresets()", function (result) {
        manager.renderSavedCurves(result);
    });
};

CurvePresetManager.prototype.renderSavedCurves = function (result) {
    var lines;
    var lineIndex;
    var parts;
    var item;
    var loadButton;
    var deleteButton;
    var nameLabel;
    var manager = this;

    this.savedList.innerHTML = "";
    if (result.indexOf("ERROR|") === 0) {
        this.savedList.textContent = result.replace("ERROR|", "");
        return;
    }

    lines = result.split("\n");
    if (lines.length === 1) {
        this.savedList.textContent = "No saved curves yet.";
        return;
    }

    for (lineIndex = 1; lineIndex < lines.length; lineIndex++) {
        parts = lines[lineIndex].split("|");
        if (parts[0] === "INVALID") {
            item = document.createElement("li");
            item.textContent = "Invalid saved curve: " + parts[1];
            this.savedList.appendChild(item);
            if (window.console && console.error) { console.error("Invalid Bezify curve preset:", parts[1]); }
            continue;
        }
        if (parts.length !== 6) {
            continue;
        }

        item = document.createElement("li");
        loadButton = document.createElement("button");
        loadButton.type = "button";
        loadButton.className = "saved-curve-load";
        loadButton.title = parts[1] + " (" + parseFloat(parts[2]).toFixed(2) + ", " + parseFloat(parts[3]).toFixed(2) + ", " + parseFloat(parts[4]).toFixed(2) + ", " + parseFloat(parts[5]).toFixed(2) + ")";
        nameLabel = document.createElement("span");
        nameLabel.className = "curve-name";
        nameLabel.textContent = parts[1];
        loadButton.appendChild(nameLabel);
        loadButton.appendChild(this.makeThumbnail(parseFloat(parts[2]), parseFloat(parts[3]), parseFloat(parts[4]), parseFloat(parts[5])));
        loadButton.addEventListener("click", this.makeLoadHandler(parts));
        deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-curve";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", this.makeDeleteHandler(parts[0], parts[1], manager));
        item.appendChild(loadButton);
        item.appendChild(deleteButton);
        this.savedList.appendChild(item);
    }
};

/* Small curve preview (same look as the built-in preset thumbnails). */
CurvePresetManager.prototype.makeThumbnail = function (x1, y1, x2, y2) {
    var ns = "http://www.w3.org/2000/svg";
    var svg = document.createElementNS(ns, "svg");
    var path = document.createElementNS(ns, "path");
    var points = [];
    var steps = 24;
    var step;
    var t;
    var q;
    var minY = 0;
    var maxY = 1;
    var d = "";

    if (!isFinite(x1) || !isFinite(y1) || !isFinite(x2) || !isFinite(y2)) {
        svg.setAttribute("viewBox", "0 0 42 18");
        return svg;
    }
    for (step = 0; step <= steps; step++) {
        t = step / steps;
        q = 1 - t;
        points.push({
            x: 3 * q * q * t * x1 + 3 * q * t * t * x2 + t * t * t,
            y: 3 * q * q * t * y1 + 3 * q * t * t * y2 + t * t * t
        });
        minY = Math.min(minY, points[step].y);
        maxY = Math.max(maxY, points[step].y);
    }
    for (step = 0; step < points.length; step++) {
        d += (step === 0 ? "M" : "L") + (2 + points[step].x * 38).toFixed(1) + " " + (16 - 14 * (points[step].y - minY) / (maxY - minY)).toFixed(1);
    }
    path.setAttribute("d", d);
    svg.setAttribute("viewBox", "0 0 42 18");
    svg.appendChild(path);
    return svg;
};

CurvePresetManager.prototype.makeLoadHandler = function (parts) {
    var manager = this;
    var values = { x1: parseFloat(parts[2]), y1: parseFloat(parts[3]), x2: parseFloat(parts[4]), y2: parseFloat(parts[5]) };

    return function () {
        manager.useCurve(parts[1], values, false);
    };
};

CurvePresetManager.prototype.makeDeleteHandler = function (fileName, name, manager) {
    return function (event) {
        BezifyDialogs.armConfirm(event.currentTarget, function () {
            manager.csInterface.evalScript("bezify.deleteCurvePreset(" + manager.toExtendScriptString(fileName) + ")", function (result) {
                manager.setStatus(result.replace("OK|", "").replace("ERROR|", ""));
                BezifyDialogs.toast("Deleted \u201c" + name + "\u201d");
                manager.refreshSavedCurves();
            });
        });
    };
};
