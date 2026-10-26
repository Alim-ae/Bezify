/* Transform capture, JSON storage, and application tools. */
bezify.numberToJSON = function (number) {
    return isNaN(number) ? "0" : String(number);
};

bezify.valueToJSON = function (value) {
    var valueIndex;
    var values = [];

    if (value instanceof Array) {
        for (valueIndex = 0; valueIndex < value.length; valueIndex++) {
            values.push(bezify.numberToJSON(value[valueIndex]));
        }
        return "[" + values.join(",") + "]";
    }
    return bezify.numberToJSON(value);
};

bezify.easeToJSON = function (easeArray) {
    var easeIndex;
    var values = [];

    for (easeIndex = 0; easeIndex < easeArray.length; easeIndex++) {
        values.push("{\"speed\":" + bezify.numberToJSON(easeArray[easeIndex].speed) + ",\"influence\":" + bezify.numberToJSON(easeArray[easeIndex].influence) + "}");
    }
    return "[" + values.join(",") + "]";
};

bezify.captureTransformProperty = function (property) {
    var keyIndex;
    var keys = [];

    for (keyIndex = 1; keyIndex <= property.numKeys; keyIndex++) {
        keys.push("{\"time\":" + bezify.numberToJSON(property.keyTime(keyIndex)) + ",\"value\":" + bezify.valueToJSON(property.keyValue(keyIndex)) + ",\"inEase\":" + bezify.easeToJSON(property.keyInTemporalEase(keyIndex)) + ",\"outEase\":" + bezify.easeToJSON(property.keyOutTemporalEase(keyIndex)) + "}");
    }

    return "{\"matchName\":\"" + property.matchName + "\",\"value\":" + bezify.valueToJSON(property.value) + ",\"keys\":[" + keys.join(",") + "]}";
};

bezify.captureSelectedTransform = function () {
    var comp = bezify.getActiveCompWithLayers();
    var layer;
    var transform;
    var propertyNames = ["ADBE Anchor Point", "ADBE Position", "ADBE Scale", "ADBE Rotate Z", "ADBE Opacity", "ADBE Rotate X", "ADBE Rotate Y"];
    var propertyIndex;
    var property;
    var properties = [];

    if (!comp) {
        return "ERROR|Open a composition and select one layer to capture its transform.";
    }

    layer = comp.selectedLayers[0];
    transform = layer.property("ADBE Transform Group");
    for (propertyIndex = 0; propertyIndex < propertyNames.length; propertyIndex++) {
        property = transform.property(propertyNames[propertyIndex]);
        if (property) {
            properties.push(bezify.captureTransformProperty(property));
        }
    }

    return "{\"type\":\"bezify-transform\",\"version\":1,\"sourceLayer\":\"" + bezify.safePresetName(layer.name) + "\",\"properties\":[" + properties.join(",") + "]}";
};

bezify.isTransformPresetJSON = function (content) {
    return /"type"\s*:\s*"(bezify|motioncraft)-transform"/.test(content);
};

bezify.transformPresetFileName = function (name, exceptFileName) {
    var presetFolder = bezify.getPresetFolder();
    var baseName = "transform_" + bezify.safePresetName(name);
    var fileName = baseName + ".json";
    var presetFile = new File(presetFolder.fsName + "/" + fileName);
    var suffix = 2;

    while (presetFile.exists && fileName !== exceptFileName) {
        fileName = baseName + "_" + suffix + ".json";
        presetFile = new File(presetFolder.fsName + "/" + fileName);
        suffix++;
    }
    return fileName;
};

bezify.saveTransformPreset = function (name, content) {
    var presetFolder = bezify.getPresetFolder();
    var fileName;
    var presetFile;

    if (!presetFolder || !bezify.isTransformPresetJSON(content)) {
        return "ERROR|The captured transform preset is not valid.";
    }
    fileName = bezify.transformPresetFileName(name, "");
    presetFile = new File(presetFolder.fsName + "/" + fileName);
    if (!presetFile.open("w")) {
        return "ERROR|Could not write the transform preset.";
    }
    presetFile.write(content);
    presetFile.close();
    return "OK|" + fileName + "|" + bezify.safePresetName(name);
};

bezify.listTransformPresets = function () {
    var presetFolder = bezify.getPresetFolder();
    var files;
    var fileIndex;
    var file;
    var content;
    var nameMatch;
    var output = ["OK"];

    if (!presetFolder) {
        return "ERROR|Could not access the presets folder.";
    }
    files = presetFolder.getFiles("transform_*.json");
    for (fileIndex = 0; fileIndex < files.length; fileIndex++) {
        file = files[fileIndex];
        if (!(file instanceof File) || !file.open("r")) {
            continue;
        }
        content = file.read();
        file.close();
        nameMatch = content.match(/"name"\s*:\s*"([^"]*)"/);
        if (bezify.isTransformPresetJSON(content)) {
            output.push(file.name + "|" + (nameMatch ? nameMatch[1] : file.name.replace(/^transform_/, "").replace(/\.json$/, "")));
        }
    }
    return output.join("\n");
};

