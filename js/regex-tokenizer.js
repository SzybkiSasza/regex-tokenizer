define(function() {
  'use strict';

  var RegexTokenizer = function() {
    this.tokenizer = /\[\^?]?(?:[^\\\]]+|\\[\S\s]?)*]?|\\(?:0(?:[0-3][0-7]{0,2}|[4-7][0-7]?)?|[1-9][0-9]*|x[0-9A-Fa-f]{2}|u[0-9A-Fa-f]{4}|c[A-Za-z]|[\S\s]?)|\((?:\?[:=!]?)?|(?:[?*+]|\{[0-9]+(?:,[0-9]*)?\})\??|[^.?*+^${[()|\\]+|./g;
  };

  /**
   * Analyzes given regex expression and builds token object (regex tree) based on it
   * @param regex token to be analyzed
   * @returns {Array}
   */
  RegexTokenizer.prototype.analyzeRegex = function(regex) {

    var currentToken = new RegexToken();
    var groupToken = new RegexToken();

    var match;
    var m;

    var openGroups = [];
    var regexTokens = new RegexToken();

    // Remove base limiters from regexp
    regex = regex.toString().replace('/^', '').replace('$/', '');

    // The tokenizer regex does most of the tokenization grunt work
    while (!!(match = this.tokenizer.exec(regex))) {
      m = match[0];

      switch (m.charAt(0)) {

        case '(': // Group opening
          openGroups.push(new RegexToken(true));
          break;

        case ')': // Group closing
          groupToken = openGroups.pop();
          if (openGroups.length > 0) {
            openGroups[openGroups.length - 1].matches.push(groupToken);
          } else {
            currentToken.matches.push(groupToken);
          }
          break;

        case '{':
        case '+':
        case '*': //Quantifier
          m = m.replace(/[{}]/g, '');

          var quantifierToken = new RegexToken(false, true);
          var mq = m.split(',');
          var mq0 = isNaN(mq[0]) ? mq[0] : parseInt(mq[0]);
          var mq1 = mq.length === 1 ? mq0 : (isNaN(mq[1]) ? mq[1] : parseInt(mq[1]));

          quantifierToken.quantifier = {min: mq0, max: mq1};
          if (openGroups.length > 0) {
            var matches = openGroups[openGroups.length - 1].matches;
            match = matches.pop();
            if (!match.isGroup) {
              groupToken = new RegexToken(true);
              groupToken.matches.push(match);
              match = groupToken;
            }
            matches.push(match);
            matches.push(quantifierToken);
          } else {
            match = currentToken.matches.pop();
            if (!match.isGroup) {
              groupToken = new RegexToken(true);
              groupToken.matches.push(match);
              match = groupToken;
            }
            currentToken.matches.push(match);
            currentToken.matches.push(quantifierToken);
          }
          break;

        default:
          if (openGroups.length > 0) {
            openGroups[openGroups.length - 1].matches.push(m);
          } else {
            currentToken.matches.push(m);
          }
          break;
      }
    }

    if (currentToken.matches.length > 0) {
      regexTokens.matches.push(currentToken);
    }

    return regexTokens;
  };

  /**
   * Validates string against token object.
   * @param token Token object to validate string against
   * @param fromGroup Info whether provided token object is group object (internally used in general)
   * @param tokenValidator String or token validator object to be validated
   * @returns {boolean}
   */
  RegexTokenizer.prototype.validateRegexToken = function(token, fromGroup, tokenValidator) {

    var $ = require('jquery');

    if (!tokenValidator) {
      return false;
    }
    tokenValidator = new TokenValidator(tokenValidator);

    var isValid = false;

    if (fromGroup) {
      tokenValidator.regexPart += '(';
      tokenValidator.openGroupCount++;
    }

    for (var mndx = 0; mndx < token.matches.length; mndx++) {
      var matchToken = token.matches[mndx];

      if (matchToken.isGroup === true) {
        isValid = this.validateRegexToken(matchToken, true, tokenValidator);
      } else if (matchToken.isQuantifier === true) {
        var crrntndx = $.inArray(matchToken, token.matches);
        var matchGroup = token.matches[crrntndx - 1];
        var regexPartBak = tokenValidator.regexPart;

        if (isNaN(matchToken.quantifier.max)) {
          while (matchToken.repeaterPart && matchToken.repeaterPart !== tokenValidator.regexPart && matchToken.repeaterPart.length > tokenValidator.regexPart.length) {
            isValid = this.validateRegexToken(matchGroup, true, tokenValidator);
            if (isValid) {
              break;
            }
          }
          isValid = isValid || this.validateRegexToken(matchGroup, true, tokenValidator);
          if (isValid) {
            matchToken.repeaterPart = tokenValidator.regexPart;
          }
          tokenValidator.regexPart = regexPartBak + matchToken.quantifier.max;
        } else {
          for (var i = 0, qm = matchToken.quantifier.max - 1; i < qm; i++) {
            isValid = this.validateRegexToken(matchGroup, true, tokenValidator);
            if (isValid) {
              break;
            }
          }
          tokenValidator.regexPart = regexPartBak + '{' + matchToken.quantifier.min + ',' + matchToken.quantifier.max + '}';
        }
      } else if (matchToken.matches !== undefined) { // Path for recurrency
        isValid = this.validateRegexToken(matchToken, fromGroup, tokenValidator);
        if (isValid) {
          break;
        }
      } else {
        var testExp;
        var exp;
        var j;

        if (matchToken.charAt(0) === '[') {
          testExp = tokenValidator.regexPart;
          testExp += matchToken;
          for (j = 0; j < tokenValidator.openGroupCount; j++) {
            testExp += ')';
          }
          exp = new RegExp('^(' + testExp + ')$');
          isValid = exp.test(tokenValidator.bufferStr);
        } else {
          for (var l = 0, tl = matchToken.length; l < tl; l++) {
            if (matchToken.charAt(l) === '\\') {
              continue;
            }
            testExp = tokenValidator.regexPart;
            testExp += matchToken.substr(0, l + 1);
            testExp = testExp.replace(/\|$/, '');

            for (j = 0; j < tokenValidator.openGroupCount; j++) {
              testExp += ')';
            }
            exp = new RegExp('^(' + testExp + ')$');
            isValid = exp.test(tokenValidator.bufferStr);

            if (isValid) {
              break;
            }
          }
        }
        tokenValidator.regexPart += matchToken;
      }
      if (isValid) {
        break;
      }
    }

    if (fromGroup) {
      tokenValidator.regexPart += ')';
      tokenValidator.openGroupCount--;
    }

    return isValid;
  };

  /**
   * Regex token constructor
   * @param isGroup
   * @param isQuantifier
   * @returns {{matches: Array, isGroup: (*|boolean), isQuantifier: (*|boolean), quantifier: {min: number, max: number}, repeaterPart: undefined}}
   * @constructor
   */
  var RegexToken = function(isGroup, isQuantifier) {
    return {
      matches: [],
      isGroup: isGroup || false,
      isQuantifier: isQuantifier || false,
      quantifier: {min: 1, max: 1},
      repeaterPart: undefined
    };
  };

  /**
   * Token validator constructor. Builds token validator if provided with string, passes object otherwise
   * @param bufferStr
   * @param isValid
   * @param regexPart
   * @param openGroupCount
   * @returns {*}
   * @constructor
   */
  var TokenValidator = function(bufferStr, isValid, regexPart, openGroupCount) {
    if (typeof bufferStr === 'string') {
      return {
        bufferStr: bufferStr,
        regexPart: regexPart ? regexPart : '',
        openGroupCount: openGroupCount ? openGroupCount : 0
      };
    } else {
      return bufferStr;
    }
  };

  return new RegexTokenizer();
});
