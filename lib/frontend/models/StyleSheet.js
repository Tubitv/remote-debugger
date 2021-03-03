import parseCss from 'css/lib/parse';
import first from 'lodash-es/first';

import { filterDupName } from '../utils/common';

export default class StyleSheet {
  constructor(id, styleSheet) {
    this.media = []; // ToDo: figure out media usage
    this.origin = styleSheet.origin || 'regular';
    this.styleSheetId = id;
    this.cssText = styleSheet.cssText;
    this.ownerNode = styleSheet.ownerNode;
    this.parsedCssRules = styleSheet.cssRules.map(rule => rule.cssText);

    this.header = {
      disabled: false,
      frameId: window.remoteDebuggerLauncher.remoteDebugger.frameId,
      hasSourceURL: Boolean(styleSheet.href),
      isInline: styleSheet.ownerNode.tagName.toLowerCase() === 'style',
      origin: 'regular',
      ownerNode: styleSheet.ownerNode._nodeId,
      sourceURL: styleSheet.href,
      startColumn: 0,
      startLine: 0,
      styleSheetId: this.styleSheetId,
      title: '',
    };

    this.rules = this.cssText2rules(this.cssText);
  }

  cssText2rules(cssText) {
    const cssTextLines = cssText.split('\n');
    return parseCss(cssText)
      .stylesheet.rules.filter(rule => rule.type === 'rule')
      .map(rule => {
        const rulePos = rule.position;
        const start = rule.declarations.length
          ? first(rule.declarations).position.start
          : 0;
        const lines = cssTextLines.slice(
          rulePos.start.line - 1,
          rulePos.end.line
        );
        let cssText = '';

        if (lines.length === 0) {
          cssText = cssTextLines[start.line - 1];
        } else {
          const linesJoined = lines.join('\n');
          cssText = linesJoined.slice(
            linesJoined.indexOf('{') + 1,
            linesJoined.indexOf('}')
          );
        }

        const cssProperties = StyleSheet.getCssProperties(rule, cssTextLines);
        const range = cssProperties.length
          ? StyleSheet.getRange(
            rulePos.start.line,
            rulePos.end.line - 1,
            rulePos.start.column,
            rulePos.end.column - 2
          )
          : StyleSheet.getRange(0, 0, 0, 0);

        return {
          media: this.media,
          origin: this.origin,
          styleSheetId: this.styleSheetId,
          selectorList: {
            text: rule.selectors.join(', '),
            selectors: rule.selectors.map((selector, i) => ({
              text: selector,
              range: StyleSheet.getRange(
                rulePos.start.line + i - 1,
                rulePos.start.line + i - 1,
                0,
                selector.length
              ),
            })),
          },
          style: {
            cssProperties,
            cssText,
            range,
            shorthandEntries: [],
            styleSheetId: this.styleSheetId,
          },
        };
      });
  }

  getStyleSheetText() {
    /**
     * return style content if inline
     */
    if (this.ownerNode.nodeName.toLowerCase() === 'style') {
      return { text: this.styleSheet.ownerNode.textContent };
    }

    /**
     * generate stylesheet text based of css rules
     */
    return { text: this.cssText };
  }

  setStyleText(range, text) {
    this.cssText = this.cssText.replace(
      /{(.*)}/,
      '{' + filterDupName(text) + '}'
    );
    this.rules = this.cssText2rules(this.cssText);
    if (this.rules[0]) {
      this.ownerNode.setAttribute('style', this.rules[0].style.cssText);
      return this.rules[0].style;
    }
    return {
      origin: this.origin,
      styleSheetId: this.styleSheetId,
      cssProperties: [],
      shorthandEntries: [],
    };
  }

  static getCssProperties(rule, cssTextLines) {
    return rule.declarations.map(declaration => {
      if (declaration.type === 'comment') {
        const commentParts = declaration.comment.split(':');
        declaration.property = commentParts[0];
        declaration.value = commentParts[1];
      }
      const declarationPos = declaration.position;
      const declarationLine = cssTextLines[declarationPos.start.line - 1];
      const text = declarationLine.slice(
        declarationPos.start.column - 1,
        declarationPos.end.column - 1
      );

      return {
        disabled: declaration.type === 'comment',
        implicit: false,
        important: Boolean(text.match(/!important/)),
        name: declaration.property,
        range: StyleSheet.getRange(
          declarationPos.start.line - 1,
          declarationPos.end.line - 1,
          declarationPos.start.column - 1,
          declarationPos.start.column + text.length
        ),
        text,
        value: declaration.value,
      };
    });
  }

  static getRange(startLine = 0, endLine = 0, startColumn = 0, endColumn = 0) {
    return { startLine, endLine, endColumn, startColumn };
  }

  static sanitizeCssUnits(cssText) {
    return cssText.replace(
      /(\s|:|,)0(%|cm|em|ex|in|mm|pc|pt|px|vh|vw|vmin|vmax)/gi,
      '$10'
    );
  }
}
