# face-fit: fit the face numbers of `src/js/30-looks.js` to reference photos

The photos are the author's and are **not** part of the repository; only the numbers measured on them are kept (in `30-looks.js`).
This folder is the way those numbers were made, in case a fighter or a photo changes.

1. `pairs.json` (not committed): a list of `{ "id": "<fighter id>", "photo": "<file name>", "box": [x, y, w, h] }`, where `box` is a rough
   rectangle around the face in the photo (the detector gets a 25% margin around it). See `pairs.example.json`.
2. `python3 landmarks.py <photos dir> pairs.json lm.json` : a face-landmark model (mediapipe 0.10.x, which bundles its models; `pip install mediapipe==0.10.14 opencv-python-headless pillow numpy`)
   finds 478 points on every face.
3. `python3 measure.py lm.json meas.json` : the points are rotated to the front (from the 3D points of the mesh) and the proportions are measured in units of the distance between
   the eyes: the width of the face at seven heights, the length of the face, the places of the nose, the mouth and the brows, the width of the nose and of the mouth, the size of the eyes.
4. `node fit.mjs meas.json fit.json` : for every fighter the face numbers (`fw, cheek, jaw, jawSq, chin, len, nose, noseL, noseW, mouthW, eyeSize, eyeGap, browY, mouthDy`) are fitted so that
   the drawn face (the same arithmetic as `frontGeo` in `21b-portrait-front.js`) has the target proportions. The target is the average of the cast plus `K` (default 1.6, `K=1.4 node fit.mjs ...`)
   times what makes the person different from the average; photos with a turned head count less.
5. `python3 apply_fit.py fit.json ../../src/js/30-looks.js` : writes the fitted numbers into `30-looks.js` (and scales the hand-drawn hair outlines of a fighter whose head width changed).
   Fighters in `SKIP` (a photo where the head is turned or looks down) keep their hand-made structure.

If the arithmetic of `frontGeo` changes, update `model()` in `fit.mjs` the same way. Check the result by eye next to the photo: the fit only handles proportions; hair, beard, glasses and expression are drawn by hand.
