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
