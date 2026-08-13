Add-Type -AssemblyName System.Drawing
$dir = "D:\Origin_jerry\Origin-Explore\docs\design-references\ai-explore-poker-820d0558\chat-6ea4b827"
Get-ChildItem -Path $dir -Filter *.png | ForEach-Object {
  $img = [System.Drawing.Image]::FromFile($_.FullName)
  $out = [System.IO.Path]::ChangeExtension($_.FullName, ".jpg")
  $img.Save($out, [System.Drawing.Imaging.ImageFormat]::Jpeg)
  $img.Dispose()
  Write-Host "converted $($_.Name) -> $(Split-Path $out -Leaf)"
}
