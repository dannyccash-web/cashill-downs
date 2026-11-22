# Cashill Downs

A self-contained horse racing browser game designed at 1920 × 1080. It scales proportionally to fit the screen and supports fullscreen.

## Play

- **Online:** https://dannyccash-web.github.io/cashill-downs/
- **Offline:** double-click `Play-Cashill-Downs.html`. It bundles the code and artwork into one file, so no server or installation is needed. If it opens in a text editor, use Open With → Safari, Chrome, Firefox, or Edge.
- **From source:** serve this folder with any static web server, for example `python3 -m http.server 8000`, then open http://localhost:8000.

Choose Get Started, select one of the five horses, and start the race. Arrow keys navigate the horse list. Space pauses or resumes a running race. Sound is optional and starts muted. Next Race returns to selection with a newly chosen track condition.

Races are simulated: watch your selection compete with four opponents. Individual strengths and track conditions influence performance, with random variation. No betting, currency, or purchases. Results use computed crossing times, and the photo finish captures the exact first crossing from the live race canvas.

## Files

- `index.html`: all four game screens
- `style.css`: layout, scaling, and visual styling
- `game.js`: selection, race simulation, sprite animation, sound, and results
- `assets/`: original generated game art (the game uses `gallop.png`, `track.jpg`, `paddock.jpg`, and `portraits.png`)
- `Play-Cashill-Downs.html`: single-file offline build

Fonts load from Google Fonts with local serif and sans-serif fallbacks. No installation or build step is needed.

## History

This game replaces **Homestretch Havoc**. The old GitHub code is preserved on the `homestretch-havoc-archive` branch.
