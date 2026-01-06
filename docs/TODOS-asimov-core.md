* github repo
* ssh key generator script


## TEMPLATING ENGINE
* tree ontology
* current state (serializable full history) so in each session we have i.e.
  * current project
  * current task
  * current ticket
  * related tickets?
* but this just comes from the tree ontology
* tree ontology:
  * each entity is serialized as json
  * couch DB???
  * or JSON files in structured directories? (better)
  * then held in memory :)
  * has typed fields
  * all have a unique string id (unique in entity type)
  * maybe all also have an meta_id GUID
  * each entity can IS or HAS another entity


Example Ontologies
* Project
  id

* Webapp
  *
  * deploy

* template declares what ontology items it requires
* templates use { astro style templating/inline js if needed }



### VISION
#### structured tags
Algebraic data types written like rabbitmq tags and filterable like rabbitmq tags
error-*

Tagtypes define the algebraic data type of a tag (everything has an id so we can specify the tragtype for required tags)

Like this it should be possible to make project from one customer inaccessable to devs who are not allowed to see those

Mandatory tags enforced by validation.

When changing the schema list of templates that don't conform yet.

Templating engine like astro templating

Templates can define what ontology items they use: example:
* template for context init needs <project> and <app> and build command for looking at the files for the project and the specific app.
* template for user-manual needs <intended audience> and <writing style> 


Templates are also algebraic (well they can be a union I guess)

Ontology aenderungen sollten immer gehen wenn es keine templates gibt also ist algorihmus zum aendern:
1. alle templates entfernen.
2. ontology updaten 
3. alle templates einzeln wieder reingeben

Project hat zb field essential-files ist liste von esseintial files (zb vite config und package.json)
Project hat repo feld
Project hat directory?
Project hat tech stack? oder ist das package.json
Project hat list of Apps?

App hat 

## Why not write it in purescript???

So we could use the algebraic datastructures available there and have strong types :)

Finally an Application for HAskell!!!!

Category Theory for vibe coding :)





# Initial Prompt
Please create a new webapp called "asimov-core"

### Tech stack
* TypeScript
* vite
* preact

### UI components
Please extract all ui controls into separate files in an appropriate directory to ensure all pages use a consistent set of ui elements


### The app
* the app shows a grid consisting of cells
* each cell can be in one of N states (states start with 0 and go up to N-1)
* there is a palette that maps cell states to colors
* when cells are left clicked the state of a cell is set to the currently selected "draw state"
* when cells are right clicked the state of a cell is set to the currently selected "draw state"
* when the mouse is over a cell edge this edge gets highlighted
* the following options are configureable via a tweakpane sidebar
  * "grid width": integer: horizontal size of the grid in cells
  * "grid height": integer: vertical size of the grid in cells
  * "grid type": enum: what kind of tesselation the grid uses: squares, hexagons, triangles
  * "grid scale": float: the length of a cell edge. In other words: the length of one side of the square, hexagon, or triangle
  * "draw state": integer: 
  * "palette": Record<number, color>: a color for every possible state
  * "edge color": color to use to draw the edges
  * "edge highlight color": color to use to draw the highlighted edges

