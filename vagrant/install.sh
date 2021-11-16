#!/bin/bash

set -ex

# Environment configuration variables
export GIT_URL="https://github.com/tympanix/Electorrent"
export NODEJS_URL="https://deb.nodesource.com/setup_14.x"

# Install common packages
sudo apt-get update
sudo apt-get install -y git xvfb build-essential ffmpeg

# Install nodejs
curl -fsSL "$NODEJS_URL" | sudo -E bash -
sudo apt-get install -y nodejs

# Install docker
sudo apt-get install -y ca-certificates curl gnupg lsb-release
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --batch --keyserver --dearmor -o /usr/share/keyrings/docker-archive-keyring.gpg
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker-archive-keyring.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt-get update && sudo apt-get install -y docker-ce docker-ce-cli containerd.io
sudo usermod -a -G docker $USER

# Install docker-compose
sudo curl -Lfs "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Set up project source code and dependencies
( 
    PROJ_NAME="$(basename $GIT_URL)"
    PROJ_DIR="$HOME/$PROJ_NAME"
    if [[ ! -d "$PROJ_DIR" ]]; then
        sudo rm -rf "$PROJ_DIR" && mkdir -p "$PROJ_DIR"
        git clone "$GIT_URL" "$PROJ_DIR"
    fi
    cd "$PROJ_DIR"
    npm install
)
