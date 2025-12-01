#!/usr/bin/env powershell
# Zip the pretty-google-calendar folder and place the zip at the same level
$folder = "pretty-google-calendar"
$zip = "pretty-google-calendar.zip"
$parent = Split-Path -Parent $PSScriptRoot
$zipPath = Join-Path $parent $zip
$folderPath = Join-Path $parent $folder

if (Test-Path $zipPath) {
    Remove-Item $zipPath -Force
}
Compress-Archive -Path $folderPath -DestinationPath $zipPath -Force
Write-Host "Zipped $folder to $zipPath"
