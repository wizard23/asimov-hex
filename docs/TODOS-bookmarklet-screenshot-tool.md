# Instructions
Please create a js bookmarklet app for the purpose specified below. 

## Coding Standards
The bookmarklet is quite extensive and bookmarklets are notoriously hard to debug so it's very important that the code follows these conventions meticulously:
* multiline, human readable
* precede the whole code with "javascript:""
* /* */ style comments ONLY
* Log everything that happens and the state the bookmarklet app is in using:
  * console.debug (for documenting every relevant detail going on and to help debugging by making the state the app "thinks" it is in explicit)
  * console.log (for key events)
  * console.warn (for things that are not as expected that might indicate a problem)
  * console.error  (for things that definitely are errors or that prevent the script from continuing in a meaningful way)

## Purpose
The purpose of the bookmarklet is to enable people who need to create user manuals/documentation for a webapp, to easily take screenshots of: 
* a complete browser window
* a certain areas of a web app
* a certain element of a web app 

## Visual Appearance
When activated it should show a small overlay dialog that can be dragged around to any place in the browser window by grabbing it in the title bar.
Please ensure that it is always on top of everything else.

It should have a radio button selection labeled "Screenshot Type" with these options available
* "Whole Window"
* "Select Area"
* "Select Element"
* "Find Element"

then it should have a text input labeled "Label"
the default value for this input should be:
"unknown"

then it should have a text input labeled "File Name"
the default value for this input should be:
"screenshot-<LABEL>--<DAY>-<TIME>.png"

then it should have a numeric input labeled "Delay (seconds)"
the default value for this input should be: "1"

then it should have an area that hosts the "Dynamic Inputs" that are described in detail below.

In the bottom it should have two buttons: one "Take Screenshot" and one "Close" button

### Dynamic Inputs
Depending on what "Screenshot Type" the user selects, the area for the "Dynamic Inputs" gets filled with different controls

#### "Whole Window"
This "Screenshot Type" does not have any dynamic inputs.

#### "Select Area"
This Screenshot Type has four numeric integer inputs for specifying the position and width/height (in pixel) of the area that should get screenshoted.


## Templating
when saving the screenshot the filename of the image is created by replacing the templates in the "File Name".
Use the current Date for <LABEL> and <DAY> and then replace the templates like this:
* <LABEL> -> the content of the "Label" text input 
* <DAY> -> YYYY-MM-DD
* <TIME> -> HH-MM-SS




## 

## Ways to take screenshots
When the user clicks the "Take Screenshot" button then the way the screenshot is taken is dependent on what :



* Show a Label counting down the ammount of seconds that was entered in the "Delay" input.
Depending on the option the user selected

