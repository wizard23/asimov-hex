## Universal Regular Polygonal Tiling Editor
Man definiert unit cells indem man polygone definiert. Nehme an fuer ein nseitiges polygon braucht man N constraints
Seiten habe defaultmaessig unit length
Winkel haben defaultmaesssig share rest

Irgendwie muss man dann noch definieren wie unit cells aneinander geklebt werden. geht natuerlich nur wenn man gleiche seiten klebt.
Glaub das ist dann so wie hier https://en.wikipedia.org/wiki/Wallpaper_group

### sollte gehen
* Tilings that are not edge-to-edge https://en.wikipedia.org/wiki/Euclidean_tilings_by_convex_regular_polygons#:~:text=Tilings%20that%20are%20not%20edge-to-edge in diesem fall ist das grosse quadrat eigentlich ein 8 seitiges polygon mit einigen 180 grad winkeln :)

### Prompt Drafts
Create a new page with


## Repo Timeline
* chatgpt fragen welche statistic man sich geben lassen kann
* list of commits mit datum und message
* timeline visualisation


## Cleanup time
Please look at the src directory and suggest refactorings for technical debt reduction, cleanup possibilities and performance opportunities.

## instanced geometry to speed up rendering
https://pixijs.com/8.x/examples?example=mesh_custom_instanced_geometry