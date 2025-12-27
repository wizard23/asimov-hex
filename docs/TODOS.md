- checkbox for showing cordinates
- coordinate system for

~~hovering over edges on the edge of the grid does not work for:~~
~~\* squares on all 4 sides~~
~~\* for triangles: on the right edge of the grid~~
~~\* for hex it works for all sides :)~~
~~For triange grid: hovering over a horizontal edge only works for the left side of the edge. when hovering over the right side of the edge it does not get highlighted.~~
FIXED: Edge detection now works for all boundary edges on squares and triangles. Triangle edge detection now checks neighboring cells to catch shared horizontal edges.

Add performance tests for these functions in grid-renderer that do grid calculations but don't contain graphics code. Performance should be measured with various grid sizes and for all grid types.

dropdown for edgePalette
checkbox for absolute difference of states between cells (uses edge palette)

move src/assets/project-statistics/ to src/assets/project-statistics/generated and update the scripts and code that generates and uses the project statistics to reflect that change (scripts/create-project-statistics.ts and src/statistics.ts)

Adapt the project generation script to exclude all files that are in a folder named generated from the statistics. For now these should be:

- docs/generated
- src/assets/project-statistics/generated

add another boolean filed to the config (user changable via the tweakpane) that shows the absolute difference of the cell states

in public/project-history/git-timeline.json is a list of commits. Please create a timeline page (same principal layout as the page rendered by src/statistics.ts) that allows user to:

- select a start date (defaults to date of the first commit in the timeline)
- select an end date (defaults to date of the last commit)
- drop down list display mode: for now this only contains "List"
- search term: a text input that allows to filter for commits that contain the entered test (case insensitive)

The page should use this information to show the list of the commits matching the entered criteria

Please create a new page called "tile editor" (same principal layout as the page rendered by src/statistics.ts) that allows user to:

- enter a float (from 1 to 200) default 100
- enter an integer called "number of sides" (defaults to 4)
- enter a string called "side length expression" (defaults to "1")
- drop down list "tool": for now this only contains "Move", "Create Polygon", "Join"

The page should use this information to just display the chosen values. The "side length expression" should be evaluated as a mathematical expression and the result should be shown.

In the formula the following should be bossible:

- brackets for grouping expressions
- operations + - \* / ^
- functions like sin(<expression>) please add the following functions:
  - sin, cos, tan, tanh, tanh2, pow, log
  - tanh2 and log get two parameters seperated by ,

Add a pixi js window below the current values titled "Unit Cell Editor"
When the tool "Create Polygon" is selected and the user left clicks into the unit cell editor a polygon with the chosen side length and the number of sides should be created centered at the location of the mouse click. The polygons should be scaled by the scale factor. When the user just moves the mouse around a grayed out preview of the polygon that would be created by left clicking should be shown.

When the tool "Move" is selected and the mouse curser is on top of one of the polygons the polygon should be highlighted and when dragged araund the polygon should be moved to the desired location.

Please make the "Current Values" area minimizable
At the moment the "Unit Cell Editor" is higher in height than than the window and a scroll bar appears. There should not be a scrollbar but the "Unit Cell Editor" should just take up the remaining height.

The editor works very well but there is a bug in the way the scaling is used. At the moment the "scale" value is used to scale each individual polygon individually. But tha "scale" value should be used to scale the whole arrangement of polygons together. So when the scaling is changed the polygons would appear in the same relative size and would seem to move together or further apart.

Please look at the src/tile-editor.ts , tile-editor.html and vite.config.ts and analyze the functionality of the "Tile Editor"

The editor works very well but there is a bug in the way the scaling is used. At the moment the "scale" value is used to scale each individual polygon individually. But tha "scale" value should be used to scale the whole arrangement of polygons together. So when the scaling is changed the polygons would appear in the same relative size and would seem to move together or further apart.

Please look at the src/tile-editor.ts , tile-editor.html and vite.config.ts and analyze the functionality of the "Tile Editor".

