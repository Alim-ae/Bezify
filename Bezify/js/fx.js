/* FX tab: a personal list of effects that can be added to selected layers in one click. */
function FxManager(options) {
    this.csInterface = options.csInterface;
    this.status = options.status;
    this.list = document.getElementById("fx-list");
    this.empty = document.getElementById("fx-empty");
    this.search = document.getElementById("fx-search");
    this.addButton = document.getElementById("fx-add");
    this.items = [];
    this.bind();
    this.refresh();
}

FxManager.prototype.report = function (result) {
    var ok = typeof result === "string" && result.indexOf("OK|") === 0;
    var text = typeof result !== "string" || result === "" ? "After Effects did not return a response." : result.replace(/^(OK|ERROR)\|/, "");
    this.status.textContent = text;
    BezifyDialogs.toast(text, ok ? "success" : "error");
    return ok;
};

FxManager.prototype.bind = function () {
    var manager = this;
    this.search.addEventListener("input", function () { manager.applyFilter(); });
    this.addButton.addEventListener("click", function () { manager.addFromSelection(); });
};

FxManager.prototype.addFromSelection = function () {
    var manager = this;
    this.csInterface.evalScript("bezify.captureSelectedEffect()", function (result) {
        var parts;
        if (typeof result !== "string" || result.indexOf("OK|") !== 0) {
            manager.report(result);
            return;
        }
        parts = result.split("|");
        BezifyDialogs.askText({ title: "Name this effect", value: parts[1], okLabel: "Add" }, function (name) {
            manager.csInterface.evalScript("bezify.saveEffect(" + JSON.stringify(name) + "," + JSON.stringify(parts.slice(2).join("|")) + ")", function (saved) {
                if (manager.report(saved)) { manager.refresh(); }
            });
        });
    });
};

FxManager.prototype.refresh = function () {
    var manager = this;
    this.csInterface.evalScript("bezify.listEffects()", function (result) {
        var lines;
        var index;
        var parts;
        manager.items = [];
        if (typeof result === "string" && result.indexOf("OK") === 0) {
            lines = result.split("\n").slice(1);
            for (index = 0; index < lines.length; index++) {
                parts = lines[index].split("|");
                if (parts.length >= 3) {
                    manager.items.push({ fileName: parts[0], name: parts[1], matchName: parts.slice(2).join("|") });
                }
            }
        }
        manager.render();
    });
};

FxManager.prototype.render = function () {
    var manager = this;
    var index;
    this.list.innerHTML = "";
    for (index = 0; index < this.items.length; index++) {
        this.list.appendChild(this.makeRow(this.items[index]));
    }
    this.applyFilter();
};

FxManager.prototype.makeRow = function (item) {
    var manager = this;
    var row = document.createElement("div");
    var apply = document.createElement("button");
    var remove = document.createElement("button");

    row.className = "fx-item";
    row.setAttribute("data-name", item.name.toLowerCase());
    apply.type = "button";
    apply.className = "fx-apply";
    apply.textContent = item.name;
    apply.title = "Add \u201c" + item.name + "\u201d to the selected layers";
    apply.addEventListener("click", function () {
        manager.csInterface.evalScript("bezify.applyEffect(" + JSON.stringify(item.matchName) + ")", function (result) { manager.report(result); });
    });
    remove.type = "button";
    remove.className = "fx-remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", function (event) {
        BezifyDialogs.armConfirm(event.currentTarget, function () {
            manager.csInterface.evalScript("bezify.deleteEffect(" + JSON.stringify(item.fileName) + ")", function (result) {
                if (manager.report(result)) { manager.refresh(); }
            });
        });
    });
    row.appendChild(apply);
    row.appendChild(remove);
    return row;
};

FxManager.prototype.applyFilter = function () {
    var term = this.search.value.replace(/^\s+|\s+$/g, "").toLowerCase();
    var rows = this.list.querySelectorAll(".fx-item");
    var visible = 0;
    var index;
    for (index = 0; index < rows.length; index++) {
        rows[index].hidden = term !== "" && rows[index].getAttribute("data-name").indexOf(term) === -1;
        if (!rows[index].hidden) { visible++; }
    }
    if (this.items.length === 0) {
        this.empty.textContent = "No effects yet. Apply an effect to a layer, select it, then press Add effect.";
    } else {
        this.empty.textContent = "No effect matches \u201c" + this.search.value + "\u201d.";
    }
    this.empty.hidden = visible > 0;
};
