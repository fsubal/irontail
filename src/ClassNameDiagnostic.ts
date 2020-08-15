import * as ts from "typescript";
import { TailwindClient } from "./TailwindClient";
import { CallExpression } from "typescript/lib/tsserverlibrary";

export interface EachDiagnostic {
  start: number;
  length: number;
  messageText: string;
}

const FUNCTION_NAMES = ["classNames", "classnames", "clsx"] as ts.__String[];

function isClassNameCall(node: ts.Node): node is CallExpression {
  if (!ts.isCallExpression(node)) {
    return false;
  }

  if (!ts.isIdentifier(node.expression)) {
    return false;
  }

  return FUNCTION_NAMES.includes(node.expression.escapedText);
}

export class ClassNameDiagnostic {
  private diagnostics: EachDiagnostic[] = [];

  constructor(
    private readonly sourceFile: ts.SourceFile,
    private readonly tailwind: TailwindClient
  ) {}

  toArray(): EachDiagnostic[] {
    ts.transform(this.sourceFile, [this.transformer]);

    return this.diagnostics;
  }

  private transformer = (context: ts.TransformationContext) => (
    rootNode: ts.Node
  ): ts.Node => {
    const visit = (node: ts.Node) => {
      node = ts.visitEachChild(node, visit, context);

      if (isClassNameCall(node)) {
        const unknownClasses = this.getUnknownClassNames(node);
        unknownClasses.forEach(({ className, start, length }) => {
          this.diagnostics.push({
            start,
            length,
            messageText: `Unknown tailwind class: "${className}"`,
          });
        });
      }

      return node;
    };

    return ts.visitNode(rootNode, visit);
  };

  private getUnknownClassNames(node: ts.CallExpression) {
    const extractedClassNames = this.tailwind.getClassNames();

    return node.arguments
      .filter((argument): argument is ts.StringLiteral => {
        if (!ts.isStringLiteral(argument)) {
          return false;
        }

        return !extractedClassNames.includes(argument.text);
      })
      .map(({ text, pos, end }) => ({
        className: text,
        start: pos,
        length: end - pos,
      }));
  }
}
