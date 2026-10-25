# Bezify installer for Windows (After Effects CEP panel)
# Run from the folder that contains this script and the "Bezify" folder.

$ErrorActionPreference = "Stop"

$source = Join-Path $PSScriptRoot "Bezify"
$extensionsRoot = Join-Path $env:APPDATA "Adobe\CEP\extensions"
$destination = Join-Path $extensionsRoot "Bezify"
$legacy = Join-Path $extensionsRoot "MotionCraft"
$backup = Join-Path $env:TEMP "bezify-presets-backup"

if (-not (Test-Path (Join-Path $source "CSXS\manifest.xml"))) {
    Write-Host "ERROR: Could not find the Bezify folder next to install.ps1." -ForegroundColor Red
    Write-Host "Extract the whole zip first, then run this script from the extracted folder."
    exit 1
}

if (Get-Process -Name "AfterFX" -ErrorAction SilentlyContinue) {
    Write-Host "After Effects is running. Close it completely, then run this installer again." -ForegroundColor Yellow
    exit 1
}

try {
    # 1. Allow unsigned panels (PlayerDebugMode)
    foreach ($version in 9..13) {
        $key = "HKCU:\Software\Adobe\CSXS.$version"
        if (-not (Test-Path $key)) { New-Item -Path $key -Force | Out-Null }
        New-ItemProperty -Path $key -Name "PlayerDebugMode" -PropertyType String -Value "1" -Force | Out-Null
    }

    # 2. Keep any presets already saved in an existing Bezify install
    if (Test-Path $backup) { Remove-Item $backup -Recurse -Force }
    New-Item -ItemType Directory -Path $backup -Force | Out-Null
    $existingPresets = Join-Path $destination "presets"
    if (Test-Path $existingPresets) {
        Copy-Item (Join-Path $existingPresets "*") $backup -Recurse -Force -ErrorAction SilentlyContinue
    }

    # 3. Fresh copy of the panel
    New-Item -ItemType Directory -Path $extensionsRoot -Force | Out-Null
    if (Test-Path $destination) { Remove-Item $destination -Recurse -Force }
    Copy-Item $source $destination -Recurse -Force
    $newPresets = Join-Path $destination "presets"
    New-Item -ItemType Directory -Path $newPresets -Force | Out-Null

    # 4. Restore Bezify presets, then migrate old MotionCraft presets (never overwrite)
    Copy-Item (Join-Path $backup "*") $newPresets -Recurse -Force -ErrorAction SilentlyContinue
    $legacyPresets = Join-Path $legacy "presets"
    $migrated = 0
    if (Test-Path $legacyPresets) {
        Get-ChildItem $legacyPresets -Filter "*.json" -File | ForEach-Object {
            $target = Join-Path $newPresets $_.Name
            if (-not (Test-Path $target)) {
                Copy-Item $_.FullName $target
                $migrated++
            }
        }
    }

    # 5. Remove the old MotionCraft panel only after its presets were copied
    if (Test-Path $legacy) { Remove-Item $legacy -Recurse -Force }

    Remove-Item $backup -Recurse -Force -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host "Bezify installed successfully." -ForegroundColor Green
    Write-Host "Location: $destination"
    if ($migrated -gt 0) { Write-Host "Migrated $migrated saved preset file(s) from MotionCraft." }
    Write-Host "Next: start After Effects, then open Window > Extensions (Legacy) > Bezify."
}
catch {
    Write-Host ""
    Write-Host "Install failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Close After Effects and any open file windows for the plugin folder, then try again."
    exit 1
}
