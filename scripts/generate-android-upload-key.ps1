$ErrorActionPreference = "Stop"

$androidDirectory = Join-Path $PSScriptRoot "..\android"
$keystorePath = Join-Path $androidDirectory "crewsync-upload.jks"
$propertiesPath = Join-Path $androidDirectory "keystore.properties"
$keytoolPath = "C:\Program Files\Eclipse Adoptium\jdk-21.0.12.8-hotspot\bin\keytool.exe"

if ((Test-Path -LiteralPath $keystorePath) -or (Test-Path -LiteralPath $propertiesPath)) {
    throw "Upload-key files already exist. Nothing was overwritten."
}
if (-not (Test-Path -LiteralPath $keytoolPath)) {
    throw "JDK 21 keytool was not found."
}

$alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%"
$bytes = New-Object byte[] 32
$random = [System.Security.Cryptography.RandomNumberGenerator]::Create()
$random.GetBytes($bytes)
$random.Dispose()
$password = -join ($bytes | ForEach-Object { $alphabet[$_ % $alphabet.Length] })

& $keytoolPath -genkeypair -v `
    -keystore $keystorePath `
    -alias "crewsync-upload" `
    -keyalg RSA `
    -keysize 2048 `
    -validity 10000 `
    -storepass $password `
    -keypass $password `
    -dname "CN=CrewSync, OU=Mobile, O=CrewSync, L=Seoul, ST=Seoul, C=KR"
if ($LASTEXITCODE -ne 0) {
    throw "keytool failed with exit code $LASTEXITCODE"
}

$properties = @(
    "storeFile=crewsync-upload.jks"
    "storePassword=$password"
    "keyAlias=crewsync-upload"
    "keyPassword=$password"
) -join [Environment]::NewLine
[System.IO.File]::WriteAllText($propertiesPath, $properties, [System.Text.UTF8Encoding]::new($false))

Write-Output "Created the CrewSync upload key and its local signing configuration."
