* unify spawn particle and cell manipulation by either highlighting cell or edge ;)
* ask how it is now
* particle rule: keep approx distance from mouse cursor
* multiple rules as priority list with rules that cant be fullfilled skipping to the next
*


## chatgpt chat 
https://chatgpt.com/share/69554dc2-d090-800c-8aa7-ef91c797ad25

If you have:
* a lattice
* and at each lattice point, a structured object (cells, edges, vertices)

Then mathematically you have:

A lattice with a basis

Or equivalently:

A periodic cell complex


```
interface PeriodicCellComplex {
  lattice: Lattice2D;
  basis: CellComplex; // local topology
}
```

Where:

lattice → translation symmetry

basis → vertices / edges / cells inside one fundamental domain

6. Naming alternatives (depending on tone)
Name	Tone
* LatticeWithBasis	mathematically clean
* PeriodicTiling	intuitive
* CellComplexLattice	topology-first
* UnitCellStructure	materials-science vibe
*PeriodicTopology	abstract / general



7. Key mental model (this clicks for most people)
* A lattice tells you where copies go.
* A basis tells you what gets copied.


Yes — in your Cairo tiling example:
*your lattice is correctly described by two vectors at 60°
*your “unit cell” being a subdivided hexagon is valid
but that unit cell is not the primitive cell — it’s a composite (non-primitive) unit cell


1. The three different “cells” people mix up
1️⃣ Primitive cell
* The smallest possible region whose translations generate the full lattice.
* Contains exactly one lattice point
* Defined purely by the lattice vectors
* Minimal area

For a hexagonal lattice:

a rhombus with 60° angle

2️⃣ Conventional (or non-primitive) unit cell
A larger, more symmetric region that still tiles space.
* May contain multiple lattice points
* Often chosen for symmetry or convenience
* Common in crystallography
Your hexagon falls into this category.

3️⃣ Motif / basis
The actual structure attached to each lattice point.

This can include:
* multiple vertices
* edges
* faces
* internal topology

2. Applying this to the Cairo tiling
What you have:
* A hexagonal lattice (two vectors at 60°)
* A hexagon-shaped unit cell

Inside that cell: a subdivision forming the Cairo tiling

This means:

You are using a non-primitive unit cell over a hexagonal Bravais lattice, with a complex basis.
That is 100% valid.

