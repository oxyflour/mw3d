Xvfb :99 -screen 0 1280x1024x24 -nolisten tcp -auth /tmp/xauth &
sleep 5
x11vnc -display :99 -auth /tmp/xauth &
DISPLAY=:99 npx electron --no-sandbox electron.js
