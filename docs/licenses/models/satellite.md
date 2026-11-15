# Satellite — local source record

Source: user-supplied `assets-source/space-satellite.zip`, containing `source/Satellite.zip` → `Satellite2.obj` and Satellite/Satellite2 PBR maps. The archive contains no creator, download URL, MTL or license document. The user previously confirmed supplied models were free to use; independent author/license verification remains unavailable. No license is invented or applied to this third-party model. Review this record before any future public redistribution.

Prepared by `tools/prepare-satellite.py`: source geometry retained, both Satellite and Satellite2 material regions restored from their respective supplied maps. Two padded 252 px tiles form each 512×256 PBR atlas; UVs are remapped by the authored material assignments. Static meshes are joined into one material primitive (7,557 triangles, 542,824-byte embedded GLB), without decoder dependencies. Original archive remains untouched. Calibration from decoded vertices: dimensions (0.9, 1.7542, 4.0619), centre (0.0321, 0.3683, 0), yaw 90°, intended panel span 10 m, menu instances scaled below that.

Original archive SHA-256: `4AD70E3DF35D33AEC393041CC37AEF0A9E8E1FEB7D2EC8DA760B68E3A0FA4D32`.
