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