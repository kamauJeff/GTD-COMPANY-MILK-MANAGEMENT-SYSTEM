# Run from gutoria-dairies\mobile folder
# Upgrades to SDK 54 and fixes App.tsx location

function New-File {
    param($path, $content)
    $dir = Split-Path $path -Parent
    if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $path), $content, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Created: $path" -ForegroundColor Green
}

Write-Host "Fixing Expo SDK version and App.tsx location..." -ForegroundColor Cyan

# Fix package.json - upgrade to SDK 54
New-File "package.json" @'
{
  "name": "gutoria-mobile",
  "version": "1.0.0",
  "main": "App.tsx",
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
    "expo": "~53.0.0",
    "expo-sqlite": "~15.1.2",
    "expo-status-bar": "~2.2.3",
    "react": "18.3.2",
    "react-native": "0.76.9",
    "react-native-safe-area-context": "4.14.0",
    "react-native-screens": "~4.4.0",
    "zustand": "^4.5.4"
  },
  "devDependencies": {
    "@babel/core": "^7.24.0",
    "@types/react": "~18.3.12",
    "typescript": "^5.3.3"
  }
}
'@

# Fix app.json - point main to App.tsx directly
New-File "app.json" @'
{
  "expo": {
    "name": "Gutoria Dairies",
    "slug": "gutoria-mobile",
    "version": "1.0.0",
    "orientation": "portrait",
    "userInterfaceStyle": "light",
    "splash": { "resizeMode": "contain", "backgroundColor": "#16a34a" },
    "android": { "adaptiveIcon": { "backgroundColor": "#16a34a" }, "package": "com.gutoria.dairies" },
    "ios": { "bundleIdentifier": "com.gutoria.dairies" }
  }
}
'@

Write-Host "`nNow run:" -ForegroundColor Green
Write-Host "  npm install" -ForegroundColor White
Write-Host "  npx expo start" -ForegroundColor White