The editor works very well but there is a bug in the way the scaling is used. At the moment the "scale" value is used to scale each individual polygon individually. But tha "scale" value should be used to
scale the whole arrangement of polygons together. So when the scaling is changed the polygons should appear in the same relative size and should seem to move together or further apart as an effect of the
scaling.

The scaling is good now but please fix the following things:

- the edges of the polygon should be drawn with a new parameter called "Edge Width"
- the scaling should always be relative to the center of the "Tile Unit Cell Editor"

Implement these changes:

- use scroll wheel inputs to modify scaling
- The "Edge Width" should not be subject to the scaling but should be used as is for the edges of the polygons

Please add a new parameter: viewOffset (a 2d vector) that controls an offset to change the (0,0) coordinate of the Unit Cell Editor window view at the polygons
Please implement a "View" tool that allows the viewer tho change this viewOffset by just draging anywher in the editor window.

Add the following things to the expression syntax:

- constants PI and E and PHI
- sqrt, cbrt (cubic root)
- optional last parameter for al trigonometric fucntions that determines if they use radians or degrees. if this is d deg degree or degrees it should use degrees. and if it is r rad randian or radians it shold huse radians. Radians is the default.

For the polygons please adapt the PolygonData data structure to be able to support arbitrary closed polygons:

- instead of just one sideLength: number it has to have sideLengthExpressions: string[] that contains an expression for each of the sides. These are initialized with the sideLengthExpression from the Editor Controls and the result of the expressions is cached in sideLengths: number[]
- it should also have an interiorAngleExpressions array that contains an expression that determines the interior angle at each vertex. The default values are derived from the "Number of Sides" parameter and are expressed as a suitable fraction of PI. The results of thesese expressions are cacged in interiorAngles: number[]
- whenever the expressions are reevaluated they get checked for internal consistency. If the polygon is not closed then an error dialog box is shown and the previous known good cached valuies are kept.

Once the data structure is adapted. Add a "Edit" tool that does the following when it's selected and the user clicks a polygon:
It opens a different tweakpane on the right side of the screen that has controls for each edge of the polygon:

- for each side there is a "Side Length Expression <Edge>" control that is either a formula like the one in the "Editor Controls"
- for each angle there is a "Angle Expression <Vertex>" control that
- <Vertex> is A, B, C, D, ...
- <Edge> is AB, BC, CD, DE, ...

If anything is unclear please just ask.

1.a. When using the "Create Polygon" tool the polygons that get created initialy are (just like now) regular n-gons. Please initialize the sideLengthExpressions and the interiorAngleExpressions accordingly using the "Side Length Expression" and the "Number of Sides" paramter from the "Editor Controls"

1.b. Your suggested algorithm for constructing the polygon is correct: “walking” edges in order, turning by π - interiorAngle at each vertex, starting at origin with the first edge along +X please.

1.c. Once the user modifies the polygon using the "Edit" tool the polygon might not be convex anymore. Before applying the edit make sure that the resulting polygon is closed and show an error dialog as described earlier.

2. angle unit s is radians by default but can be degrees for individual vertices using the same keywords as for trig functions. For example an expression of "90, degrees" or "45, d" should be interpreted as PI/2 or PI/4

3.a. your proposed closed polygon validation is correct: last vertex equals the first within a small tolerance
3.b. Please add a parameter in the Editor Controls called "Closed Polygon Epsilon" defaulting to 1e-4

4. Use an alert for now to keep it simple.

Please make the "Edit" tool less strict and allow open polygons. To support this please extend the PolygonData data structure with an isClosed boolean that gets set by the "Edit Mode" when the polygon side length and angle expressions are reevaluated. Open polygons are just a path of line segments and get drawn in red so the user sees that the polygon is not correctly closed.

Redesign the Tool system in such a way that the "Tool" parameter becomes obsolete:

- When the mouse cursor hovers over a polygon it always gets highlighted (atm this happens only when tool "Move" is selected)
- Polygons are created by double clicking in the "Unit Cell Editor" (atm this happens when tool "Create Polygon" is selected with a single click)
- Polygons are edited simply by clicking them (atm this happens only when tool "Edit" is selected)
- Polygons are moved by dragging polygons (atm this happens only when tool "Move" is selected)
- When the user drags the "Unit Cell Editor" viewOffset is modified (atm this happens only when tool "View" is selected)

