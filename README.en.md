<p align="center">
  <img src="public/favicon.svg" width="104" height="104" alt="Workspace Atlas logo" />
</p>

<h1 align="center">Workspace Atlas</h1>

<p align="center"><strong>A three-dimensional home for your projects and ideas</strong></p>
<p align="center">Turn projects into distinctive planets. Explore your workspace with smooth flights and automatic cruise.</p>

<p align="center">
  <a href="https://github.com/cgbpnw5bw4-create/workspace-atlas/releases/tag/v1.0.0"><img src="https://img.shields.io/badge/Version-v1.0.0-c9a66b?style=flat-square" alt="Workspace Atlas 1.0 stable release" /></a>
  <a href="https://github.com/cgbpnw5bw4-create/workspace-atlas/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/cgbpnw5bw4-create/workspace-atlas/ci.yml?branch=main&amp;label=Build&amp;style=flat-square" alt="Build status" /></a>
  <a href="https://cgbpnw5bw4-create.github.io/workspace-atlas/"><img src="https://img.shields.io/github/actions/workflow/status/cgbpnw5bw4-create/workspace-atlas/pages.yml?branch=main&amp;label=GitHub%20Pages&amp;style=flat-square" alt="GitHub Pages deployment status" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/License-MIT-c9a66b?style=flat-square" alt="MIT License" /></a>
  <a href="package.json"><img src="https://img.shields.io/badge/Node.js-24%2B-5fa04e?style=flat-square" alt="Node.js 24 or later" /></a>
  <img src="https://img.shields.io/badge/Graphics-WebGL%202-6e83b7?style=flat-square" alt="WebGL 2" />
</p>

<p align="center">
  <a href="https://cgbpnw5bw4-create.github.io/workspace-atlas/"><strong>Try online</strong></a> ·
  <a href="https://github.com/cgbpnw5bw4-create/workspace-atlas/releases/tag/v1.0.0">Release notes</a> ·
  <a href="#quick-start">Quick start</a> ·
  <a href="#features">Features</a> ·
  <a href="README.md">简体中文</a>
</p>

---

Workspace Atlas is a **Three.js + Vite** project navigator. Procedural nebulae, an accretion disk, planets and orbits form an interactive map of your work. Select a planet to fly closer and explore its project files.

<p align="center">
  <a href="https://cgbpnw5bw4-create.github.io/workspace-atlas/"><img src="docs/images/atlas-overview.jpg" width="100%" alt="A galaxy of 48 sample projects in Workspace Atlas" /></a>
  <br />
  <sub>48 sample projects · 4 sectors · Ready to explore in your browser</sub>
</p>

## See it in motion

<p align="center">
  <img src="docs/images/atlas-exploration.webp" width="100%" alt="Recorded Workspace Atlas interaction: automatic cruise and clicking a planet to enter its project" />
  <br />
  <sub>Recorded in the application: automatic cruise → return to the galaxy → click a planet → smooth flight into its project</sub>
</p>

## Features

| Feature | Description |
| --- | --- |
| **Procedural planets** | Stable seeds determine each project's terrain, palette, atmosphere, rings and moons. |
| **Smooth camera flights** | Select a planet, label or project card to approach it and open its panel. |
| **Automatic cruise** | Visit the current selection in order; drag, scroll or use the takeover button to regain control. |
| **Project directory** | Search, filter, sort and switch between grid and list views. Favorites stay in the current browser. |
| **File navigation** | Explore sample folders in the showcase, or connect a local workspace and open files on Windows. |
| **Two operating modes** | A galaxy showcase to explore online, and an optional local mode for your own project folders. |

<p align="center">
  <img src="docs/images/atlas-project.jpg" width="100%" alt="A planet's project file panel after clicking it and flying closer" />
  <br />
  <sub>From the galaxy overview to an individual project</sub>
</p>

## Quick start

**Requirements:** Node.js **24 or later**, and a modern browser with **WebGL 2**.

```sh
git clone https://github.com/cgbpnw5bw4-create/workspace-atlas.git
cd workspace-atlas
npm ci
npm run dev
```

Open the local URL printed by Vite. The default showcase includes **48 sample projects** across Engineering, Design, Research and Archive. Files are virtual, and service states and controls are simulated. No account, API key, local filesystem scan or business backend is required.

```sh
npm run build
npm run preview
```

The generated `dist/` folder is a static site suitable for GitHub Pages.

## Controls

| Action | Result |
| --- | --- |
| Drag / scroll | Orbit / zoom; take over an active cruise |
| Select a planet, label or project | Fly closer and open its panel |
| `Ctrl+K` / `⌘K` | Focus project search, or file filtering when the file panel is open |
| `Esc` | Stop cruise, cancel a flight or close the current panel |
| Automatic cruise | Visit the current project selection in order |
| Pause / reset | Control ambient animation / return to the overview |

## Operating modes

| | Galaxy showcase | Local workspace |
| --- | --- | --- |
| Projects | 48 sample projects across 4 sectors | An explicitly configured local root |
| Files | Virtual folders in the browser | Real directories and file entries |
| Services | Simulated states and controls; no system commands | No business service integrations |
| Start | Try online or `npm run dev` | Set `ATLAS_ROOT`, then run `npm start` |

### Connect a local directory

Organize folders as `workspace/group/project`. Explicitly set your own root to enable local browsing:

```powershell
npm run build
$env:ATLAS_ROOT = 'D:\YourWorkspace'
npm start
```

Open `http://127.0.0.1:4317`; the server redirects to local mode. Set `ATLAS_PORT` to change the port. On Linux/macOS, use `ATLAS_ROOT=/path/to/workspace npm start`.

Directory browsing is cross-platform. Opening files with their default application and revealing files in Explorer require Windows; other platforms return an unsupported-operation response. The generic local mode does not include business service launch commands and returns an empty service list. Without `ATLAS_ROOT`, `npm start` serves the galaxy showcase.

**Keep the local API on loopback. Do not expose it through a public tunnel or reverse proxy.** GitHub Pages serves the static galaxy showcase.

Clear the variable to restore the default showcase: `Remove-Item Env:ATLAS_ROOT`.

## Project structure

| Path | Responsibility |
| --- | --- |
| `src/main.js` | Project directory, search, favorites and file panels |
| `src/scene.js` | 3D scene, camera flights and automatic cruise |
| `src/planets.js` | Procedural planets, rings and moons |
| `src/nebula.js` | Procedural nebula background |
| `src/sample.js` | Sample projects, directories and service states |
| `server.mjs` | Optional local directory API and static file server |
| `tests/` | Showcase behavior and local API boundary tests |

Run checks: `npm test` · `npm run build`

## Known limitations

- The galaxy is an artistic navigation scene, not an astronomical or physical simulation.
- Rendering performance depends on the device and GPU. When WebGL initialization fails, the project directory remains available; automatic cruise is unavailable.
- Sample projects and virtual files populate the showcase. Service states and controls are simulated; they do not connect to real business services or execute system commands.
- The scene bundle currently exceeds 500 kB, producing a size warning without preventing a successful build.

## Contributing

Creative visual ideas are welcome: planetary terrain, nebula palettes, camera movements and new interactions. Share your ideas, reference images or implementations through [Issues](https://github.com/cgbpnw5bw4-create/workspace-atlas/issues) or a Pull Request, and help shape this galaxy.

Bug reports and feature suggestions are welcome too. Include your browser version, operating system and reproduction steps in bug reports.

## License

Released under the [MIT License](LICENSE). See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md) for dependency attribution and licenses.
