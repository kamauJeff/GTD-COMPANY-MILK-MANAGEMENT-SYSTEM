# Run from gutoria-dairies\mobile folder

function New-File {
    param($path, $content)
    $dir = Split-Path $path -Parent
    if ($dir -and !(Test-Path $dir)) { New-Item -ItemType Directory -Force -Path $dir | Out-Null }
    [System.IO.File]::WriteAllText((Join-Path (Get-Location) $path), $content, [System.Text.UTF8Encoding]::new($false))
    Write-Host "Created: $path" -ForegroundColor Green
}

# Fix package.json - use standard expo entry point
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
    "expo": "~53.0.0",
    "expo-sqlite": "~15.2.14",
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

# App.tsx at root - this is what expo/AppEntry.js looks for
New-File "App.tsx" @'
import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import AppNavigator from "./src/navigation/AppNavigator";
import { useAuthStore } from "./src/store/auth.store";
import { initDB } from "./src/utils/offlineStore";

export default function App() {
  const loadFromStorage = useAuthStore((s) => s.loadFromStorage);

  useEffect(() => {
    loadFromStorage();
    initDB().catch(console.error);
  }, []);

  return (
    <>
      <StatusBar style="light" />
      <AppNavigator />
    </>
  );
}
'@

# babel.config.js
New-File "babel.config.js" @'
module.exports = function(api) {
  api.cache(true);
  return { presets: ["babel-preset-expo"] };
};
'@

# tsconfig.json
New-File "tsconfig.json" @'
{
  "extends": "expo/tsconfig.base",
  "compilerOptions": {
    "strict": true
  }
}
'@

Write-Host "`nFiles created! Now run:" -ForegroundColor Green
Write-Host "  npm install --legacy-peer-deps" -ForegroundColor White
Write-Host "  npx expo start --tunnel" -ForegroundColor White