Please implement these changes to the tile editor:

- When hovering over a polygon draw the edges in yellow to indicate that it will be edited or moved when clicked or dragged.
- clicking on an non closed polygon does not work atm. This makes it impossible to edit it. Pleas fix this. Use the same technique of drawing the edges in yellow to indicate to the user that it will be edited or moved when clicked or dragged.
- remove the preview polygon
- always show the "Polygon Editor" (atm it opens and closes depending on whether a polygon is being edited). When there is no polygon being edited make it empty except for a label with the text: "Double click anywhere in the 'Unit Cell Editor' to create a new polygon. Click on an existing polygon to edit it."

Please implement these changes to the tile editor:

- "Double click anywhere in the 'Unit Cell Editor' to create a new polygon. Click on an existing polygon to edit it."
- For non closed polygons draw a dotted line connecting the first and the last vertex of the non closed polygon.
- Use the same technique of connecting the first and the last vertex of the non closed polygon you can treat it like a closed polygon for hovering, clicking and dragging.
- While editing a polygon please keep it highlighted so that is clear for the user which polygon is being edited.
- While editing a polygon please add text labels to the vertices with the letter of the vertex (i.e. A. B, C, D, ...)
- The polygon editor stays open when no polygon is being edited but it is just empty. I don't see the text "Double click anywhere in the 'Unit Cell Editor' to create a new polygon. Click on an existing polygon to edit it." in it. I see that it is in the source code but this does not work. Please find out how to show static texts in a twekpane and then fix this.

If anything is unclear please just ask.

Please implement these changes to the tile editor:

- Visually differentiate between the yellow highlighting when hovering and the highlighting when editing a polygon by changing the highlighting while it is being edited to a moving dashed line (this kind of "moving dashed line" is used in some drawing applications for highlighting selected areas)
- The labels for the vertices of polygons that are being edited work but they appear way too large. Also the positioning is a little bit off since they appear to be shifted towards the bottom right relative to where I would expect them.

If anything is unclear please just ask.

Use colors black and white for the "moving ants" and make it slower by a factor of 10
For non closed polygons please exclude the implied closing edge from both yellow highlighting when hovering and the moving ants

please fix these bugs:

- now the vertex labels are not visible anymore. They look great when I use "Scale" 1 but since I usually use scale 100 they become a antialiased mess.
- highlighting when hovering over a non closed polygon still shows the implied part in yellow (but it should be in red just as it is already working for the marching ant highlighting)

the labels for the vertices get rendered in a nice and readable font now, but he positioning is weird.
but they are not anchored to the polygon vertices anymore but now they ar far far off to the bottom left corner of the window.

something is still of about the positioning of the vertex labels. Depending on the view offset the texts are all over the place. If viewOffset is half of the canvas size znd scale is set to 1 the labels appear positioned correctly. When I channge scale or viewOffset the labels wander around.

this does not work. please draw the letters with lines and revert to the old positioning scheme before these attempts to change the positioning because of the anti aliased font

please look at the files in the cwd and in the src folder (). (ignore the directories ./docs, ./public ./scripts ./shell)

- what is the quality of the code?
- is there any duplicated code?
- any suggestions for refactoring?
- what would be a good directory structure for the code?

Please look at the src/tile-editor.ts , tile-editor.html and vite.config.ts and analyze the functionality of the "Tile Editor".
Then answer these questions:

- what is the quality of the code?
- is there any duplicated code?
- any suggestions for refactoring?


please look at the files in the cwd and in the src folder (). (ignore the directories ./docs, ./public ./scripts ./shell)

* What is the the quality of the code?
* Are there any layers of indirections that are unnecessary and are maybe a residue of past restructuring of the code?
* Are there any very similar data structures that are duplicated at different locations in the code?
* Assess the directory structure of the code?
* Are there any parts that should be refactored or rewritten given that many features have been added.
* Are there any architectural decisions that should be reevaluated?  

