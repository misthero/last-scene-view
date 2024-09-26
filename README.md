![GitHub Release][release-shield] ![GitHub Downloads (all assets, all releases)][download-shield]

![GitHub contributors][contributor-shield] ![GitHub last commit][last-commit-shield] [![Forks][forks-shield]][forks-url] [![Stargazers][stars-shield]][stars-url]

[![Forge Installs][forge-installs]][forge-link] ![Foundry Version](https://img.shields.io/endpoint?label=Foundry%20VTT%20versions:&url=https://foundryshields.com/version?url=https://raw.githubusercontent.com/misthero/last-scene-view/main/module.json)

[![ko-fi](https://img.shields.io/badge/ko--fi-Support%20Me-red?style=flat-square&logo=ko-fi)](https://ko-fi.com/misthero)

# Save Last Scene View Position - A Foundry VTT Module

This module saves each player's last scene view position, including the scene scale, and restores it when the scene is loaded again. Each scene will retain its view position relative to each player's ID.

This module is useful for resuming exactly where you left off at the end of the last session or if you need to reload Foundry or in case of crashes and mid-session involuntary reloads. The initial scene view position will be ignored, and each player will start where they were last time.

By default, the scene view position is saved 3 seconds after the last scene pan or zoom action. This delay is configurable.

## Features
- The GM can disable the module for a specific scene using the scene configuration window. 
- There is also an option to clear saved positions, in this case and when a player has no view position saved by this module, it will fall back to the default Foundry VTT "Initial View Position."

The scene navigation will show a tiny dot next to the name of the scene. The dot will be green if the last position has been saved, grey otherwise. 

![grey dot](https://i.postimg.cc/0ykYn7QB/screenshot-222.png)  ![green dot](https://i.postimg.cc/tJGPxxwD/screenshot-222.png)

If you see a red dot, the module is disabled for that scene.


[download-shield]: https://img.shields.io/github/downloads/misthero/last-scene-view/total?label=Latest%20Downloads
[release-shield]: https://img.shields.io/github/v/release/misthero/last-scene-view
[contributor-shield]: https://img.shields.io/github/contributors/misthero/last-scene-view?label=Contributors
[last-commit-shield]: https://img.shields.io/github/last-commit/misthero/last-scene-view?label=Last%20Commit
[forks-shield]: https://img.shields.io/github/forks/misthero/last-scene-view.svg?style=flat-round
[forks-url]: https://github.com/forks/misthero/last-scene-view/network/members
[stars-shield]: https://img.shields.io/github/stars/misthero/last-scene-view.svg?style=flat-round
[stars-url]: https://github.com/misthero/last-scene-view/stargazers
[forge-installs]: https://img.shields.io/badge/dynamic/json?label=Forge%20Installs&query=package.installs&suffix=%25&url=https://forge-vtt.com/api/bazaar/package/last-scene-view&colorB=blueviolet
[forge-link]: https://forge-vtt.com/bazaar#package=last-scene-view

[issues]: https://github.com/misthero/last-scene-views/issues





