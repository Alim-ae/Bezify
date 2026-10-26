/* Tools tab (speed, fit to comp, create layers, anchor point) and FX library. ExtendScript ES3. */

/* ---------- pure math (kept free of After Effects objects so it can be unit tested) ---------- */
bezify.toolsMath = {
    rotate: function (x, y, degrees) {
        var radians = degrees * Math.PI / 180;
        var cosine = Math.cos(radians);
        var sine = Math.sin(radians);
        return [x * cosine - y * sine, x * sine + y * cosine];
    },
    fitScale: function (width, height, degrees, boxWidth, boxHeight, fill) {
        var radians = degrees * Math.PI / 180;
        var cosine = Math.abs(Math.cos(radians));
        var sine = Math.abs(Math.sin(radians));
        var boundsWidth = width * cosine + height * sine;
        var boundsHeight = width * sine + height * cosine;
        var scaleX;
        var scaleY;
        if (boundsWidth <= 0 || boundsHeight <= 0) { return 0; }
        scaleX = boxWidth / boundsWidth;
        scaleY = boxHeight / boundsHeight;
        return fill ? Math.max(scaleX, scaleY) : Math.min(scaleX, scaleY);
    },
    centerPosition: function (center, anchor, scale, degrees, target) {
        var offset = this.rotate((center[0] - anchor[0]) * scale[0], (center[1] - anchor[1]) * scale[1], degrees);
        return [target[0] - offset[0], target[1] - offset[1]];
    },
    anchorShift: function (oldAnchor, newAnchor, scale, degrees) {
        return this.rotate((newAnchor[0] - oldAnchor[0]) * scale[0], (newAnchor[1] - oldAnchor[1]) * scale[1], degrees);
    },
    speedToStretch: function (speed, reversed) {
        var stretch = 10000 / speed;
        return reversed ? -stretch : stretch;
    }
};

/* ---------- shared helpers ---------- */
bezify.getActiveComp = function () {
    var item = app.project.activeItem;
    if (item && item instanceof CompItem) { return item; }
    return null;
};

bezify.runUndoable = function (name, work) {
    var result;
    app.beginUndoGroup(name);
    try {
        result = work();
    } catch (error) {
        result = "ERROR|" + error.toString();
    }
    app.endUndoGroup();
    return result;
};

bezify.transformOf = function (layer) {
    return layer.property("ADBE Transform Group");
};

bezify.isAnimated = function (property) {
    return property.numKeys > 0 || property.expressionEnabled;
};

bezify.setPropertyValue = function (property, value, time) {
    if (property.numKeys > 0) {
        property.setValueAtTime(time, value);
    } else {
        property.setValue(value);
    }
};

/* Adds an amount (number or array) to a property, shifting every keyframe when it is animated. */
bezify.addToProperty = function (property, delta) {
    var keyIndex;
    var value;
    var index;
    var next;

    function plus(base) {
        if (base instanceof Array) {
            next = [];
            for (index = 0; index < base.length; index++) {
                next.push(base[index] + (delta instanceof Array ? (delta[index] || 0) : delta));
            }
            return next;
        }
        return base + delta;
    }

    if (property.numKeys > 0) {
        for (keyIndex = 1; keyIndex <= property.numKeys; keyIndex++) {
            property.setValueAtKey(keyIndex, plus(property.keyValue(keyIndex)));
        }
    } else {
        value = property.value;
        property.setValue(plus(value));
    }
};

bezify.shiftLayerPosition = function (layer, dx, dy) {
    var transform = bezify.transformOf(layer);
    var position = transform.property("ADBE Position");
    var is3D = layer.threeDLayer;

    if (position.dimensionsSeparated) {
        bezify.addToProperty(transform.property("ADBE Position_0"), dx);
        bezify.addToProperty(transform.property("ADBE Position_1"), dy);
    } else {
        bezify.addToProperty(position, is3D ? [dx, dy, 0] : [dx, dy]);
    }
};

bezify.setLayerPositionXY = function (layer, x, y, time) {
    var transform = bezify.transformOf(layer);
    var position = transform.property("ADBE Position");

    if (position.dimensionsSeparated) {
        bezify.setPropertyValue(transform.property("ADBE Position_0"), x, time);
        bezify.setPropertyValue(transform.property("ADBE Position_1"), y, time);
    } else {
        bezify.setPropertyValue(position, [x, y], time);
    }
};

