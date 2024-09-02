![downloads](https://img.shields.io/github/downloads/misthero/last-scene-view/total.svg)

# Save Last Scene View Position - A Foundry VTT Module

This module saves each player's last scene view position, including the scene scale, and restores it when the scene is loaded again. Each scene will retain its view position relative to each player's ID.

This feature is useful for resuming exactly where you left off at the end of the last session or if you need to reload Foundry. The initial scene view position will be ignored, and each player will start where they were last time.

By default, the scene view position is saved 3 seconds after the last scene pan or zoom action. This delay is configurable.

## Features
- The GM can disable the module for a specific scene using the scene configuration window. 
- There is also an option to clear saved positions, in this case and when a player has no view position saved by this module, it will fall back to the default Foundry VTT "Initial View Position."

The scene navigation will show a tiny dot next to the name of the scene. The dot will be green if the last position has been saved, grey otherwise. 

![grey dot](https://i.postimg.cc/0ykYn7QB/screenshot-222.png)  ![green dot](https://i.postimg.cc/tJGPxxwD/screenshot-222.png)


If you see a red dot, the module is disabled for that scene.
