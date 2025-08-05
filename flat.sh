#!/bin/bash

SOURCE_DIR='/Users/alex/Library/Mobile Documents/com~apple~CloudDocs/Projects/Launchfly/launchfly-app/src'
DEST_DIR='/Users/alex/Downloads/src_flat'

mkdir -p "$DEST_DIR"

find "$SOURCE_DIR" -type f | while read FILE; do
  BASENAME=$(basename "$FILE")
  DEST="$DEST_DIR/$BASENAME"

  # Handle duplicate filenames
  if [ -e "$DEST" ]; then
    EXT="${BASENAME##*.}"
    NAME="${BASENAME%.*}"
    COUNT=1
    while [ -e "$DEST_DIR/${NAME}_$COUNT.$EXT" ]; do
      COUNT=$((COUNT + 1))
    done
    DEST="$DEST_DIR/${NAME}_$COUNT.$EXT"
  fi

  cp "$FILE" "$DEST"
done
