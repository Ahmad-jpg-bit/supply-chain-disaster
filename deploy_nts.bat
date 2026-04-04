@echo off
cd "C:\Users\MUHAMMAD AHMED\projects\nexttracksystems"
git add .
git commit -m "feat: update color palette to cyber-industrial theme"
vercel --prod
