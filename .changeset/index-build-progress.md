---
'seekstone': patch
---

The server logs index build progress to stderr at startup, so a long first build on a large vault no longer looks like a hang. Every vault gets a line after the walk and one before parsing starts; vaults of 1,000 notes or more also get a line every 1,000 notes read.
