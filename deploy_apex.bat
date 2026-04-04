@echo off
cd "C:\Users\MUHAMMAD AHMED\apex-app"
for /f "tokens=*" %%a in ('git branch --show-current') do set BRANCH=%%a
echo Current branch is %BRANCH%
git push origin %BRANCH%
