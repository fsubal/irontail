/**
 * Copied from https://github.com/tailwindlabs/tailwindcss-intellisense/blob/6659228975393fb583268b50c2274d082a159072/src/class-names/extractClassNames.js
 */

import selectorParser = require("postcss-selector-parser");
import postcss = require("postcss");

function getClassNamesFromSelector(selector: selectorParser.Selectors) {
  const classNames: string[] = [];
  const { nodes: subSelectors } = selectorParser().astSync(selector);

  for (let i = 0; i < subSelectors.length; i++) {
    const subSelector = subSelectors[i] as selectorParser.Container;

    for (let j = 0; j < subSelector.nodes.length; j++) {
      const node = subSelector.nodes[j];

      if (node.type === "class") {
        let next = subSelector.nodes[j + 1];

        while (next?.type === "pseudo") {
          j++;
          next = subSelector.nodes[j + 1];
        }

        classNames.push(node.value.trim());
      }
    }
  }

  return classNames;
}

interface Group {
  root?: postcss.Root;
  source: string;
}

export function extractClassNames(groups: Group[]) {
  const tree: Record<string, true> = {};

  groups.forEach((group) => {
    group.root?.walkRules((rule) => {
      const classNames = getClassNamesFromSelector(rule.selector);

      classNames.forEach((className) => {
        tree[className] = true;
      });
    });
  });

  return tree;
}
