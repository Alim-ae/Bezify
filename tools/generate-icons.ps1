Add-Type -AssemblyName System.Drawing

$out = Join-Path $PSScriptRoot "..\Bezify\icons"
New-Item -ItemType Directory -Force -Path $out | Out-Null

function New-BezifyIcon([int]$size, [string]$name, [bool]$dark) {
    $bitmap = New-Object System.Drawing.Bitmap $size, $size
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $scale = $size / 48.0
    $accent = [System.Drawing.ColorTranslator]::FromHtml("#D97757")
    $panel = [System.Drawing.ColorTranslator]::FromHtml($(if ($dark) { "#1E1E1E" } else { "#2A2A2A" }))
    $text = [System.Drawing.ColorTranslator]::FromHtml("#ECE7E1")
    $rect = New-Object System.Drawing.RectangleF (1.5*$scale), (1.5*$scale), (45*$scale), (45*$scale)
    $path = New-Object System.Drawing.Drawing2D.GraphicsPath
    $radius = 10.5*$scale; $d = $radius*2
    $path.AddArc($rect.X,$rect.Y,$d,$d,180,90); $path.AddArc($rect.Right-$d,$rect.Y,$d,$d,270,90); $path.AddArc($rect.Right-$d,$rect.Bottom-$d,$d,$d,0,90); $path.AddArc($rect.X,$rect.Bottom-$d,$d,$d,90,90); $path.CloseFigure()
    $graphics.FillPath((New-Object System.Drawing.SolidBrush $panel),$path)
    $graphics.DrawPath((New-Object System.Drawing.Pen $accent,(2*$scale)),$path)
    $pen = New-Object System.Drawing.Pen $accent,(3*$scale); $pen.StartCap=[System.Drawing.Drawing2D.LineCap]::Round; $pen.EndCap=[System.Drawing.Drawing2D.LineCap]::Round
    $curve = New-Object System.Drawing.Drawing2D.GraphicsPath
    $curve.AddBezier((12*$scale),(36*$scale),(28*$scale),(36*$scale),(20*$scale),(12*$scale),(36*$scale),(12*$scale))
    $graphics.DrawPath($pen,$curve)
    foreach($dot in @(@(12,36,3.2,$text),@(36,12,3.2,$text),@(28,36,2.4,$accent),@(20,12,2.4,$accent))) {
        $brush = New-Object System.Drawing.SolidBrush $dot[3]
        $r = $dot[2] * $scale
        $graphics.FillEllipse($brush, (($dot[0] * $scale) - $r), (($dot[1] * $scale) - $r), (2 * $r), (2 * $r))
        $brush.Dispose()
    }
    $bitmap.Save((Join-Path $out $name),[System.Drawing.Imaging.ImageFormat]::Png)
    $graphics.Dispose();$bitmap.Dispose()
}

New-BezifyIcon 23 "bezify-23.png" $false
New-BezifyIcon 23 "bezify-23-dark.png" $true
New-BezifyIcon 46 "bezify-46.png" $false
New-BezifyIcon 46 "bezify-46-dark.png" $true
