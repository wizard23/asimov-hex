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