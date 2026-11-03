# Flashback Retro Photobooth

A responsive, browser-based retro photobooth and photo editor. It is built with plain HTML, CSS, and JavaScript, with no build step or package installation.

## Run it

Open `index.html` in a browser, or serve this folder from a local web server. Camera access requires a secure browser context (HTTPS or `localhost`) and permission from the user. If camera access is unavailable, the photobooth and editor also accept uploaded photos.

## Features

- Responsive home, photobooth, editor, gallery, frames and stickers, about, and help pages.
- Camera capture with a timer, one/two/three/four-photo layouts, eight retro filter presets, and 12 simple solid-color frames. Each captured photo keeps the frame color selected at capture time.
- Photo editing with upload, crop ratios, zoom, rotation, brightness, contrast, the same eight filter presets, 12 solid-color frame options, stickers, and date labels. Frame-catalog selections open directly in the editor. Photobooth strips preserve each shot's selected frame in the saved image and editing source; the editor does not automatically add a second frame when opening a strip.
- Saved photos can be viewed, downloaded, searched, filtered, or removed from the gallery, and each memory can also generate a QR code for quick sharing.
- The photobooth includes a live A4 portrait print preview and a printer-friendly print sheet with one QR code per captured photo. Each photo is saved separately to the local gallery; its QR opens that saved memory only in the same browser and app location.
- Photos are kept in browser local storage on the current device; no server upload is used.

## Project structure

- `index.html` and `pages/` contain the site pages.
- `css/` contains shared, page-specific, and responsive styles.
- `js/` contains navigation, camera, editor, gallery, and local storage behavior.
- The decorative artwork is drawn with CSS and native text/emoji, so no image asset download is required.

Large or numerous photos may exceed the browser's local storage quota. If saving fails, remove older memories in the gallery and try again. QR images are created using the existing QR image service and contain only the local Gallery link and memory ID; the photos themselves are not uploaded.