bezify.summarize = function (action, done, skipped) {
    var notes = [];
    var reason;
    for (reason in skipped) {
        if (skipped.hasOwnProperty(reason) && skipped[reason] > 0) {
            notes.push(skipped[reason] + " skipped (" + reason + ")");
        }
    }
    if (done === 0) {
        return "ERROR|Nothing changed" + (notes.length ? ": " + notes.join(", ") : ".");
    }
    return "OK|" + action + " on " + done + " layer" + (done === 1 ? "" : "s") + (notes.length ? ", " + notes.join(", ") : "");
};

/* ---------- speed ---------- */
bezify.setSpeed = function (speedPercent, reversed) {
    var speed = Number(speedPercent);

    if (!(speed >= 1 && speed <= 1000)) {
        return "ERROR|Speed must be between 1% and 1000%.";
    }

    return bezify.runUndoable("Bezify: Speed", function () {
        var comp = bezify.getActiveComp();
        var layers;
        var index;
        var layer;
        var done = 0;
        var skipped = { "no footage": 0 };
        var oldStart;
        var newStart;

        if (!comp) { return "ERROR|Open a composition first."; }
        layers = comp.selectedLayers;
        if (layers.length === 0) { return "ERROR|Select a footage or pre-comp layer first."; }

        for (index = 0; index < layers.length; index++) {
            layer = layers[index];
            if (!(layer instanceof AVLayer) || !layer.source || !(layer.source.duration > 0)) {
                skipped["no footage"]++;
                continue;
            }
            /* keep the layer's earliest visible frame where it was */
            oldStart = Math.min(layer.inPoint, layer.outPoint);
            layer.stretch = bezify.toolsMath.speedToStretch(speed, reversed === true || reversed === "true");
            newStart = Math.min(layer.inPoint, layer.outPoint);
            layer.startTime = layer.startTime + (oldStart - newStart);
            done++;
        }

        return bezify.summarize("Speed " + (reversed === true || reversed === "true" ? "-" : "") + Math.round(speed) + "%", done, skipped);
    });
};

/* ---------- fit to comp ---------- */
bezify.fitToComp = function (mode, percent) {
    var fraction = Number(percent) / 100;

    if (!(fraction > 0 && fraction <= 1)) { fraction = 1; }

    return bezify.runUndoable("Bezify: Fit to Comp", function () {
        var comp = bezify.getActiveComp();
        var layers;
        var index;
        var layer;
        var transform;
        var scaleProperty;
        var rotationProperty;
        var anchorProperty;
        var positionProperty;
        var current;
        var signX;
        var signY;
        var rect;
        var rotation;
        var factor;
        var anchor;
        var position;
        var done = 0;
        var skipped = { "not a visual layer": 0, "parented": 0, "3D": 0, "animated or expression": 0, "empty": 0 };
        var time;

        if (!comp) { return "ERROR|Open a composition first."; }
        layers = comp.selectedLayers;
        if (layers.length === 0) { return "ERROR|Select a layer first."; }
        time = comp.time;

        for (index = 0; index < layers.length; index++) {
            layer = layers[index];
            if (!(layer instanceof AVLayer)) { skipped["not a visual layer"]++; continue; }
            if (layer.threeDLayer) { skipped["3D"]++; continue; }

            transform = bezify.transformOf(layer);
            scaleProperty = transform.property("ADBE Scale");
            current = scaleProperty.value;
            signX = current[0] < 0 ? -1 : 1;
            signY = current[1] < 0 ? -1 : 1;

            if (mode === "original") {
                if (scaleProperty.expressionEnabled) { skipped["animated or expression"]++; continue; }
                bezify.setPropertyValue(scaleProperty, [signX * 100, signY * 100], time);
                done++;
                continue;
            }

            if (layer.parent) { skipped["parented"]++; continue; }
            rotationProperty = transform.property("ADBE Rotate Z");
            anchorProperty = transform.property("ADBE Anchor Point");
            positionProperty = transform.property("ADBE Position");
            if (scaleProperty.expressionEnabled || positionProperty.expressionEnabled || rotationProperty.numKeys > 0 || rotationProperty.expressionEnabled || anchorProperty.numKeys > 0 || anchorProperty.expressionEnabled) {
                skipped["animated or expression"]++;
                continue;
            }

            rect = layer.sourceRectAtTime(time, false);
            if (!(rect.width > 0 && rect.height > 0)) { skipped["empty"]++; continue; }

            rotation = rotationProperty.value;
            factor = bezify.toolsMath.fitScale(rect.width, rect.height, rotation, comp.width * fraction, comp.height * fraction, mode === "fill");
            anchor = anchorProperty.value;
            position = bezify.toolsMath.centerPosition(
                [rect.left + rect.width / 2, rect.top + rect.height / 2],
                [anchor[0], anchor[1]],
                [signX * factor, signY * factor],
                rotation,
                [comp.width / 2, comp.height / 2]
            );
            bezify.setPropertyValue(scaleProperty, [signX * factor * 100, signY * factor * 100], time);
            bezify.setLayerPositionXY(layer, position[0], position[1], time);
            done++;
        }

        return bezify.summarize(mode === "original" ? "Scale reset to 100%" : (mode === "fill" ? "Fill" : "Fit " + Math.round(fraction * 100) + "%"), done, skipped);
    });
};

