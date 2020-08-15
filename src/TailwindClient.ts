import * as ts from "typescript/lib/tsserverlibrary";
import * as fs from "fs";
import * as path from "path";
import * as glob from "glob";
import extractClassNames from "./extractClassNames";
import importFrom = require("import-from");
import resolveFrom = require("resolve-from");
import type { Result } from "postcss";

export class TailwindClient {
  private readonly projectRootPath = this.project.getCurrentDirectory();

  static currentClasses?: string[];

  static lastUpdatedAt?: number;

  getLastUpdatedAt() {
    return fs.statSync(this.getConfigPath()).mtime.getTime();
  }

  isFresh() {
    return TailwindClient.lastUpdatedAt === this.getLastUpdatedAt();
  }

  /**
   * @see https://github.com/tailwindlabs/tailwindcss-intellisense/blob/eb28c540c3cff7cf4c625cf44a81e8a44164a9ed/src/class-names/index.js#L36
   */
  private readonly configGlob = path.join(
    this.projectRootPath,
    "**/{tailwind,tailwind.config,tailwind-config,.tailwindrc}.js"
  );

  constructor(private readonly project: ts.server.Project) {}

  getClassNames() {
    return TailwindClient.currentClasses ?? [];
  }

  getConfigPath() {
    const [configPath] = glob.sync(this.configGlob);
    if (!configPath) {
      throw new Error("Cannot find tailwind config");
    }

    if (!this.project.fileExists(configPath)) {
      throw new Error("Cannot find tailwind config");
    }

    return configPath;
  }

  async requestCompileCss() {
    const configPath = this.getConfigPath();
    const postcss = this.requirePostCss();
    const tailwindcss = this.requireTailwindCss();

    return Promise.all(
      ["base", "components", "utilities"].map((group) =>
        postcss([tailwindcss(configPath)]).process(`@tailwind ${group};`, {
          from: undefined,
        })
      )
    ).then((result) => {
      TailwindClient.lastUpdatedAt = this.getLastUpdatedAt();
      TailwindClient.currentClasses = this.extractClassNames(result);

      this.project.projectService.logger.info("compiled tailwind.css");
    });
  }

  private requirePostCss() {
    const configPath = this.getConfigPath();
    const tailwindRootPath = path.dirname(
      resolveFrom(configPath, "tailwindcss/package.json")
    );

    return importFrom(tailwindRootPath, "postcss") as typeof import("postcss");
  }

  private extractClassNames([base, components, utilities]: Result[]) {
    const { classNames } = extractClassNames([
      { root: base.root, source: "base" },
      { root: components.root, source: "components" },
      { root: utilities.root, source: "utilities" },
    ]);

    const classes = Object.keys(classNames);

    this.project.projectService.logger.info(JSON.stringify(classes));

    return classes;
  }

  private requireTailwindCss() {
    return importFrom(
      path.dirname(this.getConfigPath()),
      "tailwindcss"
    ) as Function;
  }
}
