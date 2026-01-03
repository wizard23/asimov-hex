Please take a look at the script in:
scripts/codex-with-autotranscript.sh
then please modify like this:

* The script should expect one command line arg for a "session label".
* It should print the intended usage instructions and exit when the arg was not provided or if more than one arg was providen
* the "session label" argument gets incorporated in a safe way into the name of the log file for example: if the arg was "a test///   for test-label" then the name of the log file should look something like this:
  * docs/transcripts-buffer/codex/codex-a_test_for_test-label-2025-12-31-1813.log
* the name of the logfile should be shown to the user before codex gets started.

If anything is unclear please just ask.







Please look at the shell script in ./scripts/codex-with-autotranscript.sh and add an optional 2nd command line argument.
If no 2nd argument is given codex should be called just like it is now.
If the second argument is given it's a "session id" and in this case codex should be called like this: `codex resume <session id>`

Please validate the session id given by ensuring it has the same basic format as this example session id: `019b7e1b-de31-7c72-959c-288a8a2e56b6`
* verify that the `-` are at the right positions
* verify that the length of the session id is correct.
Show a clear error message if the session id does not conform.

Update the usage instruction accordingly.



To make it obvious that this comes froma resumed session please add `-resumed-from-<session id>` to the log file name before the extension if the session id arg is available and valid.

  
Please give me a concise commit message for the changes we made now in the script.
Please put the commit message in this file: 
./temp/commit-message.txt