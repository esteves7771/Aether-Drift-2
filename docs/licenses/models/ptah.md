# PTAH / NMS Starship — local prototype only

Input: user-supplied assets-source/nms-starship.zip. SHA-256: 658a542fa7002206c0bc6acd58e03bd8a2280dbaee9a30ff55b7e0766d18fb75.

The Blender file contains a README claiming: Blender v3.3+, License CC0, Twitter @cmzw_. No original download URL was supplied. A matching source listing was located on 2026-11-16: https://sketchfab.com/3d-models/nms-starship-25e26f50065c433f8120c5257d683250 (cmzw). The source page returned HTTP 403 during review; the search listing establishes the model association, not underlying NMS design permission. This is preserved source evidence, not independent clearance of the NMS-associated design. Underlying intellectual-property rights remain unresolved. PTAH GLB and thumbnail are ignored by Git; build:pages excludes PTAH and its thumbnail; tools/check-distribution.mjs rejects any public output containing them. Local availability is retained. Normal local builds work.

Source: nms_starship.blend, 856,540 triangles. Converted offline with source script execution disabled. Reduced to 48,000 triangles and one material; diffuse 2048, roughness and tangent normal 1024. The supplied height-driven Bump shading was baked into a proper tangent-space normal map rather than exporting grayscale height as normal data. Embedded GLB is 2,389,736 bytes, three images. Source extent 3.7624 x .9166 x 3.7312; wrapper yaw -90 degrees and 6.8-metre length align the source -X nose to game -Z. Muzzles, nozzle, cockpit and sphere proxy are calibrated separately; original container transforms are preserved.

Tools: tools/prepare-ptah.py, tools/optimize-5h-glb.mjs. Original source remains unchanged. Local renders and inspection data: artifacts/phase5h. No blanket license or public redistribution approval is granted here.
