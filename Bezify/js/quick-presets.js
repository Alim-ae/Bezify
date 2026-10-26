/* UI controls for one-click layer animation presets and staggering. */
function QuickPresetManager(options) {
    this.editor = options.editor;
    this.csInterface = options.csInterface;
    this.status = options.status;
    this.durationInput = options.durationInput;
    this.directionInput = options.directionInput;
    this.staggerFramesInput = options.staggerFramesInput;
    this.staggerModeInput = options.staggerModeInput;
    this.bindEvents(options.presetButtons, options.staggerButton);
}

QuickPresetManager.prototype.bindEvents = function (presetButtons, staggerButton) {
    var manager = this;
    var buttonIndex;

    for (buttonIndex = 0; buttonIndex < presetButtons.length; buttonIndex++) {
        presetButtons[buttonIndex].addEventListener("click", function (event) {
            manager.applyPreset(event.currentTarget.getAttribute("data-quick-preset"));
        });
    }
    staggerButton.addEventListener("click", function () {
        manager.staggerLayers();
    });
};

QuickPresetManager.prototype.applyPreset = function (presetName) {
    var duration = parseFloat(this.durationInput.value);
    var curve = this.editor.getValues();
    var script;
    var manager = this;

    if (isNaN(duration) || duration <= 0) {
        this.status.textContent = "Enter a duration greater than zero seconds.";
        return;
    }

    script = "bezify.applyQuickPreset(" + JSON.stringify(presetName) + "," + duration + "," + JSON.stringify(this.directionInput.value) + "," + curve.x1 + "," + curve.y1 + "," + curve.x2 + "," + curve.y2 + ")";
    this.status.textContent = "Applying " + presetName + "…";
    this.csInterface.evalScript(script, function (result) {
        manager.status.textContent = result || "After Effects did not return a response.";
    });
};

QuickPresetManager.prototype.staggerLayers = function () {
    var frames = parseFloat(this.staggerFramesInput.value);
    var manager = this;

    if (isNaN(frames) || frames <= 0) {
        this.status.textContent = "Enter a stagger gap greater than zero frames.";
        return;
    }

    this.status.textContent = "Staggering keyframes…";
    this.csInterface.evalScript("bezify.staggerSelectedLayers(" + frames + "," + JSON.stringify(this.staggerModeInput.value) + ")", function (result) {
        manager.status.textContent = result || "After Effects did not return a response.";
    });
};
