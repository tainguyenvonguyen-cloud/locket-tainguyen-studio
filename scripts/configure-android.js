const fs = require('fs');
const path = require('path');

const manifestPath = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml');

if (!fs.existsSync(manifestPath)) {
  console.error('AndroidManifest.xml not found at:', manifestPath);
  process.exit(1);
}

let xml = fs.readFileSync(manifestPath, 'utf8');

// 1. Bổ sung đầy đủ quyền Camera, Micro, Âm thanh, Mạng cho WebView Locket
const permissionsBlock = `
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.CAMERA" />
    <uses-permission android:name="android.permission.RECORD_AUDIO" />
    <uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />
    <uses-permission android:name="android.permission.READ_MEDIA_IMAGES" />
    <uses-permission android:name="android.permission.READ_MEDIA_VIDEO" />
    <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-feature android:name="android.hardware.camera" android:required="false" />
    <uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />
    <uses-feature android:name="android.hardware.microphone" android:required="false" />
`;

if (!xml.includes('android.permission.CAMERA')) {
  xml = xml.replace('<application', `${permissionsBlock}\n    <application`);
}

// 2. Cho phép usesCleartextTraffic để phòng trường hợp kết nối LAN nội bộ
if (!xml.includes('android:usesCleartextTraffic')) {
  xml = xml.replace('<application', '<application\n        android:usesCleartextTraffic="true"');
}

fs.writeFileSync(manifestPath, xml, 'utf8');
console.log('✅ Đã cấu hình quyền Camera, Micro & Media cho AndroidManifest.xml');

// 3. Copy icon-512.png làm icon chính của Android APK
const iconSrc = path.join(__dirname, '..', 'public', 'icon-512.png');
if (fs.existsSync(iconSrc)) {
  const resDir = path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'res');
  const mipmapDirs = [
    'mipmap-mdpi',
    'mipmap-hdpi',
    'mipmap-xhdpi',
    'mipmap-xxhdpi',
    'mipmap-xxxhdpi',
  ];
  for (const dir of mipmapDirs) {
    const fullDir = path.join(resDir, dir);
    if (fs.existsSync(fullDir)) {
      for (const file of ['ic_launcher.png', 'ic_launcher_round.png', 'ic_launcher_foreground.png']) {
        const dest = path.join(fullDir, file);
        if (fs.existsSync(dest)) {
          fs.copyFileSync(iconSrc, dest);
        }
      }
    }
  }
  console.log('✅ Đã cập nhật App Icon cho Android APK');
}
