
## CREATE

Please create the user manual for the available app in this directory:
public/documentation/user-manual
Detailed instructions about the scope and the structure of the documentation are in:
public/documentation/user-manual/ai-instructions.md
The main entry pont for the documentation is:
public/documentation/user-manual/index.md

Please read the instructions and then create the documentation. 

If anything is unclear please just ask.


## SESSIONS
///////////////////// 2026/01/02 
Please create the user manual for the available app in this directory:
public/documentation/user-manual
Detailed instructions about the scope and the structure of the documentation are in:
public/documentation/user-manual/ai-instructions.md
The main entry pont for the documentation is:
public/documentation/user-manual/index.md

Please read the instructions and then create the documentation. 

If anything is unclear please just ask.



Please create a new app that shows md (markdown) files (passed as url arg with a link to the md file)
The app should download the md file that it got as an url arg and then display the markdown.
If anything is unclear please just ask.


and then add a link to the user manual to the "Info Panel" in the "Main" app.


Please use the Marked library for parsing and converting the markdown to html


I've tested it a bit:
* http://localhost:3000/markdown-viewer.html?url=/documentation/user-manual/index.md for example looks great
* links don't work yet since they assume the linked document at a wrong url.

Please make the links work.

If anything is unclear please just ask.


The urls "work" now but they, of course, get displayed in the browser as plain text.
Please use the markdown viewer itself in the links and pass the markdown file as an arg.


This works very well but they open a new tab. Please just create a normal link.



The links still get opened in a new tab. 



Please add a checkbox control for a flag labeled "Hide Meta Controls"


It's for the markdown viewer. Please just add the control for now and we'll wire it up later.



Please wire it up to hide everything except the actual rendered markdown.
Just for clarification: This means it will also hide itself.


Yes please also add a keyboard hotkey for toggling it with: Ctrl+Alt+M


the hotkey does not work for me. To debug please just wire it to the M key.


Please make it hidden (checked) initially.


This works but initially the meta controls flash for a few milliseconds.


For the Label of the checkbox: Use "Hide Controls (<keyboard hotkey>)" for the label please.



Please add a link to the user manual in the "Info Panel" in the main app.
It should open in a new tab and link to this markup file (using the markdown viewer)
public/documentation/user-manual/main/index.md


Please put the link to the manual right next to the header in brackets.


No this does not look good. Please put it back to the other links but give it it's own header "Documentation"





better
coordinates where applicable

ad screenshots for all dialogs


## UNUSED

## Overview
Please document the apps located in:
./src/apps/main
./src/apps/tile-editor

These are used the usual way for a vite based web app defined in:
package.json
vite.config.ts

If you need to you can look at all relevant source and html files.




## Links
### Links to sub pages

### Links to the apps
Please link the actual applications in the documentation. Please use absolute paths for the links to the apps. You should be able to deduce the correct links from the vite config.

for linking the apps 


./public/documentation/user-manual/main/index.md
./public/documentation/user-manual/tile-editor/index.md

