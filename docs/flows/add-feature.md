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