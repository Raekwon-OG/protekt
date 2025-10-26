#!/bin/bash
echo "Downloading and installing Protekt Agent..."
curl -L https://protekt-gray.vercel.app/install/agent-latest.zip -o agent.zip
unzip agent.zip -d protekt-agent
cd protekt-agent
python install.py