Are there any unused function that don't gent called anywhere?



Restructure "Current Values":

Please remove:
* Scale
* Number of Sides
* Side Length
* Edge Width
* Closed Polygon Epsilon

Split the remaining fields in 4 columns containing:
* view offset and constants
* info about polygon that is not in any other column
* polygon side lengths
* polygon angles


Make the view offset of the currently selected polygon editable in the tweakpane.
In the current values: All angles should be shown as radians and degrees with the correct unit symbols
If polygon is not closed show expected sum of angles in the "Polygon Info" column


In the "Tile Editor" in the "Editor Controls" please add a center view button that adjusts scale and view offset such that all polygons are in the viewable area.


In the "Polygon Editor" allow "?" in the formulas. If any of the formulas for the sides or the interior angles is "?" then please use the polygon solver in src/core/utils/solver.ts to calculate the missing values. The return type of the solver should match the needed data for the PolygonData data structure in src/apps/tile-editor/index.ts exactly. If this assumption of mine is not correct then please report back to me.  

There are test cases for the solver in case the usage and return values are unclear in:
src/core/utils/solver-cairo-pentagons-unsorted.test.ts

If anything is unclear please just ask.



Please add a rotationExpression to PolygoData in src/apps/tile-editor. This expression can be edited in the Polygon Editor and the default is "0". The expression is cached in PolygonData.rotation and is evaluated whenever the expression is modified. If the expression fails to evaluate then an alert is displayed and the last valid value is used just like with the polygon angles and sideLength expressions.



Please modify the "Tile Editor" in the following way.

It should be possible to create multiple "polygon instances" of the same "polygon description type" by cloning. Cloning polygons is triggered by double clicking an existing "polygon instance". When the user double clicks an existing "polygon instance" the cloned "polygon instance" is created at a location determined by this algorithm:
1. Calculate the direction from the center of the polygon to the mouse position.
2. Use this direction to extend a line from the center outwards.
3. Find the last edge of the polygon that intersects this line. There could be multiple intersections so please make sure to use the one that is furthest from the center.
4. Calculate the distance from the intersection to the center of the polygon.
5. Position the new "polygon instance" in the direction of the line at a distance of twice the value calculated in step 4.

The cloned "polygon instance" should share the same "polygon description type". How "polygon description types" work and what needs to be changed in the data structures the "Tile Editor" uses is explained below:
The side length expressions and the angle expressions and the number of vertices get moved from PolygonData type to a new PolygonDescription type (the position and rotation expression stays in the PolygonData type). The PolygonData will only hold a reference to it's polygon description type and cached values for the vertices, angles, etc (please decide what values need to be cached but ask me if you struggle with the decision). The cached values must be updated whenever the "polygon description type" changes.

To make it clear to the user what values belong to the "polygon instance" and what belong to the "polygon description type" please split up the values in the "Polygon Editor" tweakpane into two sections called "Instance Values" and "Type Values" 

If anything is unclear please just ask.


Please create documentation for the current functionality and architecture of the "Tile Editor" in this directory: docs/system-description/apps/tile-editor
Detailed instructions about the scope and the structure of the documentation are in docs/system-description/apps/tile-editor/index.md 
This file is also the main entry pont for the documentation.
Please read the instructions and then create the documentation. 


I've updated the instructions for the documentation in: docs/system-description/apps/tile-editor/index.md 
Please read the instructions and then make the necessary changes to the documentation. 




Please add "Save Tiling" and "Load Tiling" buttons to the "Editor Controls" in the "Tile Editor". Saving should download a JSON file with all relevant information to faithfully recreate the app state. Don't include unnecessary details but also don't leave anything out that is needed to recreate the saved state. 

When a tiling is loaded by selecting a file from disk the Tile Editor state should be recreated as it was when the tiling got exported except for the "View Offset" and the "Scale" which should be initialized like they would be if the user clicked the "Center View" button.

Please add a versioning scheme so that changes to the data format can be easily implemented.

Then please update the documentation for this app accordingly.

If anything is unclear please just ask.



