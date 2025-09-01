#!/bin/bash

set -e

# 1. Update and install dependencies
sudo apt update && sudo apt upgrade -y
sudo apt install -y curl git postgresql postgresql-contrib build-essential

# 2. Install Node.js 18+ using nvm
if ! command -v nvm &> /dev/null; then
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi
nvm install --lts
nvm use --lts

# 3. Clean up any old install
rm -rf ~/meterum || true

# 4. Set up PostgreSQL database and user
sudo -u postgres psql <<EOF
DROP DATABASE IF EXISTS meterum;
DROP USER IF EXISTS meterum;
CREATE DATABASE meterum;
CREATE USER meterum WITH ENCRYPTED PASSWORD 'meterum';
GRANT ALL PRIVILEGES ON DATABASE meterum TO meterum;
EOF

# 5. Clone Meterum repo
git clone https://github.com/jaredbeyer/meterum.git ~/meterum
cd ~/meterum

# 6. Copy your .env.local (edit this path if needed)
if [ -f ~/.env.local ]; then
  cp ~/.env.local .env.local
else
  cp .env.example .env.local
  echo "Edit .env.local with your local DB credentials and secrets!"
fi

# 7. Install Node dependencies and initialize DB
npm install
npm run db:init

# 8. Build and start the app
npm run build
PORT=3001 npm start