/* One-click layer animation and stagger tools. */
bezify.getActiveCompWithLayers = function () {
    var activeItem = app.project.activeItem;

    if (!activeItem || !(activeItem instanceof CompItem)) {
        return null;
    }
    if (activeItem.selectedLayers.length === 0) {
        return null;
    }
    return activeItem;
};

bezify.getTransformProperty = function (layer, matchName) {
    return layer.property("ADBE Transform Group").property(matchName);
};

bezify.addCurveKey = function (property, time, value) {
    property.setValueAtTime(time, value);
    return property.nearestKeyIndex(time);
};

bezify.scaleValue = function (value, multiplier) {
    var result = [];
    var valueIndex;

    if (value instanceof Array) {
        for (valueIndex = 0; valueIndex < value.length; valueIndex++) {
            result.push(value[valueIndex] * multiplier);
        }
        return result;
    }
    return value * multiplier;
};

bezify.copyValue = function (value) {
    var result = [];
    var valueIndex;

    if (value instanceof Array) {
        for (valueIndex = 0; valueIndex < value.length; valueIndex++) {
            result.push(value[valueIndex]);
        }
        return result;
    }
    return value;
};

bezify.applyQuickPreset = function (presetName, duration, direction, x1, y1, x2, y2) {
    var comp = bezify.getActiveCompWithLayers();
    var layerIndex;
    var layer;
    var property;
    var startTime;
    var endTime;
    var middleTime;
    var startValue;
    var endValue;
    var startKey;
    var endKey;
    var middleKey;
    var offsetX;
    var offsetY;

    if (!comp) {
        return "Open a composition and select one or more layers.";
    }
    if (isNaN(duration) || duration <= 0) {
        return "Enter an animation duration greater than zero.";
    }
    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2) || x1 <= 0 || x1 >= 1 || x2 <= 0 || x2 >= 1) {
        return "The current curve has invalid horizontal handle values.";
    }

    app.beginUndoGroup("Apply Bezify Quick Preset");
    try {
        for (layerIndex = 0; layerIndex < comp.selectedLayers.length; layerIndex++) {
            layer = comp.selectedLayers[layerIndex];
            startTime = comp.time;
            endTime = comp.time + duration;

            if (presetName === "slide-in" || presetName === "slide-out") {
                property = bezify.getTransformProperty(layer, "ADBE Position");
                if (property.dimensionsSeparated) {
                    continue;
                }
                startValue = property.valueAtTime(startTime, false);
                endValue = bezify.copyValue(startValue);
                offsetX = 0;
                offsetY = 0;
                if (direction === "right") {
                    offsetX = comp.width;
                } else if (direction === "up") {
                    offsetY = -comp.height;
                } else if (direction === "down") {
                    offsetY = comp.height;
                } else {
                    offsetX = -comp.width;
                }

                if (presetName === "slide-in") {
                    startValue = bezify.copyValue(endValue);
                    startValue[0] += offsetX;
                    startValue[1] += offsetY;
                    startKey = bezify.addCurveKey(property, startTime, startValue);
                    endKey = bezify.addCurveKey(property, endTime, endValue);
                } else {
                    endValue = bezify.copyValue(startValue);
                    endValue[0] += offsetX;
                    endValue[1] += offsetY;
                    startKey = bezify.addCurveKey(property, startTime, startValue);
                    endKey = bezify.addCurveKey(property, endTime, endValue);
                }
                bezify.applyCurveToKeyPair(property, startKey, endKey, x1, y1, x2, y2);
            } else if (presetName === "pop" || presetName === "bounce") {
                property = bezify.getTransformProperty(layer, "ADBE Scale");
                startValue = property.valueAtTime(startTime, false);
                if (presetName === "pop") {
                    endValue = startValue;
                    startKey = bezify.addCurveKey(property, startTime, bezify.scaleValue(startValue, 0));
                    endKey = bezify.addCurveKey(property, endTime, endValue);
                    bezify.applyCurveToKeyPair(property, startKey, endKey, x1, y1, x2, y2);
                } else {
                    middleTime = startTime + duration * 0.6;
                    endValue = startValue;
                    startKey = bezify.addCurveKey(property, startTime, bezify.scaleValue(startValue, 0.72));
                    middleKey = bezify.addCurveKey(property, middleTime, bezify.scaleValue(startValue, 1.15));
                    endKey = bezify.addCurveKey(property, endTime, endValue);
                    bezify.applyCurveToKeyPair(property, startKey, middleKey, x1, y1, x2, y2);
                    bezify.applyCurveToKeyPair(property, middleKey, endKey, x1, y1, x2, y2);
                }
            } else if (presetName === "fade-in" || presetName === "fade-out") {
                property = bezify.getTransformProperty(layer, "ADBE Opacity");
                startValue = property.valueAtTime(startTime, false);
                if (presetName === "fade-in") {
                    startKey = bezify.addCurveKey(property, startTime, 0);
                    endKey = bezify.addCurveKey(property, endTime, startValue);
                } else {
                    startKey = bezify.addCurveKey(property, startTime, startValue);
                    endKey = bezify.addCurveKey(property, endTime, 0);
                }
                bezify.applyCurveToKeyPair(property, startKey, endKey, x1, y1, x2, y2);
            }
        }
    } catch (error) {
        app.endUndoGroup();
        return "Could not apply the preset: " + error.toString();
    }
    app.endUndoGroup();
    return "Applied " + presetName + " to " + comp.selectedLayers.length + " layer(s).";
};

