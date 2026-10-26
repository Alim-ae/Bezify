/* ExtendScript (ES3) host functions for Bezify. */
var bezify = bezify || {};

bezify.getSelectedLayerName = function () {
    var activeItem = app.project.activeItem;

    if (!activeItem || !(activeItem instanceof CompItem)) {
        return "Open a composition, then select a layer.";
    }

    if (activeItem.selectedLayers.length === 0) {
        return "Select one layer, then try again.";
    }

    return "Selected layer: " + activeItem.selectedLayers[0].name;
};

bezify.valueToText = function (value) {
    var values;
    var i;
    var result = [];

    if (value instanceof Array) {
        values = value;
        for (i = 0; i < values.length; i++) {
            result.push(values[i]);
        }
        return "[" + result.join(", ") + "]";
    }

    return String(value);
};

bezify.getSelectedKeyframes = function () {
    var activeItem = app.project.activeItem;
    var selectedProperties;
    var property;
    var propertyIndex;
    var keyIndex;
    var output = [];
    var foundKeyframes = false;
    var propertyHasSelectedKeys;

    if (!activeItem || !(activeItem instanceof CompItem)) {
        return "Open a composition, then select property keyframes.";
    }

    selectedProperties = activeItem.selectedProperties;
    if (!selectedProperties || selectedProperties.length === 0) {
        return "Select a property with one or more keyframes.";
    }

    for (propertyIndex = 0; propertyIndex < selectedProperties.length; propertyIndex++) {
        property = selectedProperties[propertyIndex];
        propertyHasSelectedKeys = false;

        if (typeof property.keySelected !== "function" || property.numKeys === 0) {
            continue;
        }

        for (keyIndex = 1; keyIndex <= property.numKeys; keyIndex++) {
            if (property.keySelected(keyIndex)) {
                if (!propertyHasSelectedKeys) {
                    output.push("Property: " + property.name);
                }
                output.push("#" + keyIndex + "  |  " + property.keyTime(keyIndex).toFixed(3) + "s  |  " + bezify.valueToText(property.keyValue(keyIndex)));
                foundKeyframes = true;
                propertyHasSelectedKeys = true;
            }
        }
    }

    if (!foundKeyframes) {
        return "Select one or more keyframes in the Timeline, then try again.";
    }

    return output.join("\n");
};

bezify.getValueComponent = function (value, componentIndex) {
    if (value instanceof Array) {
        return value[componentIndex];
    }
    return value;
};

bezify.getSpatialDistance = function (startValue, endValue) {
    var componentIndex;
    var distanceSquared = 0;
    var difference;

    for (componentIndex = 0; componentIndex < startValue.length; componentIndex++) {
        difference = endValue[componentIndex] - startValue[componentIndex];
        distanceSquared += difference * difference;
    }

    return Math.sqrt(distanceSquared);
};

bezify.makeTemporalEase = function (property, startKey, endKey, slope, influence) {
    var startValue = property.keyValue(startKey);
    var endValue = property.keyValue(endKey);
    var duration = property.keyTime(endKey) - property.keyTime(startKey);
    var dimensionCount = property.keyOutTemporalEase(startKey).length;
    var easeArray = [];
    var componentIndex;
    var distance;
    var speed;
    var isSpatial = property.propertyValueType === PropertyValueType.TwoD_SPATIAL || property.propertyValueType === PropertyValueType.ThreeD_SPATIAL;

    if (isSpatial) {
        distance = bezify.getSpatialDistance(startValue, endValue);
        easeArray.push(new KeyframeEase((distance / duration) * slope, influence));
        return easeArray;
    }

    for (componentIndex = 0; componentIndex < dimensionCount; componentIndex++) {
        distance = bezify.getValueComponent(endValue, componentIndex) - bezify.getValueComponent(startValue, componentIndex);
        speed = (distance / duration) * slope;
        easeArray.push(new KeyframeEase(speed, influence));
    }

    return easeArray;
};

