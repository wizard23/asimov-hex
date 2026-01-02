
# AI Instructions
## Scope and Purpose of this Documentation
Please create a user manual documenting the current functionality of all the available apps that are declared in the vite.config.ts file.

An app is defined as a webpage for the purpose of this task. 

To understand the type of project better please also look at these files and directories before writing the user manual:
vite.config.ts
src/apps/
package.json
tsconfig.json
scripts/

You are allowed to look at all files directly or indirectly linked or mentioned in those files if you need to in order to write the user manual.

## Scope and Purpose of the User Manual
The user manual should strictly document the current functionality of the app as it is implemented now. Don't include any planned features or possible new features.

The main audience of the documentation are the users of the apps. It should be understandable for technically minded users. 

Please document and explain all types of user interactions available. After reading the manual a user should understand what the app is used for and should be able to confidently use all features in the way they were intended. 

Please keep the user manual short if possible. But don't leave out relevant details just for the sake of keeping the documentation short. The documentation should be complete. 

## Structure of the User Manual
For each app please start with a short overview that quickly summarizes the purpose of the app and gives a quick overview of what the main features of the app are.

Then describe the window layout and explain what areas are used for what purposes.

Then describe all features and how they work.

All types of interactions that are done with the mouse cursor should be explained in detail.

## Navigation between pages
The starting point for the whole manual is in
public/documentation/user-manual/index.md

This should provide links to all availabe apps together with a one or two sentence description of what the app does.

Each app has its own directory and their own starting landing page in a directory with it's name. For example:
* public/documentation/user-manual/main/index.md
* public/documentation/user-manual/tile-editor/index.md
* etc.

If it makes sense for an app to split the landing page up in smaller units please create seperate files with meaningful names in the directory for the app.

### Deciding what details to include
By reading the documentation a user should be able to:
* find out about all features the app supports.
* make use of all the features of the app and a user should be able.

#### These details need to be included in the documentation
Ensure that these details are definitely included in the documentation:
* The different coordinate systems that are used in the app.
* All kinds of user interactions that are supported by the app.
* what actions are triggered under what conditions with hotkeys and or mouse clicks, mouse wheel, etc.

## Documenting Sub-Apps
The following section is about how sub-apps of the app described in this document ought to be documented. It uses the "Tile Editor" sub-app "Polygon Editor" as a specific example but it is, of course, meant to describe the general way for documenting sub-apps:

To ensure this document is well structured and does not loose focus by describing small details please use separate files to describe the sub-apps. This way it is enough to just reference the sub-apps in this and other documents. Referencing a sub-app should be done like this:

"Polygon Editor" (put the name of the sub-app in quotation marks to clearly distinguish between normal text and a references to a specific sub-app)

The naming scheme for documenting the sub-apps of this app goes like this: 

The current functionality of the sub-app should be documented in polygon-editor.md

## Links between Files
When referencing something that is described in another file please create links to the referenced file like this:
["Polygon Editor"](./grid-controls.md)

Use a clear and consistent linking scheme. All separate files in the documentation must be reachable via links. So please ensure that no file is orphaned. Also ensure that it is always possible to get back to where one came from via clicking a link. So there must not be any dead ends in the navigation between files. It is not necessarily required to be able to reach every file directly from every other file so please only link what is relevant.

## FAQ
* Please keep these instructions as they are and only make changes in the other .md files.
* If anything is unclear please just ask.
