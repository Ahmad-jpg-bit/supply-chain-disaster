@echo off
powershell -Command "& 'C:\Program Files\Android\Android Studio1\jbr\bin\keytool.exe' -list -v -keystore 'C:\Users\MUHAMMAD AHMED\apex-app\signing.keystore' -storepass 8JxmxK5eg4iM | Out-File -Encoding ASCII fingerprint_ascii.txt"
type fingerprint_ascii.txt
