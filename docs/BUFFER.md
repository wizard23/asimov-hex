## TAG
A vibe-coding testbed for visualizing polygon-based tilings and simulating particles that move along their edges using local interaction rules.
A vibe-coding testbed for visualizing polygon-based tilings, where particles live on edges and move along them according to local interaction rules.


Since a general solution for cairo tiling seems too complicted let's start with the following approach: 

Parameterize the CairoGrid like this:
* scale: number (like all other grids this determines the length of one unit)
* pentagonType: "catalan" | "type4"

For now just implement the case when pentagonType === "catalan":
* Have four long edges of length 1 unit and one short one with a length of sqrt(3)-1
* the angles of these pentagons form the sequence 120°, 120°, 90°, 120°, 90°

pentagonType === "type4" should just raise a not implemented Exception for now.

As a first step please just implement test for this new tiling in: src/grid.test.ts




The five interior angles alternate between two values:

Three angles of 120°

Two angles of 90°

Ordered around the pentagon as:

120° – 90° – 120° – 90° – 120°


Angles
A
C
A =C=
E D
В = 2п-2D~131°24'
√2 D=E=+ arcos ~114° 18' =7+ arcOS 4
Illustrative tiling: (3) and tilings listed for type 2 above.


(0,0) with (1,0)
(0,0) with (0,1)
(1,0) with (2,0)
(6,0) with (7,0)
(6,0) with (4,1)
(0,1) with (2,0)
(1,1) with (0,1)
(1,1) with (3,0)
(2,1) with (4,2)
(2,1) with (2,2)


There is a visualizeEdgeDelta flag in the config in src/main.ts 
This flag is unused for now.
Please use this flag to modify how edges are drawn:

* When it is false: edges are rendered like now. 
* When it iss true: For the edge the absolute difference between the states of the two adjacent cells is calculated and this absolute difference is used to lookup the color of the edge in the edgePalette.



implement a new edgeSelectionRule named highestEdgeDelte in src/particle-system.ts that works like this:
* the particle chooses one of the edges with the highest "edge delta" (the absolute difference between the cells sharing the edge)
* the particle never backtracks (the edge it arrived at is excluded from the candidates of edges it chooses from)

