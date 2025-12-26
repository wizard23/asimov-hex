Please analyze the code in the cwd.

Ignore these directories and files: 
./docs
./public
./scripts
./shell
package-lock.json


Then please add a new feature in: "Tile Editor" in src/apps/tile-editor

Add a multi line text box in the "Editor Controls" for constants that will be available for expressions in all fields that allow expressions. Constants are calculated line by line and expressions defining constants can use all constants that have been defined before


Example of a constants block:

TEST=12
X=TEST/3
Y=X+sin(PI/4)



Then add the following information to the "Current Values":
* list of the values of all constants
* if a polygon is being edited at the moment list the following info about this polygon:
  * general info: position, number of sides, if its closed and by what amount the start and end point diverge, sum of all angles
  * list of all values of all expressions for sides and angles


If anything is unclear please just ask.


---------------

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