/* ---------- create layers ---------- */
bezify.topSelectedLayer = function (comp) {
    var layers = comp.selectedLayers;
    var top = null;
    var index;
    for (index = 0; index < layers.length; index++) {
        if (top === null || layers[index].index < top.index) { top = layers[index]; }
    }
    return top;
};

/* Time span covered by the selected layers, or null when nothing usable is selected. */
bezify.selectionSpan = function (comp) {
    var layers = comp.selectedLayers;
    var index;
    var start = null;
    var end = null;
    var low;
    var high;

    for (index = 0; index < layers.length; index++) {
        low = Math.min(layers[index].inPoint, layers[index].outPoint);
        high = Math.max(layers[index].inPoint, layers[index].outPoint);
        if (start === null || low < start) { start = low; }
        if (end === null || high > end) { end = high; }
    }
    if (start === null || end - start < comp.frameDuration) { return null; }
    return { start: start, end: end };
};

/* New layers follow the selected layer's length; with no selection they cover the whole comp. */
bezify.placeNewLayer = function (comp, layer, above, span) {
    var start = span ? span.start : 0;
    var end = span ? span.end : comp.duration;

    try {
        layer.startTime = start;
        layer.inPoint = start;
        layer.outPoint = end;
    } catch (ignored) {}
    if (above) {
        try { layer.moveBefore(above); } catch (ignoredMove) {}
    }
};

bezify.createLayer = function (kind) {
    return bezify.runUndoable("Bezify: Create " + kind, function () {
        var comp = bezify.getActiveComp();
        var above;
        var layer;
        var indices;
        var selected;
        var index;
        var rect;
        var transform;
        var span;

        if (!comp) { return "ERROR|Open a composition first."; }
        above = bezify.topSelectedLayer(comp);
        span = bezify.selectionSpan(comp);

        if (kind === "null") {
            layer = comp.layers.addNull(comp.duration);
            bezify.placeNewLayer(comp, layer, above, span);
            return "OK|Null created";
        }
        if (kind === "solid") {
            layer = comp.layers.addSolid([0.5, 0.5, 0.5], "Solid", comp.width, comp.height, comp.pixelAspect, comp.duration);
            bezify.placeNewLayer(comp, layer, above, span);
            return "OK|Solid created";
        }
        if (kind === "adjustment") {
            layer = comp.layers.addSolid([1, 1, 1], "Adjustment Layer", comp.width, comp.height, comp.pixelAspect, comp.duration);
            layer.adjustmentLayer = true;
            bezify.placeNewLayer(comp, layer, above, span);
            return "OK|Adjustment layer created";
        }
        if (kind === "text") {
            layer = comp.layers.addText("Bezify");
            bezify.placeNewLayer(comp, layer, above, span);
            transform = bezify.transformOf(layer);
            rect = layer.sourceRectAtTime(comp.time, false);
            transform.property("ADBE Anchor Point").setValue([rect.left + rect.width / 2, rect.top + rect.height / 2]);
            transform.property("ADBE Position").setValue([comp.width / 2, comp.height / 2]);
            return "OK|Text created";
        }
        if (kind === "camera") {
            layer = comp.layers.addCamera("Camera", [comp.width / 2, comp.height / 2]);
            bezify.placeNewLayer(comp, layer, above, span);
            return "OK|Camera created";
        }
        if (kind === "precompose") {
            selected = comp.selectedLayers;
            if (selected.length === 0) { return "ERROR|Select the layers to pre-compose first."; }
            indices = [];
            for (index = 0; index < selected.length; index++) { indices.push(selected[index].index); }
            indices.sort(function (a, b) { return a - b; });
            comp.layers.precompose(indices, String(selected[0].name).substr(0, 40) + " Comp", true);
            return "OK|Pre-composed " + indices.length + " layer" + (indices.length === 1 ? "" : "s");
        }
        return "ERROR|Unknown layer type.";
    });
};

