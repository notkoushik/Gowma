Add-Type -AssemblyName System.Drawing

$srcPath = "C:\Users\koushik\Downloads\gomaa_intro.jpg"
$destDir = "D:\New_project\GOMAA\Gowmaa\src\assets\landing"

if (-not (Test-Path $destDir)) {
    New-Item -ItemType Directory -Path $destDir -Force | Out-Null
}

$bmp = [System.Drawing.Bitmap]::FromFile($srcPath)

function Crop-Image($name, $x, $y, $w, $h) {
    $rect = New-Object System.Drawing.Rectangle($x, $y, $w, $h)
    $cropped = $bmp.Clone($rect, $bmp.PixelFormat)
    $outPath = Join-Path $destDir ($name + ".jpg")
    $cropped.Save($outPath, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $cropped.Dispose()
    Write-Host "Saved: $name ($w x $h)"
}

# 1. Hero visual (cow + calf + temple background + sanskrit calligraphy)
# ~ x=680 to 1480, y=30 to 450
Crop-Image "hero_sacred_cow" 680 30 800 420

# 2. Spotlight 1: Sponsor Cattle Feed banner image / left
Crop-Image "banner_feed" 80 460 600 100

# 3. Spotlight 2: Special Seva Packages banner
Crop-Image "banner_seva_packages" 700 460 480 100

# 4. Spotlight 3: Corporate Partnerships
Crop-Image "banner_corporate" 1200 460 260 100

# 5. Cattle cards
# Lakshmi
Crop-Image "cattle_lakshmi" 85 640 210 145
# Kamadhenu
Crop-Image "cattle_kamadhenu" 315 640 210 145
# Nandini
Crop-Image "cattle_nandini" 545 640 210 145
# Mahabala
Crop-Image "cattle_mahabala" 775 640 210 145
# Savitri
Crop-Image "cattle_savitri" 1005 640 210 145
# Chaitra
Crop-Image "cattle_chaitra" 1235 640 210 145

# 6. Blog Cards
# Blog 1
Crop-Image "blog_gau_seva" 80 865 215 110
# Blog 2
Crop-Image "blog_festivals" 310 865 215 110
# Blog 3
Crop-Image "blog_gaushalas" 540 865 215 110

# 7. Impact section cow portrait (left part of impact banner)
Crop-Image "impact_cow_portrait" 780 830 210 180

# 8. Logo emblem
Crop-Image "gomaa_logo_emblem" 95 18 52 52

$bmp.Dispose()
Write-Host "All crops saved successfully."
