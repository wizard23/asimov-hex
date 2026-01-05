Pleas use the opportunity to clean up the code and make sure the code base is clean:
* Are there any code smells in the code base?
* Are there any now unused remains of previous features or code paths that became derelict?
* Are there any redundant or very similar code in multiple places?
* Are all types consistent with the way they are used in the code?
* Are any non optional fields tested for unknown or undefined? 
* For every field of every type/interface that is used anywhere in the code for a legacy file format test: is the relevant field an optional field in the corresponding data type?




We spent quite some time debugging and trying to apply different solutions to fix bugs. Please review the codebase now.
Pleas use the opportunity to clean up the code and make sure the code base is clean:
* Are there any remains of debugging approaches?
* Are there any remains of trying to fix a bug that actually did not work and are now redundant?
* Are there any code smells in the code base?
* Are there any now unused remains of previous features or code paths that became derelict?
* Is there any redundant or very similar code in multiple places?
* Are all types consistent with the way they are used in the code?
* Are any non optional fields tested for unknown or undefined? 



// Gave this to both codex and claude

Please review the quality of the code of the app in src/apps/timeline
* Are there any now unused remains of previous features or code paths that became derelict?
* Are there any remains of debugging approaches?
* Are there any code smells in the code base?
* Is there any redundant or very similar code in multiple places?
* Are all types consistent with the way they are used in the code?
* Are any non optional fields tested for unknown or undefined? 


// for claude
Please document your findings in docs/cleanup/timeline-cleanup-<current timestamp in format: YYYY-MM-DD>.md