/* ---------- anchor point ---------- */
bezify.setAnchorPoint = function (column, row) {
    var col = Number(column);
    var rw = Number(row);

    if (!(col >= 0 && col <= 2 && rw >= 0 && rw <= 2)) { return "ERROR|Invalid anchor position."; }

    return bezify.runUndoable("Bezify: Anchor Point", function () {
        var comp = bezify.getActiveComp();
        var layers;
        var index;
        var layer;
        var transform;
        var anchorProperty;
        var scaleProperty;
        var rotationProperty;
        var positionProperty;
        var oldAnchor;
        var newAnchor;
        var rect;
        var scale;
        var delta;
        var done = 0;
        var skipped = { "not a visual layer": 0, "animated or expression": 0, "rotated 3D": 0, "empty": 0 };
        var time;

        function rotatedIn3D(target) {
            var x = target.property("ADBE Rotate X");
            var y = target.property("ADBE Rotate Y");
            var orientation = target.property("ADBE Orientation");
            var o = orientation.value;
            return Math.abs(x.value) > 0.0001 || Math.abs(y.value) > 0.0001 || Math.abs(o[0]) > 0.0001 || Math.abs(o[1]) > 0.0001 || Math.abs(o[2]) > 0.0001;
        }

        if (!comp) { return "ERROR|Open a composition first."; }
        layers = comp.selectedLayers;
        if (layers.length === 0) { return "ERROR|Select a layer first."; }
        time = comp.time;

        for (index = 0; index < layers.length; index++) {
            layer = layers[index];
            if (!(layer instanceof AVLayer)) { skipped["not a visual layer"]++; continue; }

            transform = bezify.transformOf(layer);
            anchorProperty = transform.property("ADBE Anchor Point");
            scaleProperty = transform.property("ADBE Scale");
            rotationProperty = transform.property("ADBE Rotate Z");
            positionProperty = transform.property("ADBE Position");

            if (bezify.isAnimated(anchorProperty) || bezify.isAnimated(scaleProperty) || bezify.isAnimated(rotationProperty) || positionProperty.expressionEnabled) {
                skipped["animated or expression"]++;
                continue;
            }
            if (layer.threeDLayer && rotatedIn3D(transform)) { skipped["rotated 3D"]++; continue; }

            rect = layer.sourceRectAtTime(time, false);
            if (!(rect.width > 0 && rect.height > 0)) { skipped["empty"]++; continue; }

            oldAnchor = anchorProperty.value;
            newAnchor = [rect.left + rect.width * col / 2, rect.top + rect.height * rw / 2];
            scale = scaleProperty.value;
            delta = bezify.toolsMath.anchorShift(
                [oldAnchor[0], oldAnchor[1]],
                newAnchor,
                [scale[0] / 100, scale[1] / 100],
                rotationProperty.value
            );

            anchorProperty.setValue(oldAnchor.length === 3 ? [newAnchor[0], newAnchor[1], oldAnchor[2]] : newAnchor);
            bezify.shiftLayerPosition(layer, delta[0], delta[1]);
            done++;
        }

        return bezify.summarize("Anchor moved", done, skipped);
    });
};

/* ---------- FX library (one small JSON file per effect in presets/fx) ---------- */
bezify.getEffectFolder = function () {
    var base = bezify.getPresetFolder();
    var folder;

    if (!base) { return null; }
    folder = new Folder(base.fsName + "/fx");
    if (!folder.exists && !folder.create()) { return null; }
    return folder;
};

bezify.escapeJSONString = function (text) {
    return String(text).replace(/\\/g, "\\\\").replace(/"/g, "\\\"").replace(/[\r\n\t]/g, " ");
};

bezify.readEffectFile = function (file) {
    var content;
    var nameMatch;
    var matchMatch;

    if (!file.open("r")) { return null; }
    content = file.read();
    file.close();
    nameMatch = /"name"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(content);
    matchMatch = /"matchName"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(content);
    if (!nameMatch || !matchMatch) { return null; }
    return {
        name: nameMatch[1].replace(/\\"/g, "\"").replace(/\\\\/g, "\\"),
        matchName: matchMatch[1].replace(/\\"/g, "\"").replace(/\\\\/g, "\\")
    };
};

