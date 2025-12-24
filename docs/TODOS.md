* checkbox for showing cordinates
* coordinate system for 

~~hovering over edges on the edge of the grid does not work for:~~
  ~~* squares on all 4 sides~~
  ~~* for triangles: on the right edge of the grid~~
  ~~* for hex it works for all sides :)~~
~~For triange grid: hovering over a horizontal edge only works for the left side of the edge. when hovering over the right side of the edge it does not get highlighted.~~
FIXED: Edge detection now works for all boundary edges on squares and triangles. Triangle edge detection now checks neighboring cells to catch shared horizontal edges.

Add performance tests for these functions in grid-renderer that do grid calculations but don't contain graphics code. Performance should be measured with various grid sizes and for all grid types.

dropdown for edgePalette
checkbox for absolute difference of states between cells (uses edge palette)




move src/assets/project-statistics/ to src/assets/project-statistics/generated and update the scripts and code that generates and uses the project statistics to reflect that change (scripts/create-project-statistics.ts and src/statistics.ts)

Adapt the  project generation script to exclude all files that are in a folder named generated from the statistics. For now these should be:
* docs/generated
* src/assets/project-statistics/generated





 add another boolean filed to the config (user changable via the tweakpane) that shows the absolute difference of the cell states



in public/project-history/git-timeline.json is a list of commits. Please create a timeline page (same principal layout as the page rendered by src/statistics.ts) that allows user to:
* select a start date (defaults to date of the first commit in the timeline)
* select an end date (defaults to date of the last commit)
* drop down list display mode: for now this only contains "List"
* search term: a text input that allows to filter for commits that contain the entered test (case insensitive)

The page should use this information to show the list of the commits matching the entered criteria






Please create a new page called "tile editor" (same principal layout as the page rendered by src/statistics.ts) that allows user to:
* enter a float (from 1 to 200) default 100
* enter an integer called "number of sides" (defaults to 4)
* enter a string called "side length expression" (defaults to "1")
* drop down list "tool": for now this only contains "Move", "Create Polygon", "Join"

The page should use this information to just display the chosen values. The "side length expression" should be evaluated as a mathematical expression and the result should be shown.

In the formula the following should be bossible:
* brackets for grouping expressions
* operations + - * / ^
* functions like sin(<expression>) please add the following functions: 
  * sin, cos, tan, tanh, tanh2, pow, log
  * tanh2 and log get two parameters seperated by ,

  




* instanced geometry
https://pixijs.com/8.x/examples?example=mesh_custom_instanced_geometry

