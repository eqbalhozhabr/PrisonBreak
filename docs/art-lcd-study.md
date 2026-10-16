# "LCD" look: style study (not shipped)

Inspired by the screen look of a game seen on Steam (olive handheld LCD, black ink outlines, dim backgrounds, steel console frame, pink accents). The shipped builds are unchanged (`STYLE_DEFAULT = 'classic'`).

- Build: `node tools/build-single.js --style lcd` -> `play/blind-eye-lcd.html` (or open any build with `?style=lcd`).
- How: a theme layer at the top of the game script maps every colour the canvas receives into a six-tone olive ramp. World (floor, walls, doors, beams) is mapped light<->dark inverted (pale floor, dark brick fronts, ink lines where a block meets floor); sprites keep their light/dark in crisp tones; strong red, gold and green become pink, amber and teal. CSS variables (`body.lcd`) give the steel UI frame, a bezel and scanlines over the board.
- Limits: this is a re-colouring of the existing procedural sprites, not new art. Proper art (characters with more frames, chapter-specific tiles and props, a drawn frame) needs a pixel artist; see the chat notes.
- Known issues to decide before adopting it: tips say "dark tile" for safe tiles but in this look safe tiles are the light ones; menu and card colours are a first pass.
