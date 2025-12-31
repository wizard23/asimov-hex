Please take a look at the script in:
scripts/codex-with-autotranscript.sh
then please modify like this:

* The script should expect one command line arg for a "session label".
* It should print the intended usage instructions and exit when the arg was not provided or if more than one arg was providen
* the "session label" argument gets incorporated in a safe way into the name of the log file for example: if the arg was "a test///   for test-label" then the name of the log file should look something like this:
  * docs/transcripts-buffer/codex/codex-a_test_for_test-label-2025-12-31-1813.log
* the name of the logfile should be shown to the user before codex gets started.

If anything is unclear please just ask.

  