## INIT 2026/01/18
Please look at:
package.json
vite.config.ts
tile-editor.html
src/apps/tile-editor/

Then please implement this task:

Atm the problem is that when the "Current Values" changes it's height it also influences the height of the "Unit Cell Editor". 
Please change the positioning of the "Current Values" such that it becomes an overlay that sits on top of the "Unit Cell Editor". 

If anything is unclear please just ask.

## SESSION


what do you mean with that: "If you want, I can tweak overlay placement/size (e.g., only over the pixi area or add a background strip for the header)." Explain in detail




Actually the headers are just a waste of screen space. Please remove both headers ("Current Values" and "Unit Cell Editor") please.
Also the canvas should cover as much space as there is between the "Editor Controls" and the "Polygon Editor". Atm there is an unnecessary border space around the canvas that also wastes screen space.


this looks great already :) But the overlay wastes so much space. I made a screenshot that shows:
* circled in red: texts that break into two lines although there would be so much space available
* yellow lines: space that is just wasted.

Please make the overlay more compact without decreasing the font size please.

screenshot is here: docs/bugs/tile-editor-overlay-wasted-space/





That's better already but not quite what I meant. I attached a screenshot to illustrate what I mean. Here The "Side Lengths" and "Angles" each take up 12 lines but so much space is wasted.
docs/bugs/tile-editor-overlay-wasted-space/Screenshot 2026-01-18 163411.png
I highlighted areas that I feel are completely wasted in yellow.
Don't change anything yet but just suggest different ways to use the space wore efficiently please.

