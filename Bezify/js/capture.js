/* UI controls for transform capture and saved transform presets. */
function TransformCaptureManager(options) {
    this.csInterface = options.csInterface;
    this.status = options.status;
    this.captureButton = options.captureButton;
    this.savedList = options.savedList;
    this.bindEvents();
    this.refreshList();
}

TransformCaptureManager.prototype.bindEvents = function () {
    var manager = this;
    this.captureButton.addEventListener("click", function () {
        manager.captureAndSave();
    });
};

TransformCaptureManager.prototype.safeName = function (name) {
    var safeName = String(name).replace(/^\s+|\s+$/g, "").replace(/[^a-zA-Z0-9_-]/g, "_");
    return safeName || "transform_preset";
};

TransformCaptureManager.prototype.captureAndSave = function () {
    var manager = this;

    this.status.textContent = "Reading the selected layer transform…";
    this.csInterface.evalScript("bezify.captureSelectedTransform()", function (result) {
        var preset;
        var name;

        if (result.indexOf("ERROR|") === 0) {
            manager.status.textContent = result.replace("ERROR|", "");
            return;
        }
        try {
            preset = JSON.parse(result);
        } catch (error) {
            manager.status.textContent = "Could not read the captured transform data.";
            return;
        }
        BezifyDialogs.askText({ title: "Name this transform preset", value: "My transform", okLabel: "Save" }, function (chosen) {
            preset.name = manager.safeName(chosen);
            manager.savePreset(preset);
        });
    });
};

TransformCaptureManager.prototype.savePreset = function (preset) {
    var manager = this;
    var content = JSON.stringify(preset);
    var script = "bezify.saveTransformPreset(" + JSON.stringify(preset.name) + "," + JSON.stringify(content) + ")";

    this.status.textContent = "Saving transform preset…";
    this.csInterface.evalScript(script, function (result) {
        manager.status.textContent = result.replace("OK|", "Saved: ").replace("ERROR|", "");
        if (result.indexOf("OK|") === 0) {
            BezifyDialogs.toast("Saved transform preset", "success");
            manager.refreshList();
        } else {
            BezifyDialogs.toast(result.replace("ERROR|", ""), "error");
        }
    });
};

TransformCaptureManager.prototype.refreshList = function () {
    var manager = this;
    this.csInterface.evalScript("bezify.listTransformPresets()", function (result) {
        manager.renderList(result);
    });
};

TransformCaptureManager.prototype.renderList = function (result) {
    var lines;
    var lineIndex;
    var parts;
    var item;
    var applyButton;
    var renameButton;
    var deleteButton;
    var manager = this;

    this.savedList.innerHTML = "";
    if (result.indexOf("ERROR|") === 0) {
        this.savedList.textContent = result.replace("ERROR|", "");
        return;
    }
    lines = result.split("\n");
    if (lines.length === 1) {
        this.savedList.textContent = "No saved transform presets yet.";
        return;
    }
    for (lineIndex = 1; lineIndex < lines.length; lineIndex++) {
        parts = lines[lineIndex].split("|");
        if (parts.length !== 2) {
            continue;
        }
        item = document.createElement("li");
        applyButton = document.createElement("button");
        applyButton.type = "button";
        applyButton.textContent = "Load & Apply: " + parts[1];
        applyButton.addEventListener("click", this.makeApplyHandler(parts[0], parts[1], manager));
        renameButton = document.createElement("button");
        renameButton.type = "button";
        renameButton.textContent = "Rename";
        renameButton.addEventListener("click", this.makeRenameHandler(parts[0], parts[1], manager));
        deleteButton = document.createElement("button");
        deleteButton.type = "button";
        deleteButton.className = "delete-curve";
        deleteButton.textContent = "Delete";
        deleteButton.addEventListener("click", this.makeDeleteHandler(parts[0], parts[1], manager));
        item.appendChild(applyButton);
        item.appendChild(renameButton);
        item.appendChild(deleteButton);
        this.savedList.appendChild(item);
    }
};

TransformCaptureManager.prototype.readPreset = function (fileName, onSuccess) {
    var manager = this;
    this.csInterface.evalScript("bezify.readTransformPreset(" + JSON.stringify(fileName) + ")", function (result) {
        var preset;
        if (result.indexOf("ERROR|") === 0) {
            manager.status.textContent = result.replace("ERROR|", "");
            return;
        }
        try {
            preset = JSON.parse(result);
        } catch (error) {
            manager.status.textContent = "Could not parse that transform preset.";
            return;
        }
        onSuccess(preset);
    });
};

TransformCaptureManager.prototype.makeApplyHandler = function (fileName, name, manager) {
    return function () {
        manager.readPreset(fileName, function (preset) {
            manager.status.textContent = "Applying " + name + " (replacing transform keys)…";
            manager.csInterface.evalScript("bezify.applyTransformPreset(" + JSON.stringify(preset) + ")", function (result) {
                manager.status.textContent = result || "After Effects did not return a response.";
            });
        });
    };
};

TransformCaptureManager.prototype.makeRenameHandler = function (fileName, oldName, manager) {
    return function () {
        manager.readPreset(fileName, function (preset) {
            BezifyDialogs.askText({ title: "Rename transform preset", value: oldName, okLabel: "Rename" }, function (nextName) {
                var script;
                preset.name = manager.safeName(nextName);
                script = "bezify.renameTransformPreset(" + JSON.stringify(fileName) + "," + JSON.stringify(preset.name) + "," + JSON.stringify(JSON.stringify(preset)) + ")";
                manager.csInterface.evalScript(script, function (result) {
                    manager.status.textContent = result.replace("OK|", "Renamed: ").replace("ERROR|", "");
                    if (result.indexOf("OK|") === 0) {
                        BezifyDialogs.toast("Renamed", "success");
                        manager.refreshList();
                    }
                });
            });
        });
    };
};

TransformCaptureManager.prototype.makeDeleteHandler = function (fileName, name, manager) {
    return function (event) {
        BezifyDialogs.armConfirm(event.currentTarget, function () {
            manager.csInterface.evalScript("bezify.deleteTransformPreset(" + JSON.stringify(fileName) + ")", function (result) {
                manager.status.textContent = result.replace("OK|", "").replace("ERROR|", "");
                BezifyDialogs.toast("Deleted \u201c" + name + "\u201d");
                manager.refreshList();
            });
        });
    };
};
