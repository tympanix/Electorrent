#!/bin/bash

IMAGE=icon_512px.png

mkdir electorrent.iconset
cd electorrent.iconset
convert -resize 16x16 ../$IMAGE icon_16x16.png
convert -resize 32x32 ../$IMAGE icon_16x16@2x.png
convert -resize 32x32 ../$IMAGE icon_32x32.png
convert -resize 64x64 ../$IMAGE icon_32x32@2x.png
convert -resize 128x128 ../$IMAGE icon_128x128.png
convert -resize 256x256 ../$IMAGE icon_128x128@2x.png
convert -resize 256x256 ../$IMAGE icon_256x256.png
convert -resize 512x512 ../$IMAGE icon_256x256@2x.png
convert -resize 512x512 ../$IMAGE icon_512x512.png
convert -resize 1024x1024 ../$IMAGE icon_512x512@2x.png
cd ..
iconutil -o electorrent.icns -c icns electorrent.iconset