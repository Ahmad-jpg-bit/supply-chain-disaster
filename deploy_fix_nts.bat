@echo off
cd "C:\Users\MUHAMMAD AHMED\projects\nexttracksystems"
call npm install next-mdx-remote@latest
git add .
git commit -m "fix: update next-mdx-remote to resolve vulnerability"
vercel --prod