When saving a tiling set a flag so that the app knows that the current state was saved. If anything relevant is modified like the position of a polygon reset this flag. Just changing "Scaling" should not reset this flag of course. When loading a tiling or when navigating away or closing the window warn the user that the polygons the user created will be lost if they are not saved. If there are no polygons then it is not necessary to warn the user.

Please also try to reduce the size of the load and save buttons if possible. They are quite large now. 




In the timeline window where it says "Timeline (<number> commits)":
please adapt the text if the user entered a "Search" filter so that it is clear that the commits are filtered by that phrase. When no search filter is entered the text can stay as it is now.  



Let's fix some usability issues in the "Tile Editor". Specifically in the "Polygon Editor":

When an expression contains any error (like a syntax error, unknown function or variable) please don't revert the users change but just show the error and after the user acknowledging the error please show the invalid expression in red. In this case use a regular n-gon with side length 1 as dummy geometry for all user interactions. A very similar technique is used to allow open polygons. Please follow the approach for open polygons for dealing with polygons where at least one expression is invalid. Draw this dummy polygon in red and connect all diagonals with all other diagonals with the same dashed red line that we use for non closed polygons to connect the diverging endpoints.

If the expression can be parsed and evaluated but the polygon could not be solved by the solver: Don't revert the expression that triggered the solver error but just show the error and then keep the expression as is (just to be clear: the expression is shown in the normal color because the solver error is not caused by the expression being invalid) and use the same dummy geometry described above. 

If anything is unclear please just ask.




Let's improve the usability of the "Type Values" even more: Please show a toast when an expression is invalid or the solver failed instead of an alert.

For the toasts:
* please use a toast with the same styling and functionality as in: src/apps/timeline/index.ts
* to avoid duplicated code:
  * extract a library function for showing toasts that we can reuse in all apps that need toasts.
  * put this new library function in a suitable named file placed somewhere under src/
  * use this library function in src/apps/timeline/index.ts where toasts where used before and in the "Tile Editor" in the cases described above. 

Just for clarification:
* Please don't change the way errors are handled in the rotation expression for the instances. 
* Please don't change anything else in src/apps/timeline/index.ts apart from the necessary modifications for the extraction of the toast functionality.

If anything is unclear please just ask.


Now let's fix the UX for the toasts:
* Toasts should be shown in the upper right corner of the browser window.
* When multiple toasts are shown they should not overlap each other but should be stacked vertically. 
* When one toast disappears the other toasts should move up to fill the now empty space.
* Fade out the toasts gradually instead of just disappearing instantly 
* Please make the toasts a bit larger.
* Add an optional toast options parameter with the following optional fields:
  * timeout in ms: how long the toast should be displayed before starting to fade away (defaults to 5000 just like now)
  * fadeout time in ms: time from when the toasts begin to fade to the time they are removed completely and the other toasts move up (defaults to 2000).
  * type of toast: for now there should be the following types: errors (in red) warnings in yellow, success (in green), messages (in blue) (default is message)
  * all types have a suitable icon (for now just use emojis for that) 

If anything is unclear please just ask.



Pleas don't modify any code but just answer my request/question stated below:

For the polygons I describe below I always used polygons with a rotation expression of "0".

I noticed that polygons with a successful geometry have their A vertex positioned in the top left corner and the first edge is horizontal pointing right. 
Dummy geometries resulting from solver errors or expression errors have the A vertex on the right side and the first edge is pointing to the bottom left.
Dummy geometries resulting from a non closed polygon are oriented the same way that successful geometries are shown.
Please analyze the tile editor code and explain in detail why this happens.


Pleas don't modify any code but just answer my request/question stated below:

Please explain what kind of centering we use in the tile editor in the different code paths. Also explain what code paths use centering versus what code paths don't use centering.



It should not matter if the geometry is a dummy geometry or a valid geometry resulting from the solver or just from the expressions.

How is the "center" calculated for each of these cases? I ask because I want to exactly understand the algorithm to compute the center.



