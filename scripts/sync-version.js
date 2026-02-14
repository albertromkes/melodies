import { readFileSync, writeFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const rootDir = resolve(__dirname, '..');

function getPackageJson() {
  const pkgPath = resolve(rootDir, 'package.json');
  const content = readFileSync(pkgPath, 'utf-8');
  return JSON.parse(content);
}

function updateAndroidBuildGradle(version, versionCode) {
  const gradlePath = resolve(rootDir, 'android/app/build.gradle');
  let content = readFileSync(gradlePath, 'utf-8');

  content = content.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`);
  content = content.replace(/versionName\s+"[^"]+"/, `versionName "${version}"`);

  writeFileSync(gradlePath, content);
  console.log(`✓ Updated android/app/build.gradle: versionName=${version}, versionCode=${versionCode}`);
}

function updateIosPlist(version, versionCode) {
  const plistPath = resolve(rootDir, 'ios/App/App/Info.plist');
  let content = readFileSync(plistPath, 'utf-8');

  content = content.replace(
    /<key>CFBundleShortVersionString<\/key>\s*<string>.*<\/string>/,
    `<key>CFBundleShortVersionString</key>\n\t<string>${version}</string>`
  );
  content = content.replace(
    /<key>CFBundleVersion<\/key>\s*<string>.*<\/string>/,
    `<key>CFBundleVersion</key>\n\t<string>${versionCode}</string>`
  );

  writeFileSync(plistPath, content);
  console.log(`✓ Updated ios/App/App/Info.plist: CFBundleShortVersionString=${version}, CFBundleVersion=${versionCode}`);
}

function main() {
  console.log('Syncing version to mobile platforms...\n');

  const pkg = getPackageJson();
  const version = pkg.version;
  const versionCode = pkg.versionCode;

  if (!version) {
    console.error('Error: version not found in package.json');
    process.exit(1);
  }

  if (versionCode === undefined) {
    console.error('Error: versionCode not found in package.json');
    process.exit(1);
  }

  console.log(`Source: package.json - version=${version}, versionCode=${versionCode}\n`);

  updateAndroidBuildGradle(version, versionCode);
  updateIosPlist(version, versionCode);

  console.log('\n✓ Version sync complete!');
  console.log('\nNext steps:');
  console.log('  - Android: Open Android Studio and build signed APK');
  console.log('  - iOS: Open Xcode and build/archive');
}

main();
