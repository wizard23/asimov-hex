* checkbox for showing cordinates
* coordinate system for 

~~hovering over edges on the edge of the grid does not work for:~~
  ~~* squares on all 4 sides~~
  ~~* for triangles: on the right edge of the grid~~
  ~~* for hex it works for all sides :)~~
~~For triange grid: hovering over a horizontal edge only works for the left side of the edge. when hovering over the right side of the edge it does not get highlighted.~~
FIXED: Edge detection now works for all boundary edges on squares and triangles. Triangle edge detection now checks neighboring cells to catch shared horizontal edges.




* instanced geometry
https://pixijs.com/8.x/examples?example=mesh_custom_instanced_geometry