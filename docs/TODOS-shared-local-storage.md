# Locked shared local storage values
This document specifies the "Locked Shared Local Storage Values" library (abreviated with LSLSV).

## Purpose
This web application consists of multiple (sub) apps that can be used at the same time by opening multiple browser windows. To ensure that data that gets stored to the local storage does not get corrupted or overwritten when multiple instances of the same app (or sub apps that write the same local storage values) try to write the same values we need an efficient locking mechanism. This document describes this mechanism and the naming conventions surrounding it.

## Examples/Use cases
here is a non comprehensive list of applications of the shared local storage values
* Palettes: The app makes use of palettes in several of the apps and there is also a designated palette editor that can be used to create and modify palettes. When multiple instances of the palette editor are active it is important that these don't corrupt or overwrite the palette data.
* Message queues: To enable inter-page message passing we need a mechanism to manipulate the queues. The "locked shared local storage values" provide this mechanism.

## Naming conventions
Each value should be named like this
Each value (no matter if it is an object, array, or primitive value) is stored as a serialized JSON string.

## Message queue
message queu for each app

queue is a shared value

take message and process it
failed messages get stored in a separate shared local storage value
