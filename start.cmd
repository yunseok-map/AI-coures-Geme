@echo off
chcp 65001 >nul
title AI 연수원 - 로컬 미리보기

rem ---------------------------------------------------------------
rem  로컬에서 확인할 때만 필요한 파일이다.
rem  배포된 주소(GitHub Pages 등)로 열면 이 파일 없이 그냥 열린다.
rem
rem  왜 필요한가: 브라우저 보안 정책 때문에 index.html 을 파일로 직접
rem  열면 화면 조각(모듈)을 불러오지 못한다. 아주 작은 웹 서버를
rem  띄워서 "주소로 여는 것"처럼 만들어 준다.
rem ---------------------------------------------------------------

cd /d "%~dp0"

echo.
echo   AI 연수원을 띄웁니다...
echo   브라우저가 열리지 않으면 주소창에 직접 입력하세요:  http://localhost:8765
echo   "연결할 수 없음"이 뜨면 1~2초 뒤 새로고침하세요. 서버가 뜨는 중입니다.
echo.
echo   끝낼 때는 이 창에서 Ctrl+C 를 누르거나 창을 닫으세요.
echo.

start "" http://localhost:8765

where python >nul 2>nul
if %errorlevel%==0 (
    python -m http.server 8765
    goto :eof
)

where py >nul 2>nul
if %errorlevel%==0 (
    py -m http.server 8765
    goto :eof
)

where npx >nul 2>nul
if %errorlevel%==0 (
    npx --yes serve -l 8765 .
    goto :eof
)

echo.
echo   [안내] Python 도 Node.js 도 찾지 못했습니다.
echo   배포 주소로 여시거나, Python 을 설치한 뒤 다시 실행하세요.
echo.
pause
