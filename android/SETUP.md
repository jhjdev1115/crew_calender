# CrewSync Android release setup

## Fixed application identity

- App name: `CrewSync`
- Package name: `com.jhjdev.crewsync`
- Minimum Android version: API 24
- Target Android version: API 36
- Production URL: `https://crewsync-web.jhjdev1115.workers.dev`

## 1. Install Android Studio

Install the current stable Android Studio with Android SDK 36 and its bundled JDK 21.
This project uses Android Gradle Plugin 8.13 and Java 21.

## 2. Register the Android app in Firebase

1. Open Firebase Console > CrewSync > Project settings > Your apps.
2. Add an Android app with package name `com.jhjdev.crewsync`.
3. Add the SHA-1 and SHA-256 fingerprints of the upload key.
4. Download `google-services.json`.
5. Place it at `android/app/google-services.json`.

The file is intentionally ignored by Git.

## 3. Create and protect the upload key

Create `android/crewsync-upload.jks`, then copy
`android/keystore.properties.example` to `android/keystore.properties` and replace
the passwords. Both files are intentionally ignored by Git. Back them up in a
password manager and a second secure location. Losing the upload key complicates
future Play Store updates.

## 4. Build

From the repository root:

```powershell
npm.cmd run android:sync
npm.cmd run android:build:release
```

The Play Console upload file is generated at:

`android/app/build/outputs/bundle/release/app-release.aab`