bezify.applyCurveToKeyPair = function (property, startKey, endKey, x1, y1, x2, y2) {
    var safeX1 = Math.max(0.001, Math.min(0.999, x1));
    var safeX2 = Math.max(0.001, Math.min(0.999, x2));
    var startSlope = y1 / safeX1;
    var endSlope = (1 - y2) / (1 - safeX2);
    var startInfluence = Math.max(0.1, Math.min(100, safeX1 * 100));
    var endInfluence = Math.max(0.1, Math.min(100, (1 - safeX2) * 100));
    var startInEase = property.keyInTemporalEase(startKey);
    var startOutEase = bezify.makeTemporalEase(property, startKey, endKey, startSlope, startInfluence);
    var endInEase = bezify.makeTemporalEase(property, startKey, endKey, endSlope, endInfluence);
    var endOutEase = property.keyOutTemporalEase(endKey);
    var startInInterpolation = property.keyInInterpolationType(startKey);
    var endOutInterpolation = property.keyOutInterpolationType(endKey);

    property.setInterpolationTypeAtKey(startKey, startInInterpolation, KeyframeInterpolationType.BEZIER);
    property.setTemporalAutoBezierAtKey(startKey, false);
    property.setTemporalContinuousAtKey(startKey, false);
    property.setTemporalEaseAtKey(startKey, startInEase, startOutEase);
    property.setInterpolationTypeAtKey(endKey, KeyframeInterpolationType.BEZIER, endOutInterpolation);
    property.setTemporalAutoBezierAtKey(endKey, false);
    property.setTemporalContinuousAtKey(endKey, false);
    property.setTemporalEaseAtKey(endKey, endInEase, endOutEase);
};

bezify.applyCubicBezier = function (x1, y1, x2, y2) {
    var activeItem = app.project.activeItem;
    var selectedProperties;
    var property;
    var propertyIndex;
    var keyIndex;
    var selectedKeyIndexes;
    var selectedKeyIndex;
    var startKey;
    var endKey;
    var startSlope;
    var endSlope;
    var startInfluence;
    var endInfluence;
    var startInEase;
    var startOutEase;
    var endInEase;
    var endOutEase;
    var startInInterpolation;
    var endOutInterpolation;
    var appliedSegments = 0;
    var skippedSegments = 0;

    if (!activeItem || !(activeItem instanceof CompItem)) {
        return "Open a composition, then select adjacent keyframes.";
    }

    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
        return "All four cubic-bezier values must be numbers.";
    }

    if (x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
        return "Use horizontal handle values between 0 and 1.";
    }

    selectedProperties = activeItem.selectedProperties;
    if (!selectedProperties || selectedProperties.length === 0) {
        return "Select a property with at least two adjacent keyframes.";
    }

    startSlope = y1 / x1;
    endSlope = (1 - y2) / (1 - x2);
    startInfluence = Math.max(0.1, Math.min(100, x1 * 100));
    endInfluence = Math.max(0.1, Math.min(100, (1 - x2) * 100));

    app.beginUndoGroup("Apply Bezify Cubic Bezier");
    try {
        for (propertyIndex = 0; propertyIndex < selectedProperties.length; propertyIndex++) {
            property = selectedProperties[propertyIndex];

            if (typeof property.keySelected !== "function" || property.numKeys < 2) {
                continue;
            }

            selectedKeyIndexes = [];
            for (keyIndex = 1; keyIndex <= property.numKeys; keyIndex++) {
                if (property.keySelected(keyIndex)) {
                    selectedKeyIndexes.push(keyIndex);
                }
            }

            for (selectedKeyIndex = 0; selectedKeyIndex < selectedKeyIndexes.length - 1; selectedKeyIndex++) {
                startKey = selectedKeyIndexes[selectedKeyIndex];
                endKey = selectedKeyIndexes[selectedKeyIndex + 1];

                if (endKey !== startKey + 1) {
                    skippedSegments++;
                    continue;
                }

                bezify.applyCurveToKeyPair(property, startKey, endKey, x1, y1, x2, y2);
                appliedSegments++;
            }
        }
    } catch (error) {
        app.endUndoGroup();
        return "Could not apply the curve: " + error.toString();
    }
    app.endUndoGroup();

    if (appliedSegments === 0) {
        return "Select at least two adjacent keyframes on an animatable numeric property.";
    }

    if (skippedSegments > 0) {
        return "Applied the curve to " + appliedSegments + " adjacent segment(s). Skipped " + skippedSegments + " non-adjacent selection(s).";
    }

    return "Applied cubic-bezier(" + x1 + ", " + y1 + ", " + x2 + ", " + y2 + ") to " + appliedSegments + " segment(s).";
};

#include "curve-presets.jsx"
#include "presets.jsx"
#include "capture.jsx"
#include "tools.jsx"
