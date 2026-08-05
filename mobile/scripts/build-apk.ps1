# Rebuild FOS ERP Android release APK (local).
# Prerequisites: portable JDK under .tools/jdk-17, SDK under .android-sdk,
# and Gradle zip at .tools/gradle-8.10.2-all.zip (created by prior APK setup).

$ErrorActionPreference = 'Stop'
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path
$JAVA_HOME = Join-Path $Root '.tools\jdk-17'
$sdk = Join-Path $Root '.android-sdk'
$gradleHome = 'd:\g'

if (-not (Test-Path "$JAVA_HOME\bin\java.exe")) { throw "Missing portable JDK: $JAVA_HOME" }
if (-not (Test-Path $sdk)) { throw "Missing Android SDK: $sdk" }
if (-not (Test-Path "$Root\android")) {
  Push-Location $Root
  npx expo prebuild --platform android
  Pop-Location
}

$env:JAVA_HOME = $JAVA_HOME
$env:ANDROID_HOME = $sdk
$env:ANDROID_SDK_ROOT = $sdk
$env:GRADLE_USER_HOME = $gradleHome
$env:Path = "$JAVA_HOME\bin;$sdk\platform-tools;$env:Path"

$sdkGradle = $sdk.Replace('\', '\\')
Set-Content -Path "$Root\android\local.properties" -Value "sdk.dir=$sdkGradle" -Encoding ASCII

New-Item -ItemType Directory -Force -Path $gradleHome | Out-Null
Push-Location "$Root\android"
.\gradlew.bat assembleRelease --no-daemon
Pop-Location

$apk = Join-Path $Root 'android\app\build\outputs\apk\release\app-release.apk'
if (-not (Test-Path $apk)) { throw "APK not found: $apk" }
New-Item -ItemType Directory -Force -Path (Join-Path $Root 'dist') | Out-Null
Copy-Item $apk (Join-Path $Root 'dist\FOS-ERP-mobile-release.apk') -Force
Write-Output "OK -> $(Join-Path $Root 'dist\FOS-ERP-mobile-release.apk')"
