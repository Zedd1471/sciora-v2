@echo off
:: Sciora Windows Firewall Configuration for Classroom Hotspot
echo ========================================================
echo    Sciora Offline Classroom Hotspot - Firewall Setup
echo ========================================================
echo.
echo Requesting administrator privileges to permit port 3000...
echo.

net session >nul 2>&1
if %errorLevel% == 0 (
    echo Administrator permissions confirmed.
) else (
    echo [ERROR] Please right-click this file and choose "Run as administrator".
    echo.
    pause
    exit /b 1
)

echo Adding inbound firewall rule for TCP port 3000 (Sciora Hotspot)...
netsh advfirewall firewall delete rule name="Sciora Offline Hotspot Server" >nul 2>&1
netsh advfirewall firewall add rule name="Sciora Offline Hotspot Server" dir=in action=allow protocol=TCP localport=3000

if %errorLevel% == 0 (
    echo.
    echo [SUCCESS] Windows Firewall is now configured!
    echo Phones connected to your laptop hotspot can now reach port 3000.
    echo.
) else (
    echo.
    echo [FAILED] Could not add firewall rule.
    echo.
)

pause