bezify.captureSelectedEffect = function () {
    var comp = bezify.getActiveComp();
    var properties;
    var index;
    var effect = null;
    var parade;

    if (!comp) { return "ERROR|Open a composition first."; }
    properties = comp.selectedProperties;
    for (index = 0; index < properties.length; index++) {
        if (properties[index].parentProperty && properties[index].parentProperty.matchName === "ADBE Effect Parade") {
            effect = properties[index];
            break;
        }
    }
    if (!effect && comp.selectedLayers.length === 1) {
        parade = comp.selectedLayers[0].property("ADBE Effect Parade");
        if (parade && parade.numProperties === 1) { effect = parade.property(1); }
    }
    if (!effect) {
        return "ERROR|Select the effect first (click its name in Effect Controls or the timeline), then press Add effect.";
    }
    return "OK|" + String(effect.name).replace(/\|/g, "/") + "|" + effect.matchName;
};

bezify.saveEffect = function (name, matchName) {
    var folder = bezify.getEffectFolder();
    var files;
    var index;
    var existing;
    var base;
    var fileName;
    var counter = 1;
    var file;
    var shownName = String(name).replace(/^\s+|\s+$/g, "");

    if (!folder) { return "ERROR|Could not access the presets folder."; }
    if (shownName.length === 0) { return "ERROR|Give the effect a name."; }

    files = folder.getFiles("*.json");
    for (index = 0; index < files.length; index++) {
        if (files[index] instanceof File) {
            existing = bezify.readEffectFile(files[index]);
            if (existing && existing.matchName === matchName) { return "ERROR|That effect is already in your list (" + existing.name + ")."; }
        }
    }

    base = "fx_" + bezify.safePresetName(shownName);
    fileName = base + ".json";
    while (new File(folder.fsName + "/" + fileName).exists) {
        counter++;
        fileName = base + "_" + counter + ".json";
    }

    file = new File(folder.fsName + "/" + fileName);
    file.encoding = "UTF-8";
    if (!file.open("w")) { return "ERROR|Could not write the effect file."; }
    file.write("{\n  \"type\": \"bezify-effect\",\n  \"version\": 1,\n  \"name\": \"" + bezify.escapeJSONString(shownName) + "\",\n  \"matchName\": \"" + bezify.escapeJSONString(matchName) + "\"\n}\n");
    file.close();
    return "OK|" + fileName + "|" + shownName;
};

bezify.listEffects = function () {
    var folder = bezify.getEffectFolder();
    var files;
    var index;
    var effect;
    var output = ["OK"];

    if (!folder) { return "ERROR|Could not access the presets folder."; }
    files = folder.getFiles("*.json");
    for (index = 0; index < files.length; index++) {
        if (files[index] instanceof File) {
            effect = bezify.readEffectFile(files[index]);
            if (effect) {
                output.push(files[index].name + "|" + effect.name.replace(/\|/g, "/") + "|" + effect.matchName);
            }
        }
    }
    return output.join("\n");
};

bezify.deleteEffect = function (fileName) {
    var folder = bezify.getEffectFolder();
    var file;

    if (!folder) { return "ERROR|Could not access the presets folder."; }
    if (!/^[A-Za-z0-9_\-]+\.json$/.test(fileName)) { return "ERROR|Invalid file name."; }
    file = new File(folder.fsName + "/" + fileName);
    if (file.exists && file.remove()) { return "OK|Effect removed."; }
    return "ERROR|Could not remove the effect.";
};

bezify.applyEffect = function (matchName) {
    return bezify.runUndoable("Bezify: Add effect", function () {
        var comp = bezify.getActiveComp();
        var layers;
        var index;
        var parade;
        var done = 0;
        var failed = 0;

        if (!comp) { return "ERROR|Open a composition first."; }
        layers = comp.selectedLayers;
        if (layers.length === 0) { return "ERROR|Select a layer first."; }

        for (index = 0; index < layers.length; index++) {
            parade = layers[index].property("ADBE Effect Parade");
            if (parade && parade.canAddProperty(matchName)) {
                parade.addProperty(matchName);
                done++;
            } else {
                failed++;
            }
        }
        if (done === 0) { return "ERROR|Could not add this effect. Is the plugin installed?"; }
        return "OK|Effect added to " + done + " layer" + (done === 1 ? "" : "s") + (failed ? ", " + failed + " skipped" : "");
    });
};
