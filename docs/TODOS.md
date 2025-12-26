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



1. Calculate the direction from the center of the polygon to the mouse position.
2. Use this direction to extend a line from the center outwards.
3. Find the first edge of the polygon that intersects this line. This is the X edge
4. Extend the line in the opposite direction 
2. Use this direction to position the cloned copy exactly 

## FUTURE