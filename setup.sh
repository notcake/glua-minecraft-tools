#!/bin/bash

function apt_install {
	dpkg -s $1 > /dev/null 2>&1
	if [ $? -ne 0 ]; then
		echo "Installing $1..."
		sudo apt install $1
	else
		echo "$1 is already installed."
	fi
}

function npm_install {
	npm list -g $1 > /dev/null 2>&1
	if [ $? -ne 0 ]; then
		echo "Installing $1..."
		sudo npm install -g $1
	else
		echo "$1 is already installed."
	fi
}

apt_install npm
npm_install ts-node
npm_install typescript

npm install
