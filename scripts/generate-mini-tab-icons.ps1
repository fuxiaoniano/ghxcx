param(
  [string]$OutputDirectory = (Join-Path $PSScriptRoot '..\miniprogram\miniprogram\assets\tabbar')
)

Add-Type -AssemblyName System.Drawing

$null = New-Item -ItemType Directory -Path $OutputDirectory -Force

function New-RoundedRectanglePath {
  param([float]$X, [float]$Y, [float]$Width, [float]$Height, [float]$Radius)
  $path = [System.Drawing.Drawing2D.GraphicsPath]::new()
  $diameter = $Radius * 2
  $path.AddArc($X, $Y, $diameter, $diameter, 180, 90)
  $path.AddArc($X + $Width - $diameter, $Y, $diameter, $diameter, 270, 90)
  $path.AddArc($X + $Width - $diameter, $Y + $Height - $diameter, $diameter, $diameter, 0, 90)
  $path.AddArc($X, $Y + $Height - $diameter, $diameter, $diameter, 90, 90)
  $path.CloseFigure()
  return $path
}

function New-TabIcon {
  param(
    [ValidateSet('home', 'doctor', 'booking', 'package', 'profile')][string]$Name,
    [string]$Color,
    [string]$Suffix
  )

  $bitmap = [System.Drawing.Bitmap]::new(81, 81, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.Clear([System.Drawing.Color]::Transparent)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $pen = [System.Drawing.Pen]::new([System.Drawing.ColorTranslator]::FromHtml($Color), 4.4)
  $pen.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
  $pen.LineJoin = [System.Drawing.Drawing2D.LineJoin]::Round

  switch ($Name) {
    'home' {
      $graphics.DrawLines($pen, [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(15, 38),
        [System.Drawing.PointF]::new(40.5, 16),
        [System.Drawing.PointF]::new(66, 38)
      ))
      $graphics.DrawLines($pen, [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(21, 34),
        [System.Drawing.PointF]::new(21, 64),
        [System.Drawing.PointF]::new(60, 64),
        [System.Drawing.PointF]::new(60, 34)
      ))
      $graphics.DrawLines($pen, [System.Drawing.PointF[]]@(
        [System.Drawing.PointF]::new(35, 64),
        [System.Drawing.PointF]::new(35, 48),
        [System.Drawing.PointF]::new(46, 48),
        [System.Drawing.PointF]::new(46, 64)
      ))
    }
    'doctor' {
      $graphics.DrawEllipse($pen, 31, 13, 19, 19)
      $graphics.DrawArc($pen, 17, 29, 47, 39, 188, 164)
      $graphics.DrawLine($pen, 29, 39, 36, 47)
      $graphics.DrawLine($pen, 52, 39, 45, 47)
      $graphics.DrawLine($pen, 36, 47, 40.5, 64)
      $graphics.DrawLine($pen, 45, 47, 40.5, 64)
      $graphics.DrawLine($pen, 57, 30, 57, 42)
      $graphics.DrawLine($pen, 51, 36, 63, 36)
    }
    'booking' {
      $path = New-RoundedRectanglePath 15 20 51 46 7
      $graphics.DrawPath($pen, $path)
      $path.Dispose()
      $graphics.DrawLine($pen, 16, 34, 65, 34)
      $graphics.DrawLine($pen, 28, 15, 28, 25)
      $graphics.DrawLine($pen, 53, 15, 53, 25)
      $graphics.DrawLine($pen, 40.5, 43, 40.5, 58)
      $graphics.DrawLine($pen, 33, 50.5, 48, 50.5)
    }
    'package' {
      $path = New-RoundedRectanglePath 17 26 47 40 7
      $graphics.DrawPath($pen, $path)
      $path.Dispose()
      $graphics.DrawArc($pen, 29, 13, 23, 27, 180, 180)
      $graphics.DrawLine($pen, 29, 27, 29, 34)
      $graphics.DrawLine($pen, 52, 27, 52, 34)
      $graphics.DrawLine($pen, 29, 48, 52, 48)
    }
    'profile' {
      $graphics.DrawEllipse($pen, 31, 13, 19, 21)
      $graphics.DrawArc($pen, 17, 31, 47, 37, 187, 166)
      $graphics.DrawLine($pen, 25, 62, 25, 54)
      $graphics.DrawLine($pen, 56, 62, 56, 54)
    }
  }

  $filePath = Join-Path $OutputDirectory "$Name-$Suffix.png"
  $bitmap.Save($filePath, [System.Drawing.Imaging.ImageFormat]::Png)
  $pen.Dispose()
  $graphics.Dispose()
  $bitmap.Dispose()
}

$icons = @('home', 'doctor', 'booking', 'package', 'profile')
foreach ($icon in $icons) {
  New-TabIcon -Name $icon -Color '#657287' -Suffix 'default'
  New-TabIcon -Name $icon -Color '#3478F6' -Suffix 'active'
}
