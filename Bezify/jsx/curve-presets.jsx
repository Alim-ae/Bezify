/* ExtendScript JSON storage for user-created curve presets. */
bezify.getPresetFolder = function () {
    var hostFile = new File($.fileName);
    var extensionRoot = hostFile.parent.parent;
    var presetFolder = new Folder(extensionRoot.fsName + "/presets");

    if (!presetFolder.exists && !presetFolder.create()) {
        return null;
    }

    bezify.migrateLegacyPresets(presetFolder);
    return presetFolder;
};

bezify.legacyPresetMigrationDone = false;
bezify.migrateLegacyPresets = function (destinationFolder) {
    var legacyFolder;
    var files;
    var fileIndex;
    var destinationFile;

    if (bezify.legacyPresetMigrationDone) {
        return;
    }
    bezify.legacyPresetMigrationDone = true;
    legacyFolder = new Folder(Folder.userData.fsName + "/Adobe/CEP/extensions/MotionCraft/presets");
    if (!legacyFolder.exists) {
        return;
    }
    files = legacyFolder.getFiles("*.json");
    for (fileIndex = 0; fileIndex < files.length; fileIndex++) {
        if (files[fileIndex] instanceof File) {
            destinationFile = new File(destinationFolder.fsName + "/" + files[fileIndex].name);
            if (!destinationFile.exists) {
                files[fileIndex].copy(destinationFile.fsName);
            }
        }
    }
};

bezify.safePresetName = function (name) {
    var safeName = String(name).replace(/^\s+|\s+$/g, "");

    safeName = safeName.replace(/[^a-zA-Z0-9_-]/g, "_");
    if (safeName.length === 0) {
        safeName = "custom_curve";
    }

    return safeName.substr(0, 48);
};

bezify.readCurvePresetFile = function (presetFile) {
    var content;
    var nameMatch;
    var x1Match;
    var y1Match;
    var x2Match;
    var y2Match;

    if (!presetFile.open("r")) {
        return null;
    }
    content = presetFile.read();
    presetFile.close();

    nameMatch = content.match(/"name"\s*:\s*"([^"]*)"/);
    x1Match = content.match(/"x1"\s*:\s*([-0-9.]+)/);
    y1Match = content.match(/"y1"\s*:\s*([-0-9.]+)/);
    x2Match = content.match(/"x2"\s*:\s*([-0-9.]+)/);
    y2Match = content.match(/"y2"\s*:\s*([-0-9.]+)/);

    if (!nameMatch || !x1Match || !y1Match || !x2Match || !y2Match) {
        return null;
    }

    return {
        name: nameMatch[1],
        x1: parseFloat(x1Match[1]),
        y1: parseFloat(y1Match[1]),
        x2: parseFloat(x2Match[1]),
        y2: parseFloat(y2Match[1])
    };
};

bezify.saveCurvePreset = function (name, x1, y1, x2, y2) {
    var presetFolder = bezify.getPresetFolder();
    var safeName;
    var fileName;
    var presetFile;
    var suffix = 2;
    var content;

    x1 = parseFloat(x1);
    y1 = parseFloat(y1);
    x2 = parseFloat(x2);
    y2 = parseFloat(y2);

    if (!presetFolder) {
        return "ERROR|Could not create the presets folder.";
    }

    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2) || x1 < 0 || x1 > 1 || x2 < 0 || x2 > 1) {
        return "ERROR|The curve values are not valid.";
    }

    safeName = bezify.safePresetName(name);
    fileName = safeName + ".json";
    presetFile = new File(presetFolder.fsName + "/" + fileName);

    while (presetFile.exists) {
        fileName = safeName + "_" + suffix + ".json";
        presetFile = new File(presetFolder.fsName + "/" + fileName);
        suffix++;
    }

    content = "{\n" +
        "  \"type\": \"bezify-curve\",\n" +
        "  \"name\": \"" + safeName + "\",\n" +
        "  \"x1\": " + x1 + ",\n" +
        "  \"y1\": " + y1 + ",\n" +
        "  \"x2\": " + x2 + ",\n" +
        "  \"y2\": " + y2 + "\n" +
        "}";

    if (!presetFile.open("w")) {
        return "ERROR|Could not open the preset file for writing.";
    }
    presetFile.write(content);
    presetFile.close();

    return "OK|" + fileName + "|" + safeName;
};

bezify.listCurvePresets = function () {
    var presetFolder = bezify.getPresetFolder();
    var files;
    var fileIndex;
    var preset;
    var output = ["OK"];

    if (!presetFolder) {
        return "ERROR|Could not access the presets folder.";
    }

    files = presetFolder.getFiles("*.json");
    for (fileIndex = 0; fileIndex < files.length; fileIndex++) {
        if (!(files[fileIndex] instanceof File)) {
            continue;
        }

        if (/^transform_/.test(files[fileIndex].name)) {
            continue;
        }

        preset = bezify.readCurvePresetFile(files[fileIndex]);
        if (preset) {
            output.push(files[fileIndex].name + "|" + preset.name + "|" + preset.x1 + "|" + preset.y1 + "|" + preset.x2 + "|" + preset.y2);
        } else {
            output.push("INVALID|" + files[fileIndex].name);
        }
    }

    return output.join("\n");
};

bezify.deleteCurvePreset = function (fileName) {
    var presetFolder = bezify.getPresetFolder();
    var presetFile;

    if (!presetFolder) {
        return "ERROR|Could not access the presets folder.";
    }

    if (!/^[a-zA-Z0-9_-]+\.json$/.test(fileName)) {
        return "ERROR|That preset filename is not allowed.";
    }

    presetFile = new File(presetFolder.fsName + "/" + fileName);
    if (!presetFile.exists) {
        return "ERROR|That preset no longer exists.";
    }

    if (!presetFile.remove()) {
        return "ERROR|Could not delete the preset.";
    }

    return "OK|Deleted preset.";
};
