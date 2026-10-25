# Bezify uninstaller for Windows. Removes the panel and backs up your saved presets to the Desktop.

$ErrorActionPreference = "Stop"

$destination = Join-Path $env:APPDATA "Adobe\CEP\extensions\Bezify"

if (Get-Process -Name "AfterFX" -ErrorAction SilentlyContinue) {
    Write-Host "After Effects is running. Close it completely, then run this again." -ForegroundColor Yellow
    exit 1
}

if (-not (Test-Path $destination)) {
    Write-Host "Bezify is not installed (nothing to remove)."
    exit 0
}

try {
    $presets = Join-Path $destination "presets"
    if (Test-Path $presets) {
        $saved = Get-ChildItem $presets -Recurse -Filter "*.json" -File -ErrorAction SilentlyContinue
        if ($saved) {
            $desktop = [Environment]::GetFolderPath("Desktop")
            $backup = Join-Path $desktop ("Bezify-presets-backup-" + (Get-Date -Format "yyyyMMdd-HHmm"))
            Copy-Item $presets $backup -Recurse -Force
            Write-Host "Your saved presets were copied to: $backup"
        }
    }

    Remove-Item $destination -Recurse -Force

    Write-Host ""
    Write-Host "Bezify was removed." -ForegroundColor Green
    Write-Host "Note: PlayerDebugMode was left on, because other panels may need it."
}
catch {
    Write-Host ""
    Write-Host "Uninstall failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Close After Effects and any open windows for the plugin folder, then try again."
    exit 1
}
