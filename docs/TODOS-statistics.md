Please look at:
scripts/create-project-statistics.ts
vite.config.ts
statistics.html
src/apps/statistics

then please also include the excludedFolders and excludedFiles in the generated json and show them to the user so it is clear to him what files are not part of the statistics.


The intended logic is this:
* Include all files that are not ignored by git. So it should not make any difference if they are untracked or tracked.
* keep handling of excludedFolders/excludedFiles just like it is 



Please make the "Project Statistics" more compact such that it does not take up so much screen height

please look at the stats script in package.json and include this information in the generated statistic json files. 
Then display these values on the statistics page.


great. please add number of tracked directories and also add seperators that ensure that it is easy to parse


I was not very happy with my simple statistics script in package.json so I reverted your last changes.
I created a new shell script that generates the repo statistics in an easy to parse format. 
please look at the script in scripts/repo-statistics.sh
You can run it to see what it outputs

Then please look at the data structure that is meant to contain the parsed data
src/apps/statistics/types.ts

Then please:
* update the package.json stats script with a call of the new script.
* update the scripts/create-project-statistics.ts to run the script and parse the data.
* update the statistics page to show this data to the user.

If anything is unclear please just ask.


Pleae show in the Overview:
* Total Commit Count
* Tracked File Count
* Tracked Dir Count
* Tracked Content Bytes

Sort the Top Level Directories and the largest blobs by size (desc)


Please move the date from the overview to the header like so: Project Statistics — 2025/12/27 20:08:50




Now please add a new feature to the Project Timeline page.

First please look at the existing code in src/apps/timeline and timeline.html

Since the feature uses pixi js and similar user interactions as an existing app please look at src/apps/tile-editor as an example of 
* how to deal with hardcoded values used for determining how the pixi window is rendered 
* zoom interaction with a pixi window
* pan interaction with a pixi window


Then create a new "Display Mode" in src/apps/timeline called "Timeline". When it is selected the filtered commits should be displayed on an actual line rendered in a pixi js window. The selected date range is used to create the line spanning the whole Timeline Window. Each commit is represented by a small disk. 

When the user hovers over the disk representing the commit the same kind of info box for the commit is shown (at the bottom of the screen) that is now used in the "List" "Display Mode".

The user can zoom into the timeline and pan the timeline by dragging the window anywhere.

At the top of the window show a scale with subdivisions and labels (vertical) at:
* decades
* years
* months
* days
* hours
* minutes

depending on the zoom level only a maximum of 2 different subdivision types should be shown.

If anything is unclear please just ask.



That's already very good but it has some bugs and usability issues:
* panning should be restricted to the time axis (x axis in the window) there is no need to be able to pan the timeline up and down
* the timescale seems to be missing. I don't see it anywhere on the screen
* the timeline should be positioned a fixed distance below the timeline.
* hovering does not seem to work. No matter what I do I don't see a window with the commit details.
* the hovered commit should be highlighted.


Still some bugs but at least hovering/highlighting works a little but now :)
What I mean with "a little bit" is this: Hovering does not work when I move the mouse cursor on top of the commit, but when I zoom in or out while the mouse is over a commit or when I press a mouse button while over a commit it gets highlighted. Tut the highlighting does not get removed when I move the mouse away.

There are some other bugs still as well but lets get highlighting to work first please.

The other bugs are:
* scale is still not visible anywhere on the screen
* details of the highlighted commit are not shown anywhere on the screen



Please look at the two apps in src/apps/tile-editor and in src/apps/timeline

Both apps use pixi js to render stuff:
* Tile Editor renders Polygons
* Project Timeline renders commits

Both apps are have a zoom and pan feature:
* Tile Editor allows zooming in and out and panning the the polygons.
* Project Timeline allows zooming in and out and panning the timeline with the commits.

These features work well for both apps.

Both apps are meant to support a hovering feature:
* Tile Editor highlights polygons when the user hovers over them.
* Project Timeline should highlight the commits when the user hovers over them.


Tile Editor works flawlessly. Hovering works perfectly.
But in the Project Timeline hovering has some bugs and does not actually work.  

Please compare the code of the two apps and try to identify the root cause. 

Don't make any changes in the code please but just report your detailed analysis.



It still does not work. I think the bug is the result of not refreshing the view when hovering is detected since it works when I zoom in or out which probably triggers a redraw. Let's debug this systematically.
Please show a statically positioned html element in the top left corner of the screen containing either the hash of the commit if hovering over a commit or the text "not hovering over a commit" when not hovering over a commit.


when i zoom in with the mouse over a commit the commit is highlighted in white but the hoverDebugElement always just shows 'not hovering over a commit'. How can that be? Why is the commit drawn in white but the hash of the commit does not show?





Great! Hovering works now! commits are highlighted correctly and the details of the commit get correctly displayed at the bottom :)
Now please try to fix the issue with the scale not sowing up at all. 

Let's systematically debug this by just drawing 2 lines with the same lengths as the timeline parallel to the timeline. 

one of these lines should be slightly above the timeline and appear yellow
and one of them should be slightly below the timeline and appear pink.


This yielded some very interesting debugging info: Both lines get drawn but they all have a pinkish color. Also the timeline itself and the outlines of the commits are drawn with the same pink color. The disks of the commits still appear in blue.

Let's debug further by just trying to get the colors I suggested correct first and also ensure that the timeline itself is drawn in blue.


This again yielded some very interesting debugging info: Now no lines are visible at all! Only the disks of the commits show up! This probably also explains why the scale is not visible.


Very good! I now see all 4 lines (from top to bottom):
* gray scale line
* yellow line
* blue timeline with commits
* pink line

I don't see:
* scale labels
* subdivisions on the scale line


No I don't see tick marks on the scale line. I don't see any labels near the top. Visually it looks identical to how it looked before your most recent changes.




Yes! I see the small red square and i see the yellow label "SCALE" in the top left corner of the canvas.




Yes I see the green tick a little bit to the right of the "SCALE" text.
The units label says: "units: decade/year"

Just in case that's relevant: the commits I use span a time interval of just 5 days.


Pleas give me a list of all remaining code that comes from either failed attempts to fix the bugs or debugging code added for finding things out.


Please add a green and a red line at each commit
the green line represents lines added and points up
the red line represents lines removed and points down

Use a logarithmic scale for these lines and also show a scale for these on the right side of the screen.


please put the timeline in the center of the window.


the timeline is centered now but now there is a ux issue:

when I hover over a commit the commit details change in height. This leads to the pixi window getting smaller and so the timeline moves up a little. This causes the commit being away from the mouse cursor and so the commit details shrink again because no commit is hovered. This again leads to the pixi window getting bigger and so on. 
Please explore ways to prevent this dx issue. Don't change anything yet but only list possible approaches to the issue.  



• Here are practical ways to prevent the hover‑height feedback loop (no code changes yet):

  - Reserve a fixed-height area for the commit details so its height never changes (e.g., set a min/max height and make it scroll).
  - Render the commit details in an overlay positioned above the canvas (absolute/fixed), so it doesn’t affect layout or canvas size.
  - Keep the timeline canvas height fixed (CSS height or flex with fixed basis) and let only the details area scroll internally.
  - Move the details panel outside the #timeline-panel flex container (e.g., sidebar or footer) to decouple it from the canvas size.
  - Cache the last non-null hovered commit details height and lock the panel height until hover ends.



git worktree add ../hotfix hotfix/login
cd ../hotfix
# fix + commit

git worktree add ../wt/feature-stat-fixed-overlay feature/stat-fixed-overlay


