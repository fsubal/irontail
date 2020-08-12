import * as ts from "typescript/lib/tsserverlibrary";
import * as path from "path";
import * as glob from "glob";
import extractClassNames from "./extractClassNames";
import importFrom = require("import-from");
import resolveFrom = require("resolve-from");
import type { Result } from "postcss";

export class TailwindClient {
  private readonly projectRootPath = this.project.getCurrentDirectory();

  static currentCss?: Result[];

  /**
   * @see https://github.com/tailwindlabs/tailwindcss-intellisense/blob/eb28c540c3cff7cf4c625cf44a81e8a44164a9ed/src/class-names/index.js#L36
   */
  private readonly configGlob = path.join(
    this.projectRootPath,
    "**/{tailwind,tailwind.config,tailwind-config,.tailwindrc}.js"
  );

  constructor(private readonly project: ts.server.Project) {}

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

  extractClassNames() {
    // const postcss = this.requirePostCss() as typeof import("postcss");
    const css = this.getCompiledCss();
    if (!css) {
      return [];
    }

    const [base, components, utilities] = css;

    const result = extractClassNames([
      { root: base.root, source: "base" },
      { root: components.root, source: "components" },
      { root: utilities.root, source: "utilities" },
    ]);

    this.project.projectService.logger.info(
      JSON.stringify(Object.keys(result.classNames))
    );

    return Object.keys(result.classNames);
  }

  getCompiledCss(): Result[] | undefined {
    return TailwindClient.currentCss;
  }

  async enqueueCompileCss() {
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
      TailwindClient.currentCss = result;

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

  private requireTailwindCss() {
    return importFrom(
      path.dirname(this.getConfigPath()),
      "tailwindcss"
    ) as Function;
  }
}
