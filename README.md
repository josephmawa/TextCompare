<!-- markdownlint-disable -->
<div align="center">
  <img src="./data/icons/hicolor/scalable/apps/io.github.josephmawa.TextCompare.svg" alt="Text Compare" width="128" height="128"/>
</div>
<h1 align="center">Text Compare</h1>
<p align="center"><b>Compare old and new text</b></p>
<div align="center">
  <a href="https://flathub.org/apps/io.github.josephmawa.TextCompare">
    <img width="240" alt="Get it on Flathub" src="https://flathub.org/api/badge?locale=en"/>
  </a>
</div>
<p align="center">
  <img src="./screenshots/compare-dark-mode.png" alt="Compare in dark mode" width="986" height="692"/>
</p>
<p align="center">
  <img src="./screenshots/compare-light-mode.png" alt="Compare in light mode" width="986" height="692"/>
</p>

<!-- markdownlint-enable -->
<!-- markdownlint-disable headings -->

Text Compare is a simple text comparison app for Gnome desktop environment.

 ## Main features

- Compare old and new text
- Select comparison token
- Switch to dark, light or system mode

## Contributing

If you find this app useful, do consider contributing. If you are wondering how,
you can contribute in the following ways:

- Star the project repository on GitHub
- Report bugs if you encounter some. There are probably a handful of them.
- You can also contribute code. If it is a bug fix, do open a pull request(PR). However,
if it is a new feature, first open an issue so that we discuss it before opening
a PR.

## Run project locally
 <!-- markdownlint-disable no-inline-html -->
1. Download [GNOME builder](https://flathub.org/apps/org.gnome.Builder). It's the
 fastest way to get up and running.
1. Use GNOME builder to clone this project to your local machine. The
<kbd>Clone Repository</kbd> button is at the bottom of the GNOME builder Welcome
 screen.
1. Use the <kbd>Shift</kbd> + <kbd>Ctrl</kbd> + <kbd>Space</kbd> keyboard
combination to run the project after opening it in GNOME builder. You can also
 use the <kbd>▶</kbd> button at the top.
 <!-- markdownlint-enable no-inline-html -->

## License

Compare is a [free software](https://www.gnu.org/philosophy/free-sw.html) and
will always be free. It is released under the terms of the
[GNU General Public License v3.0](./LICENSE).

## Acknowledgment

- This app's UI is inspired by [Workbench](https://github.com/workbenchdev/Workbench).
Thank you Sonny Piers and the other maintainers of Workbench.
- Internally, the app uses [jsdiff](https://github.com/kpdecker/jsdiff), a JS implementation
of [Myers' Difference Algorithm](http://www.xmailserver.org/diff2.pdf). Thank you
Kevin Decker and the other maintainers of jsdiff.

## License

This project is [GPL-3.0 Licensed](./COPYING) and jsdiff, the text diff package
it uses internally, is BSD 3-Clause Licensed.

## Copyright

Copyright © 2025 [Joseph Mawa](https://github.com/josephmawa)