Let's use this opportunity to fix and unify the way polygons are positioned and oriented in general. Let's use a consistent positioning and orientation scheme:
* all code paths should use the same code path for constructing the geometry from a list of real valued edge lengths and real valued angles no matter if it is a valid geometry or a dummy geometry. 
* please change the orientation for all polygons to counter clockwise with the first edge horizontally pointing to the right. I think that's the standard textbook convention (please correct my assumption if this is wrong).
* polygons should always be centered. That means the instance value "Position" describes the center not the position of the first vertex. I think this would mean that it would behave a bit like the error geometries resulting from invalid expressions now (please correct my assumption if this is wrong)
* center is always calculated with the getPolygonCenter function just as it done now.
* the getPolygonCenter is good the way it is now and does not need any changes.

Before starting with the changes please use your common sense to critically review my request and if the changes seem unreasonable or you find any inconsistencies in my descriptions just tell me what I got wrong or recap my request. Either way don't modify any code yet. 

If anything is unclear please just ask.

1. Yes your reinterpretation is correct: Please use synthetic values for the dummy geometry needed in these cases.
2. I mean CCW orientation in the way a mathematically defined CCw polygon would appear in most math textbooks and the way the user sees them on the screen. The pixi/screen space should be treated as an implementation detail.
3. Yes "always centered" implies a shift after construction.
4. Yes keep angle = 0 at start. Then center afterwards. Just to clarify: after it is centered when getPolygonCenter is called again (for rotation if i understood it correctly but please correct me if this is wrong) it should return 0/0 apart from numerical errors.

Before starting with the changes please critically review my answers and assumptions in them and report back to me.




1. For CCW handling: Flip the y coordinate for displaying the polygon on the screen.
2. Great! If it will be stable then please don't recenter the polygon again before applying the rotation to keep numerical drift minimal.
3. Great!
4. Great!

If everything is clear please start with the code changes. Otherwise report back to me for clarification. 



No there must be some misunderstanding somewhere in your reasoning. With the code as it is atm a triangle for example appears as it is in a textbook: the A vertex is close to the bottom left corner of the browser window. The B vertex is near the bottom right corner of the browser window and vertex C is on top. 
Please verify your assumptions about pixi and the browser coordinate systems and report your findings.


Thanks for double checking. To make it clear for users of the app what coordinate system is used please add an option to draw the two axes at the origin.

The base vectors should use the following new parameters from the "Editor Controls"
  * a checkbox that toggles whether the axes should be drawn (checked by default labeled "Draw Axes")
  * a axes color
  * a axes width

If the checkbox is checked:
* the axes should consist of two lines of unit length
* One line extends from (0,0) to (1,0). Next to the (1, 0) end point of the line show the text "X".
* The other line extends from (0,0) to (0,1). Next to the (0, 1) end point of the line show the text "Y".




Thanks for double-checking. To make it clear to users which coordinate system is being used, please add an option to draw the coordinate axes at the origin.

The coordinate axes should use the following new parameters from the Editor Controls:
* a checkbox that toggles whether the axes are drawn (checked by default, labeled “Draw Axes”)
* an axis color
* an axis line width

If the checkbox is checked:
* The axes should consist of two lines of unit length.
* One line should extend from (0, 0) to (1, 0). Display the label “X” next to the endpoint at (1, 0).
* The other line should extend from (0, 0) to (0, 1). Display the label “Y” next to the endpoint at (0, 1).




There seems to be a bug: I can see the labels X and Y at the correct position but I can't see the two lines.

I manually adapted the positioning of the "Y". Now it appears visually consistent with the positioning of the "X" label. Before my manual changes the "Y" was colliding with the Y axes line. Please explain why that is.


Detailed instructions about the scope and the structure of the documentation are in docs/system-description/apps/tile-editor/index.md
Please read these instructions and then update the existing documentation to reflect the current implementation. 


--------------------------------------------------------
Please read the high level system description in docs/system-description/apps/tile-editor

Then analyze the code in src/apps/tile-editor

Then please report the following items to me:

* Identify all hardcoded values|colors|etc that are used to determine how anything is drawn in the "Unit Cell Editor". Give me a list of all these hardcoded values with a short description of their use and the current hardcoded value. 
* Identify all duplicated or very similar hardcoded values that appear at multiple spots in the code.


