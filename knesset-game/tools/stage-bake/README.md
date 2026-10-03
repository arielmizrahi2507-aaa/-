# stage-bake: the realistic arena backdrops

The pictures in `src/assets/stages/<id>.<layer>.webp` (and `<id>.json`, the layout) are made by the code in this folder. `build.mjs` embeds them in `index.html` (`STAGE_DATA`),
`StageImg` / `Stages` in `50-stages.js` load and draw them. The painted arenas of `50-stages.js` stay as the fallback (a build without the pictures, a picture that cannot be decoded).

**No photograph is used anywhere**: every arena is a 3D scene made of procedural geometry (`solids.py`, trimesh) and procedural materials (`texlib.py`, `skylib.py`: numpy noise, planks, stone, rugs, flags, text drawn with the system font),
lit by physically based lights and path traced offline with [Mitsuba 3](https://www.mitsuba-renderer.org/) (CPU, LLVM), then cleaned with the Open Image Denoise library (`pyoidn`). `pip install mitsuba drjit pyoidn trimesh manifold3d shapely mapbox-earcut numpy opencv-python pillow`.

| file | what |
| --- | --- |
| `stagelib.py` | the renderer: the camera of the game, the layer integrator, scene builder, lights, denoise / grade / composite, the stage driver |
| `texlib.py` | tileable materials (planks, parquet, stone tiles, terrazzo, cement tiles, carpet, fabric, leather, brushed metal, concrete), the rug, the flag of Israel, text pictures |
| `solids.py` | rounded boxes, lathes, tubes, flags and curtains (cloth), books, people (seated, standing), chairs, the menorah, olive branches, arched windows |
| `skylib.py` | the skies: a sunset with a skyline, a clear afternoon (equirectangular float images) |
| `scenes/<id>.py` | one arena: `build(b, q)` makes the scene, `SLABS` says how it is cut into layers, `TONE` the grade, `LIVE` where the animated parts sit |
| `bake.py` | `python3 bake.py <id> --quick` (one picture to judge composition and light), `--raw` (render the layers, cached), `--post` (denoise, grade, previews), `--pack` (write the WebP + json) |
| `pack.py` | writes `src/assets/stages/` |

## The camera and the layers

The game is a 960 x 540 canvas. The fighters stand in the plane `z = 0`; one metre in that plane is `K = 125` px (a fighter of `look.h = 1` is 215 px, 1.72 m) and their feet line is the row 452.
The camera is 10 m in front of that plane at the height `H_CAM = 1.5` m, looks horizontally, and is a lens-shift camera (vertical lines stay vertical). The horizon is the row 264.5.

The camera of the game only moves sideways (`cx` 480 ... 1120), so a picture is cut into **layers by depth**, each is a transparent picture that the game moves with its own parallax factor `f = 10 / (10 + z)`:

- **wall layers** (`kind: "wall"`): everything between two depths (`z0` ... `z1`), seen from the camera, as an RGBA picture `W + 640 f` logical px wide. The primary rays of the path tracer start at the near plane and stop at the far plane
  (`LayerPath` in `stagelib.py`), everything else is still in the scene for the light, so shadows, bounces and the reflections are right, and what a near object hides in a far layer is rendered too (it shows when the camera moves).
  An opening (a window) is transparent, the layer behind shows through. A layer can fade out over `ramp` metres before its far plane. Objects must not cross the plane between two layers (they would be cut).
- **the floor layer** (`kind: "floor"`): a floor is one plane that reaches from the fighters' feet to the horizon, so cutting it into depth slabs would show seams (a wood floor or a rug pattern jumps at the cut). It is one picture of the whole floor at the middle camera (`floor_width` px wide), and the game
  draws it **sheared**: the row `y` moves with the parallax factor of its own depth, `f(y) = (y - yh) / (K * h_cam)`, which is linear in `y`, i.e. one `ctx.transform(1, 0, -d/kh, 1, ...)` (`Stages.drawReal`). Only what is on the floor (lower than 3 cm) is in this layer; the rays start above the floor plane and ignore what stands in front of it.
- **reflection layers** (`reflect=True`): a glossy floor shows what stands on it. They are the picture from the camera mirrored in the floor, turned upside down, drawn as a wall layer over the floor, weaker and blurrier the higher the reflected point is (`reflect_fade`). (A reflection baked into the sheared floor picture would move with the wrong parallax.)
- every layer's `order` says in which order the game draws them (default: far to near); `tone` overrides the grade of one layer (a bright sky gets less exposure).

`LIVE` in a scene gives the positions of the parts that the game animates on top (`dyn` in `50-stages.js`: the news ticker and the equaliser bars of the studio, the bars of the election screen, the steam of the cafe), computed with `project(...)` from world coordinates, in the pixels of the layer they belong to.

## Light and noise

A path tracer picks one light at random for every bounce, so the number of emitters matters: bulbs, ring lights, lamps of one colour are merged into one mesh = one emitter, the sun is a directional light (three copies at a third of the strength: a stronger pick rate), the sky an environment map.
The sampler is multijitter, the radiance of a sample is clamped (80), the picture is despeckled (fireflies far above the median of their neighbours), then denoised with the albedo and normal of the first hit, graded (filmic S curve, saturation, bloom), sharpened a little and stored as WebP (lossy, 82-84).

## Honest limits

- A layer is flat: inside one layer the parallax is the one of its depth, so objects near the ends of a layer's depth range move a little too much or too little (a few px at the extreme camera positions). Layers are cut where nothing crosses.
- The animated parts (ticker, bars, steam, dust, confetti, light beams in the haze) are drawn by the game over the pictures; they are not lit by the scene.
- Fighters are not in the pictures. The game lights them with `STAGE_LIGHT` (`22-f3d-core.js`) tuned by eye to each arena, and draws a soft contact shadow and (glossy floors) their own reflection.
- The people in the plenum and the crowd of the election night are simple figures (ellipsoids and capsules with a few facial features) that read as people at the size they have in the picture; they are no one in particular.

## Bake again

```
python3 bake.py office --raw --post --pack --scale-mul 1.2 --spp-mul 1.5 --q sky_w=6144 sky_h=3072
```
`--scale-mul` multiplies the resolution of every layer (the scene says 1.25 for the near layers), `--spp-mul` the samples; the work folder (`--work`, default `/tmp/stagebuild`) keeps the raw renders, so `--post` alone re-grades without rendering.
A whole arena takes 5 - 20 minutes on 4 cores.
