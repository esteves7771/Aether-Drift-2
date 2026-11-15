# Installed soundtrack

The user supplied the four exact Pixabay tracks listed in the project-root MUSIC_CREDITS.md. Desktop originals were copied without modification to menu.mp3, combat.mp3, death.mp3, and boss.mp3. The two supplied combat downloads are identical; only one is installed.

Runtime uses menu.mp3, combat.mp3, boss.mp3, and **death-cue.mp3**. The original death.mp3 is retained for edit provenance and is never loaded by the game. The derived cue selects source 00:20–00:28 with an 80 ms fade-in and 2.5-second fade-out. Its hash/edit record is in death-cue.edit.json.

Recreate the cue with `npm run music:cue -- --start 20 --duration 8`. The tool supports FFmpeg on PATH, FFMPEG_PATH, or the ignored local portable editor. Rebuild static output after replacing files; refresh the dev page to update its dynamic manifest. Missing/unsupported files remain nonblocking.

Menu/combat/boss tracks loop; death plays once. Playback begins after a click/key gesture, pauses with the game, resumes its transport position, and uses independent saved Master/Music/SFX controls. The existing boss:spawn / boss:defeated gameplay events select boss music and return to combat after victory.

Source/license evidence and hashes are in license-evidence/source-record.json. No official download certificate was supplied; this observation record is not a certificate or new license grant.