Yes please extract them into a shared config but please don't change anything about these:
  * the letter glyphs
  * axes endpoints
  * Dash toggle epsilon

Very good. Please also include:
* min|max|step for all slider controls in the EditorControls
* axes endpoints
* dash animation speed
* dash toggle epsilon
* letter glyphs




At the moment we have controls in the "Editor Controls" to configure|change some of these values while most are hardcoded. 
For the vast majority we don't need controls but conceptually I want them all to be configurable at runtime and handled the same way. 
Also they should all be defined in one central place.

I want them grouped into three groups
* Editor Settings. This consists of:
  * Scale
  * Number of sides
  * Side Length Expr
  * View Offset
* Application Settings. This consists only of the "Closed Polygon Epsilon" for now
* Gui Settings
  * all colors and line widths.
  * 
These 

Examples for

I want to change that in a structured way such that all of the All of these hardcoded values should come from one central place.


Yes please extract them into a shared config but please don't change anything about these:
* the letter glyphs
* axes endpoints
* Dash toggle epsilon


Please Identify any other hardcoded values that determine how anything appears to the user anywhere in the "Tile Editor"



There is functionality in the tile editor to detect when the user hovers with the mouse over a polygon. How is this determined? What counts as hovering in the current implementation?

You said "The point is close to any polygon edge (pointNearPolyline) with closePath = true."
Is there a different code path for closed and non closed polygons? What about polygons that failed to solve?




Please group all the existing controls in the "Editor Controls" into folders in this order

* "Commands" folder consisting of all buttons
  * Center View
  * Save Tiling
  * Load Tiling

* "Tiling" folder:  
  * Number of Sides
  * Side Length Expr
  * Constants

* "View" folder:
  * Scale
  * View Offset

3. "Gui Settings" folder
   * Edge Width
   * Draw Axes
   * Axes Color

* "Advanced/Debug" folder that for now only contains:
  * "Closed Polygon Epsilon"


Did I forget anything?
If anything is unclear please just ask.


for the constants please simplify the binding. Here is a tweakpane multiline example code:

pane.addBinding(PARAMS, 'someLongString', {
  readonly: true,
  multiline: true,
  rows: 5,
});

I was wrong. this does not support multiline after all. Please try it with the @pangenerator/tweakpane-textarea-plugin

Her is some sample code for it:

import {Pane} from 'tweakpane';
import * as TextareaPlugin from '@pangenerator/tweakpane-textarea-plugin';

const pane = new Pane();
pane.registerPlugin(TextareaPlugin);

const params = {
  prop: 'Put your\nmultiline\ntext here!'
};

pane.addBinding(params, 'prop', {
  view: 'textarea',
  rows: 6,
  placeholder: 'Type here...'
}).on('change', (ev) => {
  console.log(ev.value);
});




I want clean functionality for detecting
* if the mouse hovers over a polygon
* if the mouse hovers over an edge
* if the mouse hovers over a vertex

Please add the following functionality:
* When the user 





## FUTURE
Please read the high level system description in docs/system-description/apps/tile-editor

Then analyze the code in the cwd but ignore these directories and files: 
./docs
./public
./scripts
./shell
package-lock.json

Then please refactor the "Tile Editor" such that all of the hardcoded colors that are used for drawing polygons are made configurable in the "Editor Controls"
* please add the new parameters in a new tweakpane folder named "Editor Settings"
* 

If you notice any other hardcoded colors that I forgot to mention then please don't modify the code yet but just report a list with the colors I forgot.



Then please add these new features in: "Tile Editor" in src/apps/tile-editor

* When hovering over vertices of polygon instances please highlight the vertex in
Allow the user to modify the rotation of polygon instances  


## FUTURE NOTES
* mirror
* rot
* snap
* delete


## INIT CONTEXT
Please read the high level system description in docs/system-description/apps/tile-editor

Then analyze the code in the cwd but ignore these directories and files: 
./docs
./public
./scripts
./shell
package-lock.json

Then please refactor the "Tile Editor" such that: