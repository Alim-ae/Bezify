(function () {
    var csInterface = new CSInterface();
    var ui = new BezifyUI();
    var button = document.getElementById("selected-layer-button");
    var keyframesButton = document.getElementById("selected-keyframes-button");
    var message = document.getElementById("message");
    var keyframeResults = document.getElementById("keyframe-results");

    function showSelectedLayer() {
        message.textContent = "Checking After Effects…";
        csInterface.evalScript("bezify.getSelectedLayerName()", function (result) {
            message.textContent = result || "After Effects did not return a response.";
        });
    }

    function showSelectedKeyframes() {
        keyframeResults.textContent = "Reading selected keyframes…";
        csInterface.evalScript("bezify.getSelectedKeyframes()", function (result) {
            keyframeResults.textContent = result || "After Effects did not return a response.";
        });
    }

    function applyCubicBezier(values) {
        var label = curveEditor.curveName || "Custom curve";
        keyframeResults.textContent = "Applying cubic-bezier…";
        csInterface.evalScript("bezify.applyCubicBezier(" + values.x1 + "," + values.y1 + "," + values.x2 + "," + values.y2 + ")", function (result) {
            if (result && result.indexOf("Applied") === 0) {
                keyframeResults.textContent = "Applied: " + label + " (" + values.x1.toFixed(2) + ", " + values.y1.toFixed(2) + ", " + values.x2.toFixed(2) + ", " + values.y2.toFixed(2) + ")";
            } else {
                keyframeResults.textContent = result || "After Effects did not return a response.";
                if (window.console && console.error) { console.error("Bezify apply error:", result); }
            }
            if (result && result.indexOf("Applied") === 0) {
                ui.showSuccess(document.getElementById("apply-bezier-button"));
            }
        });
    }

    button.addEventListener("click", showSelectedLayer);
    keyframesButton.addEventListener("click", showSelectedKeyframes);
    var curveEditor = new EaseEditor({
        canvas: document.getElementById("curve-canvas"),
        applyButton: document.getElementById("apply-bezier-button"),
        outputElements: {
            x1: document.getElementById("curve-x1"),
            y1: document.getElementById("curve-y1"),
            x2: document.getElementById("curve-x2"),
            y2: document.getElementById("curve-y2")
        },
        onApply: applyCubicBezier
    });
    ui.attachCurveClipboard(curveEditor);

    new CurvePresetManager({
        editor: curveEditor,
        csInterface: csInterface,
        status: keyframeResults,
        savedList: document.getElementById("saved-curves"),
        saveButton: document.getElementById("save-curve-button")
    });

    new QuickPresetManager({
        editor: curveEditor,
        csInterface: csInterface,
        status: keyframeResults,
        durationInput: document.getElementById("quick-duration"),
        directionInput: document.getElementById("slide-direction"),
        staggerFramesInput: document.getElementById("stagger-frames"),
        staggerModeInput: document.getElementById("stagger-mode"),
        presetButtons: document.querySelectorAll("[data-quick-preset]"),
        staggerButton: document.getElementById("stagger-button")
    });

    new ToolsManager({
        csInterface: csInterface,
        status: keyframeResults
    });

    new FxManager({
        csInterface: csInterface,
        status: keyframeResults
    });

    new TransformCaptureManager({
        csInterface: csInterface,
        status: keyframeResults,
        captureButton: document.getElementById("capture-transform-button"),
        savedList: document.getElementById("saved-transform-presets")
    });
}());
