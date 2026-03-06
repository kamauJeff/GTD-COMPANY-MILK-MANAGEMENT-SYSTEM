# Run from gutoria-dairies\mobile folder

function New-File {
    param($path, $content)
    $dir = Split-Path $path -Parent
    if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $path), $content, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Created: $path" -ForegroundColor Green
}

Write-Host "Upgrading to Expo SDK 54..." -ForegroundColor Cyan

New-File "package.json" @'
{
  "name": "gutoria-mobile",
  "version": "1.0.0",
  "main": "node_modules/expo/AppEntry.js",
  "scripts": {
    "start": "expo start",
    "android": "expo start --android",
    "ios": "expo start --ios"
  },
  "dependencies": {
    "@react-native-async-storage/async-storage": "2.1.2",
    "@react-navigation/bottom-tabs": "^6.5.20",
    "@react-navigation/native": "^6.1.17",
    "@react-navigation/native-stack": "^6.9.26",
    "axios": "^1.7.2",
    "expo": "~54.0.0",
    "expo-sqlite": "~16.0.0",
    "expo-status-bar": "~2.2.3",
    "react": "19.0.0",
    "react-native": "0.79.6",
    "react-native-safe-area-context": "5.4.0",
    "react-native-screens": "~4.11.1",
    "zustand": "^4.5.4"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "~19.0.10",
    "typescript": "~5.8.3"
  }
}
'@

New-File "app.json" @'
{
  "expo": {
    "name": "Gutoria Dairies",
    "slug": "gutoria-mobile",
    "version": "1.0.0",
    "sdkVersion": "54.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "android": { "adaptiveIcon": { "backgroundColor": "#16a34a" }, "package": "com.gutoria.dairies" },
    "ios": { "bundleIdentifier": "com.gutoria.dairies" }
  }
}
'@

Write-Host "`nDone! Now run:" -ForegroundColor Green
Write-Host "  Remove-Item -Recurse -Force node_modules" -ForegroundColor White
Write-Host "  npm install --legacy-peer-deps" -ForegroundColor White
Write-Host "  npx expo start --tunnel" -ForegroundColor White
