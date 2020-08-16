import * as ts from "typescript";
import { TailwindClient } from "./TailwindClient";
import { CallExpression, JsxAttribute } from "typescript/lib/tsserverlibrary";

export interface EachDiagnostic {
  start: number;
  length: number;
  messageText: string;
}

interface SuspiciousChildren {
  pos: number;
  end: number;
  className: string;
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

function isJsxClassNameAttribute(node: ts.Node): node is JsxAttribute {
  if (!ts.isJsxAttribute(node)) {
    return false;
  }

  return node.name.escapedText !== "className";
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
      if (isClassNameCall(node)) {
        this.getSuspiciousArguments(node).forEach(this.handleFound);

        return node;
      } else if (isJsxClassNameAttribute(node)) {
        this.getSuspiciousAttributes(node).forEach(this.handleFound);

        return node;
      }

      return ts.visitEachChild<ts.Node>(node, visit, context);
    };

    return ts.visitNode(rootNode, visit);
  };

  private handleFound = ({ className, pos, end }: SuspiciousChildren) => {
    this.diagnostics.push({
      start: pos,
      length: end - pos,
      messageText: `Unknown tailwind class: "${className}"`,
    });
  };

  private getSuspiciousArguments(node: ts.CallExpression) {
    const children: SuspiciousChildren[] = [];

    /**
     * @see https://github.com/JedWatson/classnames/blob/master/tests/index.js
     *
     * NOTICE: Not all cases are supported.
     * For example, object/function using .toString() is not supported.
     * @see https://github.com/JedWatson/classnames/blob/bbf03f73f30/tests/index.js#L94
     */
    node.arguments.forEach(function walk(argument) {
      /**
       * classNames('hoge')
       */
      if (ts.isStringLiteral(argument)) {
        children.push({ className: argument.text, ...argument });
      }

      /**
       * classNames(true && 'hoge')
       */
      if (ts.isBinaryExpression(argument)) {
        if (ts.isStringLiteral(argument.right)) {
          children.push({
            className: argument.right.text,
            ...argument.right,
          });
        }
      }

      /**
       * classNames(true ? 'hoge' : 'moge')
       */
      if (ts.isConditionalExpression(argument)) {
        /**
         * classNames(true ? 'hoge' : 'moge')
         *                   ^^^^^^
         */
        if (ts.isStringLiteral(argument.whenTrue)) {
          children.push({
            className: argument.whenTrue.text,
            ...argument.whenTrue,
          });
        }

        /**
         * classNames(true ? 'hoge' : 'moge')
         *                            ^^^^^^
         */
        if (ts.isStringLiteral(argument.whenFalse)) {
          children.push({
            className: argument.whenFalse.text,
            ...argument.whenFalse,
          });
        }
      }

      /**
       * classNames({ hoge: true })
       *
       * NOTICE: followings are not supported
       * - computed property ( { ['hoge']: true } )
       * - private property ( { #hoge: true } )
       * - numeric literal ( { 1: true } )
       */
      if (ts.isObjectLiteralExpression(argument)) {
        argument.properties.forEach((property) => {
          /**
           * classNames({ 'hoge': true })
           */
          if (property.name && ts.isStringLiteral(property.name)) {
            children.push({
              className: property.name.text,
              ...property.name,
            });
          }

          /**
           * classNames({ hoge: true })
           * or
           * classNames({ hoge })
           */
          if (property.name && ts.isIdentifier(property.name)) {
            children.push({
              className: property.name.escapedText.toString(),
              ...property.name,
            });
          }
        });
      }

      /**
       * classNames(['hoge'], [{ moge: true }])
       */
      if (ts.isArrayLiteralExpression(argument)) {
        argument.elements.forEach(walk);
      }
    });

    const extractedClassNames = this.tailwind.getClassNames();

    return children.filter(
      ({ className }) => !extractedClassNames.hasOwnProperty(className)
    );
  }

  private getSuspiciousAttributes(node: ts.JsxAttribute) {
    const children: SuspiciousChildren[] = [];

    if (node.initializer) {
      /**
       * <div className="aa">
       */
      if (ts.isStringLiteral(node.initializer)) {
        children.push({
          className: node.initializer.text,
          ...node.initializer,
        });
      }

      /**
       * <div className={"aa"}>
       */
      if (ts.isJsxExpression(node.initializer)) {
        if (
          node.initializer.expression &&
          ts.isStringLiteral(node.initializer.expression)
        ) {
          children.push({
            className: node.initializer.expression.text,
            ...node.initializer.expression,
          });
        }
      }
    }

    const extractedClassNames = this.tailwind.getClassNames();

    return children.filter(
      ({ className }) => !extractedClassNames.hasOwnProperty(className)
    );
  }
}
