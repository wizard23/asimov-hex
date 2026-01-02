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






////////// SESSION 2026/01/02

Please look at:
scripts/create-project-statistics.ts
package.json
vite.config.ts
statistics.html
src/apps/statistics


We will be doing changes.

Please adapt the statistics generation script to also include the list of all files that got included in the words/lines/bytes count.
Then please adapt the app to also list these files right after the table with the file endings.

If anything is unclear please just ask.



/// TODOS-golden.md
The app failed in CI. Please fix the errors.

Please look at the scripts in ./package.json
If you need to you can also look at any code or file that is referenced there.

Then run (using a 90 sec timeout):
npm run verify

You can also use the individual scripts to save time.
* test
* lint
* build

In the future when you change something please always use this method for finding out if there are still errors in the code that would fail in CI.



I did not specify it correctly and in enough detail. What I meant was that for each included file we need the same fields that are available for the file types:
* words
* lines
* bytes

In the app it should be shown to the user by making each file type expandable and the list the files under the filetype

Additionally after the table with the file endings there should be a similar table with all files and their stats (sorted alphabetically ascending initially)
By clicking on any header the table should get sorted by this field ascending.

If anything is unclear please just ask.




## INIT 2026/01/02

Please look at:
scripts/create-project-statistics.ts
package.json
vite.config.ts
statistics.html
src/apps/statistics


## IMPROVEMENTS/THOUGHTS
* wow 99% context left with INIT 2026/01/02







