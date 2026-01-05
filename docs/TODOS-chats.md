http://hex.wizard23.net 😃
(https gibt's net 😅)

Wollte eigentlich nur vibe coding ausprobieren mit  einem partikel system, welches auf den edges von hexfeldern lebt

Das hat ziemlich schnell funktioniert und dann sind mir tausende Ideen eingefallen...gestern bin ich endlich dazugekommen ein automatisiertes deploy script zu machen...es fehlen noch viele Sachen, aber dachte mir: 
Release early release often...

Besonders Highlight, das ich am Anfang gar nicht geplant hatte: 
http://hex.wizard23.net/timeline.html
Geht aber nur auf Desktop gut

http://hex.wizard23.net/tile-editor.html
Tiling Editor...an dem arbeite ich gerade da Micro manage ich ihn ein bisschen damit die wichtigsten Datenstrukturen und die Koordinaten Systeme genau so sind wie ich will 😅

Bei allem anderen hab ich nur drüber geschaut und ihn mal machen lassen und dann bei Bedarf refactored...das grid auf der Hauptseite war sowas...das war am Anfang "irgendwie" und damit er dann beliebige tilings unterstützen kann hab ich das dann refactored... theoretisch könnte das jetzt auch Penrose tilings...aber müsste hald eine Implementatierung vom Interface zur Verfügung stellen die die einzelnen Penrose tiles aufzählt und zu jedem Polygon die Nachbarn liefert... Aber jedes periodische polygonale tiling kann man damit ganz einfach abbilden 😃