bezify.collectKeyedProperties = function (propertyGroup, result) {
    var propertyIndex;
    var child;

    for (propertyIndex = 1; propertyIndex <= propertyGroup.numProperties; propertyIndex++) {
        child = propertyGroup.property(propertyIndex);
        if (child.propertyType === PropertyType.PROPERTY) {
            if (child.numKeys > 0) {
                result.push(child);
            }
        } else {
            bezify.collectKeyedProperties(child, result);
        }
    }
};

bezify.staggerSelectedLayers = function (frames, mode) {
    var comp = bezify.getActiveCompWithLayers();
    var layers;
    var layerIndex;
    var propertyIndex;
    var keyIndex;
    var properties;
    var offsetMultiplier;
    var center;
    var temporaryLayer;
    var changedProperties = 0;

    if (!comp || comp.selectedLayers.length < 2) {
        return "Select two or more layers to stagger their keyframes.";
    }
    if (isNaN(frames) || frames <= 0) {
        return "Enter a stagger gap greater than zero frames.";
    }

    layers = [];
    for (layerIndex = 0; layerIndex < comp.selectedLayers.length; layerIndex++) {
        layers.push(comp.selectedLayers[layerIndex]);
    }
    layers.sort(function (first, second) { return first.index - second.index; });
    if (mode === "reverse") {
        layers.reverse();
    }
    center = (layers.length - 1) / 2;

    app.beginUndoGroup("Stagger Bezify Keyframes");
    try {
        for (layerIndex = 0; layerIndex < layers.length; layerIndex++) {
            if (mode === "center") {
                offsetMultiplier = Math.abs(layerIndex - center);
            } else {
                offsetMultiplier = layerIndex;
            }
            properties = [];
            bezify.collectKeyedProperties(layers[layerIndex], properties);
            for (propertyIndex = 0; propertyIndex < properties.length; propertyIndex++) {
                for (keyIndex = properties[propertyIndex].numKeys; keyIndex >= 1; keyIndex--) {
                    properties[propertyIndex].setKeyTime(keyIndex, properties[propertyIndex].keyTime(keyIndex) + frames * comp.frameDuration * offsetMultiplier);
                }
                changedProperties++;
            }
        }
    } catch (error) {
        app.endUndoGroup();
        return "Could not stagger the keyframes: " + error.toString();
    }
    app.endUndoGroup();
    return "Staggered " + layers.length + " layers across " + changedProperties + " keyed properties.";
};
