Pleas use the opportunity to clean up the code and make sure the code base is clean:
* Are there any code smells in the code base?
* Are there any now unused remains of previous features or code paths that became derelict?
* Are there any redundant or very similar code in multiple places?
* Are all types consistent with the way they are used in the code?
* Are any non optional fields tested for unknown or undefined? 
* For every field of every type/interface that is used anywhere in the code for a legacy file format test: is the relevant field an optional field in the corresponding data type?




