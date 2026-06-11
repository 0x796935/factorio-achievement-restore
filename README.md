# Factorio Achievement Restore

## Factorio Achievement Restore Readme

Factorio Achievement Restore is a tool created by 0x796935 based on the research/method of u/KimJonhUnsSon on [Reddit](https://www.reddit.com/r/factorio/comments/rlprxh/text_tutorial_for_reenabling_achievements_after/). This tool helps you restore achievements in Factorio after using console commands or mods.

Based on comments on [Reddit](https://www.reddit.com/r/factorio/comments/1gacff0/enabling_achievements_after_using_console_commands/) and binary analysis of the Factorio 2.0.x executable, the cheat-flag bytes and their context in the save file have been identified. The tool patches the relevant bytes in the compressed save data and recreates the save ZIP.

> **Tested against Factorio up to 2.0.x (Space Age).** Because the flag locations are derived from the compiled binary's struct layout, they may shift again in a future major update. If the tool reports no changes for a freshly cheated save, please open an issue.

### Requirements

- Latest Node.js (tested on v20.5.1)

### Installation and Usage

1. Clone the repository or download the source code.
2. Open a terminal/command prompt in the project directory.
3. Run `npm install` to install the required dependencies.
4. Run `npm start` to execute the tool.
5. Pick number of savegame and enjoy.
6. ([Check if Achievements are enabled](https://www.reddit.com/r/factorio/comments/qq77n5/comment/hjy9bgq/?utm_source=share&utm_medium=web2x&context=3))

![Screenshot](/screen_new.png)

### Known Limitations

- **`/c` console commands only (currently).** Using `/editor` or the in-game cheat toggle sets a *different* flag byte (`Map+0x230`) in the save. The tool now attempts to patch that flag too (via the `FF FF 01 01 00` pattern), but it has not been confirmed to work for every case. If achievements are still disabled after running the tool on a `/editor` save, try the workaround below.
- **Command log must still be present in the save.** The tool locates the flag by searching for the string `command-ran` in the save data. If a lot of game time has passed since you ran the command, that string may have scrolled out of the save's current chunk. **Workaround:** load the save in-game, run any harmless `/c` command (e.g. `/c game.player.print("hi")`), save again, then re-run this tool.

### Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| "No cheat flag bytes found in file" | Flag pattern changed in this Factorio version, or save is already clean | Open an issue with your Factorio version |
| "No command-ran marker found" | Command log scrolled out | See workaround above |
| Achievements still disabled after tool reports success | `/editor` flag — may need binary-level patch | See [BeLikeBrett/factorio-achievement-unlocker](https://github.com/BeLikeBrett/factorio-achievement-unlocker) (Linux) or [oorzkws/FactorioAchievementEnabler](https://github.com/oorzkws/FactorioAchievementEnabler) (Windows) |
| Save corrupted after running tool | Older version of the tool — update to the latest commit | Pull latest and retry on a backup |

### License

This project is licensed under the GNU General Public License v3.0.

### Acknowledgments

- u/KimJonhUnsSon on Reddit for the original research and method
- [BeLikeBrett](https://github.com/BeLikeBrett) for binary analysis of Factorio 2.0.x identifying the exact flag struct offsets
- [rezarria](https://github.com/rezarria) for adding Linux/OSX support
- [alvarocastro](https://github.com/alvarocastro) for adding npm start script
- [pooreboy](https://github.com/pooreboy) for adding the Space Age update
- [hazel410](https://github.com/hazel410) for adding custom saves-path support
- [fatcrackle](https://github.com/fatcrackle) for fixing ZIP extraction on Node 22/24

### Disclaimer

This tool is not officially supported by the Factorio developers. Use it at your own risk. Always keep a backup of your original save before running this tool.
