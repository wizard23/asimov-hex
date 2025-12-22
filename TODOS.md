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




move src/assets/project-statistics/ to src/assets/project-statistics/generated and update the scripts and code that generates and uses the project statistics to refelect that change.

Adapt the  project generation script to exclude all files that are in a folder named generated from the statistics. For now these are:
* docs/generated
* src/assets/project-statistics/generated





* instanced geometry
https://pixijs.com/8.x/examples?example=mesh_custom_instanced_geometry