bezify.readTransformPreset = function (fileName) {
    var presetFolder = bezify.getPresetFolder();
    var presetFile;
    var content;

    if (!presetFolder || !/^transform_[a-zA-Z0-9_-]+\.json$/.test(fileName)) {
        return "ERROR|That transform preset filename is not allowed.";
    }
    presetFile = new File(presetFolder.fsName + "/" + fileName);
    if (!presetFile.exists || !presetFile.open("r")) {
        return "ERROR|Could not open that transform preset.";
    }
    content = presetFile.read();
    presetFile.close();
    return bezify.isTransformPresetJSON(content) ? content : "ERROR|That file is not a Bezify transform preset.";
};

bezify.deleteTransformPreset = function (fileName) {
    var presetFolder = bezify.getPresetFolder();
    var presetFile;

    if (!presetFolder || !/^transform_[a-zA-Z0-9_-]+\.json$/.test(fileName)) {
        return "ERROR|That transform preset filename is not allowed.";
    }
    presetFile = new File(presetFolder.fsName + "/" + fileName);
    return presetFile.exists && presetFile.remove() ? "OK|Deleted transform preset." : "ERROR|Could not delete the transform preset.";
};

bezify.renameTransformPreset = function (oldFileName, newName, content) {
    var presetFolder = bezify.getPresetFolder();
    var newFileName;
    var newFile;
    var oldFile;

    if (!presetFolder || !/^transform_[a-zA-Z0-9_-]+\.json$/.test(oldFileName) || !bezify.isTransformPresetJSON(content)) {
        return "ERROR|Could not rename the transform preset.";
    }
    newFileName = bezify.transformPresetFileName(newName, oldFileName);
    newFile = new File(presetFolder.fsName + "/" + newFileName);
    if (!newFile.open("w")) {
        return "ERROR|Could not write the renamed transform preset.";
    }
    newFile.write(content);
    newFile.close();
    if (newFileName !== oldFileName) {
        oldFile = new File(presetFolder.fsName + "/" + oldFileName);
        oldFile.remove();
    }
    return "OK|" + newFileName + "|" + bezify.safePresetName(newName);
};

bezify.makeCapturedEaseArray = function (easeData) {
    var easeIndex;
    var easeArray = [];

    for (easeIndex = 0; easeIndex < easeData.length; easeIndex++) {
        easeArray.push(new KeyframeEase(easeData[easeIndex].speed, easeData[easeIndex].influence));
    }
    return easeArray;
};

bezify.applyTransformPreset = function (preset) {
    var comp = bezify.getActiveCompWithLayers();
    var layerIndex;
    var propertyIndex;
    var keyIndex;
    var layer;
    var property;
    var propertyData;
    var keyData;
    var appliedLayers = 0;

    if (!comp || !preset || (preset.type !== "bezify-transform" && preset.type !== "motioncraft-transform") || !preset.properties) {
        return "Open a composition, select target layers, and choose a valid transform preset.";
    }

    app.beginUndoGroup("Apply Bezify Transform Preset");
    try {
        for (layerIndex = 0; layerIndex < comp.selectedLayers.length; layerIndex++) {
            layer = comp.selectedLayers[layerIndex];
            for (propertyIndex = 0; propertyIndex < preset.properties.length; propertyIndex++) {
                propertyData = preset.properties[propertyIndex];
                property = bezify.getTransformProperty(layer, propertyData.matchName);
                if (!property) {
                    continue;
                }
                for (keyIndex = property.numKeys; keyIndex >= 1; keyIndex--) {
                    property.removeKey(keyIndex);
                }
                if (propertyData.keys.length === 0) {
                    property.setValue(propertyData.value);
                } else {
                    for (keyIndex = 0; keyIndex < propertyData.keys.length; keyIndex++) {
                        keyData = propertyData.keys[keyIndex];
                        property.setValueAtTime(keyData.time, keyData.value);
                    }
                    for (keyIndex = 0; keyIndex < propertyData.keys.length; keyIndex++) {
                        keyData = propertyData.keys[keyIndex];
                        property.setInterpolationTypeAtKey(keyIndex + 1, KeyframeInterpolationType.BEZIER, KeyframeInterpolationType.BEZIER);
                        property.setTemporalAutoBezierAtKey(keyIndex + 1, false);
                        property.setTemporalContinuousAtKey(keyIndex + 1, false);
                        property.setTemporalEaseAtKey(keyIndex + 1, bezify.makeCapturedEaseArray(keyData.inEase), bezify.makeCapturedEaseArray(keyData.outEase));
                    }
                }
            }
            appliedLayers++;
        }
    } catch (error) {
        app.endUndoGroup();
        return "Could not apply the transform preset: " + error.toString();
    }
    app.endUndoGroup();
    return "Applied the transform preset to " + appliedLayers + " layer(s).";
};
